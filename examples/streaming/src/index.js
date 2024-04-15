'use strict';

import { readFileSync } from 'fs';
import { join } from 'path';
import Janode from '../../../src/janode.js';
import config from './config.js';
const { janode: janodeConfig, web: serverConfig, streaming: streamingConfig } = config;

import { fileURLToPath } from 'url';
import { dirname, basename } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Logger } = Janode;
const LOG_NS = `[${basename(__filename)}]`;
import StreamingPlugin from '../../../src/plugins/streaming-plugin.js';

import express from 'express';
const app = express();
const options = {
  key: serverConfig.key ? readFileSync(serverConfig.key) : null,
  cert: serverConfig.cert ? readFileSync(serverConfig.cert) : null,
};
import { createServer as createHttpsServer } from 'https';
import { createServer as createHttpServer } from 'http';
const httpServer = (options.key && options.cert) ? createHttpsServer(options, app) : createHttpServer(app);
import { Server } from 'socket.io';
const io = new Server(httpServer);

const scheduleBackEndConnection = (function () {
  let task = null;

  return (function (del = 10) {
    if (task) return;
    Logger.info(`${LOG_NS} scheduled connection in ${del} seconds`);
    task = setTimeout(() => {
      initBackEnd()
        .then(() => task = null)
        .catch(() => {
          task = null;
          scheduleBackEndConnection();
        });
    }, del * 1000);
  });
})();

let janodeSession;
let janodeManagerHandle;

(function main() {

  initFrontEnd().catch(({ message }) => Logger.error(`${LOG_NS} failure initializing front-end: ${message}`));

  scheduleBackEndConnection(1);

})();

async function initBackEnd() {
  Logger.info(`${LOG_NS} connecting Janode...`);
  let connection;

  try {
    connection = await Janode.connect(janodeConfig);
    Logger.info(`${LOG_NS} connection with Janus created`);

    connection.on(Janode.EVENT.CONNECTION_CLOSED, () => {
      Logger.info(`${LOG_NS} connection with Janus closed`);
    });

    connection.on(Janode.EVENT.CONNECTION_ERROR, ({ message }) => {
      Logger.info(`${LOG_NS} connection with Janus error (${message})`);

      // notify clients
      replyError(io, 'backend-failure');

      // schedule reconnection
      scheduleBackEndConnection();
    });

    const session = await connection.create();
    janodeSession = session;
    Logger.info(`${LOG_NS} session established`);

    session.once(Janode.EVENT.SESSION_DESTROYED, () => {
      Logger.info(`${LOG_NS} session destryed`);
    });

    const managerStreamingHandle = await session.attach(StreamingPlugin);
    Logger.info(`${LOG_NS} manager handle attached`);
    janodeManagerHandle = managerStreamingHandle;

    // generic handle events
    managerStreamingHandle.once(Janode.EVENT.HANDLE_DETACHED, () => {
      Logger.info(`${LOG_NS} manager handle detached`);
    });
  }
  catch (error) {
    Logger.error(`${LOG_NS} Janode setup error: ${error.message}`);
    if (connection) connection.close().catch(() => { });

    // notify clients
    replyError(io, 'backend-failure');

    throw error;
  }
}

