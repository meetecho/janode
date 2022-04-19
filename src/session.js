'use strict';

/**
 * This module contains the Session class definition.
 * @module session
 * @access private
 */

import { EventEmitter } from 'events';

import Logger from './utils/logger.js';
const LOG_NS = '[session.js]';
import { getNumericID } from './utils/utils.js';
import { JANUS, JANODE, isTimeoutData, isResponseData, isErrorData } from './protocol.js';
import JanodeHandle from './handle.js';

/**
 * Class representing a Janode session.<br>
 *
 * Session extends EventEmitter, so an instance can emit events and users can subscribe to them.<br>
 *
 * Users are not expected to create Session instances, but insted use the Connection.create() API.
 *
 * @hideconstructor
 */
class Session extends EventEmitter {
  /**
   * Create a Janode session.
   *
   * @param {module:connection~Connection} connection - A reference to the parent connection
   * @param {number} id - The session identifier
   * @param {number} [ka_interval=30] - The keepalive interval in seconds
   */
  constructor(connection, id, ka_interval = 30) {
    super();

    /**
     * The transaction manager used by this session.
     *
     * @private
     * @type {TransactionManager}
     */
    this._tm = connection._tm;

    /**
     * A boolean flag indicating that the session is being destroyed.
     * Once the destroy has been completed, the flag returns to false.
     *
     * @private
     * @type {boolean}
     */
    this._destroying = false;

    /**
     * A boolean flag indicating that the session has been destroyed.
     *
     * @private
     * @type {boolean}
     */
    this._destroyed = false;

    /**
     * Keep track of the handles.
     *
     * @private
     * @type {Map}
     */
    this._handles = new Map(); // keep track of the handles

    /**
     * The task of the peridic keep-alive.
     *
     * @private
     */
    this._ka_task = null;

    /**
     * The parent Janode connection.
     *
     * @type {module:connection~Connection}
     */
    this.connection = connection;

    /**
     * The session unique id, usually taken from Janus response.
     *
     * @type {number}
     */
    this.id = id;

    /**
     * A more descriptive, not unique string (used for logging).
     *
     * @type {string}
     */
    this.name = `[${this.id}]`;

    /* Enable keep-alive when creating the session */
    this._setKeepAlive(ka_interval * 1000);

    /**
     * The callback function used for a connection closed event.
     *
     * @private
     */
    this._closedListener = this._signalDestroy.bind(this);

    /**
     * The callback function used for a connection error event.
     *
     * @private
     */
    this._errorListener = this._signalDestroy.bind(this);

    /* Set a listener to run a callback when the connection gets closed */
    this.connection.once(JANODE.EVENT.CONNECTION_CLOSED, this._closedListener);
    /* Set a listener to run a callback when the connection fails */
    this.connection.once(JANODE.EVENT.CONNECTION_ERROR, this._errorListener);
    /* Set a dummy error listener to avoid unmanaged errors */
    this.on('error', e => `${LOG_NS} ${this.name} catched unmanaged error ${e.message}`);
  }

  /**
   * Cleanup the session canceling the KA task, closing all owned transactions, emitting the destroyed event
   * and removing all registered listeners.
   *
   * @private
   */
  _signalDestroy() {
    if (this._destroyed) return;
    this._destroying = false;
    this._destroyed = true;

    /* Cancel the KA task */
    this._unsetKeepAlive();
    /* Remove the listeners on the connection */
    this.connection.removeListener(JANODE.EVENT.CONNECTION_CLOSED, this._closedListener);
    this.connection.removeListener(JANODE.EVENT.CONNECTION_ERROR, this._errorListener);
    /* Close all pending transactions for this session with an error */
    this._tm.closeAllTransactionsWithError(this, new Error('session destroyed'));
    /* Clear handle table */
    this._handles.clear();
    /* Emit the destroyed event */
    /**
     * The session has been destroyed.
     *
     * @event module:session~Session#event:SESSION_DESTROYED
     * @type {object}
     * @property {number} id - The session identifier
     */
    this.emit(JANODE.EVENT.SESSION_DESTROYED, { id: this.id });
    /* Remove all listeners to avoid leaks */
    this.removeAllListeners();
  }

