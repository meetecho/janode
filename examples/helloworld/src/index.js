'use strict';

import Janode from '../../../src/janode.js';
import config from './config.js';
const { janode: janodeConfig } = config;

import { fileURLToPath } from 'url';
import { dirname, basename } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Logger } = Janode;
const LOG_NS = `[${basename(__filename)}]`;

const closeAfterSecs = 120;

(async function startConnection() {

  let connection = null;
  let endTask;

  try {
    // Janode is a connection factory with Promise API
    connection = await Janode.connect(janodeConfig, 'janus_1_api');

    Logger.info(`${LOG_NS} ***** CONNECTION CREATED *****`);

    // close connection after X seconds
    Logger.info(`${LOG_NS} auto-destroying janus connection in ${closeAfterSecs} seconds`);
    endTask = setTimeout(() => connection.close().catch(() => { }).then(() => Logger.info(`${LOG_NS} janus connection CLOSED`)), closeAfterSecs * 1000);

    // connection closing (Sessions -> WS closed -> connection closed)
    connection.on(Janode.EVENT.CONNECTION_CLOSED, () => {
      Logger.info(`${LOG_NS} ***** CONNECTION CLOSED *****`);
      clearTimeout(endTask);
    });

    // connection error event (i.e. WS error, unexpected WS close)
    connection.on(Janode.EVENT.CONNECTION_ERROR, ({ message }) => {
      Logger.error(`${LOG_NS} xxxxx CONNECTION ERROR xxxxx (${message})`);
      clearTimeout(endTask);
    });

    // Connection API: Janus GET INFO
    const info = await connection.getInfo();
    Logger.info(`${LOG_NS} ***** GET INFO REQ OK ***** server = ${info.name} ${info.version_string}`);

    // Connection API: Janus CREATE SESSION
    const session = await connection.create(10);

    Logger.info(`${LOG_NS} ***** SESSION CREATED *****`);

    session.on(Janode.EVENT.SESSION_DESTROYED, () => Logger.info(`${LOG_NS} ***** SESSION DESTROYED *****`));

    /* Session API: Janus ATTACH PLUGIN */
    /* returns the raw plugin handle */
    const handle = await session.attach({ id: 'janus.plugin.echotest' });

    Logger.info(`${LOG_NS} ***** HANDLE ATTACHED *****`);

    // generic handle events
    handle.on(Janode.EVENT.HANDLE_WEBRTCUP, () => Logger.info(`${LOG_NS} ***** HANDLE WEBRTCUP *****`));
    handle.on(Janode.EVENT.HANDLE_MEDIA, data => Logger.info(`${LOG_NS} ***** HANDLE MEDIA ***** ${JSON.stringify(data)}`));
    handle.on(Janode.EVENT.HANDLE_HANGUP, data => Logger.info(`${LOG_NS} ***** HANDLE HANGUP ***** ${JSON.stringify(data)}`));
    handle.on(Janode.EVENT.HANDLE_DETACHED, () => Logger.info(`${LOG_NS} ***** HANDLE DETACHED *****`));
    handle.on(Janode.EVENT.HANDLE_TRICKLE, evtdata => Logger.info(`${LOG_NS} ${handle.name} ***** HANDLE TRICKLE ***** ${JSON.stringify(evtdata)}`));

  } catch ({ message }) {
    Logger.error(`${LOG_NS} xxxxx JANODE SETUP ERROR xxxxx (${message})`);
    if (connection) connection.close().catch(() => { });
    clearTimeout(endTask);
  }

})();

(async function startAdmin() {

  let admin = null;
  let task, endTask = null;

  try {
    admin = await Janode.connect(janodeConfig, 'janus_1_admin');

    Logger.info(`${LOG_NS} ***** ADMIN CONNECTION CREATED *****`);

    // connection closing (Sessions -> WS closed -> connection closed)
    admin.on(Janode.EVENT.CONNECTION_CLOSED, () => {
      Logger.info(`${LOG_NS} ***** ADMIN CONNECTION CLOSED *****`);
      clearInterval(task);
      clearTimeout(endTask);
    });

    // connection error event (i.e. WS error, unexpected WS close)
    admin.on(Janode.EVENT.CONNECTION_ERROR, ({ message }) => {
      Logger.error(`${LOG_NS} xxxxx ADMIN CONNECTION ERROR xxxxx (${message})`);
      clearInterval(task);
      clearTimeout(endTask);
    });

    task = setInterval(async () => {
      try {
        const sList = await admin.listSessions();
        Logger.info(`${LOG_NS} ***** ADMIN LIST SESSIONS ***** ${JSON.stringify(sList)}`);
        if (Array.isArray(sList.sessions) && sList.sessions.length > 0) {
          const hList = await admin.listHandles(sList.sessions[0]);
          Logger.info(`${LOG_NS} ***** ADMIN LIST HANDLES ***** ${JSON.stringify(hList)}`);
        }
      } catch (error) {
        Logger.error(`${LOG_NS} ***** LIST SESSIONS/HANDLES ERROR ***** ${error.message}`);
      }
    }, 5 * 1000);

    // close connection after X seconds
    Logger.info(`${LOG_NS} auto-destroying admin connection in ${closeAfterSecs} seconds`);
    endTask = setTimeout(() => {
      admin.close().catch(() => { }).then(() => Logger.info(`${LOG_NS} admin connection CLOSED`));
      clearInterval(task);
      clearTimeout(endTask);
    }, closeAfterSecs * 1000);

    // Connection API: Janus GET INFO
    const info = await admin.getInfo();
    Logger.info(`${LOG_NS} ***** GET INFO REQ OK ***** server = ${info.name} ${info.version_string}`);

  } catch ({ message }) {
    Logger.info(`${LOG_NS} xxxxx JANODE ADMIN STUP ERROR xxxxx ${message}`);
    if (admin) admin.close().catch(() => { });
    clearInterval(task);
    clearTimeout(endTask);
  }

})();
