'use strict';

/**
 * This module contains the transaction manager used by janode.
 * It is possible to debug the size of the transaction table (to detect leaks) by using the CLI argument `--debug-tx`.
 * @module tmanager
 * @private
 */

/**
 * An object describing a pending transaction stored in the manager.
 *
 * @typedef {object} PendingTransaction
 * @property {string} id - The transaction identifier
 * @property {object} owner - A reference to the object that created the transaction
 * @property {string} request - The janus request for the pending transaction
 * @property {function} done - The success callback
 * @property {function} error - The error callback
 */

import Logger from './utils/logger.js';
const LOG_NS = '[tmanager.js]';
import { getNumericID, getCliArgument } from './utils/utils.js';

const debug = getCliArgument('debug-tx', 'boolean', false);

/**
 * Class representing a Janode Transaction Manager (TM).
 * A transaction manager stores the pending transactions and has methods to create and close transactions.
 * Every transaction objects has an identifier, a reference to the owner and a kind of janus request.
 *
 * @private
 */
class TransactionManager {
  /**
   * Create a Transacton Manager (TM)
   *
   * @param {string} [id] - The identifier given to the manager (got from a counter if missing)
   */
  constructor(id = getNumericID()) {
    this.transactions = new Map();
    this.id = id;
    Logger.info(`${LOG_NS} [${this.id}] creating new transaction manager (debug=${debug})`);
    this._dbgtask = null;
    /* If tx debugging is enabled, periodically print the size of the tx table */
  }

  /**
   * Clear the internal transaction table and the debugging printing task.
   */
  clear() {
    Logger.info(`${LOG_NS} [${this.id}] clearing transaction manager`);
    clearInterval(this._dbgtask);
    this.transactions.clear();
  }

  /**
   * Check if the TM has a specific transaction.
   *
   * @param {string} id - The transaction id
   * @returns {boolean} True if the manager contains the transaction
   */
  has(id) {
    if (!id) return false;
    return this.transactions.has(id);
  }

  /**
   * Get a specific transaction from the TM.
   *
   * @param {string} id - The transaction id
   * @returns {PendingTransaction|void} The wanted transaction, or nothing if missing
   */
  get(id) {
    if (!id) return null;
    if (!this.has(id)) return null;
    return this.transactions.get(id);
  }

  /**
   * Get the current size of the transaction table.
   *
   * @returns {number} The size of the table
   */
  size() {
    return this.transactions.size;
  }

  /**
   * Add a pending transaction to the TM.
   *
   * @param {string} id - The transaction id
   * @param {PendingTransaction} transaction
   */
  set(id, transaction) {
    if (!id) return;
    if (!transaction) return;
    this.transactions.set(id, transaction);
    if (debug && !this._dbgtask) {
      this._dbgtask = setInterval(_ => {
        Logger.info(`${LOG_NS} [${this.id}] TM DEBUG size=${this.size()}`);
      }, 5000);
    }
  }

  /**
   * Delete a specific transaction from the TM.
   *
   * @param {string} id - The transaction id to delete
   */
  delete(id) {
    if (!id) return;
    if (!this.has(id)) return;
    this.transactions.delete(id);
  }

  /**
   * Get the owner of a specific transaction id.
   *
   * @param {string} id - The transaction id
   * @returns {object|void} A reference to the owner object, or nothing if transaction is missing
   */
  getTransactionOwner(id) {
    if (!id) return;
    if (!this.has(id)) return;
    return this.get(id).owner;
  }

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
  createTransaction(id, owner, request, done, error) {
    if (this.has(id)) return;
    const tx = {
      id,
      owner,
      request,
      done,
      error,
    };
    this.set(id, tx);
    Logger.verbose(`${LOG_NS} [${tx.owner.id}] created new transaction ${id}, request "${tx.request}"`);
    return tx;
  }

  /**
   * Close a transaction with an error if the id is found and the owner matches.
   * The closed transaction will be removed from the internal table and the error cb will be invoked with the error string.
   *
   * @param {string} id - The transaction identifier
   * @param {object} owner - A reference to the transaction owner
   * @param {string} error - The error string
   * @returns {PendingTransaction|void} The closed transaction, or nothing if the id does not exist or the owner does not match
   */
  closeTransactionWithError(id, owner, error) {
    const tx = this.get(id);
    if (!tx) return;
    if (tx.owner !== owner) return;
    this.delete(id);
    tx.error(error);
    Logger.verbose(`${LOG_NS} [${tx.owner.id}] closed with error transaction ${id}, request "${tx.request}"`);
    return tx;
  }

  /**
   * Close all the stored transactions with an error.
   * If an owner is specified only the owner's transaction will be closed.
   * The closed transactions will be removed from the internal table.
   *
   * @param {object} [owner] - A reference to the transaction owner
   * @param {string} error - The error string
   */
  closeAllTransactionsWithError(owner, error) {
    for (const [_, pendingTx] of this.transactions) {
      if (!owner || pendingTx.owner === owner)
        this.closeTransactionWithError(pendingTx.id, pendingTx.owner, error);
    }
  }

  /**
   * Close a transaction with success if the id is found and the owner matches.
   * The closed transaction will be removed from the internal table and the success cb will be invoked with the specified data.
   *
   * @param {string} id - The transaction identifier
   * @param {object} owner - A reference to the transaction owner
   * @param {*} data - The success callback data
   * @returns {PendingTransaction|void} The closed transaction, or nothing if the id does not exist or the owner does not match
   */
  closeTransactionWithSuccess(id, owner, data) {
    const tx = this.get(id);
    if (!tx) return;
    if (tx.owner !== owner) return;
    this.delete(id);
    tx.done(data);
    Logger.verbose(`${LOG_NS} [${tx.owner.id}] closed with success transaction ${id}, request "${tx.request}"`);
    return tx;
  }
}

export default TransactionManager;

