  /**
   * Send a keep-alive request.
   * The returned promise will return upon keep-alive response or a wait timeout.
   *
   * @private
   * @param {number} timeout - The timeout in milliseconds before detecting a ka timeout
   * @returns {Promise<void>}
   */
  async _sendKeepAlive(timeout) {
    const request = {
      janus: JANUS.REQUEST.KEEPALIVE,
    };

    let timeout_task;
    const timeout_ka = new Promise((_, reject) => {
      timeout_task = setTimeout(_ => reject(new Error('timeout')), timeout);
    });

    Logger.verbose(`${LOG_NS} ${this.name} sending keep-alive (timeout=${timeout}ms)`);
    const ka_op = this.sendRequest(request).then(_ => {
      Logger.verbose(`${LOG_NS} ${this.name} keep-alive OK`);
      clearTimeout(timeout_task);
    }).catch(e => {
      Logger.error(`${LOG_NS} ${this.name} keep-alive error (${e.message})`);
      clearTimeout(timeout_task);
      throw e;
    });

    return Promise.race([ka_op, timeout_ka]);
  }

  /**
   * Helper method to enable the keep-alive task with a given period.
   *
   * @private
   * @param {number} delay - The period of the task in milliseconds
   */
  _setKeepAlive(delay) {
    if (this._ka_task) return;
    const timeout = delay / 2;

    this._ka_task = setInterval(_ => {
      this._sendKeepAlive(timeout).catch(({ message }) => {
        /* If a keep-alive fails destroy the session */
        if (!this._destroyed) {
          const error = new Error(`keep-alive failed (${message})`);
          Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
        }
        this._signalDestroy();
      });
    }, delay);

    Logger.info(`${LOG_NS} ${this.name} session keep-alive task scheduled every ${delay} milliseconds`);
  }

  /**
   * Helper method to disable the keep-alive task.
   *
   * @private
   */
  _unsetKeepAlive() {
    if (!this._ka_task) return;
    clearInterval(this._ka_task);
    this._ka_task = null;
    Logger.info(`${LOG_NS} ${this.name} session keep-alive task disabled`);
  }

  /**
   * Helper to check if a pending transaction is a keep-alive.
   *
   * @private
   * @param {string} id - The transaction identifier
   * @returns {boolean}
   */
  _isKeepaliveTx(id) {
    const tx = this._tm.get(id);
    if (tx) return (tx.request === JANUS.REQUEST.KEEPALIVE);
    return false;
  }

  /**
   * Manage a message sent to this session.  If a handle is involved let it manage the message.
   * Trickles transactions are closed here because the Janus API lacks the handle id in the ack.
   * If the message involves a owned transaction and the response is a definitive one,
   * the transaction will be closed.
   *
   * @private
   * @param {object} janus_message
   */
  _handleMessage(janus_message) {
    const { sender, janus, transaction } = janus_message;

    /* First check if a handle is involved */
    if (sender) {
      /* Look for the handle in the map */
      const handle = this._handles.get(sender);
      /* If the handle is missing notifies the user */
      if (!handle) {
        if (janus === JANUS.EVENT.HANDLE_DETACHED_PLUGIN) {
          /* In case of duplicate "detached" try to not pollute the logs */
          Logger.verbose(`${LOG_NS} ${this.name} handle ${sender} not found for incoming message "${janus}"`);
          return;
        }
        Logger.verbose(`${LOG_NS} ${this.name} handle ${sender} not found for incoming message "${janus}"`);
        return;
      }

      /* Let the handle manage the message */
      handle._handleMessage(janus_message);
      return;
    }

    /* Ack responses for trickle requests (sent by handles) are exceptionally handled here */
    /* Since the sender id is missing from the ack response, we need to understand the handle that originated the request */
    if (transaction) {
      /* Fetch the owner of the transaction */
      const owner = this._tm.getTransactionOwner(transaction);
      /* Is the owner one of the handle of this session? */
      const handle = owner ? this._handles.get(owner.id) : null;

      if (handle && handle === owner) {
        /* The handle has been found and it is the owner of the tx, let it close the tx */
        handle._handleMessage(janus_message);
        return;
      }
    }

    /* Check if this message is a transaction of this session */
    if (transaction) {
      Logger.verbose(`${LOG_NS} ${this.name} received ${janus} for transaction ${transaction}`);

      /* Not owned by the session? */
      if (this._tm.getTransactionOwner(transaction) !== this) {
        Logger.warn(`${LOG_NS} ${this.name} transaction ${transaction} not found for incoming message ${janus}`);
        return;
      }

      /*
       * Pending session transaction management.
       * Close transaction in case of:
       * 1) Definitive response
       * 2) Any response to a Keep-Alive request
       */
      if (isResponseData(janus_message) || this._isKeepaliveTx(transaction)) {
        if (isErrorData(janus_message)) {
          const error = new Error(`${janus_message.error.code} ${janus_message.error.reason}`);
          this._tm.closeTransactionWithError(transaction, this, error);
          return;
        }

        this._tm.closeTransactionWithSuccess(transaction, this, janus_message);
      }

      return;
    }

    /* Session timeout event from Janus */
    if (isTimeoutData(janus_message)) {
      Logger.warn(`${LOG_NS} ${this.name} session timed out by Janus server!`);
      /* Let's cleanup the session */
      this._signalDestroy();
      return;
    }

    /* No handle, no transaction, no timeout? */
    Logger.error(`${LOG_NS} ${this.name} unexpected janus message directed to the session ${JSON.stringify(janus_message)}`);
  }

