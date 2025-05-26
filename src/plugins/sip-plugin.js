'use strict';

/**
 * This module contains the implementation of the SIP plugin (ref. {@link https://janus.conf.meetecho.com/docs/sip.html}).
 * @module sip-plugin
 */

import Handle from '../handle.js';
import { JANODE } from '../protocol.js';

/* The plugin ID exported in the plugin descriptor */
const PLUGIN_ID = 'janus.plugin.sip';

/* These are the requests defined for the Janus SIP plugin API */
const REQUEST_REGISTER = 'register';
const REQUEST_CALL = 'call';
const REQUEST_ACCEPT = 'accept';
const REQUEST_HANGUP = 'hangup';
const REQUEST_DECLINE = 'decline';

/* These are the events/responses that the Janode plugin will manage */
/* Some of them will be exported in the plugin descriptor */
const PLUGIN_EVENT = {
  REGISTERED: 'sip_registered',
  REGISTERING: 'sip_registering',
  CALLING: 'sip_calling',
  RINGING: 'sip_ringing',
  PROCEEDING: 'sip_proceeding',
  INCOMING: 'sip_incoming',
  HANGUP: 'sip_hangup',
  HANGINGUP: 'sip_hangingup',
  DECLINING: 'declining',
  ACCEPTED: 'sip_accepted',
  MISSED: 'sip_missed',
  INFO: 'sip_info',
  DTMF: 'sip_dtmf',
  ERROR: 'sip_error',
  ERROR_EVENT: 'sip_error_event',
};

/**
 * The class implementing the SIP plugin (ref. {@link https://janus.conf.meetecho.com/docs/sip.html}).<br>
 *
 * It extends the base Janode Handle class and overrides the base "handleMessage" method.<br>
 *
 * Moreover it defines some methods to support SIP operations.<br>
 *
 * @hideconstructor
 * @extends module:handle~Handle
 */
class SipHandle extends Handle {
  /**
   * Create a Janode SIP handle.
   *
   * @param {module:session~Session} session - A reference to the parent session
   * @param {number} id - The handle identifier
   */
  constructor(session, id) {
    super(session, id);
    this._pendingRegister = null;
    this._pendingCalls = {};

    this.on(JANODE.EVENT.HANDLE_HANGUP, _ => {
      this._pendingRegister = null;
      this._pendingCalls = {};
    });
    this.on(JANODE.EVENT.HANDLE_DETACHED, _ => {
      this._pendingRegister = null;
      this._pendingCalls = {};
    });
  }

