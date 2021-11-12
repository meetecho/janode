'use strict';

/**
 * This module contains the Connection class definition.
 * @module connection
 * @private
 */

const { EventEmitter } = require('events');

/* Isomorphic implementation of WebSocket */
/* It uses ws on Node and global.WebSocket in browsers */
const WebSocket = require('isomorphic-ws');

const Logger = require('./utils/logger.js');
const LOG_NS = '[connection.js]';
const { getNumericID, checkUrl, newIterator, delayOp } = require('./utils/utils.js');
const { JANODE, JANUS, isResponseData, isErrorData } = require('./protocol.js');
const JanodeSession = require('./session.js');
const TransactionManager = require('./tmanager.js');

/* Default ws ping interval */
const PING_TIME_SECS = 10;
/* Default pong wait timeout */
const PING_TIME_WAIT_SECS = 5;

/**
 * Class representing a Janode connection.<br>
 *
 * Internally uses a WebSocket to establish a connection with Janus and uses ws ping/pong as keepalives.<br>
 *
 * In case of failure a connection will be retried according to the configuration (time interval and
 * times to attempt).At every attempt, if multiple addresses are available for Janus, the next address
 * will be tried. An error will be raised only if the maxmimum number of attempts have been reached.<br>
 *
 * This class implements also the Janus Admin API.<br>
 *
 * Connection extends EventEmitter, so an instance can emit events and users can subscribe to them.<br>
 *
 * Users are not expected to create Connection instances, but insted use the Janode.connect API.<br>
 *
 * @hideconstructor
 */
class Connection extends EventEmitter {
  /**
   * Create a Janode Connection.
   *
   * @param {Configuration} server_config - The Janode configuration as created by the Configuration constructor.
   */
  constructor(server_config) {
    super();

    /**
     * The internal WebSocket connection.
     *
     * @private
     * @type {WebSocket}
     */
    this._ws = null;

    /**
     * The transaction manager used by this connection.
     *
     * @private
     * @type {TransactionManager}
     */
    this._tm = null;

    /**
     * A boolean flag indicating that the connection is being opened.
     *
     * @private
     * @type {boolean}
     */
    this._opening = false;

    /**
     * A boolean flag indicating that the connection has been opened.
     *
     * @private
     * @type {boolean}
     */
    this._opened = false;

    /**
     * A boolean flag indicating that the connection is being closed.
     *
     * @private
     * @type {boolean}
     */
    this._closing = false;

    /**
     * A boolean flag indicating that the connection has been closed.
     *
     * @private
     * @type {boolean}
     */
    this._closed = false; // true if websocket has been closed after being opened

    /**
     * Keep track of the sessions.
     *
     * @private
     * @type {Map}
     */
    this._sessions = new Map();

    /**
     * The task of the peridic ws ping.
     *
     * @private
     */
    this._ping_task = null;

    /**
     * Internal counter for connection attempts.
     *
     * @private
     */
    this._attempts = 0;

    /**
     * The configuration in use for this connection.
     *
     * @private
     * @type {Configuration}
     */
    this._config = server_config;

    /**
     * The iterator to select available Janus addresses.
     *
     * @private
     * @type {CircularIterator}
     */
    this._address_iterator = newIterator(this._config.getAddress());

    /**
     * A numerical identifier assigned for logging purposes.
     *
     * @type {number}
     */
    this.id = parseInt(getNumericID());

    /**
     * A more descriptive, not unique string (used for logging).
     *
     * @type {string}
     */
    this.name = `[${this.id}]`;

    /* Set a dummy error listener to avoid unmanaged errors */
    this.on('error', e => `${LOG_NS} ${this.name} catched unmanaged error ${e.message}`);
  }

  /**
   * Cleanup the connection canceling the ping task, closing all owned transactions, emitting the destroyed event
   * and removing all registered listeners.
   *
   * @private
   * @param {boolean} graceful - True if this is an expected disconnection
   */
  _signalClose(graceful) {
    if (this._closed) return;
    this._closing = false;
    this._closed = true;

    /* Cancel the KA task */
    this._unsetPingTask();
    /* Close all pending transactions inside this connection with an error */
    this._tm.closeAllTransactionsWithError(null, this, new Error('connection closed'));
    /* Clear tx table */
    this._tm.clear();
    /* Clear session table */
    this._sessions.clear();

    /* Did we really mean to close it? */
    if (graceful) {
      /* This is a greceful teardown */
      /**
       * The connection has been closed.
       *
       * @event module:connection~Connection#event:CONNECTION_CLOSED
       * @type {object}
       * @property {number} id - The connection identifier
       */
      this.emit(JANODE.EVENT.CONNECTION_CLOSED, { id: this.id });
    }
    else if (this._opened) {
      /* If this event is unexpected emit an error */
      const error = new Error('unexpected disconnection');
      Logger.error(`${LOG_NS} ${this.name} oops... unexpected disconnection!`);
      /**
       * An error occurred on the connection.
       *
       * @event module:connection~Connection#event:CONNECTION_ERROR
       * @type {Error}
       */
      this.emit(JANODE.EVENT.CONNECTION_ERROR, error);
    }

    /* removeAllListeners is only supported on the node ws module */
    if (typeof this._ws.removeAllListeners === 'function') this._ws.removeAllListeners();
    /* Remove all listeners to avoid leaks */
    this.removeAllListeners();
  }

