export default TransportUnix;
/**
 * Class representing a connection through Unix dgram sockets transport.<br>
 *
 * In case of failure a connection will be retried according to the configuration (time interval and
 * times to attempt). At every attempt, if multiple addresses are available for Janus, the next address
 * will be tried. An error will be raised only if the maxmimum number of attempts have been reached.<br>
 *
 * @private
 */
declare class TransportUnix {
    /**
     * Create a connection through Unix dgram socket.
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
     * The internal Unix Socket.
     *
     * @type {module:unix-dgram~Socket}
     */
    _socket: any;
    /**
     * The local file to bind the socket to.
     */
    _local_bind: string;
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
     * Initialize the internal socket.
     *
     * @returns {Promise<module:connection~Connection>}
     */
    _initUnixSocket(): Promise<module>;
    /**
     * Internal helper to open a unix socket connection.
     * In case of error retry the connection with another address from the available pool.
     * If maximum number of attempts is reached, throws an error.
     *
     * @returns {module:unix-dgram~Socket} The unix socket
     */
    _attemptOpen(): any;
    _close(): void;
    /**
     * Open a transport connection. This is called from parent connection.
     *
     * @returns {Promise<module:connection~Connection>} A promise resolving with the Janode connection
     */
    open(): Promise<module>;
    /**
     * Get the remote Janus hostname.
     * It is called from the parent connection.
     *
     * @returns {string} The hostname of the Janus server
     */
    getRemoteHostname(): string;
    /**
     * Gracefully close the connection.
     * It is called from the parent connection.
     *
     * @returns {Promise<void>}
     */
    close(): Promise<void>;
    /**
     * Send a request from this connection.
     * It is called from the parent connection.
     *
     * @param {object} request - The request to be sent
     * @returns {Promise<object>} A promise resolving with a response from Janus
     */
    send(request: object): Promise<object>;
}