  /**
   * The custom "handleMessage" needed for handling SIP plugin messages.
   *
   * @private
   * @param {Object} janus_message
   * @returns {Object} A falsy value for unhandled events, a truthy value for handled events
   */
  handleMessage(janus_message) {
    const { plugindata, transaction } = janus_message;
    if (plugindata && plugindata.data && plugindata.data.sip) {
      /**
       * @type {SipData}
       */
      const message_data = plugindata.data;
      const { sip, result, call_id, error, error_code } = message_data;

      /* The event can not be recognized, return a falsy value */
      if (!error && sip !== 'event' && !result.event)
        return null;

      /* Prepare an object for the output Janode event */
      const janode_event = this._newPluginEvent(janus_message);

      /* Add call id information if available */
      if (call_id) {
        janode_event.data.call_id = call_id;
        this._pendingCalls[call_id] = this._pendingCalls[call_id] || {};
      }

      /* Plugin messaging error (not related to SIP requests) */
      if (error) {
        janode_event.event = PLUGIN_EVENT.ERROR;
        janode_event.data = new Error(`${error_code} ${error}`);
        /* In case of error, close a transaction */
        this.closeTransactionWithError(transaction, janode_event.data);
        return janode_event;
      }

      /* Emit the event to the application */
      let emit = false;

      /* Close the related janus transaction */
      const CLOSE_TX_NO = 0;
      const CLOSE_TX_SUCCESS = 1;
      const CLOSE_TX_ERROR = -1;
      let closeTx = CLOSE_TX_NO;
      let txId = transaction;

      switch (result.event) {

        /* Registering event */
        case 'registering':
          janode_event.event = PLUGIN_EVENT.REGISTERING;
          closeTx = CLOSE_TX_NO;
          emit = true;
          break;

        case 'registration_failed':
          janode_event.event = PLUGIN_EVENT.ERROR_EVENT;
          janode_event.data = new Error(`${result.code} ${result.reason}`);
          closeTx = CLOSE_TX_ERROR;
          txId = transaction || this._pendingRegister;
          emit = false;
          break;

        case 'registered':
          janode_event.event = PLUGIN_EVENT.REGISTERED;
          janode_event.data.username = result.username;
          janode_event.data.register_sent = result.register_sent;
          closeTx = CLOSE_TX_SUCCESS;
          txId = transaction || this._pendingRegister;
          emit = false;
          break;

        case 'calling':
          janode_event.event = PLUGIN_EVENT.CALLING;
          closeTx = CLOSE_TX_NO;
          emit = true;
          break;

        case 'ringing':
          janode_event.event = PLUGIN_EVENT.RINGING;
          closeTx = CLOSE_TX_NO;
          emit = true;
          break;

        case 'proceeding':
          janode_event.event = PLUGIN_EVENT.PROCEEDING;
          closeTx = CLOSE_TX_NO;
          emit = true;
          break;

        /* Inbound call */
        case 'incomingcall': {
          janode_event.event = PLUGIN_EVENT.INCOMING;
          /* Store the incoming call URI */
          const call = this._pendingCalls[call_id];
          if (call) {
            call.incoming = result.username;
          }
          janode_event.data.username = result.username;
          janode_event.data.callee = result.callee;
          janode_event.data.display_name = result.displayname || undefined;
          closeTx = CLOSE_TX_NO;
          emit = true;
          break;
        }

        case 'hangup': {
          /* Is there is a pending call without a reply? */
          const call = this._pendingCalls[call_id];
          if (call && !call.accepted && !call.declined && !call.incoming) {
            janode_event.event = PLUGIN_EVENT.ERROR_EVENT;
            janode_event.data = new Error(`${result.code} ${result.reason}`);
            closeTx = CLOSE_TX_ERROR;
          }
          /* Async hangup */
          else {
            janode_event.event = PLUGIN_EVENT.HANGUP;
            closeTx = CLOSE_TX_NO;
            emit = true;
          }
          delete this._pendingCalls[call_id];
          break;
        }

        case 'hangingup':
          janode_event.event = PLUGIN_EVENT.HANGINGUP;
          closeTx = CLOSE_TX_SUCCESS;
          emit = false;
          break;

        case 'declining': {
          janode_event.event = PLUGIN_EVENT.DECLINING;
          const call = this._pendingCalls[call_id];
          if (call) {
            call.declined = true;
          }
          closeTx = CLOSE_TX_SUCCESS;
          emit = false;
          break;
        }

        /* A call has been accepted */
        case 'accepted': {
          janode_event.event = PLUGIN_EVENT.ACCEPTED;
          janode_event.data.username = result.username || this._pendingCalls[call_id].incoming;
          const call = this._pendingCalls[call_id];
          if (call) {
            call.accepted = true;
          }
          closeTx = CLOSE_TX_SUCCESS;
          emit = false;
          break;
        }

        /* Call has been missed */
        case 'missed_call': {
          delete this._pendingCalls[call_id];
          janode_event.event = PLUGIN_EVENT.MISSED;
          janode_event.data.callee = result.callee;
          janode_event.data.caller = result.caller;
          closeTx = CLOSE_TX_NO;
          emit = true;
          break;
        }

        /* SIP INFO */
        case 'info': {
          janode_event.event = PLUGIN_EVENT.INFO;
          janode_event.data.sender = result.sender;
          if (result.displayname) {
            janode_event.data.displayname = result.displayname;
          }
          janode_event.data.type = result.type;
          janode_event.data.content = result.content;
          if (result.headers) {
            janode_event.data.headers = result.headers;
          }
          emit = true;
          break;
        }

        /* RFC2833 DTMF */
        case 'dtmf': {
          janode_event.event = PLUGIN_EVENT.DTMF;
          janode_event.data.sender = result.sender;
          janode_event.data.signal = result.signal;
          janode_event.data.duration = result.duration;
          emit = true;
          break;
        }
      }

      /* The event has been handled */
      if (janode_event.event) {
        if (closeTx === CLOSE_TX_SUCCESS)
          this.closeTransactionWithSuccess(txId, janus_message);
        if (closeTx === CLOSE_TX_ERROR)
          this.closeTransactionWithError(txId, janode_event.data);
        if (emit)
          this.emit(janode_event.event, janode_event.data);
        return janode_event;
      }
    }

    /* The event has not been handled, return a falsy value */
    return null;
  }

