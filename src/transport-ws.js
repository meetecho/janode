'use strict';

/**
 * This module contains the WebSocket transport implementation.
 * @module transport-ws
 * @access private
 */

/* Isomorphic implementation of WebSocket */
/* It uses ws on Node and global.WebSocket in browsers */
import WebSocket from 'isomorphic-ws';

import Logger from './utils/logger.js';
const LOG_NS = '[transport-ws.js]';
import { delayOp } from './utils/utils.js';

/* Janus API ws subprotocol */
const API_WS = 'janus-protocol';
/* Janus Admin API ws subprotocol */
const ADMIN_WS = 'janus-admin-protocol';

/* Default ws ping interval */
const PING_TIME_SECS = 10;
/* Default pong wait timeout */
const PING_TIME_WAIT_SECS = 5;

/**
 * Class representing a connection through WebSocket transport.<br>
 *
 * In case of failure a connection will be retried according to the configuration (time interval and
 * times to attempt). At every attempt, if multiple addresses are available for Janus, the next address
 * will be tried. An error will be raised only if the maxmimum number of attempts have been reached.<br>
 *
 * Internally uses WebSockets API to establish a connection with Janus and uses ws ping/pong as keepalives.<br>
 *
 * @private
 */
class TransportWs {
  /**
   * Create a connection through WebSocket.
   *
   * @param {module:connection~Connection} connection - The parent Janode connection
   */
  constructor(connection) {
    /**
     * The parent  Janode connection.
     *
     * @type {module:connection~Connection}
     */
    this._connection = connection;

    /**
     * The internal WebSocket connection.
     *
     * @type {WebSocket}
     */
    this._ws = null;

    /**
     * Internal counter for connection attempts.
     *
     * @type {number}
     */
    this._attempts = 0;

    /**
     * A boolean flag indicating that the connection is being opened.
     *
     * @type {boolean}
     */
    this._opening = false;

    /**
     * A boolean flag indicating that the connection has been opened.
     *
     * @type {boolean}
     */
    this._opened = false;

    /**
     * A boolean flag indicating that the connection is being closed.
     *
     * @type {boolean}
     */
    this._closing = false;

    /**
     * A boolean flag indicating that the connection has been closed.
     *
     * @type {boolean}
     */
    this._closed = false; // true if websocket has been closed after being opened

    /**
     * The task of the peridic ws ping.
     *
     * @type {*}
     */
    this._ping_task = null;

    /**
     * A numerical identifier assigned for logging purposes.
     *
     * @type {number}
     */
    this.id = connection.id;

    /**
     * A more descriptive, not unique string (used for logging).
     *
     * @type {string}
     */
    this.name = `[${this.id}]`;
  }

  /**
   * Initialize the internal WebSocket.
   * Wraps with a promise the standard WebSocket API opening.
   *
   * @returns {Promise<module:connection~Connection>}
   */
  async _initWebSocket() {
    Logger.info(`${LOG_NS} ${this.name} trying connection with ${this._connection._address_iterator.currElem().url}`);

    return new Promise((resolve, reject) => {
      const wsOptions = this._connection._config.wsOptions() || { };
      if (!wsOptions.handshakeTimeout) wsOptions.handshakeTimeout = 5000;

      const ws = new WebSocket(
        this._connection._address_iterator.currElem().url,
        [this._connection._config.isAdmin() ? ADMIN_WS : API_WS],
        wsOptions);

      /* Register an "open" listener */
      ws.addEventListener('open', _ => {
        Logger.info(`${LOG_NS} ${this.name} websocket connected`);
        /* Set the ping/pong task */
        this._setPingTask(PING_TIME_SECS * 1000);
        /* Resolve the promise and return this connection */
        resolve(this);
      }, { once: true });

      /* Register a "close" listener */
      ws.addEventListener('close', ({ code, reason, wasClean }) => {
        Logger.info(`${LOG_NS} ${this.name} websocket closed code=${code} reason=${reason} clean=${wasClean}`);
        /* Start cleanup */
        /* Cancel the KA task */
        this._unsetPingTask();
        this._connection._signalClose(this._closing);
        this._closing = false;
        this._closed = true;
        /* removeAllListeners is only supported on the node ws module */
        if (typeof this._ws.removeAllListeners === 'function') this._ws.removeAllListeners();
      }, { once: true });

      /* Register an "error" listener */
      /*
       * The "error" event is fired when a ws connection has been closed due
       * to an error (some data couldn't be sent for example)
       */
      ws.addEventListener('error', error => {
        Logger.error(`${LOG_NS} ${this.name} websocket error (${error.message})`);
        reject(error);
      }, { once: true });

      /* Register a "message" listener */
      ws.addEventListener('message', ({ data }) => {
        Logger.debug(`${LOG_NS} ${this.name} <ws RCV OK> ${data}`);
        this._connection._handleMessage(JSON.parse(data));
      });

      this._ws = ws;
    });
  }

