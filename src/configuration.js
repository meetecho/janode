'use strict';

const { API_WS } = require('./protocol.js').JANUS;
const { ADMIN_WS } = require('./protocol.js').JANUS;

const DEF_RETRY_TIME = 10;
const DEF_MAX_RETRIES = 5;

/**
 * Class representing a Janode configuration.
 * The purpose of the class is basically filtering the input config and distinguish Janus API and Admin API connections.
 */
class Configuration {
  /**
   * Create a configuration.
   *
   * @private
   * @param {module:janode~RawConfiguration} config
   */
  constructor({ address, retry_time_secs, max_retries, is_admin }) {
    if (!address)
      throw new Error('invalid configuration, missing parameter "address"');
    if (Array.isArray(address) && address.length === 0)
      throw new Error('invalid configuration, empty parameter "address"');
    this.address = Array.isArray(address) ? address : [address];
    for (const server of this.address) {
      if (typeof server !== 'object' || !server)
        throw new Error('invalid configuration, every element of address attribute must be an object');
      if (typeof server.url !== 'string' || !server.url)
        throw new Error('invalid configuration, missing server url attribute ');
    }

    this.retry_time_secs = (typeof retry_time_secs === 'number') ? retry_time_secs : DEF_RETRY_TIME;
    this.max_retries = (typeof max_retries === 'number') ? max_retries : DEF_MAX_RETRIES;
    this.ws_subproto = (is_admin === true) ? ADMIN_WS : API_WS;
  }

  /**
   * Get the server list of this configuration.
   *
   * @returns {module:janode~ServerObjectConf[]} The address array
   */
  getAddress() {
    return this.address;
  }

  /**
   * Get the number of seconds between any attempt.
   *
   * @returns {number} The value of the property
   */
  getRetryTimeSeconds() {
    return this.retry_time_secs;
  }

  /**
   * Get the max number of retries.
   *
   * @returns {number} The value of the property
   */
  getMaxRetries() {
    return this.max_retries;
  }

  /**
   * Get the ws subprotocol of this configuration.
   *
   * @returns {string} The subprotocol of the connection
   */
  getSubProtocol() {
    return this.ws_subproto;
  }

  /**
   * Check if the configuration is for an admin connection.
   *
   * @returns {boolean} True if the configuration will be used for an admin connection
   */
  isAdmin() {
    return this.ws_subproto === ADMIN_WS;
  }
}

module.exports = Configuration;