  /**
   * Decorate request with session id and transaction (if missing).
   *
   * @private
   * @param {object} request
   */
  _decorateRequest(request) {
    request.transaction = request.transaction || getNumericID();
    request.session_id = request.session_id || this.id;
  }

  /**
   * Send a request from this session.
   *
   * @param {object} request
   * @returns {Promise<object>} A promise resolving with the response
   */
  async sendRequest(request) {
    /* Input check */
    if (typeof request !== 'object' || !request) {
      const error = new Error('request must be an object');
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }

    /* Check session status */
    if (this._destroyed) {
      const error = new Error('unable to send request because session has been destroyed');
      Logger.error(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }

    /* Add session properties */
    this._decorateRequest(request);

    return new Promise((resolve, reject) => {
      /* Create a new transaction if the transaction does not exist */
      /* Use promise resolve and reject fn as callbacks for the transaction */
      this._tm.createTransaction(request.transaction, this, request.janus, resolve, reject);

      /* Send this message through the parent janode connection */
      this.connection.sendRequest(request).catch(error => {
        /* In case of error quickly close the transaction */
        this._tm.closeTransactionWithError(request.transaction, this, error);
      });
    });
  }

  /**
   * Gracefully destroy the session.
   *
   * @returns {Promise<void>}
   */
  async destroy() {
    Logger.info(`${LOG_NS} ${this.name} destroying session`);
    if (this._destroying) {
      const error = new Error('destroying already in progress');
      Logger.warn(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }
    if (this._destroyed) {
      const error = new Error('session already destroyed');
      Logger.warn(`${LOG_NS} ${this.name} ${error.message}`);
      throw error;
    }
    this._destroying = true;

    const request = {
      janus: JANUS.REQUEST.DESTROY_SESSION,
    };

    try {
      await this.sendRequest(request);
      this._signalDestroy();
      return;
    }
    catch (error) {
      Logger.error(`${LOG_NS} ${this.name} error while destroying session (${error.message})`);
      this._destroying = false;
      throw error;
    }
  }

  /**
   * Attach a plugin in this session using a plugin descriptor.
   * If the Handle param is missing, a new generic Handle will be attached.
   * Returns a promise with the pending attach operation.
   *
   * @param {module:janode~PluginDescriptor} descriptor - The plugin descriptor
   * @returns {Promise<module:handle~Handle>}
   *
   * @example
   *
   * // attach an echotest plugin with its specifc class
   * import EchoTestPlugin from 'janode/src/plugins/echotest-plugin.js';
   * const echoHandle = await janodeSession.attach(EchoTestPlugin);
   *
   * // attach a plugin without using its custom implementation
   * const handle = await session.attach({ id: 'janus.plugin.echotest' });
   *
   */
  async attach({ id, Handle = JanodeHandle }) {
    Logger.info(`${LOG_NS} ${this.name} attaching new handle`);

    if (!id) {
      const error = new Error('plugin identifier null or not valid');
      throw error;
    }

    const request = {
      janus: JANUS.REQUEST.ATTACH_PLUGIN,
      plugin: id,
    };

    try {
      const { data } = await this.sendRequest(request);
      /* Increase the maximum number of listeners for this session */
      /* The handle will register one listener */
      this.setMaxListeners(this.getMaxListeners() + 1);

      /* If the plugin Handle class is defined, use it to create a custom handle */
      /* Or simply create a generic handle with standard methods and events */
      const handle_instance = new Handle(this, data.id);

      /* Add the new handle to the table */
      this._handles.set(handle_instance.id, handle_instance);

      /* On handle detach delete the entry from handle map and decrease the number of listeners */
      handle_instance.once(JANODE.EVENT.HANDLE_DETACHED, ({ id }) => {
        this._handles.delete(id);
        this.setMaxListeners(this.getMaxListeners() - 1);
      });

      Logger.info(`${LOG_NS} ${this.name} handle attached (id=${handle_instance.id})`);
      return handle_instance;
    }
    catch (error) {
      Logger.error(`${LOG_NS} ${this.name} handle attach error (${error.message})`);
      throw error;
    }
  }

}

export default Session;