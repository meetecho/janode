'use strict';

/**
 * This module contains the implementation of the Streaming plugin (ref. {@link https://janus.conf.meetecho.com/docs/streaming.html}).
 * @module streaming-plugin
 */

import Handle from '../handle.js';

/* The plugin ID exported in the plugin descriptor */
const PLUGIN_ID = 'janus.plugin.streaming';

/* These are the requests defined for the Janus Streaming API */
const REQUEST_LIST = 'list';
const REQUEST_INFO = 'info';
const REQUEST_START = 'start';
const REQUEST_WATCH = 'watch';
const REQUEST_STOP = 'stop';
const REQUEST_SWITCH = 'switch';
const REQUEST_PAUSE = 'pause';
const REQUEST_CONFIGURE = 'configure';
const REQUEST_RECORDING = 'recording';
const REQUEST_ENABLE = 'enable';
const REQUEST_DISABLE = 'disable';
const REQUEST_CREATE = 'create';
const REQUEST_DESTROY = 'destroy';
/* Recording actions */
const ACTION_START_REC = 'start';
const ACTION_STOP_REC = 'stop';

/* These are the events/responses that the Janode plugin will manage */
/* Some of them will be exported in the plugin descriptor */
const PLUGIN_EVENT = {
  STATUS: 'streaming_status',
  SWITCHED: 'streaming_switched',
  CONFIGURED: 'streaming_configured',
  LIST: 'streaming_list',
  INFO: 'streaming_info',
  CREATED: 'streaming_created',
  DESTROYED: 'streaming_destroyed',
  OK: 'streaming_ok',
  ERROR: 'streaming_error',
};

/**
 * The class implementing the Streaming plugin (ref. {@link https://janus.conf.meetecho.com/docs/streaming.html}).<br>
 *
 * It extends the base Janode Handle class and overrides the "handleMessage" method.<br>
 *
 * Moreover it defines many methods to support Streaming operations.<br>
 *
 * @hideconstructor
 */
class StreamingHandle extends Handle {
  /**
   * Create a Janode Streaming handle.
   *
   * @param {module:session~Session} session - A reference to the parent session
   * @param {number} id - The handle identifier
   */
  constructor(session, id) {
    super(session, id);
    /**
     * The mountpoint this handle has subscribed to.
     *
     * @type {number|string}
     */
    this.mp = null;
  }

