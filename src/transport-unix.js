'use strict';

/**
 * This module contains the Unix Sockets transport implementation.
 * @module transport-unix
 * @access private
 */

import { Buffer } from 'buffer';
import { unlinkSync } from 'fs';

/* External dependency with Unix dgram sockets implementation */
import { createSocket } from 'unix-dgram';

import Logger from './utils/logger.js';
const LOG_NS = '[transport-unix.js]';
import { delayOp } from './utils/utils.js';

/**
 * Class representing a connection through Unix dgram sockets transport.<br>
 *
 * In case of failure a connection will be retried according to the configuration (time interval and
 * times to attempt). At every attempt, if multiple addresses are available for Janus, the next address
 * will be tried. An error will be raised only if the maxmimum number of attempts have been reached.<br>
 *
 * @private
 */
class TransportUnix {
  /**
   * Create a connection through Unix dgram socket.
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
     * The internal Unix Socket.
     *
     * @type {module:unix-dgram~Socket}
     */
    this._socket = null;

    /**
     * The local file to bind the socket to.
     */
    this._local_bind = `/tmp/.janode-${connection.id}`;

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
    this._closed = false; // true if socket has been closed after being opened

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
   * Initialize the internal socket.
   *
   * @returns {Promise<module:connection~Connection>}
   */
  async _initUnixSocket() {
    Logger.info(`${LOG_NS} ${this.name} trying connection with ${this._connection._address_iterator.currElem().url}`);

    return new Promise((resolve, reject) => {
      let socket;

      let connected = false;
      let bound = false;

      try {
        socket = createSocket('unix_dgram');
      } catch (error) {
        Logger.error(`${LOG_NS} ${this.name} unix socket create error (${error.message})`);
        reject(error);
        return;
      }

      socket.on('error', error => {
        Logger.error(`${LOG_NS} ${this.name} unix socket error (${error.message})`);
        if (error.errno < 0) {
          this._close();
        }
        reject(error);
      });

      socket.on('connect', _ => {
        Logger.info(`${LOG_NS} ${this.name} unix socket connected`);
        connected = true;
        if (bound && connected) resolve(this);
      });

      socket.on('listening', _ => {
        Logger.info(`${LOG_NS} ${this.name} unix socket bound`);
        /* Resolve the promise and return this connection */
        bound = true;
        socket.connect(this._connection._address_iterator.currElem().url.split('file://')[1]);
        if (bound && connected) resolve(this);
      });

      socket.on('message', buf => {
        const data = buf.toString();
        Logger.debug(`${LOG_NS} ${this.name} <unix RCV OK> ${data}`);
        this._connection._handleMessage(JSON.parse(data));
      });

      socket.on('writable', _ => {
        Logger.warn(`${LOG_NS} ${this.name} unix socket writable notification`);
      });

      socket.on('congestion', _buf => {
        Logger.warn(`${LOG_NS} ${this.name} unix socket congestion notification`);
      });

      this._socket = socket;

      try { unlinkSync(this._local_bind); } catch (error) { }
      socket.bind(this._local_bind);
    });
  }

  /**
   * Internal helper to open a unix socket connection.
   * In case of error retry the connection with another address from the available pool.
   * If maximum number of attempts is reached, throws an error.
   *
   * @returns {module:unix-dgram~Socket} The unix socket
   */
  async _attemptOpen() {
    /* Reset status at every attempt */
    this._opened = false;
    this._closing = false;
    this._closed = false;

    try {
      const conn = await this._initUnixSocket();
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
        Logger.error(`${LOG_NS} ${this.name} socket connection failed, ${err.message}`);
        throw error;
      }
      Logger.error(`${LOG_NS} ${this.name} socket connection failed, will try again in ${this._connection._config.getRetryTimeSeconds()} seconds...`);
      /* Wait an amount of seconds specified in the configuration */
      await delayOp(this._connection._config.getRetryTimeSeconds() * 1000);
      /* Make shift the circular iterator */
      this._connection._address_iterator.nextElem();
      return this._attemptOpen();
    }
  }

  _close() {
    if (!this._socket) return;
    Logger.info(`${LOG_NS} ${this.name} closing unix transport`);
    try {
      this._socket.close();
    } catch (error) {
      Logger.error(`${LOG_NS} ${this.name} error while closing unix socket (${error.message})`);
    }

    try {
      unlinkSync(this._local_bind);
    } catch (error) {
      Logger.error(`${LOG_NS} ${this.name} error while unlinking fd (${error.message})`);
    }
    /* removeAllListeners is only supported on the node ws module */
    if (typeof this._socket.removeAllListeners === 'function') this._socket.removeAllListeners();
    this._socket = null;
    this._connection._signalClose(this._closing);
    this._closing = false;
    this._closed = true;
  }

  /**
   * Open a transport connection. This is called from parent connection.
   *
   * @returns {Promise<module:connection~Connection>} A promise resolving with the Janode connection
   */
  async open() {
    /* Check the flags before attempting a connection */
    let error;
    if (this._opening) error = new Error('unable to open, unix socket is already being opened');
    else if (this._opened) error = new Error('unable to open, unix socket has already been opened');
    else if (this._closed) error = new Error('unable to open, unix socket has already been closed');

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
   * Get the remote Janus hostname.
   * It is called from the parent connection.
   *
   * @returns {string} The hostname of the Janus server
   */
  getRemoteHostname() {
    if (this._opened) {
      return (this._connection._address_iterator.currElem().url.split('file://')[1]);
    }
    return null;
  }

  /**
   * Gracefully close the connection.
   * It is called from the parent connection.
   *
   * @returns {Promise<void>}
   */
  async close() {
    /* Check the status flags before */
    let error;
    if (!this._opened) error = new Error('unable to close, unix socket has never been opened');
    else if (this._closing) error = new Error('unable to close, unix socket is already being closed');
    else if (this._closed) error = new Error('unable to close, unix socket has already been closed');

    if (error) {
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }

    this._closing = true;

    return this._close();
  }

  /**
   * Send a request from this connection.
   * It is called from the parent connection.
   *
   * @param {object} request - The request to be sent
   * @returns {Promise<object>} A promise resolving with a response from Janus
   */
  async send(request) {
    /* Check connection status */
    let error;
    if (!this._opened) error = new Error('unable to send request because unix socket has not been opened');
    else if (this._closed) error = new Error('unable to send request because unix socket has been closed');

    if (error) {
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }

    /* Stringify the message */
    const string_req = JSON.stringify(request);
    const buf = Buffer.from(string_req, 'utf-8');

    return new Promise((resolve, reject) => {
      this._socket.send(buf, error => {
        if (error) {
          Logger.error(`${LOG_NS} ${this.name} unix socket send error (${error.message})`);
          if (error.errno < 0) {
            this._close();
          }
          reject(error);
          return;
        }
        Logger.debug(`${LOG_NS} ${this.name} <unix SND OK> ${string_req}`);
        resolve();
      });
    });
  }

}

export default TransportUnix;