  /**
   * Internal helper to open a websocket connection.
   * In case of error retry the connection with another address from the available pool.
   * If maximum number of attempts is reached, throws an error.
   *
   * @returns {WebSocket} The websocket connection
   */
  async _attemptOpen() {
    /* Reset status at every attempt, opening should be true at this step */
    this._opened = false;
    this._closing = false;
    this._closed = false;

    try {
      const conn = await this._initWebSocket();
      this._opening = false;
      this._opened = true;
      return conn;
    }
    catch (error) {
      /* In case of error notifies the user, but try with another address */
      this._attempts++;
      /* Get the max number of attempts from the configuration */
      if (this._attempts >= this._connection._config.getMaxRetries()) {
        this._opening = false;
        const err = new Error('attempt limit exceeded');
        Logger.error(`${LOG_NS} ${this.name} connection failed, ${err.message}`);
        throw error;
      }
      Logger.error(`${LOG_NS} ${this.name} connection failed, will try again in ${this._connection._config.getRetryTimeSeconds()} seconds...`);
      /* Wait an amount of seconds specified in the configuration */
      await delayOp(this._connection._config.getRetryTimeSeconds() * 1000);
      /* Make shift the circular iterator */
      this._connection._address_iterator.nextElem();
      return this._attemptOpen();
    }
  }

  /**
   * Open a transport connection. This is called from parent connection.
   *
   * @returns {Promise<module:connection~Connection>} A promise resolving with the Janode connection
   */
  async open() {
    /* Check the flags before attempting a connection */
    let error;
    if (this._opening) error = new Error('unable to open, websocket is already being opened');
    else if (this._opened) error = new Error('unable to open, websocket has already been opened');
    else if (this._closed) error = new Error('unable to open, websocket has already been closed');

    if (error) {
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }

    /* Set the starting status */
    this._opening = true;
    this._attempts = 0;

    /* Use internal helper */
    return this._attemptOpen();
  }

  /**
   * Send a ws ping frame.
   * This API is only available when the library is not used in a browser.
   *
   * @returns {Promise<void>}
   */
  async _ping() {
    /* ws.ping is only supported on the node "ws" module */
    if (typeof this._ws.ping !== 'function') {
      Logger.warn('ws ping not supported');
      return;
    }
    let timeout;

    /* Set a promise that will reject in PING_TIME_WAIT_SECS seconds */
    const timeout_ping = new Promise((_, reject) => {
      timeout = setTimeout(_ => reject(new Error('timeout')), PING_TIME_WAIT_SECS * 1000);
    });

    /* Set a promise that will resolve once "pong" has been received */
    const ping_op = new Promise((resolve, reject) => {
      /* Send current timestamp in the ping */
      const ping_data = '' + Date.now();

      this._ws.ping(ping_data, error => {
        if (error) {
          Logger.error(`${LOG_NS} ${this.name} websocket PING send error (${error.message})`);
          clearTimeout(timeout);
          return reject(error);
        }
        Logger.verbose(`${LOG_NS} ${this.name} websocket PING sent (${ping_data})`);
      });

      /* Resolve on pong */
      this._ws.once('pong', data => {
        Logger.verbose(`${LOG_NS} ${this.name} websocket PONG received (${data.toString()})`);
        clearTimeout(timeout);
        return resolve();
      });

    });

    /* Race between timeout and pong */
    return Promise.race([ping_op, timeout_ping]);
  }