  /**
   * The custom "handleMessage" needed for handling Streamiing messages.
   *
   * @private
   * @param {object} janus_message
   * @returns {object} A falsy value for unhandled events, a truthy value for handled events
   */
  handleMessage(janus_message) {
    const { plugindata, jsep, transaction } = janus_message;
    if (plugindata && plugindata.data && plugindata.data.streaming) {
      /**
       * @type {StreamingData}
       */
      const message_data = plugindata.data;
      const { streaming, error, error_code } = message_data;

      /* Prepare an object for the output Janode event */
      const janode_event = {
        /* The name of the resolved event */
        event: null,
        /* The event payload */
        data: {},
      };

      /* Add JSEP data if available */
      if (jsep) janode_event.data.jsep = jsep;
      if (jsep && typeof jsep.e2ee === 'boolean') janode_event.data.e2ee = jsep.e2ee;

      /* The plugin will emit an event only if the handle does not own the transaction */
      /* That means that a transaction has already been closed or this is an async event */
      const emit = (this.ownsTransaction(transaction) === false);

      /* Use the "janode" property to store the output event */
      janus_message._janode = janode_event;

      switch (streaming) {

        /* Ok is a success response */
        case 'ok':
          janode_event.event = PLUGIN_EVENT.OK;
          break;

        /* Mountpoint info */
        case 'info': {
          janode_event.event = PLUGIN_EVENT.INFO;
          janode_event.data = message_data.info;
          break;
        }

        /* Mountpoint list */
        case 'list':
          janode_event.event = PLUGIN_EVENT.LIST;
          janode_event.data.list = message_data.list;
          break;

        /* Mountpoint created */
        case 'created':
          janode_event.event = PLUGIN_EVENT.CREATED;
          janode_event.data.name = message_data.created;
          janode_event.data.id = (message_data.stream) ? message_data.stream.id : null;
          janode_event.data.description = (message_data.stream) ? message_data.stream.description : null;
          janode_event.data.audio_port = (message_data.stream) ? message_data.stream.audio_port : null;
          janode_event.data.audio_rtcp_port = (message_data.stream) ? message_data.stream.audio_rtcp_port : null;
          janode_event.data.video_port = (message_data.stream) ? message_data.stream.video_port : null;
          janode_event.data.video_port_2 = (message_data.stream) ? message_data.stream.video_port_2 : null;
          janode_event.data.video_port_3 = (message_data.stream) ? message_data.stream.video_port_3 : null;
          janode_event.data.video_rtcp_port = (message_data.stream) ? message_data.stream.video_rtcp_port : null;
          janode_event.data.data_port = (message_data.stream) ? message_data.stream.data_port : null;
          break;

        /* Mountpoint destroyed */
        case 'destroyed':
          janode_event.event = PLUGIN_EVENT.DESTROYED;
          janode_event.data.id = message_data.destroyed;
          break;

        /* Generic events (error, result ...) */
        case 'event':
          /* Streaming error */
          if (error) {
            janode_event.event = PLUGIN_EVENT.ERROR;
            janode_event.data = new Error(`${error_code} ${error}`);
            /* In case of error, close a transaction */
            this.closeTransactionWithError(transaction, janode_event.data);
            break;
          }
          /* Result event (status, switched etc.) */
          if (typeof message_data.result !== 'undefined') {
            /* Result -> Status event */
            if (typeof message_data.result.status !== 'undefined') {
              janode_event.event = PLUGIN_EVENT.STATUS;
              janode_event.data.status = message_data.result.status;
              if (janode_event.data.status !== 'preparing') {
                /* Add mp id to preparing event */
                janode_event.data.id = this.mp;
              }
              if (janode_event.data.status === 'updating') {
                /* Flag for ongoing restarts */
                janode_event.data.restart = true;
              }
              break;
            }
            /* Result -> Switched event */
            if (typeof message_data.result.switched !== 'undefined') {
              janode_event.event = PLUGIN_EVENT.SWITCHED;
              janode_event.data.switched = message_data.result.switched;
              janode_event.data.id = message_data.result.id;
              break;
            }
            /* Result -> Event */
            if (typeof message_data.result.event !== 'undefined') {
              /* Configured */
              if (message_data.result.event === 'configured') {
                janode_event.event = PLUGIN_EVENT.CONFIGURED;
                break;
              }
              break;
            }
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

  /*----------*/
  /* USER API */
  /*----------*/

  /* These are the APIs that users need to work with the streaming plugin */

  /**
   * Subscribe to a mountpoint.
   *
   * @param {object} params
   * @param {number|string} params.id - The mp id
   * @param {string} [params.pin] - The optional mp pin
   * @param {boolean} [params.audio] - True to request audio
   * @param {boolean} [params.video] - True to request video
   * @param {boolean} [params.data] - True to request data
   * @param {boolean} [params.restart=false] - True to trigger a restart
   * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_STATUS>}
   */
  async watch({ id, pin, audio, video, data, restart = false }) {
    const body = {
      request: REQUEST_WATCH,
      id,
    };
    if (typeof pin === 'string') body.pin = '' + pin;
    if (typeof audio === 'boolean') body.offer_audio = audio;
    if (typeof video === 'boolean') body.offer_video = video;
    if (typeof data === 'boolean') body.offer_data = data;
    if (typeof restart === 'boolean') body.restart = restart;

    const response = await this.message(body);
    const { event, data: evtdata } = response._janode || {};
    if (event === PLUGIN_EVENT.STATUS && (evtdata.status === 'preparing' || evtdata.status === 'updating')) {
      /* Set current mp to subscribed id */
      this.mp = id;
      return evtdata;
    }
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Start a mountpoint stream.
   *
   * @param {object} params
   * @property {RTCSessionDescription} params.jsep
   * @property {boolean} [params.e2ee]
   * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_STATUS>}
   */
  async start({ jsep, e2ee }) {
    if (typeof jsep === 'object' && jsep && jsep.type !== 'answer') {
      const error = new Error('jsep must be an answer');
      return Promise.reject(error);
    }

    const body = {
      request: REQUEST_START,
    };
    jsep.e2ee = (typeof e2ee === 'boolean') ? e2ee : jsep.e2ee;

    const response = await this.message(body, jsep);
    const { event, data: evtdata } = response._janode || {};
    if (event === PLUGIN_EVENT.STATUS && (evtdata.status === 'starting' || evtdata.status === 'started'))
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Pause the current stream.
   *
   * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_STATUS>}
   */
  async pause() {
    const body = {
      request: REQUEST_PAUSE,
    };

    const response = await this.message(body);
    const { event, data: evtdata } = response._janode || {};
    if (event === PLUGIN_EVENT.STATUS && evtdata.status === 'pausing')
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Stop the current stream.
   *
   * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_STATUS>}
   */
  async stop() {
    const body = {
      request: REQUEST_STOP,
    };

    const response = await this.message(body);
    const { event, data: evtdata } = response._janode || {};
    if (event === PLUGIN_EVENT.STATUS && evtdata.status === 'stopping')
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Switch to another mountpoint.
   *
   * @param {object} params
   * @param {number|string} params.id - The mp id to switch to
   * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_SWITCHED>}
   */
  async switch({ id }) {
    const body = {
      request: REQUEST_SWITCH,
      id,
    };

    const response = await this.message(body);
    const { event, data: evtdata } = response._janode || {};
    if (event === PLUGIN_EVENT.SWITCHED && evtdata.switched === 'ok') {
      /* Set current mp to the switched id */
      this.mp = evtdata.id;
      return evtdata;
    }
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Configure an active stream.
   *
   * @param {object} params
   * @param {boolean} [params.audio] - Enable/disable audio
   * @param {boolean} [params.video] - Enable/disable video
   * @param {boolean} [params.data] - Enable/disable data
   * @param {number} [params.substream] - Substream to switch to (simuclast)
   * @param {number} [params.temporal] - Temporal layer to switch to (simulcast)
   * @param {number} [params.fallback] - Fallback timer (simulcast)
   * @param {number} [params.spatial_layer] - Spatial layer to switch to (svc)
   * @param {number} [params.temporal_layer] - Temporal layer to switch to (svc)
   * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_CONFIGURED>}
   */
  async configure({ audio, video, data, substream, temporal, fallback, spatial_layer, temporal_layer }) {
    const body = {
      request: REQUEST_CONFIGURE,
    };
    if (typeof audio === 'boolean') body.audio = audio;
    if (typeof video === 'boolean') body.video = video;
    if (typeof data === 'boolean') body.data = data;
    if (typeof substream === 'number') body.substream = substream;
    if (typeof temporal === 'number') body.temporal = temporal;
    if (typeof fallback === 'number') body.fallback = fallback;
    if (typeof spatial_layer === 'number') body.spatial_layer = spatial_layer;
    if (typeof temporal_layer === 'number') body.temporal_layer = temporal_layer;

    const response = await this.message(body);
    const { event, data: evtdata } = response._janode || {};
    if (event === PLUGIN_EVENT.CONFIGURED)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /*----------------*/
  /* Management API */
  /*----------------*/

  /* These are the APIs needed to manage streaming resources (mountpoints, recording ...) */

  /**
   * List all the available mountpoints.
   *
   * @param {object} params
   * @param {string} [params.admin_key] - The admin key needed for invoking the API
   * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_LIST>}
   */
  async list({ admin_key } = {}) {
    const body = {
      request: REQUEST_LIST,
    };
    if (typeof admin_key === 'string') body.admin_key = admin_key;

    const response = await this.message(body);
    const { event, data: evtdata } = response._janode || {};
    if (event === PLUGIN_EVENT.LIST)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Get mountpoint info.
   *
   * @param {object} params
   * @param {number|string} params.id
   * @param {string} [params.secret]
   * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_INFO>}
   */
  async info({ id, secret }) {
    const body = {
      request: REQUEST_INFO,
      id,
    };
    if (typeof secret === 'string') body.secret = '' + secret;

    const response = await this.message(body);
    const { event, data: evtdata } = response._janode || {};
    if (event === PLUGIN_EVENT.INFO)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Start recording on a mountpoint
   *
   * @param {object} params
   * @param {number|string} params.id
   * @param {string} [params.audio] - The filename for audio
   * @param {string} [params.video] - The filename for video
   * @param {string} [params.data] - The filename for data
   * @param {string} [params.secret]
   * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_OK>}
   */
  async startRecording({ id, audio, video, data, secret }) {
    const body = {
      request: REQUEST_RECORDING,
      action: ACTION_START_REC,
      id,
    };
    if (audio) body.audio = audio;
    if (video) body.video = video;
    if (data) body.data = data;
    if (typeof secret === 'string') body.secret = '' + secret;

    const response = await this.message(body);
    const { event, data: evtdata } = response._janode || {};
    if (event === PLUGIN_EVENT.OK)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Stop recording on a mountpoint.
   *
   * @param {object} params
   * @param {number|string} params.id
   * @param {boolean} [params.audio=true] - True to stop recording of audio
   * @param {boolean} [params.video=true] - True to stop recording of video
   * @param {boolean} [params.data=true] - True to stop recording of data
   * @param {string} [params.secret]
   * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_OK>}
   */
  async stopRecording({ id, audio = true, video = true, data = true, secret }) {
    const body = {
      request: REQUEST_RECORDING,
      action: ACTION_STOP_REC,
      id,
      audio,
      video,
      data,
    };
    if (typeof secret === 'string') body.secret = '' + secret;

    const response = await this.message(body);
    const { event, data: evtdata } = response._janode || {};
    if (event === PLUGIN_EVENT.OK)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Enable a mountpoint.
   *
   * @param {object} params
   * @param {number|string} params.id
   * @param {string} [params.secret]
   * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_OK>}
   */
  async enable({ id, secret }) {
    const body = {
      request: REQUEST_ENABLE,
      id,
    };
    if (typeof secret === 'string') body.secret = secret;

    const response = await this.message(body);
    const { event, data: evtdata } = response._janode || {};
    if (event === PLUGIN_EVENT.OK)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Disable a mountpoint.
   *
   * @param {object} params
   * @param {number|string} params.id
   * @param {boolean} [stop_recording=true] - True if the user wants to also stop the recording of a disabled moutnpoint
   * @param {string} [params.secret]
   * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_OK>}
   */
  async disable({ id, stop_recording = true, secret }) {
    const body = {
      request: REQUEST_DISABLE,
      id,
      stop_recording,
    };
    if (typeof secret === 'string') body.secret = secret;

    const response = await this.message(body);
    const { event, data: evtdata } = response._janode || {};
    if (event === PLUGIN_EVENT.OK)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Create a RTP live mountpoint.
   *
   * @param {object} params
   * @param {number|string} [params.id=0] - The id for the new mountpoint (if omitted Janus will pick one)
   * @param {string} [params.description] - A description for the mp
   * @param {string} [params.secret] - The secret that'll be needed to edit this mountpoint
   * @param {string} [params.pin] - The pin that'll be needed to connect to the new mountpoint
   * @param {string} [params.admin_key] - The admin key needed for invoking the API
   * @param {boolean} [params.permanent=false] - True if Janus must persist the mp on a config file
   * @param {boolean} [params.is_private=false] - Flag the mp as private
   * @param {boolean} [params.e2ee=false] - True to set a a mp as end to end encrypted
   * @param {object} [params.audio] - The audio descriptor for the mp
   * @param {number} [params.audio.port] - Port used for audio RTP
   * @param {number} [params.audio.rtcpport] - Port used for audio RTCP
   * @param {string} [params.audio.mcast] - Multicast address to listen to
   * @param {number} [params.audio.pt] - Payload type that will be used
   * @param {string} [params.audio.rtpmap] - rtpmap type that will be used
   * @param {boolean} [params.audio.skew] - Set skew compensation
   * @param {object} [params.video] - The video descriptor for the mp
   * @param {number} [params.video.port] - Port used for video RTP
   * @param {number} [params.video.port2] - Port used for video RTP (simulcast layer)
   * @param {number} [params.video.port3] - Port used for video RTP (simulcast layer)
   * @param {number} [params.video.rtcpport] - Port used for video RTCP
   * @param {string} [params.video.mcast] - Multicast address to listen to
   * @param {number} [params.video.pt] - Payload type that will be used
   * @param {string} [params.video.rtpmap] - rtpmap that will be used
   * @param {boolean} [params.video.skew] - Set skew compensation
   * @param {string} [params.video.fmtp] - fmtp that will be used
   * @param {boolean} [params.video.buffer] - Enable buffering of the keyframes
   * @param {object} [params.data] - The datachannel descriptor for the mp
   * @param {number} [params.data.port] - Port used for datachannels packets
   * @param {boolean} [params.data.buffer] - Enable buffering of the datachannels
   * @param {number} [params.threads] - The number of helper threads used in this mp
   * @param {object} [params.metadata] - An opaque metadata to add to the mp
   * @param {number} [params.collision] - The stream collision discarding time in number of milliseconds (0=disabled)
   * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_CREATED>}
   */
  async createRtpMountpoint({ id = 0, name, description, secret, pin, admin_key, permanent = false, is_private = false, e2ee = false, audio, video, data, threads, metadata, collision }) {
    const body = {
      request: REQUEST_CREATE,
      type: 'rtp',
      id,
      permanent,
      is_private,
      e2ee,
      audio: false,
      video: false,
      data: false,
      collision: 2000,
    };
    if (typeof name === 'string') body.name = name;
    if (typeof description === 'string') body.description = description;
    if (typeof secret === 'string') body.secret = secret;
    if (typeof pin === 'string') body.pin = pin;
    if (typeof admin_key === 'string') body.admin_key = admin_key;
    if (typeof audio === 'object' && audio) {
      body.audio = true;
      body.audioport = (typeof audio.port === 'number') ? audio.port : 0;
      if (typeof audio.rtcpport === 'number') body.audiortcpport = audio.rtcppport;
      if (typeof audio.mcast === 'string') body.audiomcast = audio.mcast;
      if (audio.pt) body.audiopt = audio.pt;
      if (audio.rtpmap) body.audiortpmap = audio.rtpmap;
      if (typeof audio.skew === 'boolean') body.audioskew = audio.skew;
    }
    if (typeof video === 'object' && video) {
      body.video = true;
      body.videoport = (typeof video.port === 'number') ? video.port : 0;
      if (typeof video.rtcpport === 'number') body.videortcpport = video.rtcpport;
      if (typeof video.mcast === 'string') body.videomcast = video.mcast;
      if (video.pt) body.videopt = video.pt;
      if (video.rtpmap) body.videortpmap = video.rtpmap;
      if (video.fmtp) body.videofmtp = video.fmtp;
      if (typeof video.buffer === 'boolean') body.videobufferkf = video.buffer;
      if (typeof video.skew === 'boolean') body.videoskew = video.skew;
      if (typeof video.port2 === 'number' && typeof video.port3 === 'number') {
        body.videosimulcast = true;
        body.videoport2 = video.port2;
        body.videoport3 = video.port3;
      }
    }
    if (typeof data === 'object' && data) {
      body.data = true;
      body.dataport = (typeof data.port === 'number') ? data.port : 0;
      if (typeof data.buffer === 'boolean') body.databuffermsg = data.buffer;
    }
    if (typeof threads === 'number' && threads > 0) body.threads = threads;
    if (metadata) body.metadata = metadata;
    if (typeof collision === 'number') body.collision = collision;

    const response = await this.message(body);
    const { event, data: evtdata } = response._janode || {};
    if (event === PLUGIN_EVENT.CREATED)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Destroy a mountpoint.
   *
   * @param {object} params
   * @param {number|string} params.id
   * @param {boolean} [params.permanent]
   * @param {string} [params.secret]
   * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_DESTROYED>}
   */
  async destroyMountpoint({ id, permanent, secret }) {
    const body = {
      request: REQUEST_DESTROY,
      id,
    };
    if (typeof permanent === 'boolean') body.permanent = permanent;
    if (typeof secret === 'string') body.secret = secret;

    const response = await this.message(body);
    const { event, data: evtdata } = response._janode || {};
    if (event === PLUGIN_EVENT.DESTROYED)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

}

/**
 * The payload of the plugin message (cfr. Janus docs).
 * {@link https://janus.conf.meetecho.com/docs/streaming.html}
 *
 * @private
 * @typedef {object} StreamingData
 */

/**
 * Success response for streaming requests.
 *
 * @typedef {object} STREAMING_EVENT_OK
 */

/**
 * Response event for mountpoint info request.
 *
 * @typedef {object} STREAMING_EVENT_INFO
 */

/**
 * Response event for mountpoint list request.
 *
 * @typedef {object} STREAMING_EVENT_LIST
 * @property {object[]} list - The list of mountpoints as returned by Janus
 */

/**
 * Response event for mountpoint create request.
 *
 * @typedef {object} STREAMING_EVENT_CREATED
 * @property {string} name - The name of the mountpoint
 * @property {number|string} id - The identifier for the mountpoint
 * @property {string} description - An optional description
 * @property {number} [audio_port] - The port for RTP audio
 * @property {number} [audio_rtcp_port] - The port RTCP audio
 * @property {number} [video_port] - The port for RTP video
 * @property {number} [video_port_2] - The port for RTP video (simulcast)
 * @property {number} [video_port_3] - The port for RTP video (simulcast)
 * @property {number} [video_rtcp_port] - The port for RTCP video
 * @property {number} [data_port] - The port for datachannels
 */

/**
 * Response event for mountpoint destroy request.
 *
 * @typedef {object} STREAMING_EVENT_DESTROYED
 * @property {number|string} id - The identifier of the dstroyed mountpoint
 */

/**
 * A streaming status update event.
 *
 * @typedef {object} STREAMING_EVENT_STATUS
 * @property {string} status - The current status of the stream
 * @property {number|string} [id] - The involved mountpoint identifier
 * @property {boolean} [restart] - True if the request had it true
 * @property {boolean} [e2ee] - True if an offered stream is end to end encrypted
 * @property {RTCSessionDescription} [jsep] - Optional JSEP offer from Janus
 */

/**
 * Response event for mountpoint switch request.
 *
 * @typedef {object} STREAMING_EVENT_SWITCHED
 * @property {string} switched - The string as returned by Janus
 * @property {number|string} id - The identifier of the mp that has been switched to
 */

/**
 * Response event for configure stream request
 *
 * @typedef {object} STREAMING_EVENT_CONFIGURED
 */

/**
 * The exported plugin descriptor.
 *
 * @type {object}
 * @property {string} id - The plugin identifier used when attaching to Janus
 * @property {module:streaming-plugin~StreamingHandle} Handle - The custom class implementing the plugin
 * @property {object} EVENT - The events emitted by the plugin
 * @property {string} EVENT.STREAMING_STATUS {@link module:streaming-plugin~STREAMING_STATUS}
 * @property {string} EVENT.STREAMING_ERROR {@link module:streaming-plugin~STREAMING_ERROR}
 */
export default {
  id: PLUGIN_ID,
  Handle: StreamingHandle,
  EVENT: {
    /**
     * Update of the status for the active stream.
     *
     * @event module:streaming-plugin~StreamingHandle#event:STREAMING_STATUS
     * @type {module:streaming-plugin~STREAMING_EVENT_STATUS}
     */
    STREAMING_STATUS: PLUGIN_EVENT.STATUS,

    /**
     * Generic streaming error.
     *
     * @event module:streaming-plugin~StreamingHandle#event:STREAMING_ERROR
     * @type {Error}
     */
    STREAMING_ERROR: PLUGIN_EVENT.ERROR,
  },
};