  /**
   * Initialize the internal WebSocket.
   * Wraps with a promise the standard WebSocket API opening.
   *
   * @private
   * @returns {Promise<Connection>}
   */
  async _initWebSocket() {
    Logger.info(`${LOG_NS} ${this.name} trying connection with ${this._address_iterator.currElem().url}`);

    /* Check URL protocols */
    if (!checkUrl(this._address_iterator.currElem().url, ['ws', 'wss'])) {
      const error = new Error('invalid url or protocol not allowed');
      Logger.error(`${LOG_NS} ${this.name} ${error.message} ${this._address_iterator.currElem().url}`);
      throw error;
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(
        this._address_iterator.currElem().url,
        [this._config.getSubProtocol()],
        { handshakeTimeout: 5000 });

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
        this._signalClose(this._closing);
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
        /* Catch any error to not break the message loop */
        try {
          this._handleMessage(JSON.parse(data));
        } catch (error) {
          Logger.error(`${LOG_NS} ${this.name} error while handling message (${error.message})`);
        }
      });

      this._ws = ws;
    });
  }

  /**
   * Internal helper to open a websocket connection.
   * In case of error retry the connection with another address from the available pool.
   * If maximum number of attempts is reached, throws an error.
   *
   * @private
   * @returns {WebSocket} The websocket connection
   */
  async _open_internal() {
    /* Reset status at every attempt */
    this._tm = new TransactionManager(this.id);
    this._opened = false;
    this._closing = false;
    this._closed = false;

    try {
      const ws = await this._initWebSocket();
      this._opening = false;
      this._opened = true;
      return ws;
    }
    catch (error) {
      /* In case of error notifies the user, but try with another address */
      Logger.error(`${LOG_NS} ${this.name} connection failed`);
      this._attempts++;
      /* Get the max number of attempts from the configuration */
      if (this._attempts >= this._config.getMaxRetries()) {
        this._opening = false;
        const err = new Error('attempt limit exceeded');
        Logger.error(`${LOG_NS} ${this.name} ${err.message}`);
        throw error;
      }
      Logger.info(`${LOG_NS} ${this.name} will try again in ${this._config.getRetryTimeSeconds()} seconds...`);
      /* Wait an amount of seconds specified in the configuration */
      await delayOp(this._config.getRetryTimeSeconds() * 1000);
      /* Make shift the circular iterator */
      this._address_iterator.nextElem();
      return this._open_internal();
    }
  }

  /**
   * Open a connection using the internal helper.
   * Users do not need to call this method, since the connection is opened by Janode.connect().
   *
   * @private
   * @returns {Promise<Connection>} A promise resolving with the Janode connection
   */
  async open() {
    /* Check the flags before attempting a connection */
    if (this._opening) {
      const error = new Error('unable to open, websocket is already being opened');
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }
    if (this._opened) {
      const error = new Error('unable to open, websocket has already been opened');
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }
    if (this._closed) {
      const error = new Error('unable to open, websocket has already been closed');
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }

    /* Set the status */
    this._opening = true;
    this._attempts = 0;

    /* Use _open_internal */
    return this._open_internal();
  }

  /**
   * Send a ws ping frame.
   * This API is only available when the library is not used in a browser.
   *
   * @private
   * @returns {Promise}
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
   * @private
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
   * @private
   * @returns {void}
   */
  _unsetPingTask() {
    if (!this._ping_task) return;
    clearInterval(this._ping_task);
    this._ping_task = null;
    Logger.info(`${LOG_NS} ${this.name} websocket ping task disabled`);
  }

  /**
   * Manage a message sent to this session.  If a session is involved let it manage the message.
   * If the message involves a owned transaction and the response is a definitive one,
   * the transaction will be closed.
   *
   * @private
   * @param {object} janus_message
   */
  _handleMessage(janus_message) {
    const { session_id, transaction, janus } = janus_message;

    /* Check if a session is involved */
    if (session_id) {
      /* Look for the session in the map */
      const session = this._sessions.get(session_id);
      /* If the handle is missing notifies the user */
      if (!session) {
        Logger.warn(`${LOG_NS} ${this.name} session ${session_id} not found for incoming message ${janus}`);
        return;
      }

      /* Let the session manage the message */
      session._handleMessage(janus_message);
      return;
    }

    /* Check if a transaction is involved */
    if (transaction) {
      Logger.verbose(`${LOG_NS} ${this.name} received ${janus} for transaction ${transaction}`);

      /* Not owned by this connection? */
      if (this._tm.getTransactionOwner(transaction) !== this) {
        Logger.warn(`${LOG_NS} ${this.name} transaction ${transaction} not found for incoming messsage ${janus}`);
        return;
      }

      /*
       * Pending connection transaction management.
       * Close transaction in case of:
       * 1) Definitive response
       */
      if (isResponseData(janus_message)) {
        if (isErrorData(janus_message)) {
          const error = new Error(`${janus_message.error.code} ${janus_message.error.reason}`);
          return this._tm.closeTransactionWithError(transaction, this, error);
        }

        this._tm.closeTransactionWithSuccess(transaction, this, janus_message);
      }

      return;
    }

    /* No session, no transaction? */
    Logger.error(`${LOG_NS} ${this.name} unexpected janus message directed to the connection ${JSON.stringify(janus_message)}`);
  }

  /**
   * Decorate request with apisecret, token and transaction (if missing).
   *
   * @private
   * @param {object} request
   */
  _decorateRequest(request) {
    request.transaction = request.transaction || getNumericID();
    if (this._address_iterator.currElem().apisecret) {
      if (!this._config.isAdmin())
        request.apisecret = request.apisecret || this._address_iterator.currElem().apisecret;
      else
        request.admin_secret = request.admin_secret || this._address_iterator.currElem().apisecret;
    }
    if (this._address_iterator.currElem().token)
      request.token = this._address_iterator.currElem().token;
  }

  /**
   * Get the remote Janus hostname.
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
   *
   * @returns {Promise}
   */
  async close() {
    /* Check the status flags before */
    if (!this._opened) {
      const error = new Error('unable to close, websocket has never been opened');
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }
    if (this._closing) {
      const error = new Error('unable to close, websocket is already being closed');
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }
    if (this._closed) {
      const error = new Error('unable to close, websocket has already been closed');
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
   * Returns a promise with a pending request.
   *
   * @param {object} request - The request to be sent
   * @returns {Promise<object>} A promise resolving with a response from Janus
   */
  async sendRequest(request) {
    /* Input checking */
    if (typeof request !== 'object' || !request) {
      const error = new Error('request must be an object');
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }

    /* Check connection status */
    if (!this._opened) {
      const error = new Error('unable to send request because connection has not been opened');
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }
    if (this._closed) {
      const error = new Error('unable to send request because connection has been closed');
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }

    /* Add connection properties */
    this._decorateRequest(request);

    return new Promise((resolve, reject) => {
      /* Create a new transaction if the transaction does not exist */
      /* Use promise resolve and reject fn as callbacks for the transaction */
      this._tm.createTransaction(request.transaction, this, request.janus, resolve, reject);

      /* Stringify the message */
      const string_req = JSON.stringify(request);

      /* Send this message on the wire in text mode */
      this._ws.send(string_req, { compress: false, binary: false }, error => {
        if (error) {
          Logger.error(`${LOG_NS} ${this.name} websocket send error (${error.message})`);
          /* In case of error quickly close the transaction */
          this._tm.closeTransactionWithError(request.transaction, this, error);
          reject(error);
          return;
        }
        Logger.debug(`${LOG_NS} ${this.name} <ws SND OK> ${string_req}`);
      });
    });
  }

  /**
   * Create a new session in this connection.
   *
   * @returns {Promise<module:session~Session>} The newly created session
   *
   * @example
   *
   * const session = await connection.create();
   * Logger.info(`***** SESSION CREATED *****`);
   */
  async create() {
    Logger.info(`${LOG_NS} ${this.name} creating new session`);

    const request = {
      janus: JANUS.REQUEST.CREATE_SESSION,
    };

    try {
      const { data: { id } } = await this.sendRequest(request);
      /* Increase the maximum number of listeners for this connection */
      /* The session will register two listeners */
      this.setMaxListeners(this.getMaxListeners() + 2);

      /* Create a new Janode Session and add it to the table */
      const session_instance = new JanodeSession(this, id);
      this._sessions.set(session_instance.id, session_instance);

      /* On session destroy delete the entry from session map and decrease the number of listeners */
      session_instance.once(JANODE.EVENT.SESSION_DESTROYED, ({ id }) => {
        this._sessions.delete(id);
        this.setMaxListeners(this.getMaxListeners() - 2);
      });

      Logger.info(`${LOG_NS} ${this.name} session created (id=${id})`);
      return session_instance;
    }
    catch (error) {
      Logger.error(`${LOG_NS} ${this.name} session creation error (${error.message})`);
      throw error;
    }
  }

  /**
   * Janus GET INFO API.
   *
   * @returns {Promise<object>} The Get Info response
   *
   * @example
   *
   * const info = await connection.getInfo();
   * Logger.info(`${info.name} ${info.version_string}`);
   */
  async getInfo() {
    Logger.info(`${LOG_NS} ${this.name} requesting server info`);

    const request = {
      janus: JANUS.REQUEST.SERVER_INFO,
    };

    return this.sendRequest(request);
  }

  /*************/
  /* ADMIN API */
  /*************/

  /* The following APIs are available only if a connection has been created with is_admin = true in the config */

  /**
   * (Admin API) List the sessions in a janus instance.
   *
   * @returns {Promise<object>}
   *
   * @example
   *
   * const data = await connection.listSessions();
   * Logger.info(`${JSON.stringify(data)}`);
   */
  async listSessions() {
    Logger.verbose(`${LOG_NS} ${this.name} requesting session list`);

    const request = {
      janus: JANUS.ADMIN.LIST_SESSIONS,
    };

    return this.sendRequest(request);
  }

  /**
   * (Admin API) List the handles in a session.
   *
   * @param {number} session_id - The identifier of the session
   * @returns {Promise<object>}
   *
   * @example
   *
   * const data = await connection.listSessions();
   * Logger.info(`${JSON.stringify(data)}`);
   */
  async listHandles(session_id) {
    Logger.info(`${LOG_NS} ${this.name} requesting handle list`);
    if (!session_id) {
      const error = new Error('session_id parameter not specified');
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }
    const request = {
      janus: JANUS.ADMIN.LIST_HANDLES,
      session_id,
    };

    return this.sendRequest(request);
  }

  /**
   * (Admin API) Get an handle info.
   *
   * @param {number} session_id - The session identifier
   * @param {number} handle_id - The handle identifier
   * @returns {Promise<object>} The Get Handle Info response
   *
   * @example
   *
   * const data = await connection.handleInfo(session.id, handle.id);
   * Logger.info(`${JSON.stringify(data)}`);
   */
  async handleInfo(session_id, handle_id) {
    Logger.info(`${LOG_NS} ${this.name} requesting handle info`);
    if (!session_id) {
      const error = new Error('session_id parameter not specified');
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }
    if (!handle_id) {
      const error = new Error('handle_id parameter not specified');
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }
    const request = {
      janus: JANUS.ADMIN.HANDLE_INFO,
      session_id,
      handle_id,
    };

    return this.sendRequest(request);
  }

  /**
   * (Admin API) Start a packet capture on an handle.
   *
   * @param {number} session_id - The session identifier
   * @param {number} handle_id - The handle identifier
   * @param {string} folder - The folder in which save the pcap
   * @param {string} filename - The pcap file name
   * @param {number} [truncate] - Number of bytes to truncate the pcap to
   * @returns {Promise<object>} The start pcap response
   */
  async startPcap(session_id, handle_id, folder, filename, truncate) {
    Logger.info(`${LOG_NS} ${this.name} requesting pcap start for handle ${handle_id}`);
    if (!session_id) {
      const error = new Error('session_id parameter not specified');
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }
    if (!handle_id) {
      const error = new Error('handle_id parameter not specified');
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }
    if (typeof folder !== 'string' || typeof filename !== 'string') {
      const error = new Error('invalid folder or filename specified');
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }
    const request = {
      janus: JANUS.ADMIN.START_PCAP,
      session_id,
      handle_id,
      folder,
      filename,
    };
    if ((typeof truncate === 'number') && truncate > 0) {
      request.truncate = truncate;
    }

    return this.sendRequest(request);
  }

  /**
   * Stop an ogoing packet capture.
   *
   * @param {number} session_id - The session identifier
   * @param {number} handle_id - The handle identifier
   * @returns {Promsie<object>} The stop pcap response
   */
  async stopPcap(session_id, handle_id) {
    Logger.info(`${LOG_NS} ${this.name} requesting pcap stop for handle ${handle_id}`);
    if (!session_id) {
      const error = new Error('session_id parameter not specified');
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }
    if (!handle_id) {
      const error = new Error('handle_id parameter not specified');
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }
    const request = {
      janus: JANUS.ADMIN.STOP_PCAP,
      session_id,
      handle_id,
    };

    return this.sendRequest(request);
  }

}

module.exports = Connection;