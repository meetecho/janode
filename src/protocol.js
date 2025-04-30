'use strict';

/**
 * This module contains several Janus constants related to the Janus/Admin API and Janode, like:<br>
 *
 * - Janus request names<br>
 *
 * - Janus response names<br>
 *
 * - Janus event names<br>
 *
 * - Janode event names<br>
 *
 * Some helper methods related to the protocols are defined here too.
 * @module protocol
 */

/**
 * Janus protocol constants
 *
 * @private
 */
export const JANUS = {
  /**
   * Janus API requests
   */
  REQUEST: {
    /* connection level requests */
    SERVER_INFO: 'info',
    /* session level requests */
    CREATE_SESSION: 'create',
    KEEPALIVE: 'keepalive',
    DESTROY_SESSION: 'destroy',
    /* handle level requests */
    ATTACH_PLUGIN: 'attach',
    MESSAGE: 'message',
    TRICKLE: 'trickle',
    HANGUP: 'hangup',
    DETACH_PLUGIN: 'detach',
  },
  /**
   * Janus temporary response (ack)
   */
  ACK: 'ack',
  /**
   * Janus definitive responses
   */
  RESPONSE: {
    SUCCESS: 'success',
    SERVER_INFO: 'server_info',
    ERROR: 'error',
  },
  /**
   * Janus events
   */
  EVENT: {
    EVENT: 'event',
    DETACHED: 'detached',
    ICE_FAILED: 'ice-failed',
    HANGUP: 'hangup',
    MEDIA: 'media',
    TIMEOUT: 'timeout',
    WEBRTCUP: 'webrtcup',
    SLOWLINK: 'slowlink',
    TRICKLE: 'trickle',
  },
  /**
   * Janus Admin API requests
   */
  ADMIN: {
    LIST_SESSIONS: 'list_sessions',
    LIST_HANDLES: 'list_handles',
    HANDLE_INFO: 'handle_info',
    START_PCAP: 'start_pcap',
    STOP_PCAP: 'stop_pcap',
  },
};

/**
 * @typedef {Object} JanodeCoreEvents
 * @property {string} CONNECTION_CLOSED - {@link module:connection~Connection#event:CONNECTION_CLOSED CONNECTION_CLOSED}
 * @property {string} SESSION_DESTROYED - {@link module:session~Session#event:SESSION_DESTROYED SESSION_DESTROYED}
 * @property {string} HANDLE_DETACHED - {@link module:handle~Handle#event:HANDLE_DETACHED HANDLE_DETACHED}
 * @property {string} HANDLE_ICE_FAILED - {@link module:handle~Handle#event:HANDLE_ICE_FAILED HANDLE_ICE_FAILED}
 * @property {string} HANDLE_HANGUP - {@link module:handle~Handle#event:HANDLE_HANGUP HANDLE_HANGUP}
 * @property {string} HANDLE_MEDIA - {@link module:handle~Handle#event:HANDLE_MEDIA HANDLE_MEDIA}
 * @property {string} HANDLE_WEBRTCUP - {@link module:handle~Handle#event:HANDLE_WEBRTCUP HANDLE_WEBRTCUP}
 * @property {string} HANDLE_SLOWLINK - {@link module:handle~Handle#event:HANDLE_SLOWLINK HANDLE_SLOWLINK}
 * @property {string} HANDLE_TRICKLE - {@link module:handle~Handle#event:HANDLE_TRICKLE HANDLE_TRICKLE}
 * @property {string} CONNECTION_ERROR - {@link module:connection~Connection#event:CONNECTION_ERROR CONNECTION_ERROR}
 */

/**
 * Janode protocol constants
 *
 * @private
 */
export const JANODE = {
  /**
   * Janode core events.
   *
   * @type {JanodeCoreEvents}
   */
  EVENT: {
    CONNECTION_CLOSED: 'connection_closed',
    SESSION_DESTROYED: 'session_destroyed',
    HANDLE_DETACHED: 'handle_detached',
    HANDLE_ICE_FAILED: 'handle_ice_failed',
    HANDLE_HANGUP: 'handle_hangup',
    HANDLE_MEDIA: 'handle_media',
    HANDLE_WEBRTCUP: 'handle_webrtcup',
    HANDLE_SLOWLINK: 'handle_slowlink',
    HANDLE_TRICKLE: 'handle_trickle',
    CONNECTION_ERROR: 'connection_error',
  },
};

/**
 * Check if a message from Janus is a definitive response.
 *
 * @private
 * @param {Object} data - The data from Janus
 * @returns {boolean} True if the check succeeds
 */
export const isResponseData = data => {
  if (typeof data === 'object' && data) {
    return Object.values(JANUS.RESPONSE).includes(data.janus);
  }
  return false;
};

/**
 * Check if a message from Janus is an event.
 *
 * @private
 * @param {Object} data - The data from Janus
 * @returns {boolean} True if the check succeeds
 */
export const isEventData = data => {
  if (typeof data === 'object' && data) {
    return data.janus === JANUS.EVENT.EVENT;
  }
  return false;
};

/**
 * Check if a message from Janus is an error.
 *
 * @private
 * @param {Object} data - The data from Janus
 * @returns {boolean} True if the check succeeds
 */
export const isErrorData = data => {
  if (typeof data === 'object' && data) {
    return data.janus === JANUS.RESPONSE.ERROR;
  }
  return false;
};

/**
 * Check if a message from Janus is a timeout notification.
 *
 * @private
 * @param {Object} data - The data from Janus
 * @returns {boolean} True if the check succeeds
 */
export const isTimeoutData = data => {
  if (typeof data === 'object' && data) {
    return data.janus === JANUS.EVENT.TIMEOUT;
  }
  return false;
};

/**
 * Check if a message from Janus is an ack.
 *
 * @private
 * @param {Object} data - The data from Janus
 * @returns {boolean} True if the check succeeds
 */
export const isAckData = data => {
  if (typeof data === 'object' && data) {
    return data.janus === JANUS.ACK;
  }
  return false;
};