  /**
   * Register to the SIP plugin (sending of a SIP REGISTER is optional).
   *
   * @param {Object} params
   * @param {string} [params.type] - optional SIP session type, either "guest" or "helper"
   * @param {boolean} [params.send_register] - True to send a SIP register
   * @param {boolean} [params.force_udp] - True to force UDP for the SIP messaging
   * @param {boolean} [params.force_tcp] - True to force TCP for the SIP messaging
   * @param {boolean} [params.sips] - True to configure a SIPS URI too when registering
   * @param {boolean} [params.rfc2543_cancel] - True to configure sip client to CANCEL pending INVITEs without having received a provisional response
   * @param {string} params.username - The SIP URI to register
   * @param {string} [params.secret] - The password to use, if any
   * @param {string} [params.ha1_secret] - The prehashed password to use, if any
   * @param {string} [params.display_name] - The display name to use when sending SIP REGISTER
   * @param {string} [params.proxy] - The server to register at (not needed for guests)
   * @param {string} [params.outbound_proxy] - The server to register at (not needed for guests)
   * @param {number} [params.register_ttl] - The number of seconds after which the registration should expire
   *
   * @returns {Promise<module:sip-plugin~SIP_EVENT_REGISTERED>}
   */
  async register({ type, send_register, force_udp, force_tcp, sips, rfc2543_cancel, username, secret, ha1_secret, display_name, proxy, outbound_proxy, register_ttl }) {
    const body = {
      request: REQUEST_REGISTER,
      username,
    };

    if (typeof type === 'string') body.type = type;
    if (typeof send_register === 'boolean') body.send_register = send_register;
    if (typeof force_udp === 'boolean') body.force_udp = force_udp;
    if (typeof force_tcp === 'boolean') body.force_tcp = force_tcp;
    if (typeof sips === 'boolean') body.sips = sips;
    if (typeof rfc2543_cancel === 'boolean') body.rfc2543_cancel = rfc2543_cancel;
    if (typeof secret === 'string') body.secret = secret;
    if (typeof ha1_secret === 'string') body.ha1_secret = ha1_secret;
    if (typeof display_name === 'string') body.display_name = display_name;
    if (typeof proxy === 'string') body.proxy = proxy;
    if (typeof outbound_proxy === 'string') body.outbound_proxy = outbound_proxy;
    if (typeof register_ttl === 'number') body.register_ttl = register_ttl;

    const request = {
      janus: 'message',
      body,
    };
    this.decorateRequest(request);
    this._pendingRegister = request.transaction;

    const response = await this.sendRequest(request, 10000);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.REGISTERED) {
      evtdata.username = username;
      return evtdata;
    }
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Start a SIP call.
   *
   * @param {Object} params
   * @param {string} params.uri - The SIP URI to call
   * @param {string} [params.call_id] - The user-defined value of Call-ID SIP header used in all SIP requests throughout the call
   * @param {string} [params.authuser] - The username to use to authenticate as to call, only needed in case authentication is needed and no REGISTER was sent
   * @param {string} [params.secret] - The password to use for authentication, if any
   * @param {string} [params.ha1_secret] - The prehashed password to use for authentication, if any
   * @param {RTCSessionDescription} params.jsep - JSEP offer
   * @returns {Promise<module:sip-plugin~SIP_EVENT_ACCEPTED>}
   */
  async call({ uri, call_id, authuser, secret, ha1_secret, jsep }) {
    if (typeof jsep === 'object' && jsep && jsep.type !== 'offer') {
      const error = new Error('jsep must be an offer');
      return Promise.reject(error);
    }

    const body = {
      request: REQUEST_CALL,
      uri,
    };

    if (typeof call_id === 'string') body.call_id = call_id;
    if (typeof authuser === 'string') body.authuser = authuser;
    if (typeof secret === 'string') body.secret = secret;
    if (typeof ha1_secret === 'string') body.ha1_secret = ha1_secret;

    const request = {
      janus: 'message',
      body,
      jsep,
    };
    this.decorateRequest(request);

    const response = await this.sendRequest(request, 120000);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.ACCEPTED)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Accept an incoming SIP call.
   *
   * @param {Object} params
   * @param {RTCSessionDescription} params.jsep - JSEP answer
   * @returns {Promise<module:sip-plugin~SIP_EVENT_ACCEPTED>}
   */
  async accept({ jsep }) {
    if (typeof jsep === 'object' && jsep && jsep.type !== 'answer') {
      const error = new Error('jsep must be an answer');
      return Promise.reject(error);
    }
    const body = {
      request: REQUEST_ACCEPT,
    };

    const request = {
      janus: 'message',
      body,
      jsep,
    };
    this.decorateRequest(request);

    const response = await this.sendRequest(request, 10000);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.ACCEPTED)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Hangup a SIP call.
   *
   * @returns {Promise<module:sip-plugin~SIP_EVENT_HANGINGUP>}
   */
  async sip_hangup() {
    const body = {
      request: REQUEST_HANGUP,
    };

    const request = {
      janus: 'message',
      body,
    };
    this.decorateRequest(request);

    const response = await this.sendRequest(request, 10000);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.HANGINGUP)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Decline an incoming SIP call.
   *
   * @returns {Promise<module:sip-plugin~SIP_EVENT_DECLINING>}
   */
  async decline() {
    const body = {
      request: REQUEST_DECLINE,
    };

    const request = {
      janus: 'message',
      body,
    };
    this.decorateRequest(request);

    const response = await this.sendRequest(request, 10000);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.DECLINING)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }
}

