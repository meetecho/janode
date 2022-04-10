import Session from './session.d'
import EventEmitter from 'events';
export default Connection;
/**
 * Class representing a Janode connection.<br>
 *
 * Specific transports are picked by checking the connection URI.<br>
 *
 * This class implements both the Janus API and Admin API.<br>
 *
 * Connection extends EventEmitter, so an instance can emit events and users can subscribe to them.<br>
 *
 * Users are not expected to create Connection instances, but insted use the Janode.connect() API.<br>
 *
 * @hideconstructor
 */
declare class Connection extends EventEmitter {
    /**
     * Create a Janode Connection.
     *
     * @param {module:configuration~Configuration} server_config - The Janode configuration as created by the Configuration constructor.
     */
    constructor(server_config: any);
    /**
     * The configuration in use for this connection.
     *
     * @private
     * @type {module:configuration~Configuration}
     */
    private _config;
    /**
     * The transaction manager used by this connection.
     *
     * @private
     * @type {module:tmanager~TransactionManager}
     */
    private _tm;
    /**
     * Keep track of the sessions.
     *
     * @private
     * @type {Map}
     */
    private _sessions;
    /**
     * The iterator to select available Janus addresses.
     *
     * @private
     * @type {module:utils~CircularIterator}
     */
    private _address_iterator;
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
     * The internal transport that will be used for the connection.
     *
     * @typedef {object} Transport
     * @property {function} open
     * @property {function} close
     * @property {function} send
     * @property {function} getRemoteHostname
     */
    _transport: WsTransport | UnixTransport | {
        open: (_: any) => Promise<never>;
        close: (_: any) => Promise<never>;
        send: (_: any) => Promise<never>;
        getRemoteHostname: (_: any) => never;
    };
    /**
     * Cleanup the connection closing all owned transactions and emitting the destroyed event
     * and removing all registered listeners.
     *
     * @private
     * @param {boolean} graceful - True if this is an expected disconnection
     */
    private _signalClose;
    /**
     * Open a connection using the transport defined open method.
     * Users do not need to call this method, since the connection is opened by Janode.connect().
     *
     * @returns {Promise<module:connection~Connection>} A promise resolving with the Janode connection
     */
    open(): Promise<Connection>;
    /**
     * Manage a message sent to this session.  If a session is involved let it manage the message.
     * If the message involves a owned transaction and the response is a definitive one,
     * the transaction will be closed.
     *
     * @private
     * @param {object} janus_message
     */
    private _handleMessage;
    /**
     * Decorate request with apisecret, token and transaction (if missing).
     *
     * @private
     * @param {object} request
     */
    private _decorateRequest;
    /**
     * Gracefully close the connection using the transport defined close method.
     *
     * @returns {Promise<void>}
     */
    close(): Promise<void>;
    /**
     * Send a request from this connection using the transport defined send method.
     *
     * @param {object} request - The request to be sent
     * @returns {Promise<object>} A promise resolving with a response from Janus
     */
    sendRequest(request: object): Promise<object>;
    /**
     * Get the remote Janus hostname using the transport defined method.
     *
     * @returns {string} The hostname of the Janus server
     */
    getRemoteHostname(): string;
    /**
     * Create a new session in this connection.
     *
     * @param {number} [ka_interval] - The time interval (seconds) for session keep-alive requests
     * @returns {Promise<module:session~Session>} The newly created session
     *
     * @example
     *
     * const session = await connection.create();
     * Logger.info(`***** SESSION CREATED *****`);
     */
    create(ka_interval?: number): Promise<Session>;
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
    getInfo(): Promise<object>;
    /*************/
    /*************/
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
    listSessions(): Promise<object>;
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
    listHandles(session_id: number): Promise<object>;
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
    handleInfo(session_id: number, handle_id: number): Promise<object>;
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
    startPcap(session_id: number, handle_id: number, folder: string, filename: string, truncate?: number): Promise<object>;
    /**
     * Stop an ogoing packet capture.
     *
     * @param {number} session_id - The session identifier
     * @param {number} handle_id - The handle identifier
     * @returns {Promise<object>} The stop pcap response
     */
    stopPcap(session_id: number, handle_id: number): Promise<any>;
}
import WsTransport from "./transport-ws.js";
import UnixTransport from "./transport-unix.js";

