'use strict';

/**
 * This module contains the implementation of the Record&Play plugin (ref. {@link https://janus.conf.meetecho.com/docs/recordplay.html}).
 * @module recordplay-plugin
 */

import Handle from '../handle.js';

/* The plugin ID exported in the plugin descriptor */
const PLUGIN_ID = 'janus.plugin.recordplay';

/* These are the requests defined for the Janus RecordPlay API */
const REQUEST_LIST = 'list';
const REQUEST_UPDATE = 'update';
const REQUEST_RECORD = 'record';
const REQUEST_PLAY = 'play';
const REQUEST_START = 'start';
const REQUEST_CONFIGURE = 'configure';
const REQUEST_PAUSE = 'pause';
const REQUEST_RESUME = 'resume';
const REQUEST_STOP = 'stop';

/* These are the events/responses that the Janode plugin will manage */
/* Some of them will be exported in the plugin descriptor */
const PLUGIN_EVENT = {
  RECORDINGS_LIST: 'recordplay_list',
  RECORDING: 'recordplay_recording',
  CONFIGURED: 'recordplay_configured',
  PAUSED: 'recordplay_paused',
  RESUMED: 'recordplay_resumed',
  PREPARING: 'recordplay_preparing',
  PLAYING: 'recordplay_playing',
  STOPPED: 'recordplay_stopped',
  SLOW_LINK: 'recordplay_slowlink',
  DONE: 'recordplay_done',
  SUCCESS: 'recordplay_success',
  ERROR: 'recordplay_error',
};

/**
 * The class implementing the Record&Play plugin (ref. {@link https://janus.conf.meetecho.com/docs/recordplay.html}).<br>
 *
 * It extends the base Janode Handle class and overrides the base "handleMessage" method.<br>
 *
 * Moreover it defines many methods to support RecordPlay operations.
 *
 * @hideconstructor
 * @extends module:handle~Handle
 */
class RecordPlayHandle extends Handle {
  /**
   * Create a Janode RecordPlay handle.
   *
   * @param {module:session~Session} session - A reference to the parent session
   * @param {number} id - The handle identifier
   */
  constructor(session, id) {
    super(session, id);
  }

  /**
   * The custom "handleMessage" needed for handling RecordPlay messages.
   *
   * @private
   * @param {Object} janus_message
   * @returns {Object} A falsy value for unhandled events, a truthy value for handled events
   */
  handleMessage(janus_message) {
    const { plugindata, transaction } = janus_message;
    if (plugindata && plugindata.data && plugindata.data.recordplay) {
      /**
       * @type {RecordPlayData}
       */
      const message_data = plugindata.data;
      const { recordplay, error, error_code } = message_data;

      /* Prepare an object for the output Janode event */
      const janode_event = this._newPluginEvent(janus_message);

      /* The plugin will emit an event only if the handle does not own the transaction */
      /* That means that a transaction has already been closed or this is an async event */
      const emit = (this.ownsTransaction(transaction) === false);

      switch (recordplay) {

        /* Got a list of recordings */
        case 'list':
          /* Recordings list API */
          janode_event.event = PLUGIN_EVENT.RECORDINGS_LIST;
          if (typeof message_data.list !== 'undefined')
            janode_event.data.list = message_data.list;
          break;

        /* Update success */
        case 'ok':
          /* "ok" is treated as "success" */
          janode_event.event = PLUGIN_EVENT.SUCCESS;
          break;

        /* Configure success */
        case 'configure':
          /* Configure API */
          janode_event.event = PLUGIN_EVENT.CONFIGURED;
          if (typeof message_data.result !== 'undefined')
            janode_event.data.settings = message_data.result.settings;
          break;

        /* Generic event (e.g. errors) */
        case 'event':
          /* RecordPlay error */
          if (error) {
            janode_event.event = PLUGIN_EVENT.ERROR;
            janode_event.data = new Error(`${error_code} ${error}`);
            /* In case of error, close a transaction */
            this.closeTransactionWithError(transaction, janode_event.data);
            break;
          }
          /* Update for this handle */
          if (typeof message_data.result !== 'undefined') {
            if (typeof message_data.result.status !== 'undefined') {
              if (typeof message_data.result.id !== 'undefined')
                janode_event.data.id = message_data.result.id;
              if (typeof message_data.result.is_private !== 'undefined')
                janode_event.data.is_private = message_data.result.is_private;
              if (typeof message_data.result.media !== 'undefined')
                janode_event.data.media = message_data.result.media;
              if (typeof message_data.result.uplink !== 'undefined')
                janode_event.data.uplink = message_data.result.uplink;
              switch (message_data.result.status) {
                case 'recording':
                  janode_event.event = PLUGIN_EVENT.RECORDING;
                  break;
                case 'paused':
                  janode_event.event = PLUGIN_EVENT.PAUSED;
                  break;
                case 'resumed':
                  janode_event.event = PLUGIN_EVENT.RESUMED;
                  break;
                case 'preparing':
                  janode_event.event = PLUGIN_EVENT.PREPARING;
                  break;
                case 'playing':
                  janode_event.event = PLUGIN_EVENT.PLAYING;
                  break;
                case 'stopped':
                  janode_event.event = PLUGIN_EVENT.STOPPED;
                  break;
                case 'slow_link':
                  janode_event.event = PLUGIN_EVENT.SLOW_LINK;
                  break;
                case 'done':
                  janode_event.event = PLUGIN_EVENT.DONE;
                  break;
              }
            }
            break;
          }
      }

      /* The event has been handled */
      if (janode_event.event) {
        /* Try to close the transaction */
        this.closeTransactionWithSuccess(transaction, janus_message);
        /* If the transaction was not owned, emit the event */
        if (emit) this.emit(janode_event.event, janode_event.data);
        return janode_event;
      }
    }

    /* The event has not been handled, return a falsy value */
    return null;
  }

