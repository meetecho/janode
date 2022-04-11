import Handle from './handle.js'
import Logger from './utils/logger.js'

import Connection from "./connection.js";

declare namespace _default {
    export { connect };
    export { Logger };
    export { EVENT };
}

// declare module 'janode/plugins/audiobridge' {
//   export { default } from './plugins/audiobridge-plugin'
//   export * from './plugins/audiobridge-plugin'
// }
export default _default;
/**
 * An object describing a janus server (e.g. url, secret).
 */
export type ServerObjectConf = {
    /**
     * - The URL to reach this server API
     */
    url: string;
    /**
     * - The API secret for this server
     */
    apisecret: string;
};
/**
 * The configuration passed by the user.
 */
export type RawConfiguration = {
    /**
     * - The key used to refer to this server in Janode.connect
     */
    server_key: string;
    /**
     * - The server to connect to
     */
    address: string;
    /**
     * - The seconds between any connection attempts
     */
    retry_time_secs: number;
    /**
     * - The maximum number of retries before issuing a connection error
     */
    max_retries: number;
    /**
     * - True if the connection is dedicated to the Janus Admin API
     */
    is_admin: boolean;
};
/**
 * The plugin descriptor used when attaching a plugin from a session.
 */
export type PluginDescriptor = {
    /**
     * - The plugin id used when sending the attach request to Janus
     */
    id: string;
    /**
     * - The class implementing the handle
     */
    Handle?: Handle;
    /**
     * - The object with the list of events emitted by the plugin
     */
    EVENT?: object;
};
/**
 * An object describing a janus server (e.g. url, secret).
 *
 * @typedef {object} ServerObjectConf
 * @property {string} url - The URL to reach this server API
 * @property {string} api_secret - The API secret for this server
 */
/**
 * The configuration passed by the user.
 *
 * @typedef {object} RawConfiguration
 * @property {string} server_key - The key used to refer to this server in Janode.connect
 * @property {module:janode~ServerObjectConf[]|module:janode~ServerObjectConf} address - The server to connect to
 * @property {number} retry_time_secs - The seconds between any connection attempts
 * @property {number} max_retries - The maximum number of retries before issuing a connection error
 * @property {boolean} is_admin - True if the connection is dedicated to the Janus Admin API
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

export type ConnectConfig = {
    address: ServerObjectConf[],
    max_retries?:number
    is_admin?:boolean
    retry_time_secs?:number
}
declare function connect(config?: ConnectConfig, key?: number | string): Promise<Connection>;
declare const EVENT: {
    CONNECTION_CLOSED: string;
    SESSION_DESTROYED: string;
    HANDLE_DETACHED: string;
    HANDLE_HANGUP: string;
    HANDLE_MEDIA: string;
    HANDLE_WEBRTCUP: string;
    HANDLE_SLOWLINK: string;
    CONNECTION_ERROR: string;
};