  /**
   * Set a ws ping-pong task.
   *
   * @param {number} delay - The ping interval in milliseconds
   * @returns {void}
   */
  _setPingTask(delay) {
    /* ws "ping" is only supported on the node ws module */
    if (typeof this._ws.ping !== 'function') {
      Logger.warn('ws ping not supported');
      return;
    }
    if (this._ping_task) return;

    /* Set a periodic task to send a ping */
    /* In case of error, terminate the ws */
    this._ping_task = setInterval(async _ => {
      try {
        await this._ping();
      } catch ({ message }) {
        Logger.error(`${LOG_NS} ${this.name} websocket PING error (${message})`);
        /* ws "terminate" is only supported on the node ws module */
        this._ws.terminate();
      }
    }, delay);

    Logger.info(`${LOG_NS} ${this.name} websocket ping task scheduled every ${PING_TIME_SECS} seconds`);
  }

  /**
   * Remove the ws ping task.
   *
   * @returns {void}
   */
  _unsetPingTask() {
    if (!this._ping_task) return;
    clearInterval(this._ping_task);
    this._ping_task = null;
    Logger.info(`${LOG_NS} ${this.name} websocket ping task disabled`);
  }

  /**
   * Get the remote Janus hostname.
   * It is called from the parent connection.
   *
   * @returns {string} The hostname of the Janus server
   */
  getRemoteHostname() {
    if (this._ws && this._ws.url) {
      return (new URL(this._ws.url)).hostname;
    }
    return null;
  }

  /**
   * Gracefully close the connection.
   * Wraps with a promise the standard WebSocket API "close".
   * It is called from the parent connection.
   *
   * @returns {Promise<void>}
   */
  async close() {
    /* Check the status flags before */
    let error;
    if (!this._opened) error = new Error('unable to close, websocket has never been opened');
    else if (this._closing) error = new Error('unable to close, websocket is already being closed');
    else if (this._closed) error = new Error('unable to close, websocket has already been closed');

    if (error) {
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }

    this._closing = true;

    return new Promise((resolve, reject) => {
      Logger.info(`${LOG_NS} ${this.name} closing websocket`);
      try {
        this._ws.close();
        /* Add a listener to resolve the promise */
        this._ws.addEventListener('close', resolve, { once: true });
      } catch (e) {
        Logger.error(`${LOG_NS} ${this.name} error while closing websocket (${e.message})`);
        this._closing = false;
        reject(e);
        return;
      }
    });
  }

  /**
   * Send a request from this connection.
   * Wraps with a promise the standard WebSocket API "send".
   * It is called from the parent connection.
   *
   * @param {object} request - The request to be sent
   * @returns {Promise<object>} A promise resolving with a response from Janus
   */
  async send(request) {
    /* Check connection status */
    let error;
    if (!this._opened) error = new Error('unable to send request because connection has not been opened');
    else if (this._closed) error = new Error('unable to send request because connection has been closed');

    if (error) {
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }

    /* Stringify the message */
    const string_req = JSON.stringify(request);

    return new Promise((resolve, reject) => {
      this._ws.send(string_req, { compress: false, binary: false }, error => {
        if (error) {
          Logger.error(`${LOG_NS} ${this.name} websocket send error (${error.message})`);
          reject(error);
          return;
        }
        Logger.debug(`${LOG_NS} ${this.name} <ws SND OK> ${string_req}`);
        resolve();
      });
    });
  }

}

export default TransportWs;
