import EventEmitter from 'events';
import Session from './session.js'
export default Handle;
/**
 * Class representing a Janode handle.<br>
 *
 * Users implementing new plugins must extend this class and override the `handleMessage` function.<br>
 *
 * Handle extends EventEmitter, so an instance can emit events and users can subscribe to them.<br>
 *
 * Users are not expected to create Handle instances, but insted use the Session.attach() API.
 *
 * @hideconstructor
 */
declare class Handle extends EventEmitter {
    /**
     * Create a Janode handle.
     *
     * @param {module:session~Session} session - A reference to the parent session
     * @param {number} id - The handle identifier
     */
    constructor(session: Session, id: number);
    /**
     * The transaction manager used by this handle.
     *
     * @private
     * @type {TransactionManager}
     */
    private _tm;
    /**
     * A boolean flag indicating that the handle is being detached.
     * Once the detach has been completed, the flag returns to false.
     *
     * @private
     * @type {boolean}
     */
    private _detaching;
    /**
     * A boolean flag indicating that the handle has been detached.
     *
     * @private
     * @type {boolean}
     */
    private _detached;
    /**
     * The parent Janode session.
     *
     * @type {Session}
     */
    session: Session;
    /**
     * The handle unique id, usually taken from Janus response.
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
     * The callback function used for a session destroyed event.
     *
     * @private
     */
    private _sessionDestroyedListener;
    /**
     * Cleanup the handle closing all owned transactions, emitting the detached event
     * and removing all registered listeners.
     *
     * @private
     */
    private _signalDetach;
    /**
     * Helper to check if a pending transaction is a trickle.
     *
     * @private
     * @param {string} id - The transaction identifier
     * @returns {boolean}
     */
    private _isTrickleTx;
    /**
     * Helper to check if a pending transaction is a hangup.
     *
     * @private
     * @param {string} id - The transaction identifier
     * @returns {boolean}
     */
    private _isHangupTx;
    /**
     * Helper to check if a pending transaction is a detach.
     *
     * @private
     * @param {string} id - The transaction identifier
     * @returns {boolean}
     */
    private _isDetachTx;
    /**
     * Manage a message sent to this handle. If this involves a owned transaction
     * and the response is a definitive one, the transaction will be closed.
     * In case the instance implements a `handleMessage` method, this function will
     * pass the message to it on order to let a plugin implements its custom logic.
     * Generic Janus API events like `detached`, `hangup` etc. are handled here.
     *
     * @private
     * @param {object} janus_message
     */
    private _handleMessage;
    /**
     * Decorate request with handle id and transaction (if missing).
     *
     * @private
     * @param {object} request
     */
    private _decorateRequest;
    /**
     * Stub handleMessage (it is overriden by specific plugin handlers).
     * Implementations must return falsy values for unhandled events and truthy value
     * for handled events.
     *
     */
    handleMessage(): any;
    /**
     * Helper to check if the handle is managing a specific transaction.
     *
     * @property {string} id - The transaction id
     * @returns {boolean} True if this handle is the owner
     */
    ownsTransaction(id: string): boolean;
    /**
     * Helper to close a transaction with error.
     *
     * @property {string} id - The transaction id
     * @property {string} error - The error message
     * @returns {void}
     */
    closeTransactionWithError(id: string, error: Error): void;
    /**
     * Helper to close a transaction with success.
     *
     * @property {string} id - The transaction id
     * @property {object} [data] - The callback success data
     * @returns {void}
     */
    closeTransactionWithSuccess(id: string, data: any): void;
    /**
     * Send a request from this handle.
     *
     * @param {object} request
     * @returns {Promise<object>} A promsie resolving with the response to the request
     */
    sendRequest(request: object): Promise<object>;
    /**
     * Gracefully detach the Handle.
     *
     * @returns {Promise<void>}
     */
    detach(): Promise<void>;
    /**
     * Close the peer connection associated to this handle.
     *
     * @returns {Promise<object>}
     */
    hangup(): Promise<object>;
    /**
     * Send an ICE candidate / array of candidates.
     *
     * @param {RTCIceCandidate|RTCIceCandidate[]} candidate
     * @returns {Promise<void>}
     */
    trickle(candidate: RTCIceCandidate | RTCIceCandidate[]): Promise<void>;
    /**
     * Send ICE trickle complete message.
     *
     * @returns {Promise<void>}
     */
    trickleComplete(): Promise<void>;
    /**
     * Send a `message` to Janus from this handle, with given body and optional jsep.
     *
     * @param {object} body - The body of the message
     * @param {RTCSessionDescription} [jsep]
     * @returns {Promise<object>} A promise resolving with the response to the message
     *
     * @example
     * // This is a plugin that sends a message with a custom body
     * const body = {
     *   audio: true,
     *   video: true,
     *   record: false,
     * };
     *
     * await handle.message(body, jsep);
     *
     */
    message(body: object, jsep?: RTCSessionDescription): Promise<object>;
}
