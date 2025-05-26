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
import SipPlugin from '../../../src/plugins/sip-plugin.js';

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

    let sipHandle;

    // start request from client
    socket.on('register', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} register received`);
      const { _id, data: regdata = {} } = evtdata;

      if (!checkSessions(janodeSession, true, socket, evtdata)) return;

      try {
        sipHandle = await janodeSession.attach(SipPlugin);
        Logger.info(`${LOG_NS} ${remote} sip handle ${sipHandle.id} attached`);

        // custom sipHandle events
        sipHandle.on(SipPlugin.EVENT.SIP_REGISTERING, evtdata => {
          Logger.info(`${LOG_NS} ${sipHandle.name} sip handle registering`);
          replyEvent(socket, 'registering', evtdata);
        });
        sipHandle.on(SipPlugin.EVENT.SIP_CALLING, evtdata => {
          Logger.info(`${LOG_NS} ${sipHandle.name} sip handle calling`);
          replyEvent(socket, 'calling', evtdata);
        });
        sipHandle.on(SipPlugin.EVENT.SIP_RINGING, evtdata => {
          Logger.info(`${LOG_NS} ${sipHandle.name} sip handle ringing`);
          replyEvent(socket, 'ringing', evtdata);
        });
        sipHandle.on(SipPlugin.EVENT.SIP_PROCEEDING, evtdata => {
          Logger.info(`${LOG_NS} ${sipHandle.name} sip handle proceeding`);
          replyEvent(socket, 'proceeding', evtdata);
        });
        sipHandle.on(SipPlugin.EVENT.SIP_INCOMING, evtdata => {
          Logger.info(`${LOG_NS} ${sipHandle.name} sip handle incoming call`);
          replyEvent(socket, 'incoming', evtdata);
        });
        sipHandle.on(SipPlugin.EVENT.SIP_HANGUP, evtdata => {
          Logger.info(`${LOG_NS} ${sipHandle.name} sip handle hangup`);
          replyEvent(socket, 'hangup', evtdata);
        });
        sipHandle.on(SipPlugin.EVENT.SIP_MISSED, evtdata => {
          Logger.info(`${LOG_NS} ${sipHandle.name} sip handle missed`);
          replyEvent(socket, 'missed', evtdata);
        });
        sipHandle.on(SipPlugin.EVENT.SIP_INFO, evtdata => {
          Logger.info(`${LOG_NS} ${sipHandle.name} sip handle info`);
          replyEvent(socket, 'info', evtdata);
        });
        sipHandle.on(SipPlugin.EVENT.SIP_DTMF, evtdata => {
          Logger.info(`${LOG_NS} ${sipHandle.name} sip handle dtmf`);
          replyEvent(socket, 'dtmf', evtdata);
        });

        // generic sipHandle events
        sipHandle.on(Janode.EVENT.HANDLE_WEBRTCUP, () => Logger.info(`${LOG_NS} ${sipHandle.name} webrtcup event`));
        sipHandle.on(Janode.EVENT.HANDLE_MEDIA, evtdata => Logger.info(`${LOG_NS} ${sipHandle.name} media event ${JSON.stringify(evtdata)}`));
        sipHandle.on(Janode.EVENT.HANDLE_SLOWLINK, evtdata => Logger.info(`${LOG_NS} ${sipHandle.name} slowlink event ${JSON.stringify(evtdata)}`));
        sipHandle.on(Janode.EVENT.HANDLE_HANGUP, evtdata => Logger.info(`${LOG_NS} ${sipHandle.name} hangup event ${JSON.stringify(evtdata)}`));
        sipHandle.on(Janode.EVENT.HANDLE_DETACHED, () => Logger.info(`${LOG_NS} ${sipHandle.name} detached event`));
        sipHandle.on(Janode.EVENT.HANDLE_TRICKLE, evtdata => Logger.info(`${LOG_NS} ${sipHandle.name} trickle event ${JSON.stringify(evtdata)}`));

        const response = await sipHandle.register(regdata);
        replyEvent(socket, 'registered', response, _id);

        Logger.info(`${LOG_NS} ${remote} registered sent`);
      } catch ({ message }) {
        Logger.error(`${LOG_NS} ${remote} error registering (${message})`);
        replyError(socket, message, regdata, _id);
      }

    });

    // start call
    socket.on('call', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} call received`);
      const { _id, data: calldata = {} } = evtdata;

      if (!checkSessions(janodeSession, sipHandle, socket, evtdata)) return;

      try {
        const { uri, jsep: offer } = calldata;
        const response = await sipHandle.call({
          uri,
          jsep: offer,
        });
        replyEvent(socket, 'accepted', response, _id);
        Logger.info(`${LOG_NS} ${remote} accepted sent`);
      } catch ({ message }) {
        Logger.error(`${LOG_NS} ${remote} error calling (${message})`);
        replyError(socket, message, calldata, _id);
      }
    });

    // answer call
    socket.on('accept', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} accept received`);
      const { _id, data: acceptdata = {} } = evtdata;

      if (!checkSessions(janodeSession, sipHandle, socket, evtdata)) return;

      try {
        const { jsep: answer } = acceptdata;
        const response = await sipHandle.accept({
          jsep: answer,
        });
        replyEvent(socket, 'accepted', response, _id);
        Logger.info(`${LOG_NS} ${remote} accepted sent`);
      } catch ({ message }) {
        Logger.error(`${LOG_NS} ${remote} error accepting (${message})`);
        replyError(socket, message, acceptdata, _id);
      }
    });

    socket.on('hangup', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} hangup received`);
      const { _id, data: hangupdata = {} } = evtdata;

      if (!checkSessions(janodeSession, sipHandle, socket, evtdata)) return;

      try {
        await sipHandle.sip_hangup();
        replyEvent(socket, 'hangup', {}, _id);
        Logger.info(`${LOG_NS} ${remote} hangup sent`);
      } catch ({ message }) {
        Logger.error(`${LOG_NS} ${remote} error hanging up (${message})`);
        replyError(socket, message, hangupdata, _id);
      }
    });

    socket.on('decline', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} decline received`);
      const { _id, data: declinedata = {} } = evtdata;

      if (!checkSessions(janodeSession, sipHandle, socket, evtdata)) return;

      try {
        await sipHandle.decline();
        replyEvent(socket, 'declined', {}, _id);
        Logger.info(`${LOG_NS} ${remote} declined sent`);
      } catch ({ message }) {
        Logger.error(`${LOG_NS} ${remote} error declining (${message})`);
        replyError(socket, message, declinedata, _id);
      }
    });

    // trickle candidate from the client
    socket.on('trickle', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} trickle received`);
      const { _id, data: trickledata = {} } = evtdata;

      if (!checkSessions(janodeSession, sipHandle, socket, evtdata)) return;

      sipHandle.trickle(trickledata.candidate).catch(({ message }) => replyError(socket, message, trickledata, _id));
    });

    // trickle complete signal from the client
    socket.on('trickle-complete', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} trickle-complete received`);
      const { _id, data: trickledata = {} } = evtdata;

      if (!checkSessions(janodeSession, sipHandle, socket, evtdata)) return;

      sipHandle.trickleComplete().catch(({ message }) => replyError(socket, message, trickledata, _id));
    });

    // socket disconnection event
    socket.on('disconnect', () => {
      Logger.info(`${LOG_NS} ${remote} disconnected socket`);
      //request sipHandle detach
      if (sipHandle) sipHandle.detach().catch(() => { });
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

  socket.emit('sip-error', evtdata);
}