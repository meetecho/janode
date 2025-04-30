'use strict';

/**
 * This module contains the implementation of the EchoTest plugin (ref. {@link https://janus.conf.meetecho.com/docs/echotest.html}).
 * @module echotest-plugin
 */

import Handle from '../handle.js';

/* The plugin ID exported in the plugin descriptor */
const PLUGIN_ID = 'janus.plugin.echotest';

/* These are the events/responses that the Janode plugin will manage */
/* Some of them will be exported in the plugin descriptor */
const PLUGIN_EVENT = {
  SLOWLINK: 'echotest_slowlink',
  RESULT: 'echotest_result',
  ERROR: 'echotest_error',
};

/**
 * The class implementing the EchoTest plugin (ref. {@link https://janus.conf.meetecho.com/docs/echotest.html}).<br>
 *
 * It extends the base Janode Handle class and overrides the base "handleMessage" method.<br>
 *
 * Moreover it defines some methods to support EchoTest operations.<br>
 *
 * @hideconstructor
 * @extends module:handle~Handle
 */
class EchoTestHandle extends Handle {
  /**
   * Create a Janode EchoTest handle.
   *
   * @param {module:session~Session} session - A reference to the parent session
   * @param {number} id - The handle identifier
   */
  constructor(session, id) {
    super(session, id);
  }

  /**
   * The custom "handleMessage" needed for handling EchoTest messages.
   *
   * @private
   * @param {Object} janus_message
   * @returns {Object} A falsy value for unhandled events, a truthy value for handled events
   */
  handleMessage(janus_message) {
    const { plugindata, transaction } = janus_message;
    if (plugindata && plugindata.data && plugindata.data.echotest) {
      /**
       * @type {EchoTestData}
       */
      const message_data = plugindata.data;
      const { echotest, event, error, error_code, result } = message_data;

      /* Prepare an object for the output Janode event */
      const janode_event = this._newPluginEvent(janus_message);

      /* The plugin will emit an event only if the handle does not own the transaction */
      /* That means that a transaction has already been closed or this is an async event */
      const emit = (this.ownsTransaction(transaction) === false);

      switch (echotest) {

        /* Generic event (e.g. result, error) */
        case 'event':
          /* EchoTest SlowLink event */
          if (event === 'slow_link') {
            janode_event.event = PLUGIN_EVENT.SLOWLINK;
            janode_event.data.media = message_data.media;
            if (typeof message_data['current-bitrate'] !== 'number') {
              janode_event.data.bitrate = message_data['current-bitrate'];
            }
            break;
          }
          /* EchoTest Result event (ok, done ...)  */
          if (result) {
            janode_event.event = PLUGIN_EVENT.RESULT;
            janode_event.data.result = result;
            break;
          }
          /* EchoTest error */
          if (error) {
            janode_event.event = PLUGIN_EVENT.ERROR;
            janode_event.data = new Error(`${error_code} ${error}`);
            /* In case of error, close a transaction */
            this.closeTransactionWithError(transaction, janode_event.data);
            break;
          }
          break;
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

  /**
   * Start/update an echotest session.
   *
   * @param {Object} params
   * @param {boolean} [params.audio] - True to request audio in this session
   * @param {boolean} [params.video] - True to request video in this session
   * @param {RTCSessionDescription} [params.jsep=null] - The JSEP offer
   * @param {number} [params.bitrate=0] - The bitrate to force in the session
   * @param {boolean} [params.record=false] - True to record the session
   * @param {string} [params.filename=null]  - The filename of the recording
   * @returns {Promise<module:echotest-plugin~ECHOTEST_EVENT_RESULT>}
   */
  async start({ audio, video, jsep = null, bitrate = 0, record = false, filename = null }) {
    if (typeof jsep === 'object' && jsep.type !== 'offer') {
      const error = new Error('jsep must be an offer');
      return Promise.reject(error);
    }

    const body = {
      audio: (typeof audio === 'boolean') ? audio : false,
      video: (typeof video === 'boolean') ? video : false,
      record: (typeof record === 'boolean') ? record : false,
    };

    if (typeof bitrate === 'number') body.bitrate = bitrate;
    if (typeof filename === 'string') body.filename = filename;

    const response = await this.message(body, jsep);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.RESULT && evtdata.result === 'ok')
      return evtdata;
    const error = new Error('invalid echotest result');
    throw (error);
  }

}

/**
 * The payload of the plugin message (cfr. Janus docs).
 * {@link https://janus.conf.meetecho.com/docs/echotest.html}
 *
 * @private
 * @typedef {Object} EchoTestData
 */

/**
 * @typedef {Object} ECHOTEST_EVENT_RESULT
 * @property {string} result - The result status (ok, done ...)
 * @property {RTCSessionDescription} [jsep] - The JSEP answer from Janus
 */

/**
 * The exported plugin descriptor.
 *
 * @type {Object}
 * @property {string} id - The plugin identifier used when attaching to Janus
 * @property {module:echotest-plugin~EchoTestHandle} Handle - The custom class implementing the plugin
 * @property {Object} EVENT - The events emitted by the plugin
 * @property {string} EVENT.ECHOTEST_RESULT {@link module:echotest-plugin~EchoTestHandle#event:ECHOTEST_RESULT ECHOTEST_RESULT}
 * @property {string} EVENT.ECHOTEST_SLOWLINK {@link module:echotest-plugin~EchoTestHandle#event:ECHOTEST_SLOWLINK ECHOTEST_SLOWLINK}
 * @property {string} EVENT.ECHOTEST_ERROR {@link module:echotest-plugin~EchoTestHandle#event:ECHOTEST_ERROR ECHOTEST_ERROR}
 */
export default {
  id: PLUGIN_ID,
  Handle: EchoTestHandle,
  EVENT: {
    /**
     * The result event emitted if the session status changes.
     *
     * @event module:echotest-plugin~EchoTestHandle#event:ECHOTEST_RESULT
     * @type {Object}
     * @property {string} result - The result status (ok, done ...)
     * @property {RTCSessionDescription} [jsep] - The JSEP answer from Janus
     */
    ECHOTEST_RESULT: PLUGIN_EVENT.RESULT,

    /**
     * The slowlink event emitted by the plugin.
     *
     * @event module:echotest-plugin~EchoTestHandle#event:ECHOTEST_SLOWLINK
     * @type {Object}
     * @property {string} media - The media type (audio, video)
     * @property {number} [bitrate] - Current bitrate cap
     */
    ECHOTEST_SLOWLINK: PLUGIN_EVENT.SLOWLINK,

    /**
     * @event module:echotest-plugin~EchoTestHandle#event:ECHOTEST_ERROR
     * @type {Error}
     */
    ECHOTEST_ERROR: PLUGIN_EVENT.ERROR,
  },
};