/**
 * The payload of the plugin message (cfr. Janus docs).
 * {@link https://janus.conf.meetecho.com/docs/sip.html}
 *
 * @private
 * @typedef {Object} SipData
 */

/**
 * The success event for a register request
 *
 * @typedef {Object} SIP_EVENT_REGISTERED
 * @property {string} username - The URI that has been registered
 * @property {boolean} register_sent - True is a REGISTER has been sent
 */

/**
 * The success event for an accept request
 *
 * @typedef {Object} SIP_EVENT_ACCEPTED
 * @property {string} call_id
 * @property {string} username
 * @property {RTCSessionDescription} [jsep]
 */

/**
 * The success event for an hangup request
 *
 * @typedef {Object} SIP_EVENT_HANGINGUP
 * @property {string} call_id
 */

/**
 * The success event for a decline request
 *
 * @typedef {Object} SIP_EVENT_DECLINING
 * @property {string} call_id
 */

/**
 * The exported plugin descriptor.
 *
 * @type {Object}
 * @property {string} id - The plugin identifier used when attaching to Janus
 * @property {module:sip-plugin~SipHandle} Handle - The custom class implementing the plugin
 * @property {Object} EVENT - The events emitted by the plugin
 * @property {string} EVENT.SIP_REGISTERING {@link module:sip-plugin~SipHandle#event:SIP_REGISTERING SIP_REGISTERING}
 * @property {string} EVENT.SIP_CALLING {@link module:sip-plugin~SipHandle#event:SIP_CALLING SIP_CALLING}
 * @property {string} EVENT.SIP_RINGING {@link module:sip-plugin~SipHandle#event:SIP_RINGING SIP_RINGING}
 * @property {string} EVENT.SIP_PROCEEDING {@link module:sip-plugin~SipHandle#event:SIP_PROCEEDING SIP_PROCEEDING}
 * @property {string} EVENT.SIP_INCOMING {@link module:sip-plugin~SipHandle#event:SIP_INCOMING SIP_INCOMING}
 * @property {string} EVENT.SIP_HANGUP {@link module:sip-plugin~SipHandle#event:SIP_HANGUP SIP_HANGUP}
 * @property {string} EVENT.SIP_MISSED {@link module:sip-plugin~SipHandle#event:SIP_MISSED SIP_MISSED}
 * @property {string} EVENT.SIP_INFO {@link module:sip-plugin~SipHandle#event:SIP_INFO SIP_INFO}
 * @property {string} EVENT.SIP_DTMF {@link module:sip-plugin~SipHandle#event:SIP_DTMF SIP_DTMF}
 */
