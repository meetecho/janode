'use strict';

/**
 * The logging module used in janode.<br>
 *
 * The level of logging on the stdout can be set through the CLI argument "--janode-log={debug|verb|info|warn|error|none}"".<br>
 *
 * Default logging level is "info".
 * @module logger
 * @private
 */

import { getCliArgument } from './utils.js';

const LEVELS = ['none', 'error', 'warning', 'info', 'verbose', 'debug'];
const LEVELS_IDX = LEVELS.reduce((obj, lvl, idx) => {
  obj[lvl] = idx;
  return obj;
}, {});

const DEFAULT_LEVEL = 'info';

/**
 * Class representing a Janode logger.<br>
 *
 * Users are not expected to create Logger instances, but insted use the Janode.Logger instance.<br>
 *
 * @hideconstructor
 */
class Logger {
  constructor(lvl = DEFAULT_LEVEL) {
    /**
     * The current verbosity level of the logger.
     * @type {string}
     * @private
     */
    this._log_verbosity = this.setLevel(lvl);
  }

  /**
   * @private
   */
  _printout(msg_verbosity, console_fn, ...args) {
    if (LEVELS_IDX[msg_verbosity] > LEVELS_IDX[this._log_verbosity]) return;
    const ts = (new Date()).toISOString();
    const prefix = `${ts} - ${msg_verbosity.toUpperCase().padEnd(8, ' ')}:`;
    if (args.length === 1 && typeof args[0] === 'function') {
      const msg = (args[0])();
      console_fn(prefix, msg);
    }
    else
      console_fn(prefix, ...args);
  }

  /**
   * Debug logging.
   * It is a wrapper for `console.debug()`.
   *
   * @function
   * @param {...any} args
   */
  debug(...args) {
    this._printout('debug', console.debug, ...args);
  }

  /**
   * Verbose logging.
   * It is a wrapper for `console.debug()`.
   *
   * @function
   * @param {...any} args
   */
  verbose(...args) {
    this._printout('verbose', console.debug, ...args);
  }

  /**
   * Alias for verbose.
   *
   * @function
   * @param {...any} args
   */
  verb(...args) {
    this.verbose(...args);
  }

  /**
   * Info logging (default).
   * It is a wrapper for `console.info()`.
   *
   * @function
   * @param {...any} args
   */
  info(...args) {
    this._printout('info', console.info, ...args);
  }

  /**
   * Warning logging.
   * It is a wrapper for `console.warn()`.
   *
   * @function
   * @param {...any} args
   */
  warning(...args) {
    this._printout('warning', console.warn, ...args);
  }

  /**
   * Alias for warning.
   *
   * @function
   * @param {...any} args
   */
  warn(...args) {
    this.warning(...args);
  }

  /**
   * Error logging.
   * It is a wrapper for `console.error()`.
   *
   * @function
   * @param {...any} args
   */
  error(...args) {
    this._printout('error', console.error, ...args);
  }

  /**
   * Set level of logger.
   *
   * @function
   * @param {"debug"|"verb"|"info"|"warn"|"error"|"none"} lvl
   * @returns {string} The current level
   */
  setLevel(lvl = '') {
    lvl = lvl.toLowerCase();
    if (lvl === 'verb') lvl = 'verbose';
    if (lvl === 'warn') lvl = 'warning';
    if (typeof LEVELS_IDX[lvl] === 'number') {
      this._log_verbosity = lvl;
    }
    else {
      this._log_verbosity = DEFAULT_LEVEL;
    }
    return this._log_verbosity;
  }

  /**
   * Alias for setLevel.
   *
   * @function
   * @param {"debug"|"verb"|"info"|"warn"|"error"|"none"} lvl
   * @returns {string} The current level
   */
  setLogLevel(lvl = '') {
    return this.setLevel(lvl);
  }
}

const cli_log_verbosity = getCliArgument('janode-log', 'string', DEFAULT_LEVEL);
const loggerInstance = new Logger(cli_log_verbosity);

export default loggerInstance;