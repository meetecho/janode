export default TransportWs;
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
declare class TransportWs {
    /**
     * Create a connection through WebSocket.
     *
     * @param {module:connection~Connection} connection - The parent Janode connection
     */
    constructor(connection: any);
    /**
     * The parent  Janode connection.
     *
     * @type {module:connection~Connection}
     */
    _connection: any;
    /**
     * The internal WebSocket connection.
     *
     * @type {WebSocket}
     */
    _ws: WebSocket;
    /**
     * Internal counter for connection attempts.
     *
     * @type {number}
     */
    _attempts: number;
    /**
     * A boolean flag indicating that the connection is being opened.
     *
     * @type {boolean}
     */
    _opening: boolean;
    /**
     * A boolean flag indicating that the connection has been opened.
     *
     * @type {boolean}
     */
    _opened: boolean;
    /**
     * A boolean flag indicating that the connection is being closed.
     *
     * @type {boolean}
     */
    _closing: boolean;
    /**
     * A boolean flag indicating that the connection has been closed.
     *
     * @type {boolean}
     */
    _closed: boolean;
    /**
     * The task of the peridic ws ping.
     *
     * @type {*}
     */
    _ping_task: any;
    /**
     * A numerical identifier assigned for logging purposes.
     *
     * @type {number}
     */
    id: number;
    /**
     * A more descriptive, not unique string (used for logging).
     *
     * @type {string}
     */
    name: string;
    /**
     * Initialize the internal WebSocket.
     * Wraps with a promise the standard WebSocket API opening.
     *
     * @returns {Promise<module:connection~Connection>}
     */
    _initWebSocket(): Promise<module>;
    /**
     * Internal helper to open a websocket connection.
     * In case of error retry the connection with another address from the available pool.
     * If maximum number of attempts is reached, throws an error.
     *
     * @returns {WebSocket} The websocket connection
     */
    _attemptOpen(): WebSocket;
    /**
     * Open a transport connection. This is called from parent connection.
     *
     * @returns {Promise<module:connection~Connection>} A promise resolving with the Janode connection
     */
    open(): Promise<module>;
    /**
     * Send a ws ping frame.
     * This API is only available when the library is not used in a browser.
     *
     * @returns {Promise<void>}
     */
    _ping(): Promise<void>;
    /**
     * Set a ws ping-pong task.
     *
     * @param {number} delay - The ping interval in milliseconds
     * @returns {void}
     */
    _setPingTask(delay: number): void;
    /**
     * Remove the ws ping task.
     *
     * @returns {void}
     */
    _unsetPingTask(): void;
    /**
     * Get the remote Janus hostname.
     * It is called from the parent connection.
     *
     * @returns {string} The hostname of the Janus server
     */
    getRemoteHostname(): string;
    /**
     * Gracefully close the connection.
     * Wraps with a promise the standard WebSocket API "close".
     * It is called from the parent connection.
     *
     * @returns {Promise<void>}
     */
    close(): Promise<void>;
    /**
     * Send a request from this connection.
     * Wraps with a promise the standard WebSocket API "send".
     * It is called from the parent connection.
     *
     * @param {object} request - The request to be sent
     * @returns {Promise<object>} A promise resolving with a response from Janus
     */
    send(request: object): Promise<object>;
}
