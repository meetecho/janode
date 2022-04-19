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
 * @private
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
 * Janode protocol constants
 *
 * @private
 */
export const JANODE = {
  /**
   * Janode core events.
   */
  EVENT: {
    CONNECTION_CLOSED: 'connection_closed',
    SESSION_DESTROYED: 'session_destroyed',
    HANDLE_DETACHED: 'handle_detached',
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
 * @param {object} data - The data from Janus
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
 * @param {object} data - The data from Janus
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
 * @param {object} data - The data from Janus
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
 * @param {object} data - The data from Janus
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
 * @param {object} data - The data from Janus
 * @returns {boolean} True if the check succeeds
 */
export const isAckData = data => {
  if (typeof data === 'object' && data) {
    return data.janus === JANUS.ACK;
  }
  return false;
};