  /*----------*/
  /* USER API */
  /*----------*/

  /* These are the APIs that users need to work with the recordplay plugin */

  /**
   * List recordings.
   *
   * @param {Object} params
   * @param {string} [params.admin_key] - The optional admin key needed for invoking the API
   * @returns {Promise<module:recordplay-plugin~RECORDPLAY_EVENT_RECORDINGS_LIST>}
   */
  async listRecordings({ admin_key }) {
    const body = {
      request: REQUEST_LIST,
    };
    if (typeof admin_key === 'string') body.admin_key = admin_key;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.RECORDINGS_LIST)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Re-index the list of recordings.
   *
   * @param {Object} params
   * @param {string} [params.admin_key] - The optional admin key needed for invoking the API
   * @returns {Promise<module:recordplay-plugin~RECORDPLAY_EVENT_UPDATE_RESPONSE>}
   */
  async updateRecordings({ admin_key }) {
    const body = {
      request: REQUEST_UPDATE,
    };
    if (typeof admin_key === 'string') body.admin_key = admin_key;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.SUCCESS)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Configure a recording session.
   *
   * @param {Object} params
   * @param {number} [params.maxBitrate] - The optional bitrate to enforce via REMB
   * @param {number} [params.keyframeInterval] - The optional keyframe interval to enforce, in ms
   * @returns {Promise<module:recordplay-plugin~RECORDPLAY_EVENT_CONFIGURED>}
   */
  async configure({ maxBitrate, keyframeInterval }) {
    const body = {
      request: REQUEST_CONFIGURE,
    };
    if (typeof maxBitrate === 'number') body['video-bitrate-max'] = maxBitrate;
    if (typeof keyframeInterval === 'number') body['video-keyframe-interval'] = keyframeInterval;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.CONFIGURED)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Start a recording session.
   *
   * @param {Object} params
   * @param {number} [params.id] - The ID to assign to the recording
   * @param {string} [params.name] - The short description of the recording
   * @param {boolean} [params.is_private] - Flag the recording as private
   * @param {string} [params.filename] - Set the base path/filename for the recording
   * @param {string} [audiocodec] - Set the audio codec to use in the recording
   * @param {string} [videocodec] - Set the video codec to use in the recording
   * @param {string} [videoprofile] - Set the video fmtp to use in the recording
   * @param {boolean} [params.opusred] - Set whether RED should be negotiated for audio
   * @param {boolean} [params.textdata] - In case data channels are negotiated, set whether it should be text (default) or binary data
   * @param {boolean} [params.update] - Set to true for renegotiations
   * @param {RTCSessionDescription} params.jsep - JSEP offer to be sent to Janus
   * @returns {Promise<module:recordplay-plugin~RECORDPLAY_EVENT_STATUS>}
   */
  async record({ id, name, is_private, filename, audiocodec, videocodec, videoprofile, opusred, textdata, update, jsep }) {
    if (!jsep || typeof jsep !== 'object' || jsep && jsep.type !== 'offer') {
      const error = new Error('jsep must be an offer');
      return Promise.reject(error);
    }
    const body = {
      request: REQUEST_RECORD,
    };
    if (typeof id === 'number') body.id = id;
    if (typeof name === 'string') body.name = name;
    if (typeof is_private === 'boolean') body.is_private = is_private;
    if (typeof filename === 'string') body.filename = filename;
    if (typeof audiocodec === 'string') body.audiocodec = audiocodec;
    if (typeof videocodec === 'string') body.videocodec = videocodec;
    if (typeof videoprofile === 'string') body.videoprofile = videoprofile;
    if (typeof opusred === 'boolean') body.opusred = opusred;
    if (typeof textdata === 'boolean') body.textdata = textdata;
    if (typeof update === 'boolean') body.update = update;

    const response = await this.message(body, jsep);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.RECORDING)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Play an existing recording.
   *
   * @param {Object} params
   * @param {number} params.id - The ID of the recording to replay
   * @param {boolean} [params.restart] - Set to true for triggering a renegotiation and an ICE restart
   * @returns {Promise<module:recordplay-plugin~RECORDPLAY_EVENT_STATUS>}
   */
  async play({ id, restart }) {
    const body = {
      request: REQUEST_PLAY,
      id
    };
    if (typeof restart === 'boolean') body.restart = restart;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.PREPARING)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Start a playback session.
   *
   * @param {Object} params
   * @param {RTCSessionDescription} params.jsep
   * @returns {Promise<module:streaming-plugin~RECORDPLAY_EVENT_STATUS>}
   */
  async start({ jsep }) {
    if (!jsep || typeof jsep !== 'object' || jsep && jsep.type !== 'answer') {
      const error = new Error('jsep must be an answer');
      return Promise.reject(error);
    }

    const body = {
      request: REQUEST_START,
    };

    const response = await this.message(body, jsep);
    const { event, data: evtdata } = this._getPluginEvent(response);;
    if (event === PLUGIN_EVENT.PLAYING)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Pauses the current recording session.
   *
   * @returns {Promise<module:streaming-plugin~RECORDPLAY_EVENT_STATUS>}
   */
  async pause() {
    const body = {
      request: REQUEST_PAUSE,
    };

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);;
    if (event === PLUGIN_EVENT.PAUSED)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Resumes the current recording session.
   *
   * @returns {Promise<module:streaming-plugin~RECORDPLAY_EVENT_STATUS>}
   */
  async resume() {
    const body = {
      request: REQUEST_RESUME,
    };

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);;
    if (event === PLUGIN_EVENT.RESUMED)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Stop the current recording or playback session.
   *
   * @returns {Promise<module:streaming-plugin~RECORDPLAY_EVENT_STATUS>}
   */
  async stop() {
    const body = {
      request: REQUEST_STOP,
    };

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);;
    if (event === PLUGIN_EVENT.STOPPED)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

}

/**
 * The payload of the plugin message (cfr. Janus docs).
 * {@link https://janus.conf.meetecho.com/docs/recordplay.html}
 *
 * @private
 * @typedef {Object} RecordPlayData
 */

/**
 * The response event for recordplay recordings request.
 *
 * @typedef {Object} RECORDPLAY_EVENT_RECORDINGS_LIST
 * @property {object[]} list - The list of the recordings as returned by Janus
 */

/**
 * The response event for recordplay update request.
 *
 * @typedef {Object} RECORDPLAY_EVENT_UPDATE_RESPONSE
 */

/**
 * The response event for record request.
 *
 * @typedef {Object} RECORDPLAY_EVENT_RECORDING
 * @property {number} [id] - The involved recording identifier
 * @property {boolean} [is_private] - True if the event mentions a private recording
 * @property {RTCSessionDescription} [jsep] - Optional JSEP from Janus
 */

/**
 * The response event for configure request.
 *
 * @typedef {Object} RECORDPLAY_EVENT_CONFIGURED
 * @property {object} [settings] - The current settings as returned by Janus
 */

/**
 * The response event for pause request.
 *
 * @typedef {Object} RECORDPLAY_EVENT_PAUSED
 * @property {number} [id] - The involved recording identifier
 */

/**
 * The response event for resume request.
 *
 * @typedef {Object} RECORDPLAY_EVENT_RESUMED
 * @property {number} [id] - The involved recording identifier
 */

/**
 * The response event for play request.
 *
 * @typedef {Object} RECORDPLAY_EVENT_PREPARING
 * @property {number} [id] - The involved recording identifier
 * @property {boolean} [is_private] - True if the event mentions a private recording
 * @property {RTCSessionDescription} [jsep] - Optional JSEP from Janus
 */

/**
 * The response event for start request.
 *
 * @typedef {Object} RECORDPLAY_EVENT_PLAYING
 * @property {number} [id] - The involved recording identifier
 */

/**
 * The response event for stop request.
 *
 * @typedef {Object} RECORDPLAY_EVENT_STOPPED
 * @property {number} [id] - The involved recording identifier
 * @property {boolean} [is_private] - True if the event mentions a private recording
 */

/**
 * A recordplay slow-link event.
 *
 * @typedef {Object} RECORDPLAY_EVENT_SLOW_LINK
 * @property {string} [media] - Audio or video
 * @property {number} [current-bitrate] - The current configured max video bitrate
 * @property {boolean} [uplink] - Whether this is an uplink or downlink event
 */

/**
 * A recordplay done event.
 *
 * @typedef {Object} RECORDPLAY_EVENT_DONE
 * @property {number} [id] - The involved recording identifier
 * @property {boolean} [is_private] - True if the event mentions a private recording
 */

/**
 * The exported plugin descriptor.
 *
 * @type {Object}
 * @property {string} id - The plugin identifier used when attaching to Janus
 * @property {module:recordplay-plugin~RecordPlayHandle} Handle - The custom class implementing the plugin
 * @property {Object} EVENT - The events emitted by the plugin
 * @property {string} EVENT.RECORDPLAY_SLOW_LINK {@link module:recordplay-plugin~RecordPlayHandle#event:RECORDPLAY_STATUS RECORDPLAY_SLOW_LINK}
 * @property {string} EVENT.RECORDPLAY_DONE {@link module:recordplay-plugin~RecordPlayHandle#event:RECORDPLAY_STATUS RECORDPLAY_DONE}
 * @property {string} EVENT.RECORDPLAY_ERROR {@link module:recordplay-plugin~RecordPlayHandle#event:RECORDPLAY_ERROR RECORDPLAY_ERROR}
 */
export default {
  id: PLUGIN_ID,
  Handle: RecordPlayHandle,

  EVENT: {
    /**
     * Trouble on an active stream.
     *
     * @event module:recordplay-plugin~RecordPlayHandle#event:RECORDPLAY_SLOW_LINK
     * @type {module:recordplay-plugin~RECORDPLAY_EVENT_SLOW_LINK}
     */
    RECORDPLAY_SLOW_LINK: PLUGIN_EVENT.SLOW_LINK,

    /**
     * A recording/playback session is over.
     *
     * @event module:recordplay-plugin~RecordPlayHandle#event:RECORDPLAY_DONE
     * @type {module:recordplay-plugin~RECORDPLAY_EVENT_DONE}
     */
    RECORDPLAY_DONE: PLUGIN_EVENT.DONE,

    /**
     * Generic recordplay error.
     *
     * @event module:recordplay-plugin~RecordPlayHandle#event:RECORDPLAY_ERROR
     * @type {Error}
     */
    RECORDPLAY_ERROR: PLUGIN_EVENT.ERROR,
  },
};
