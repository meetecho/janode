import Connection from  './connection.d'
import EventEmitter from 'events'
import {AudioBridgeEvent, AudioBridgeHandle} from './plugins/audiobridge.d'
import {EchoTestHandle} from './plugins/echotest.d'
import {StreamingHandle} from './plugins/streaming.d'
import {VideoRoomHandle} from './plugins/videoroom.d'

export default Session;
/**
 * Class representing a Janode session.<br>
 *
 * Session extends EventEmitter, so an instance can emit events and users can subscribe to them.<br>
 *
 * Users are not expected to create Session instances, but insted use the Connection.create() API.
 *
 * @hideconstructor
 */
declare class Session extends EventEmitter {
    /**
     * Create a Janode session.
     *
     * @param {module:connection~Connection} connection - A reference to the parent connection
     * @param {number} id - The session identifier
     * @param {number} [ka_interval=30] - The keepalive interval in seconds
     */
    constructor(connection: Connection, id: number, ka_interval?: number);
    /**
     * The transaction manager used by this session.
     *
     * @private
     * @type {TransactionManager}
     */
    private _tm;
    /**
     * A boolean flag indicating that the session is being destroyed.
     * Once the destroy has been completed, the flag returns to false.
     *
     * @private
     * @type {boolean}
     */
    private _destroying;
    /**
     * A boolean flag indicating that the session has been destroyed.
     *
     * @private
     * @type {boolean}
     */
    private _destroyed;
    /**
     * Keep track of the handles.
     *
     * @private
     * @type {Map}
     */
    private _handles;
    /**
     * The task of the peridic keep-alive.
     *
     * @private
     */
    private _ka_task;
    /**
     * The parent Janode connection.
     *
     * @type {module:connection~Connection}
     */
    connection: Connection;
    /**
     * The session unique id, usually taken from Janus response.
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
     * The callback function used for a connection closed event.
     *
     * @private
     */
    private _closedListener;
    /**
     * The callback function used for a connection error event.
     *
     * @private
     */
    private _errorListener;
    /**
     * Cleanup the session canceling the KA task, closing all owned transactions, emitting the destroyed event
     * and removing all registered listeners.
     *
     * @private
     */
    private _signalDestroy;
    /**
     * Send a keep-alive request.
     * The returned promise will return upon keep-alive response or a wait timeout.
     *
     * @private
     * @param {number} timeout - The timeout in milliseconds before detecting a ka timeout
     * @returns {Promise<void>}
     */
    private _sendKeepAlive;
    /**
     * Helper method to enable the keep-alive task with a given period.
     *
     * @private
     * @param {number} delay - The period of the task in milliseconds
     */
    private _setKeepAlive;
    /**
     * Helper method to disable the keep-alive task.
     *
     * @private
     */
    private _unsetKeepAlive;
    /**
     * Helper to check if a pending transaction is a keep-alive.
     *
     * @private
     * @param {string} id - The transaction identifier
     * @returns {boolean}
     */
    private _isKeepaliveTx;
    /**
     * Manage a message sent to this session.  If a handle is involved let it manage the message.
     * Trickles transactions are closed here because the Janus API lacks the handle id in the ack.
     * If the message involves a owned transaction and the response is a definitive one,
     * the transaction will be closed.
     *
     * @private
     * @param {object} janus_message
     */
    private _handleMessage;
    /**
     * Decorate request with session id and transaction (if missing).
     *
     * @private
     * @param {object} request
     */
    private _decorateRequest;
    /**
     * Send a request from this session.
     *
     * @param {object} request
     * @returns {Promise<object>} A promise resolving with the response
     */
    sendRequest(request: object): Promise<object>;
    /**
     * Gracefully destroy the session.
     *
     * @returns {Promise<void>}
     */
    destroy(): Promise<void>;
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
    attach({id,Handle,EVENT}: {id:string, Handle:AudioBridgeHandle, EVENT:AudioBridgeEvent}): Promise<AudioBridgeHandle>
    attach({id,Handle,EVENT}: {id:string, Handle:EchoTestHandle, EVENT:object}): Promise<EchoTestHandle>
    attach({id,Handle,EVENT}: {id:string, Handle:StreamingHandle, EVENT:object}): Promise<StreamingHandle>
    attach({id,Handle,EVENT}: {id:string, Handle:VideoRoomHandle, EVENT:object}): Promise<VideoRoomHandle>
}
