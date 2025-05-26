export default TransactionManager;
/**
 * An object describing a pending transaction stored in the manager.
 */
export type PendingTransaction = {
    /**
     * - The transaction identifier
     */
    id: string;
    /**
     * - A reference to the object that created the transaction
     */
    owner: object;
    /**
     * - The janus request for the pending transaction
     */
    request: string;
    /**
     * - The success callback
     */
    done: Function;
    /**
     * - The error callback
     */
    error: Function;
};
/**
 * Class representing a Janode Transaction Manager (TM).
 * A transaction manager stores the pending transactions and has methods to create and close transactions.
 * Every transaction objects has an identifier, a reference to the owner and a kind of janus request.
 *
 * @private
 */
declare class TransactionManager {
    /**
     * Create a Transacton Manager (TM)
     *
     * @param {string} [id] - The identifier given to the manager (got from a counter if missing)
     */
    constructor(id?: string);
    transactions: any;
    id: string;
    _dbgtask: number;
    /**
     * Clear the internal transaction table and the debugging printing task.
     */
    clear(): void;
    /**
     * Check if the TM has a specific transaction.
     *
     * @param {string} id - The transaction id
     * @returns {boolean} True if the manager contains the transaction
     */
    has(id: string): boolean;
    /**
     * Get a specific transaction from the TM.
     *
     * @param {string} id - The transaction id
     * @returns {PendingTransaction|void} The wanted transaction, or nothing if missing
     */
    get(id: string): PendingTransaction | void;
    /**
     * Get the current size of the transaction table.
     *
     * @returns {number} The size of the table
     */
    size(): number;
    /**
     * Add a pending transaction to the TM.
     *
     * @param {string} id - The transaction id
     * @param {PendingTransaction} transaction
     */
    set(id: string, transaction: PendingTransaction): void;
    /**
     * Delete a specific transaction from the TM.
     *
     * @param {string} id - The transaction id to delete
     */
    delete(id: string): void;
    /**
     * Get the owner of a specific transaction id.
     *
     * @param {string} id - The transaction id
     * @returns {object|void} A reference to the owner object, or nothing if transaction is missing
     */
    getTransactionOwner(id: string): object | void;
    /**
     * Create a new transaction if id does not exist in the table and add it to the TM.
     *
     * @param {string} id - The transaction identifier
     * @param {object} owner - A reference to the object that created the transaction
     * @param {string} request - The janus request for the pending transaction
     * @param {function} done - The success callback
     * @param {function} error - The error callback
     * @returns {PendingTransaction|void} The newly created transaction, or nothing if the id already exists
     */
    createTransaction(id: string, owner: object, request: string, done: Function, error: Function): PendingTransaction | void;
    /**
     * Close a transaction with an error if the id is found and the owner matches.
     * The closed transaction will be removed from the internal table and the error cb will be invoked with the error string.
     *
     * @param {string} id - The transaction identifier
     * @param {object} owner - A reference to the transaction owner
     * @param {string} error - The error string
     * @returns {PendingTransaction|void} The closed transaction, or nothing if the id does not exist or the owner does not match
     */
    closeTransactionWithError(id: string, owner: object, error: string): PendingTransaction | void;
    /**
     * Close all the stored transactions with an error.
     * If an owner is specified only the owner's transaction will be closed.
     * The closed transactions will be removed from the internal table.
     *
     * @param {object} [owner] - A reference to the transaction owner
     * @param {string} error - The error string
     */
    closeAllTransactionsWithError(owner?: object, error?: string): void;
    /**
     * Close a transaction with success if the id is found and the owner matches.
     * The closed transaction will be removed from the internal table and the success cb will be invoked with the specified data.
     *
     * @param {string} id - The transaction identifier
     * @param {object} owner - A reference to the transaction owner
     * @param {*} data - The success callback data
     * @returns {PendingTransaction|void} The closed transaction, or nothing if the id does not exist or the owner does not match
     */
    closeTransactionWithSuccess(id: string, owner: object, data: any): PendingTransaction | void;
}
