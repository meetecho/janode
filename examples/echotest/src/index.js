'use strict';

import { readFileSync } from 'fs';
import Janode from '../../../src/janode.js';
import config from './config.js';
const { janode: janodeConfig, web: serverConfig } = config;

import { fileURLToPath } from 'url';
import { dirname, basename } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Logger } = Janode;
const LOG_NS = `[${basename(__filename)}]`;
import EchoTestPlugin from '../../../src/plugins/echotest-plugin.js';

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

    connection.once(Janode.EVENT.CONNECTION_CLOSED, () => {
      Logger.info(`${LOG_NS} connection with Janus closed`);
    });

    connection.once(Janode.EVENT.CONNECTION_ERROR, ({ message }) => {
      Logger.info(`${LOG_NS} connection with Janus error (${message})`);

      replyError(io, 'backend-failure');

      scheduleBackEndConnection();
    });

    const session = await connection.create();
    Logger.info(`${LOG_NS} session with Janus established`);
    janodeSession = session;

    session.once(Janode.EVENT.SESSION_DESTROYED, () => {
      Logger.info(`${LOG_NS} session destroyed`);
    });
  }
  catch (error) {
    Logger.error(`${LOG_NS} Janode setup error (${error.message})`);
    if (connection) connection.close().catch(() => { });

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

    let echoHandle;

    // start request from client
    socket.on('start', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} start received`);
      const { _id, data: startdata = {} } = evtdata;

      if (!checkSessions(janodeSession, true, socket, evtdata)) return;

      if (echoHandle) {
        Logger.verbose(`${LOG_NS} ${remote} detaching previous handle`);
        await echoHandle.detach().catch(() => { });
      }

      try {
        echoHandle = await janodeSession.attach(EchoTestPlugin);
        Logger.info(`${LOG_NS} ${remote} echotest handle ${echoHandle.id} attached`);

        // custom echoHandle events
        echoHandle.on(EchoTestPlugin.EVENT.ECHOTEST_RESULT, evtdata => {
          Logger.info(`${LOG_NS} ${echoHandle.name} echotest handle result event: ${JSON.stringify(evtdata)}`);
          replyEvent(socket, 'result', evtdata.result);
          Logger.info(`${LOG_NS} ${remote} result event sent`);
        });

        // generic echoHandle events
        echoHandle.on(Janode.EVENT.HANDLE_WEBRTCUP, () => Logger.info(`${LOG_NS} ${echoHandle.name} webrtcup event`));
        echoHandle.on(Janode.EVENT.HANDLE_MEDIA, evtdata => Logger.info(`${LOG_NS} ${echoHandle.name} media event ${JSON.stringify(evtdata)}`));
        echoHandle.on(Janode.EVENT.HANDLE_SLOWLINK, evtdata => Logger.info(`${LOG_NS} ${echoHandle.name} slowlink event ${JSON.stringify(evtdata)}`));
        echoHandle.on(Janode.EVENT.HANDLE_HANGUP, evtdata => Logger.info(`${LOG_NS} ${echoHandle.name} hangup event ${JSON.stringify(evtdata)}`));
        echoHandle.on(Janode.EVENT.HANDLE_DETACHED, () => Logger.info(`${LOG_NS} ${echoHandle.name} detached event`));
        echoHandle.on(Janode.EVENT.HANDLE_TRICKLE, evtdata => Logger.info(`${LOG_NS} ${echoHandle.name} trickle event ${JSON.stringify(evtdata)}`));

        replyEvent(socket, 'ready', {}, _id);

        Logger.info(`${LOG_NS} ${remote} ready sent`);
      } catch ({ message }) {
        replyError(socket, message, startdata, _id);
      }

    });

    // echo offer from the client
    socket.on('offer', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} offer received`);
      const { _id, data: offerdata = {} } = evtdata;

      if (!checkSessions(janodeSession, echoHandle, socket, evtdata)) return;

      try {
        const { audio, video, jsep: offer, bitrate, record, filename } = offerdata;
        const { jsep } = await echoHandle.start({
          audio,
          video,
          jsep: offer,
          bitrate,
          record,
          filename
        });
        replyEvent(socket, 'answer', { jsep }, _id);
        Logger.info(`${LOG_NS} ${remote} answer sent`);
      } catch ({ message }) {
        replyError(socket, message, offerdata, _id);
      }
    });

    // trickle candidate from the client
    socket.on('trickle', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} trickle received`);
      const { _id, data: trickledata = {} } = evtdata;

      if (!checkSessions(janodeSession, echoHandle, socket, evtdata)) return;

      echoHandle.trickle(trickledata.candidate).catch(({ message }) => replyError(socket, message, trickledata, _id));
    });

    // trickle complete signal from the client
    socket.on('trickle-complete', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} trickle-complete received`);
      const { _id, data: trickledata = {} } = evtdata;

      if (!checkSessions(janodeSession, echoHandle, socket, evtdata)) return;

      echoHandle.trickleComplete().catch(({ message }) => replyError(socket, message, trickledata, _id));
    });

    // socket disconnection event
    socket.on('disconnect', () => {
      Logger.info(`${LOG_NS} ${remote} disconnected socket`);
      //request echoHandle detach
      if (echoHandle) echoHandle.detach().catch(() => { });
    });
  });

  // disable etag and view caching for all app
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

  socket.emit('echo-error', evtdata);
}