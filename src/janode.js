'use strict';

/**
 * This module is the entry point of the Janode library.<br>
 *
 * Users start by importing the library and using the functions and properties exported by this module.
 * @module janode
 */

import Logger from './utils/logger.js';
const LOG_NS = '[janode.js]';
import Configuration from './configuration.js';
import Connection from './connection.js';
import { JANODE as JANODE_PROTO } from './protocol.js';
const { EVENT } = JANODE_PROTO;

/**
 * An object describing a janus server (e.g. url, secret).
 *
 * @typedef {object} ServerObjectConf
 * @property {string} url - The URL to reach this server API
 * @property {string} apisecret - The API secret for this server
 * @property {string} [token] - The optional Janus API token
 */

/**
 * The configuration passed by the user.
 *
 * @typedef {object} RawConfiguration
 * @property {string} [server_key] - The key used to refer to this server in Janode.connect
 * @property {module:janode~ServerObjectConf[]|module:janode~ServerObjectConf} address - The server to connect to
 * @property {number} [retry_time_secs=10] - The seconds between any connection attempts
 * @property {number} [max_retries=5] - The maximum number of retries before issuing a connection error
 * @property {boolean} [is_admin=false] - True if the connection is dedicated to the Janus Admin API
 * @property {object} [ws_options] - Specific WebSocket transport options
 */

/**
 * The plugin descriptor used when attaching a plugin from a session.
 *
 * @typedef {object} PluginDescriptor
 * @property {string} id - The plugin id used when sending the attach request to Janus
 * @property {module:handle~Handle} [Handle] - The class implementing the handle
 * @property {object} [EVENT] - The object with the list of events emitted by the plugin
 */

/**
 * Connect using a defined configuration.<br>
 *
 * The input configuration can be an object or an array. In case it is an array and the param "key" is provided,
 * Janode will pick a server configuration according to "key" type. If it is a number it will pick the index "key" of the array.
 * If it is a string it will pick the server configuration that matches the "server_key" property.
 * In case "key" is missing, Janode will fallback to index 0.
 *
 * @param {module:janode~RawConfiguration|module:janode~RawConfiguration[]} config - The configuration to be used
 * @param {number|string} [key=0] - The index of the config in the array to use, or the server of the arrray matching this server key
 * @returns {Promise<module:connection~Connection>} The promise resolving with the Janode connection
 *
 * @example
 *
 * // simple example with single object and no key
 * const connection = await Janode.connect({
 *   address: {
 *	   url: 'ws://127.0.0.1:8188/',
 *	   apisecret: 'secret'
 *	 },
 * });
 *
 * // example with an array and a key 'server_2'
 * // connection is established with ws://127.0.0.1:8002
 * const connection = await Janode.connect([{
 *   server_key: 'server_1',
 *   address: {
 *	   url: 'ws://127.0.0.1:8001/',
 *	   apisecret: 'secret'
 *	 },
 * },
 * {
 *   server_key: 'server_2',
 *   address: {
 *	   url: 'ws://127.0.0.1:8002/',
 *	   apisecret: 'secondsecret'
 *	 },
 * }], 'server_2');
 *
 * // example with an array and a key 'server_B' with multiple addresses
 * // connection is attempted starting with ws://127.0.0.1:8003
 * const connection = await Janode.connect([{
 *   server_key: 'server_A',
 *   address: {
 *	   url: 'ws://127.0.0.1:8001/',
 *	   apisecret: 'secret'
 *	 },
 * },
 * {
 *   server_key: 'server_B',
 *   address: [{
 *	   url: 'ws://127.0.0.1:8003/',
 *	   apisecret: 'secondsecret'
 *	 },
 *   {
 *     url: 'ws://127.0.0.2:9003/',
 *	   apisecret: 'thirdsecret'
 *   }],
 * }], 'server_B');
 */
const connect = (config = {}, key = null) => {
  Logger.info(`${LOG_NS} creating new connection`);

  const janus_server_list = Array.isArray(config) ? config : [config];
  let index = 0;
  if (typeof key === 'number')
    index = key;
  if (typeof key === 'string')
    index = janus_server_list.findIndex(({ server_key }) => server_key === key);
  if (!key)
    Logger.verbose(`${LOG_NS} omitted server key, falling back to the first server in configuration`);

  const server_raw_conf = janus_server_list[index];
  if (!server_raw_conf) {
    const error = new Error(`server configuration not defined for server #${key || index}`);
    Logger.error(`${LOG_NS} ${error.message}`);
    throw error;
  }

  const server_conf = new Configuration(server_raw_conf);
  Logger.verbose(`${LOG_NS} creating connection with server configuration ${JSON.stringify(server_conf)}`);
  const janus_connection = new Connection(server_conf);
  return janus_connection.open();
};

export default {
  connect,
  /**
   * The Logger used in Janode.
   *
   * @type {object}
   * @property {function} debug - Print out a debug message
   * @property {function} verbose - Print out a verbose message
   * @property {function} info - Print out an info message
   * @property {function} warn - Print out a warning message
   * @property {function} error - Print out an error message
   * @property {function} setLevel - Set logger level
   */
  Logger,

  /**
   * Events emitted by Janode
   *
   * @type {object}
   * @property {string} CONNECTION_CLOSED - {@link module:connection~Connection#event:CONNECTION_CLOSED}
   * @property {string} SESSION_DESTROYED - {@link module:session~Session#event:SESSION_DESTROYED}
   * @property {string} HANDLE_DETACHED - {@link module:handle~Handle#event:HANDLE_DETACHED}
   * @property {string} HANDLE_HANGUP - {@link module:handle~Handle#event:HANDLE_HANGUP}
   * @property {string} HANDLE_MEDIA - {@link module:handle~Handle#event:HANDLE_MEDIA}
   * @property {string} HANDLE_WEBRTCUP - {@link module:handle~Handle#event:HANDLE_WEBRTCUP}
   * @property {string} HANDLE_SLOWLINK - {@link module:handle~Handle#event:HANDLE_SLOWLINK}
   * @property {string} CONNECTION_ERROR - {@link module:connection~Connection#event:CONNECTION_ERROR}
   */
  EVENT,
};