export default {
  id: PLUGIN_ID,
  Handle: SipHandle,
  EVENT: {
    /**
     * The event notifying a register is in progress
     *
     * @event module:sip-plugin~SipHandle#event:SIP_REGISTERING
     * @type {Object}
     */
    SIP_REGISTERING: PLUGIN_EVENT.REGISTERING,

    /**
     * Event for a SIP call in progress
     *
     * @event module:sip-plugin~SipHandle#event:SIP_CALLING
     * @type {Object}
     * @property {string} call_id - SIP Call-ID header for related call
     */
    SIP_CALLING: PLUGIN_EVENT.CALLING,

    /**
     * Event for a SIP call ringing
     *
     * @event module:sip-plugin~SipHandle#event:SIP_RINGING
     * @type {Object}
     * @property {string} call_id - SIP Call-ID header for related call
     */
    SIP_RINGING: PLUGIN_EVENT.RINGING,

    /**
     * Event for a SIP call proceeding
     *
     * @event module:sip-plugin~SipHandle#event:SIP_PROCEEDING
     * @type {Object}
     * @property {string} call_id - SIP Call-ID header for related call
     */
    SIP_PROCEEDING: PLUGIN_EVENT.PROCEEDING,

    /**
     * Event for an incoming SIP call
     *
     * @event module:sip-plugin~SipHandle#event:SIP_INCOMING
     * @type {Object}
     * @property {string} call_id - SIP Call-ID header for related call
     * @property {string} callee - SIP URI that was called
     * @property {string} display_name - Display name of the caller
     * @property {string} username - SIP URI of the caller
     * @property {RTCSessionDescription} [jsep] - The JSEP offer
     */
    SIP_INCOMING: PLUGIN_EVENT.INCOMING,

    /**
     * Event for a SIP call hangup
     *
     * @event module:sip-plugin~SipHandle#event:SIP_HANGUP
     * @type {Object}
     * @property {string} call_id - SIP Call-ID header for related call
     */
    SIP_HANGUP: PLUGIN_EVENT.HANGUP,

    /**
     * Event for a missed SIP call
     *
     * @event module:sip-plugin~SipHandle#event:SIP_MISSED
     * @type {Object}
     * @property {string} call_id - SIP Call-ID header for related call
     * @property {string} callee - SIP URI that was called
     * @property {string} caller - SIP URI of the caller
     */
    SIP_MISSED: PLUGIN_EVENT.MISSED,

    /**
     * @event module:sip-plugin~SipHandle#event:SIP_INFO
     * @type {Object}
     * @property {string} sender - SIP URI of the message sender
     * @property {string} [call_id] - SIP Call-ID header for related call
     * @property {string} [displayname] - Display name of the sender
     * @property {string} type - Content type of the message
     * @property {string} content - Content of the message
     * @property {Object} [headers] - Custom headers extracted from SIP event
     */
    SIP_INFO: PLUGIN_EVENT.INFO,

    /**
     * @event module:sip-plugin~SipHandle#event:SIP_DTMF
     * @type {Object}
     * @property {string} sender - SIP URI of the DTMF sender
     * @property {string} [call_id] - SIP Call-ID header for related call
     * @property {string} signal - The DTMF tone signal
     * @property {number} duration - The DTMF tone duration
     */
    SIP_DTMF: PLUGIN_EVENT.DTMF,
  },
};