function initFrontEnd() {
  if (httpServer.listening) return Promise.reject(new Error('Server already listening'));

  Logger.info(`${LOG_NS} initializing socketio front end...`);

  io.on('connection', function (socket) {
    const remote = `[${socket.request.connection.remoteAddress}:${socket.request.connection.remotePort}]`;
    Logger.info(`${LOG_NS} ${remote} connection with client established`);

    let streamingHandle;

    // select stream to watch
    socket.on('watch', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} watch received`);
      const { _id, data: watchdata = {} } = evtdata;

      if (!checkSessions(janodeSession, true, socket, evtdata)) return;

      try {
        if (!streamingHandle) {
          streamingHandle = await janodeSession.attach(StreamingPlugin);
          Logger.info(`${LOG_NS} ${remote} streaming handle ${streamingHandle.id} attached`);
        }
        else if (!watchdata.restart) {
          Logger.verbose(`${LOG_NS} ${remote} detaching previous handle`);
          await streamingHandle.detach().catch(() => { });
          streamingHandle = await janodeSession.attach(StreamingPlugin);
          Logger.info(`${LOG_NS} ${remote} streaming handle ${streamingHandle.id} attached`);
        }
        else {
          Logger.info(`${LOG_NS} ${remote} user requested a watch restart`);
        }

        // custom streaming handle events
        streamingHandle.on(StreamingPlugin.EVENT.STREAMING_STATUS, evtdata => {
          Logger.info(`${LOG_NS} ${streamingHandle.name} streaming handle event status ${JSON.stringify(evtdata)}`);
          replyEvent(socket, evtdata.status, { id: evtdata.id });
        });

        // generic handle events
        streamingHandle.on(Janode.EVENT.HANDLE_WEBRTCUP, () => Logger.info(`${LOG_NS} ${streamingHandle.name} webrtcup event`));
        streamingHandle.on(Janode.EVENT.HANDLE_SLOWLINK, evtdata => Logger.info(`${LOG_NS} ${streamingHandle.name} slowlink event ${JSON.stringify(evtdata)}`));
        streamingHandle.on(Janode.EVENT.HANDLE_HANGUP, evtdata => Logger.info(`${LOG_NS} ${streamingHandle.name} hangup event ${JSON.stringify(evtdata)}`));
        streamingHandle.once(Janode.EVENT.HANDLE_DETACHED, () => {
          Logger.info(`${LOG_NS} ${streamingHandle.name} detached event`);
        });
        streamingHandle.on(Janode.EVENT.HANDLE_TRICKLE, evtdata => Logger.info(`${LOG_NS} ${streamingHandle.name} trickle event ${JSON.stringify(evtdata)}`));


        const { jsep, restart = false } = await streamingHandle.watch(watchdata);
        replyEvent(socket, 'offer', { jsep, restart }, _id);
        Logger.info(`${LOG_NS} ${remote} offer sent`);
      } catch ({ message }) {
        Logger.error(`${LOG_NS} ${remote} error requesting streaming watch: ${message}`);
        if (streamingHandle) streamingHandle.detach().catch(() => { });
        replyError(socket, message, watchdata, _id);
      }
    });

    // start request with optional jsep answer from the client
    socket.on('start', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} start received`);
      const { _id, data: startdata = {} } = evtdata;

      if (!checkSessions(janodeSession, streamingHandle, socket, evtdata)) return;

      try {
        const { status, id } = await streamingHandle.start(startdata);
        replyEvent(socket, status, { id }, _id);
        Logger.info(`${LOG_NS} ${remote} start response sent`);
      } catch ({ message }) {
        Logger.error(`${LOG_NS} ${remote} error starting streaming: ${message}`);
        replyError(socket, message, startdata, _id);
      }
    });

    // trickle candidate from the client
    socket.on('trickle', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} trickle received`);
      const { _id, data: trickledata = {} } = evtdata;

      if (!checkSessions(janodeSession, streamingHandle, socket, evtdata)) return;

      streamingHandle.trickle(trickledata.candidate).catch(({ message }) => replyError(socket, message, trickledata, _id));
    });

    // trickle complete signal from the client
    socket.on('trickle-complete', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} trickle-complete received`);
      const { _id, data: trickledata = {} } = evtdata;

      if (!checkSessions(janodeSession, streamingHandle, socket, evtdata)) return;

      streamingHandle.trickleComplete().catch(({ message }) => replyError(socket, message, trickledata, _id));
    });

    // pause request from the client
    socket.on('pause', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} pause received`);
      const { _id, data: pausedata = {} } = evtdata;

      if (!checkSessions(janodeSession, streamingHandle, socket, evtdata)) return;

      try {
        const { status, id } = await streamingHandle.pause();
        replyEvent(socket, status, { id }, _id);
        Logger.info(`${LOG_NS} ${remote} pause response sent`);
      } catch ({ message }) {
        Logger.error(`${LOG_NS} ${remote} error pausing streaming: ${message}`);
        replyError(socket, message, pausedata, _id);
      }
    });

    // stop watching request from the client
    socket.on('stop', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} stop received`);
      const { _id, data: stopdata = {} } = evtdata;

      if (!checkSessions(janodeSession, streamingHandle, socket, evtdata)) return;

      try {
        const { status, id } = await streamingHandle.stop();
        replyEvent(socket, status, { id }, _id);
        Logger.info(`${LOG_NS} ${remote} stop response sent`);
      } catch ({ message }) {
        Logger.error(`${LOG_NS} ${remote} error stopping streaming: ${message}`);
        replyError(socket, message, stopdata, _id);
      }
    });

    // configure active stream
    socket.on('configure', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} configure received`);
      const { _id, data: confdata = {} } = evtdata;

      if (!checkSessions(janodeSession, streamingHandle, socket, evtdata)) return;

      try {
        await streamingHandle.configure(confdata);
        replyEvent(socket, 'configured', confdata, _id);
        Logger.info(`${LOG_NS} ${remote} configure response sent`);
      } catch ({ message }) {
        Logger.error(`${LOG_NS} ${remote} error configuring streaming: ${message}`);
        replyError(socket, message, confdata, _id);
      }
    });

    socket.on('info', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} info received`);
      const { _id, data: infodata = {} } = evtdata;

      if (!checkSessions(janodeSession, janodeManagerHandle, socket, evtdata)) return;

      try {
        const info = await janodeManagerHandle.info(infodata);
        replyEvent(socket, 'info', info, _id);
        Logger.info(`${LOG_NS} ${remote} info response sent`);
      } catch ({ message }) {
        Logger.error(`${LOG_NS} ${remote} error info streaming: ${message}`);
        replyError(socket, message, infodata, _id);
      }
    });

    socket.on('list', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} list received`);
      const { _id, data: listdata = {} } = evtdata;

      if (!checkSessions(janodeSession, janodeManagerHandle, socket, evtdata)) return;

      try {
        const list = await janodeManagerHandle.list();
        replyEvent(socket, 'list', list, _id);
        Logger.info(`${LOG_NS} ${remote} list response sent`);
      } catch ({ message }) {
        Logger.error(`${LOG_NS} ${remote} error listing streaming: ${message}`);
        replyError(socket, message, listdata, _id);
      }
    });

    // start recording request from the client
    socket.on('start-rec', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} start-rec received`);
      const { _id, data: recdata = {} } = evtdata;

      if (!checkSessions(janodeSession, janodeManagerHandle, socket, evtdata)) return;

      const now = (new Date().getTime());
      const filePath = (streamingConfig && streamingConfig.recording_path) ? streamingConfig.recording_path : '';
      recdata.audio = join(filePath, now + '-audio');
      recdata.video = join(filePath, now + '-video');
      recdata.data = join(filePath, now + '-data');

      try {
        await janodeManagerHandle.startRecording(recdata);
        replyEvent(socket, 'rec-started', { id: recdata.id }, _id);
        Logger.info(`${LOG_NS} ${remote} start-rec response sent`);
      } catch ({ message }) {
        Logger.error(`${LOG_NS} ${remote} error starting rec streaming: ${message}`);
        replyError(socket, message, recdata, _id);
      }
    });

    // stop recording request from the client
    socket.on('stop-rec', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} stop-rec received`);
      const { _id, data: recdata = {} } = evtdata;

      if (!checkSessions(janodeSession, janodeManagerHandle, socket, evtdata)) return;

      recdata.audio = true;
      recdata.video = true;
      recdata.data = true;

      try {
        await janodeManagerHandle.stopRecording(recdata);
        replyEvent(socket, 'rec-stopped', { id: recdata.id }, _id);
        Logger.info(`${LOG_NS} ${remote} stop-rec response sent`);
      } catch ({ message }) {
        Logger.error(`${LOG_NS} ${remote} error stopping rec streaming: ${message}`);
        replyError(socket, message, recdata, _id);
      }
    });

    // enable mountpoint
    socket.on('enable', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} enable received`);
      const { _id, data: enabledata = {} } = evtdata;

      if (!checkSessions(janodeSession, janodeManagerHandle, socket, evtdata)) return;

      try {
        await janodeManagerHandle.enable(enabledata);
        replyEvent(socket, 'enabled', { id: enabledata.id }, _id);
        Logger.info(`${LOG_NS} ${remote} enabled response sent`);
      } catch ({ message }) {
        Logger.error(`${LOG_NS} ${remote} error enabling streaming: ${message}`);
        replyError(socket, message, enabledata, _id);
      }
    });

    // disable mountpoint
    socket.on('disable', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} disable received`);
      const { _id, data: disabledata = {} } = evtdata;

      if (!checkSessions(janodeSession, janodeManagerHandle, socket, evtdata)) return;

      try {
        await janodeManagerHandle.disable(disabledata);
        replyEvent(socket, 'disabled', { id: disabledata.id }, _id);
        Logger.info(`${LOG_NS} ${remote} disabled response sent`);
      } catch ({ message }) {
        Logger.error(`${LOG_NS} ${remote} error disabling streaming: ${message}`);
        replyError(socket, message, disabledata, _id);
      }
    });

    // create mountpoint
    socket.on('create', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} create mp received`);
      const { _id, data: mpdata = {} } = evtdata;

      if (!checkSessions(janodeSession, janodeManagerHandle, socket, evtdata)) return;

      try {
        const created = await janodeManagerHandle.createRtpMountpoint(mpdata);
        replyEvent(socket, 'created', created, _id);
        Logger.info(`${LOG_NS} ${remote} created mp response sent`);
      } catch ({ message }) {
        Logger.error(`${LOG_NS} ${remote} error creating streaming: ${message}`);
        replyError(socket, message, mpdata, _id);
      }
    });

    // create mountpoint
    socket.on('destroy', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} destroy mp received`);
      const { _id, data: mpdata = {} } = evtdata;

      if (!checkSessions(janodeSession, janodeManagerHandle, socket, evtdata)) return;

      try {
        const destroyed = await janodeManagerHandle.destroyMountpoint(mpdata);
        replyEvent(socket, 'destroyed', destroyed, _id);
        Logger.info(`${LOG_NS} ${remote} destroyed mp response sent`);
      } catch ({ message }) {
        Logger.error(`${LOG_NS} ${remote} error destroying streaming: ${message}`);
        replyError(socket, message, mpdata, _id);
      }
    });

    // socket disconnection event
    socket.on('disconnect', () => {
      Logger.info(`${LOG_NS} ${remote} disconnected socket`);
      if (streamingHandle) streamingHandle.detach().catch(() => { });
    });
  });

  // disable caching for all app
  app.set('etag', false).set('view cache', false);

  // static content
  app.use('/janode', express.static(__dirname + '/../html/', {
    etag: false,
    lastModified: false,
    maxAge: 0,
  }));

  // http server binding
  return new Promise((resolve, reject) => {
    // web server binding
    httpServer.listen(
      serverConfig.port,
      serverConfig.bind,
      () => {
        Logger.info(`${LOG_NS} server listening on ${(options.key && options.cert) ? 'https' : 'http'}://${serverConfig.bind}:${serverConfig.port}/janode`);
        resolve();
      }
    );

    httpServer.on('error', e => reject(e));
  });
}

function checkSessions(session, handle, socket, { data, _id }) {
  if (!session) {
    replyError(socket, 'session-not-available', data, _id);
    return false;
  }
  if (!handle) {
    replyError(socket, 'handle-not-available', data, _id);
    return false;
  }
  return true;
}

function replyEvent(socket, evtname, data, _id) {
  const evtdata = {
    data,
  };
  if (_id) evtdata._id = _id;

  socket.emit(evtname, evtdata);
}

function replyError(socket, message, request, _id) {
  const evtdata = {
    error: message,
  };
  if (request) evtdata.request = request;
  if (_id) evtdata._id = _id;

  socket.emit('streaming-error', evtdata);
}