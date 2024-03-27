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
import VideoRoomPlugin from '../../../src/plugins/videoroom-plugin.js';

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

    connection.once(Janode.EVENT.CONNECTION_CLOSED, () => {
      Logger.info(`${LOG_NS} connection with Janus closed`);
    });

    connection.once(Janode.EVENT.CONNECTION_ERROR, error => {
      Logger.error(`${LOG_NS} connection with Janus error: ${error.message}`);

      replyError(io, 'backend-failure');

      scheduleBackEndConnection();
    });

    const session = await connection.create();
    Logger.info(`${LOG_NS} session ${session.id} with Janus created`);
    janodeSession = session;

    session.once(Janode.EVENT.SESSION_DESTROYED, () => {
      Logger.info(`${LOG_NS} session ${session.id} destroyed`);
      janodeSession = null;
    });

    const handle = await session.attach(VideoRoomPlugin);
    Logger.info(`${LOG_NS} manager handle ${handle.id} attached`);
    janodeManagerHandle = handle;

    // generic handle events
    handle.once(Janode.EVENT.HANDLE_DETACHED, () => {
      Logger.info(`${LOG_NS} ${handle.name} manager handle detached event`);
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

    const msHandles = (function () {
      const handles = {
        pub: null,
        sub: null,
      };

      return {
        setPubHandle: handle => {
          handles.pub = handle;
        },
        setSubHandle: handle => {
          handles.sub = handle;
        },
        getPubHandle: _ => {
          return handles.pub;
        },
        getSubHandle: _ => {
          return handles.sub;
        },
        getHandleByFeed: feed => {
          if (feed && handles.pub && feed === handles.pub.feed) return handles.pub;
          if (!feed && handles.sub) return handles.sub;
          return null;
        },
        detachPubHandle: async _ => {
          if (handles.pub)
            await handles.pub.detach().catch(() => { });
          handles.pub = null;
        },
        detachSubHandle: async _ => {
          if (handles.sub)
            await handles.sub.detach().catch(() => { });
          handles.sub = null;
        },
        detachAll: async _ => {
          const detaches = Object.values(handles).map(h => h && h.detach().catch(() => { }));
          await Promise.all(detaches);
          handles.pub = null;
          handles.sub = null;
        },
      };
    })();

    /*----------*/
    /* USER API */
    /*----------*/

    socket.on('join', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} join received`);
      const { _id, data: joindata = {} } = evtdata;

      if (!checkSessions(janodeSession, true, socket, evtdata)) return;

      let pubHandle;

      try {
        pubHandle = await janodeSession.attach(VideoRoomPlugin);
        Logger.info(`${LOG_NS} ${remote} videoroom publisher handle ${pubHandle.id} attached`);
        msHandles.setPubHandle(pubHandle);

        // custom videoroom publisher/manager events

        pubHandle.on(VideoRoomPlugin.EVENT.VIDEOROOM_DESTROYED, evtdata => {
          replyEvent(socket, 'destroyed', evtdata);
        });

        pubHandle.on(VideoRoomPlugin.EVENT.VIDEOROOM_PUB_LIST, evtdata => {
          replyEvent(socket, 'feed-list', evtdata);
        });

        pubHandle.on(VideoRoomPlugin.EVENT.VIDEOROOM_PUB_PEER_JOINED, evtdata => {
          replyEvent(socket, 'feed-joined', evtdata);
        });

        pubHandle.on(VideoRoomPlugin.EVENT.VIDEOROOM_UNPUBLISHED, evtdata => {
          replyEvent(socket, 'unpublished', evtdata);
        });

        pubHandle.on(VideoRoomPlugin.EVENT.VIDEOROOM_LEAVING, async evtdata => {
          if (pubHandle.feed === evtdata.feed) {
            await msHandles.detachPubHandle();
          }
          replyEvent(socket, 'leaving', evtdata);
        });

        pubHandle.on(VideoRoomPlugin.EVENT.VIDEOROOM_DISPLAY, evtdata => {
          replyEvent(socket, 'display', evtdata);
        });

        pubHandle.on(VideoRoomPlugin.EVENT.VIDEOROOM_TALKING, evtdata => {
          replyEvent(socket, 'talking', evtdata);
        });

        pubHandle.on(VideoRoomPlugin.EVENT.VIDEOROOM_KICKED, async evtdata => {
          replyEvent(socket, 'kicked', evtdata);
        });

        // generic videoroom events
        pubHandle.on(Janode.EVENT.HANDLE_WEBRTCUP, () => Logger.info(`${LOG_NS} ${pubHandle.name} webrtcup event`));
        pubHandle.on(Janode.EVENT.HANDLE_MEDIA, evtdata => Logger.info(`${LOG_NS} ${pubHandle.name} media event ${JSON.stringify(evtdata)}`));
        pubHandle.on(Janode.EVENT.HANDLE_SLOWLINK, evtdata => Logger.info(`${LOG_NS} ${pubHandle.name} slowlink event ${JSON.stringify(evtdata)}`));
        pubHandle.on(Janode.EVENT.HANDLE_HANGUP, evtdata => Logger.info(`${LOG_NS} ${pubHandle.name} hangup event ${JSON.stringify(evtdata)}`));
        pubHandle.on(Janode.EVENT.HANDLE_DETACHED, () => {
          Logger.info(`${LOG_NS} ${pubHandle.name} detached event`);
          msHandles.setPubHandle(null);
        });
        pubHandle.on(Janode.EVENT.HANDLE_TRICKLE, evtdata => Logger.info(`${LOG_NS} ${pubHandle.name} trickle event ${JSON.stringify(evtdata)}`));

        const response = await pubHandle.joinPublisher(joindata);

        replyEvent(socket, 'joined', response, _id);

        Logger.info(`${LOG_NS} ${remote} joined sent`);
      } catch ({ message }) {
        if (pubHandle) pubHandle.detach().catch(() => { });
        replyError(socket, message, joindata, _id);
      }
    });

    socket.on('subscribe', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} subscribe received`);
      const { _id, data: subscribedata = {} } = evtdata;

      if (!checkSessions(janodeSession, true, socket, evtdata)) return;

      let subHandle = msHandles.getSubHandle();
      let response;

      try {
        if (!subHandle) {
          subHandle = await janodeSession.attach(VideoRoomPlugin);
          Logger.info(`${LOG_NS} ${remote} videoroom listener handle ${subHandle.id} attached`);
          msHandles.setSubHandle(subHandle);
          // generic videoroom events
          subHandle.on(Janode.EVENT.HANDLE_WEBRTCUP, () => Logger.info(`${LOG_NS} ${subHandle.name} webrtcup event`));
          subHandle.on(Janode.EVENT.HANDLE_SLOWLINK, evtdata => Logger.info(`${LOG_NS} ${subHandle.name} slowlink event ${JSON.stringify(evtdata)}`));
          subHandle.on(Janode.EVENT.HANDLE_HANGUP, evtdata => Logger.info(`${LOG_NS} ${subHandle.name} hangup event ${JSON.stringify(evtdata)}`));
          subHandle.once(Janode.EVENT.HANDLE_DETACHED, () => {
            Logger.info(`${LOG_NS} ${subHandle.name} detached event`);
            msHandles.setSubHandle(null);
          });
          subHandle.on(Janode.EVENT.HANDLE_TRICKLE, evtdata => Logger.info(`${LOG_NS} ${subHandle.name} trickle event ${JSON.stringify(evtdata)}`));

          // specific videoroom events
          subHandle.on(VideoRoomPlugin.EVENT.VIDEOROOM_UPDATED, evtdata => {
            Logger.info(`${LOG_NS} ${subHandle.name} updated event`);
            replyEvent(socket, 'updated', evtdata);
          });
          response = await subHandle.joinSubscriber(subscribedata);
        }
        else {
          response = await subHandle.update({
            subscribe: subscribedata.streams,
          });
        }

        replyEvent(socket, 'subscribed', response, _id);
        Logger.info(`${LOG_NS} ${remote} subscribed sent`);
      } catch ({ message }) {
        replyError(socket, message, subscribedata, _id);
      }
    });

    socket.on('unsubscribe', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} unsubscribe received`);
      const { _id, data: unsubscribedata = {} } = evtdata;

      let subHandle = msHandles.getSubHandle();
      if (!checkSessions(janodeSession, subHandle, socket, evtdata)) return;
      let response;

      try {
        response = await subHandle.update({
          unsubscribe: unsubscribedata.streams,
        });

        replyEvent(socket, 'unsubscribed', response, _id);
        Logger.info(`${LOG_NS} ${remote} unsubscribed sent`);
      } catch ({ message }) {
        replyError(socket, message, unsubscribedata, _id);
      }
    });

    socket.on('configure', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} configure received`);
      const { _id, data: confdata = {} } = evtdata;

      const handle = msHandles.getHandleByFeed(confdata.feed);
      if (!checkSessions(janodeSession, handle, socket, evtdata)) return;

      try {
        const response = await handle.configure(confdata);
        delete response.configured;
        replyEvent(socket, 'configured', response, _id);
        Logger.info(`${LOG_NS} ${remote} configured sent`);
      } catch ({ message }) {
        replyError(socket, message, confdata, _id);
      }
    });

    socket.on('unpublish', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} unpublish received`);
      const { _id, data: unpubdata = {} } = evtdata;

      const handle = msHandles.getPubHandle();
      if (!checkSessions(janodeSession, handle, socket, evtdata)) return;

      try {
        const response = await handle.unpublish();
        replyEvent(socket, 'unpublished', response, _id);
        Logger.info(`${LOG_NS} ${remote} unpublished sent`);
      } catch ({ message }) {
        replyError(socket, message, unpubdata, _id);
      }
    });

    socket.on('leave', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} leave received`);
      const { _id, data: leavedata = {} } = evtdata;

      const handle = msHandles.getHandleByFeed(leavedata.feed);
      if (!checkSessions(janodeSession, handle, socket, evtdata)) return;

      try {
        const response = await handle.leave();
        replyEvent(socket, 'leaving', response, _id);
        Logger.info(`${LOG_NS} ${remote} leaving sent`);
        handle.detach().catch(() => { });
      } catch ({ message }) {
        replyError(socket, message, leavedata, _id);
      }
    });

    socket.on('start', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} start received`);
      const { _id, data: startdata = {} } = evtdata;

      const handle = msHandles.getSubHandle();
      if (!checkSessions(janodeSession, handle, socket, evtdata)) return;

      try {
        const response = await handle.start(startdata);
        replyEvent(socket, 'started', response, _id);
        Logger.info(`${LOG_NS} ${remote} started sent`);
      } catch ({ message }) {
        replyError(socket, message, startdata, _id);
      }
    });

    socket.on('pause', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} pause received`);
      const { _id, data: pausedata = {} } = evtdata;

      const handle = msHandles.getSubHandle();
      if (!checkSessions(janodeSession, handle, socket, evtdata)) return;

      try {
        const response = await handle.pause();
        replyEvent(socket, 'paused', response, _id);
        Logger.info(`${LOG_NS} ${remote} paused sent`);
      } catch ({ message }) {
        replyError(socket, message, pausedata, _id);
      }
    });

    socket.on('switch', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} switch received`);
      const { _id, data: switchdata = {} } = evtdata;

      const handle = msHandles.getSubHandle();
      if (!checkSessions(janodeSession, handle, socket, evtdata)) return;

      try {
        const response = await handle.switch(switchdata);
        replyEvent(socket, 'switched', response, _id);
        Logger.info(`${LOG_NS} ${remote} switched sent`);
      } catch ({ message }) {
        replyError(socket, message, switchdata, _id);
      }
    });

    // trickle candidate from the client
    socket.on('trickle', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} trickle received`);
      const { _id, data: trickledata = {} } = evtdata;

      const handle = msHandles.getHandleByFeed(trickledata.feed);
      if (!checkSessions(janodeSession, handle, socket, evtdata)) return;

      handle.trickle(trickledata.candidate).catch(({ message }) => replyError(socket, message, trickledata, _id));
    });

    // trickle complete signal from the client
    socket.on('trickle-complete', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} trickle-complete received`);
      const { _id, data: trickledata = {} } = evtdata;

      const handle = msHandles.getHandleByFeed(trickledata.feed);
      if (!checkSessions(janodeSession, handle, socket, evtdata)) return;

      handle.trickleComplete(trickledata.candidate).catch(({ message }) => replyError(socket, message, trickledata, _id));
    });

    // socket disconnection event
    socket.on('disconnect', async () => {
      Logger.info(`${LOG_NS} ${remote} disconnected socket`);

      await msHandles.detachAll();
    });


    /*----------------*/
    /* Management API */
    /*----------------*/


    socket.on('list-participants', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} list_participants received`);
      const { _id, data: listdata = {} } = evtdata;

      if (!checkSessions(janodeSession, janodeManagerHandle, socket, evtdata)) return;

      try {
        const response = await janodeManagerHandle.listParticipants(listdata);
        replyEvent(socket, 'participants-list', response, _id);
        Logger.info(`${LOG_NS} ${remote} participants-list sent`);
      } catch ({ message }) {
        replyError(socket, message, listdata, _id);
      }
    });

    socket.on('kick', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} kick received`);
      const { _id, data: kickdata = {} } = evtdata;

      if (!checkSessions(janodeSession, janodeManagerHandle, socket, evtdata)) return;

      try {
        const response = await janodeManagerHandle.kick(kickdata);
        replyEvent(socket, 'kicked', response, _id);
        Logger.info(`${LOG_NS} ${remote} kicked sent`);
      } catch ({ message }) {
        replyError(socket, message, kickdata, _id);
      }
    });

    socket.on('exists', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} exists received`);
      const { _id, data: existsdata = {} } = evtdata;

      if (!checkSessions(janodeSession, janodeManagerHandle, socket, evtdata)) return;

      try {
        const response = await janodeManagerHandle.exists(existsdata);
        replyEvent(socket, 'exists', response, _id);
        Logger.info(`${LOG_NS} ${remote} exists sent`);
      } catch ({ message }) {
        replyError(socket, message, existsdata, _id);
      }
    });

    socket.on('list-rooms', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} list-rooms received`);
      const { _id, data: listdata = {} } = evtdata;

      if (!checkSessions(janodeSession, janodeManagerHandle, socket, evtdata)) return;

      try {
        const response = await janodeManagerHandle.list();
        replyEvent(socket, 'rooms-list', response, _id);
        Logger.info(`${LOG_NS} ${remote} rooms-list sent`);
      } catch ({ message }) {
        replyError(socket, message, listdata, _id);
      }
    });

    socket.on('create', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} create received`);
      const { _id, data: createdata = {} } = evtdata;

      if (!checkSessions(janodeSession, janodeManagerHandle, socket, evtdata)) return;

      try {
        const response = await janodeManagerHandle.create(createdata);
        replyEvent(socket, 'created', response, _id);
        Logger.info(`${LOG_NS} ${remote} created sent`);
      } catch ({ message }) {
        replyError(socket, message, createdata, _id);
      }
    });

    socket.on('destroy', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} destroy received`);
      const { _id, data: destroydata = {} } = evtdata;

      if (!checkSessions(janodeSession, janodeManagerHandle, socket, evtdata)) return;

      try {
        const response = await janodeManagerHandle.destroy(destroydata);
        replyEvent(socket, 'destroyed', response, _id);
        Logger.info(`${LOG_NS} ${remote} destroyed sent`);
      } catch ({ message }) {
        replyError(socket, message, destroydata, _id);
      }
    });

    socket.on('allow', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} allow received`);
      const { _id, data: allowdata = {} } = evtdata;

      if (!checkSessions(janodeSession, janodeManagerHandle, socket, evtdata)) return;

      try {
        const response = await janodeManagerHandle.allow(allowdata);
        replyEvent(socket, 'allowed', response, _id);
        Logger.info(`${LOG_NS} ${remote} allowed sent`);
      } catch ({ message }) {
        replyError(socket, message, allowdata, _id);
      }
    });

    socket.on('rtp-fwd-start', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} rtp-fwd-start received`);
      const { _id, data: rtpstartdata = {} } = evtdata;

      if (!checkSessions(janodeSession, janodeManagerHandle, socket, evtdata)) return;

      try {
        const response = await janodeManagerHandle.startForward(rtpstartdata);
        replyEvent(socket, 'rtp-fwd-started', response, _id);
        Logger.info(`${LOG_NS} ${remote} rtp-fwd-started sent`);
      } catch ({ message }) {
        replyError(socket, message, rtpstartdata, _id);
      }
    });

    socket.on('rtp-fwd-stop', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} rtp-fwd-stop received`);
      const { _id, data: rtpstopdata = {} } = evtdata;

      if (!checkSessions(janodeSession, janodeManagerHandle, socket, evtdata)) return;

      try {
        const response = await janodeManagerHandle.stopForward(rtpstopdata);
        replyEvent(socket, 'rtp-fwd-stopped', response, _id);
        Logger.info(`${LOG_NS} ${remote} rtp-fwd-stopped sent`);
      } catch ({ message }) {
        replyError(socket, message, rtpstopdata, _id);
      }
    });

    socket.on('rtp-fwd-list', async (evtdata = {}) => {
      Logger.info(`${LOG_NS} ${remote} rtp_fwd_list received`);
      const { _id, data: rtplistdata = {} } = evtdata;

      if (!checkSessions(janodeSession, janodeManagerHandle, socket, evtdata)) return;

      try {
        const response = await janodeManagerHandle.listForward(rtplistdata);
        replyEvent(socket, 'rtp-fwd-list', response, _id);
        Logger.info(`${LOG_NS} ${remote} rtp-fwd-list sent`);
      } catch ({ message }) {
        replyError(socket, message, rtplistdata, _id);
      }
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

  socket.emit('videoroom-error', evtdata);
}
