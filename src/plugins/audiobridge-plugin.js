'use strict';

/**
 * This module contains the implementation of the AudioBridge plugin (ref. {@link https://janus.conf.meetecho.com/docs/audiobridge.html}).
 * @module audiobridge-plugin
 */

import Handle from '../handle.js';

/* The plugin ID exported in the plugin descriptor */
const PLUGIN_ID = 'janus.plugin.audiobridge';

/* These are the requests defined for the Janus AudioBridge API */
const REQUEST_JOIN = 'join';
const REQUEST_LIST_PARTICIPANTS = 'listparticipants';
const REQUEST_KICK = 'kick';
const REQUEST_CONFIGURE = 'configure';
const REQUEST_LEAVE = 'leave';
const REQUEST_AUDIO_HANGUP = 'hangup';
const REQUEST_EXISTS = 'exists';
const REQUEST_LIST_ROOMS = 'list';
const REQUEST_CREATE = 'create';
const REQUEST_DESTROY = 'destroy';
const REQUEST_RECORDING = 'enable_recording';
const REQUEST_ALLOW = 'allowed';
const REQUEST_RTP_FWD_START = 'rtp_forward';
const REQUEST_RTP_FWD_STOP = 'stop_rtp_forward';
const REQUEST_RTP_FWD_LIST = 'listforwarders';
const REQUEST_SUSPEND_PARTICIPANT = 'suspend';
const REQUEST_RESUME_PARTICIPANT = 'resume';
const REQUEST_MUTE_PARTICIPANT = 'mute';
const REQUEST_UNMUTE_PARTICIPANT = 'unmute';
const REQUEST_MUTE_ROOM = 'unmute_room';
const REQUEST_UNMUTE_ROOM = 'unmute_room';
const REQUEST_PLAY_FILE = 'play_file';
const REQUEST_IS_PLAYING = 'is_playing';
const REQUEST_STOP_FILE = 'stop_file';
const REQUEST_STOP_ALL_FILES = 'stop_all_files';
const REQUEST_LIST_ANNOUNCEMENTS = 'listannouncements';

/* These are the events/responses that the Janode plugin will manage */
/* Some of them will be exported in the plugin descriptor */
const PLUGIN_EVENT = {
  JOINED: 'audiobridge_joined',
  PEER_JOINED: 'audiobridge_peer_joined',
  PARTICIPANTS_LIST: 'audiobridge_participants_list',
  CONFIGURED: 'audiobridge_configured',
  PEER_CONFIGURED: 'audiobridge_peer_configured',
  LEAVING: 'audiobridge_leaving',
  AUDIO_HANGINGUP: 'audiobridge_hangingup',
  PEER_LEAVING: 'audiobridge_peer_leaving',
  KICKED: 'audiobridge_kicked',
  PEER_KICKED: 'audiobridge_peer_kicked',
  TALKING: 'audiobridge_talking',
  PEER_TALKING: 'audiobridge_peer_talking',
  SUSPENDED: 'audiobridge_suspended',
  PEER_SUSPENDED: 'audiobridge_peer_suspended',
  RESUMED: 'audiobridge_resumed',
  PEER_RESUMED: 'audiobridge_peer_resumed',
  EXISTS: 'audiobridge_exists',
  ROOMS_LIST: 'audiobridge_list',
  CREATED: 'audiobridge_created',
  DESTROYED: 'audiobridge_destroyed',
  RECORDING: 'audiobrige_recording',
  RTP_FWD: 'audiobridge_rtp_fwd',
  FWD_LIST: 'audiobridge_rtp_list',
  ALLOWED: 'audiobridge_allowed',
  ROOM_MUTED: 'audiobridge_room_muted',
  ANNOUNCEMENTS_LIST: 'audiobridge_announcements_list',
  ANNOUNCEMENT_STARTED: 'audiobridge_announcement_started',
  ANNOUNCEMENT_STOPPED: 'audiobridge_announcement_stopped',
  SUCCESS: 'audiobridge_success',
  ERROR: 'audiobridge_error',
};

/**
 * The class implementing the AudioBridge plugin (ref. {@link https://janus.conf.meetecho.com/docs/audiobridge.html}).<br>
 *
 * It extends the base Janode Handle class and overrides the base "handleMessage" method.<br>
 *
 * Moreover it defines many methods to support AudioBridge operations.
 *
 * @hideconstructor
 * @extends module:handle~Handle
 */
class AudioBridgeHandle extends Handle {
  /**
   * Create a Janode AudioBridge handle.
   *
   * @param {module:session~Session} session - A reference to the parent session
   * @param {number} id - The handle identifier
   */
  constructor(session, id) {
    super(session, id);

    /**
     * The feed identifier assigned to this handle when it joined the audio bridge.
     *
     * @type {number|string}
     */
    this.feed = null;

    /**
     * The identifier of the room the audiobridge handle has joined.
     *
     * @type {number|string}
     */
    this.room = null;
  }

  /**
   * The custom "handleMessage" needed for handling AudioBridge messages.
   *
   * @private
   * @param {Object} janus_message
   * @returns {Object} A falsy value for unhandled events, a truthy value for handled events
   */
  handleMessage(janus_message) {
    const { plugindata, transaction } = janus_message;
    if (plugindata && plugindata.data && plugindata.data.audiobridge) {
      /**
       * @type {AudioBridgeData}
       */
      const message_data = plugindata.data;
      const { audiobridge, error, error_code, room } = message_data;

      /* Prepare an object for the output Janode event */
      const janode_event = this._newPluginEvent(janus_message);

      /* Add room information if available */
      if (room) janode_event.data.room = room;

      /* The plugin will emit an event only if the handle does not own the transaction */
      /* That means that a transaction has already been closed or this is an async event */
      const emit = (this.ownsTransaction(transaction) === false);

      switch (audiobridge) {

        /* success response */
        case 'success':
          /* Room exists API */
          if (typeof message_data.exists !== 'undefined') {
            janode_event.data.exists = message_data.exists;
            janode_event.event = PLUGIN_EVENT.EXISTS;
            break;
          }
          /* Room list API */
          if (typeof message_data.list !== 'undefined') {
            janode_event.data.list = message_data.list;
            janode_event.event = PLUGIN_EVENT.ROOMS_LIST;
            break;
          }
          /* Enable recording API */
          if (typeof message_data.record !== 'undefined') {
            janode_event.data.record = message_data.record;
            janode_event.event = PLUGIN_EVENT.RECORDING;
            break;
          }

          /* RTP forwarding started/stopped */
          if (typeof message_data.stream_id !== 'undefined') {
            janode_event.data.forwarder = {
              host: message_data.host,
              audio_port: message_data.port,
              audio_stream: message_data.stream_id,
            };
            /* Forwarding group info */
            if (message_data.group) janode_event.data.forwarder.group = message_data.group;
            janode_event.event = PLUGIN_EVENT.RTP_FWD;
            break;
          }

          /* Generic success (might be token disable) */
          if (typeof message_data.allowed !== 'undefined') {
            janode_event.data.list = message_data.allowed;
          }
          if (typeof message_data.file_id !== 'undefined') {
            janode_event.data.file_id = message_data.file_id;
          }
          if (typeof message_data.file_id_list !== 'undefined') {
            janode_event.data.file_id_list = message_data.file_id_list;
          }
          if (typeof message_data.playing !== 'undefined') {
            janode_event.data.playing = message_data.playing;
          }
          /* In this case the "event" field of the Janode event is "success" */
          janode_event.event = PLUGIN_EVENT.SUCCESS;
          break;

        /* Joined an audio bridge */
        case 'joined':
          /* If the message contains the id field, the event is for this handle */
          if (typeof message_data.id !== 'undefined') {
            /* Set the room, feed and display properties */
            this.room = room;
            this.feed = message_data.id;
            /* Set event data (feed, display name, setup, muted etc.) */
            janode_event.data.feed = message_data.id;
            if (typeof message_data.rtp !== 'undefined') {
              janode_event.data.rtp_participant = message_data.rtp;
              /* This is left here just for backward compatibility */
              /* It will be removed eventually */
              janode_event.data.rtp = message_data.rtp;
            }
            /* Add participants data */
            janode_event.data.participants = message_data.participants.map(({ id, display, muted, setup, talking, suspended }) => {
              const peer = {
                feed: id,
                display,
                muted,
                setup,
              };
              if (typeof talking !== 'undefined') peer.talking = talking;
              if (typeof suspended !== 'undefined') peer.suspended = suspended;
              return peer;
            });
            janode_event.event = PLUGIN_EVENT.JOINED;
          }
          /* If the event contains the participants field, this is the join of another peer */
          else if (message_data.participants && message_data.participants.length == 1) {
            janode_event.data.feed = message_data.participants[0].id;
            if (typeof message_data.participants[0].display === 'string') janode_event.data.display = message_data.participants[0].display;
            if (typeof message_data.participants[0].muted !== 'undefined') janode_event.data.muted = message_data.participants[0].muted;
            if (typeof message_data.participants[0].setup !== 'undefined') janode_event.data.setup = message_data.participants[0].setup;
            if (typeof message_data.participants[0].suspended !== 'undefined') janode_event.data.suspended = message_data.participants[0].suspended;
            janode_event.event = PLUGIN_EVENT.PEER_JOINED;
          }
          break;

        /* Participants list */
        case 'participants':
          janode_event.data.participants = message_data.participants.map(({ id, display, muted, setup, talking, suspended }) => {
            const peer = {
              feed: id,
              display,
              muted,
              setup,
            };
            if (typeof talking !== 'undefined') peer.talking = talking;
            if (typeof suspended !== 'undefined') peer.suspended = suspended;
            return peer;
          });
          janode_event.event = PLUGIN_EVENT.PARTICIPANTS_LIST;
          break;

        /* Audio bridge room created */
        case 'created':
          janode_event.event = PLUGIN_EVENT.CREATED;
          janode_event.data.permanent = message_data.permanent;
          break;

        /* Audio bridge room destroyed */
        case 'destroyed':
          janode_event.event = PLUGIN_EVENT.DESTROYED;
          break;

        /* Audio bridge explicit hangup (different from core hangup!) */
        case 'hangingup':
          janode_event.data.feed = message_data.id || this.feed;
          janode_event.event = PLUGIN_EVENT.AUDIO_HANGINGUP;
          break;

        /* This handle left the audio bridge */
        case 'left':
          janode_event.data.feed = message_data.id || this.feed;
          this.feed = null;
          this.room = null;
          janode_event.event = PLUGIN_EVENT.LEAVING;
          break;

        /* Active forwarders list */
        case 'forwarders':
          janode_event.data.forwarders = message_data.rtp_forwarders.map(({ ip, port, stream_id, always_on, group }) => {
            const forwarder = {
              host: ip,
              audio_port: port,
              audio_stream: stream_id,
              always: always_on,
            };
            if (group) forwarder.group = group;
            return forwarder;
          });
          janode_event.event = PLUGIN_EVENT.FWD_LIST;
          break;

        /* Announcements list */
        case 'announcements':
          janode_event.data.announcements = message_data.announcements;
          janode_event.event = PLUGIN_EVENT.ANNOUNCEMENTS_LIST;
          break;

        /* Talking events */
        case 'talking':
        case 'stopped-talking':
          janode_event.data.feed = message_data.id;
          janode_event.data.talking = (audiobridge === 'talking');
          janode_event.event = message_data.id !== this.feed ? PLUGIN_EVENT.PEER_TALKING : PLUGIN_EVENT.TALKING;
          break;

        /* Announcement events */
        case 'announcement-started':
        case 'announcement-stopped':
          janode_event.data.file_id = message_data.file_id;
          janode_event.event = audiobridge === 'announcement-started' ? PLUGIN_EVENT.ANNOUNCEMENT_STARTED : PLUGIN_EVENT.ANNOUNCEMENT_STOPPED;
          break;

        /* Generic event (e.g. errors) */
        case 'event':
          /* AudioBridge error */
          if (error) {
            janode_event.event = PLUGIN_EVENT.ERROR;
            janode_event.data = new Error(`${error_code} ${error}`);
            /* In case of error, close a transaction */
            this.closeTransactionWithError(transaction, janode_event.data);
            break;
          }
          /* Configuration success for this handle */
          if (typeof message_data.result !== 'undefined') {
            if (message_data.result === 'ok') {
              janode_event.event = PLUGIN_EVENT.CONFIGURED;
            }
            break;
          }
          /* This handle or another participant has been resumed */
          if (typeof message_data.resumed != 'undefined') {
            janode_event.data.feed = message_data.resumed;
            if (message_data.participants) {
              /* Add participants data */
              janode_event.data.participants = message_data.participants.map(({ id, display, muted, setup, talking, suspended }) => {
                const peer = {
                  feed: id,
                  display,
                  muted,
                  setup,
                };
                if (typeof talking !== 'undefined') peer.talking = talking;
                if (typeof suspended !== 'undefined') peer.suspended = suspended;
                return peer;
              });
            }
            if (this.feed === janode_event.data.feed) {
              janode_event.event = PLUGIN_EVENT.RESUMED;
            }
            else {
              janode_event.event = PLUGIN_EVENT.PEER_RESUMED;
            }
            break;
          }
          /* This handle or another participant has been suspended */
          if (typeof message_data.suspended != 'undefined') {
            janode_event.data.feed = message_data.suspended;
            if (this.feed === janode_event.data.feed) {
              janode_event.event = PLUGIN_EVENT.SUSPENDED;
            }
            else {
              janode_event.event = PLUGIN_EVENT.PEER_SUSPENDED;
            }
            break;
          }
          /* Peer leaving confirmation */
          if (typeof message_data.leaving !== 'undefined') {
            janode_event.data.feed = message_data.leaving;
            janode_event.event = PLUGIN_EVENT.PEER_LEAVING;
            break;
          }
          /* Room muted event */
          if (typeof message_data.muted !== 'undefined') {
            janode_event.data.muted = message_data.muted;
            janode_event.event = PLUGIN_EVENT.ROOM_MUTED;
            break;
          }
          /* This handle or another participant kicked-out */
          if (typeof message_data.kicked !== 'undefined') {
            janode_event.data.feed = message_data.kicked;
            if (this.feed === janode_event.data.feed) {
              /* Reset handle status */
              this.feed = null;
              this.room = null;
              janode_event.event = PLUGIN_EVENT.KICKED;
            }
            else {
              janode_event.event = PLUGIN_EVENT.PEER_KICKED;
            }
            break;
          }
          /* Configuration events for other participants */
          if (typeof message_data.participants !== 'undefined' && message_data.participants.length == 1) {
            janode_event.data.feed = message_data.participants[0].id;
            if (typeof message_data.participants[0].display === 'string') janode_event.data.display = message_data.participants[0].display;
            if (typeof message_data.participants[0].muted !== 'undefined') janode_event.data.muted = message_data.participants[0].muted;
            if (typeof message_data.participants[0].setup !== 'undefined') janode_event.data.setup = message_data.participants[0].setup;
            if (typeof message_data.participants[0].suspended !== 'undefined') janode_event.data.suspended = message_data.participants[0].suspended;
            /* when using "mute"/"unmute" management requests, janus will notify "configured" to all participants, including the involved one */
            janode_event.event = janode_event.data.feed !== this.feed ? PLUGIN_EVENT.PEER_CONFIGURED : PLUGIN_EVENT.CONFIGURED;
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

  /* These are the APIs that users need to work with the audiobridge plugin */

  /**
   * Join an audiobridge room.
   *
   * @param {Object} params
   * @param {number|string} params.room - The room to join
   * @param {number|string} [params.feed] - The feed identifier for the participant, picked by Janus if omitted
   * @param {string} [params.display] - The display name to use
   * @param {boolean} [params.muted] - True to join in muted status
   * @param {string} [params.pin] - The pin needed to join
   * @param {string} [params.token] - The token to use when joining
   * @param {number} [params.quality] - The opus quality for the encoder
   * @param {number} [params.volume] - The percent volume
   * @param {boolean} [params.record] - True to enable recording
   * @param {string} [params.filename] - The recording filename
   * @param {boolean} [params.suspended] - True to join in suspended status
   * @param {boolean} [params.pause_events] - Wheter to pause notification events for suspended participants
   * @param {module:audiobridge-plugin~RtpParticipant} [params.rtp_participant] - Set a descriptor object if you need a RTP participant
   * @param {string} [params.group] - The group to assign to this participant
   * @param {boolean} [params.generate_offer] - True to get Janus to send the SDP offer.
   * @param {string} [params.codec] - The codec to be used among opus, pcma or  pcmu (Janus will default to opus)
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_JOINED>}
   */
  async join({ room, feed, display, muted, pin, token, quality, volume, record, filename, suspended, pause_events, rtp_participant, group, generate_offer, codec }) {
    const body = {
      request: REQUEST_JOIN,
      room,
    };
    if (typeof feed === 'string' || typeof feed === 'number') body.id = feed;
    if (typeof display === 'string') body.display = display;
    if (typeof muted === 'boolean') body.muted = muted;
    if (typeof pin === 'string') body.pin = pin;
    if (typeof token === 'string') body.token = token;
    if (typeof quality === 'number') body.quality = quality;
    if (typeof volume === 'number') body.volume = volume;
    if (typeof record === 'boolean') body.record = record;
    if (typeof filename === 'string') body.filename = filename;
    if (typeof suspended === 'boolean') body.suspended = suspended;
    if (typeof pause_events === 'boolean') body.pause_events = pause_events;
    if (typeof rtp_participant === 'object' && rtp_participant) body.rtp = rtp_participant;
    if (typeof group === 'string') body.group = group;
    if (typeof generate_offer === 'boolean') body.generate_offer = generate_offer;
    if (typeof codec === 'string') body.codec = codec;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.JOINED)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Configure an audiobridge handle.
   *
   * @param {Object} params
   * @param {string} [params.display] - The display name to use
   * @param {boolean} [params.muted] - Set muted status
   * @param {number} [params.quality] - Set opus quality
   * @param {number} [params.bitrate] - Set received bitrate (overrides room default)
   * @param {number} [params.volume] - Set volume percent
   * @param {boolean} [params.record] - Enable recording
   * @param {string} [params.filename] - Set recording filename
   * @param {number} [params.expected_loss] - Set a new expected_loss value for this participant (overrides room default)
   * @param {number} [params.prebuffer] - Set a new prebuffer value (overrides room default)
   * @param {string} [params.group] - Set the group that the participant belongs to
   * @param {module:audiobridge-plugin~RtpParticipant} [params.rtp_participant] - Set a descriptor object if you need a RTP participant
   * @param {RTCSessionDescription} [params.jsep=null] - JSEP offer/answer to be sent to Janus
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_CONFIGURED>}
   */
  async configure({ display, muted, quality, bitrate, volume, record, filename, expected_loss, prebuffer, group, rtp_participant, jsep = null }) {
    const body = {
      request: REQUEST_CONFIGURE,
    };
    if (typeof display === 'string') body.display = display;
    if (typeof muted === 'boolean') body.muted = muted;
    if (typeof quality === 'number') body.quality = quality;
    if (typeof bitrate === 'number') body.bitrate = bitrate;
    if (typeof volume === 'number') body.volume = volume;
    if (typeof record === 'boolean') body.record = record;
    if (typeof filename === 'string') body.filename = filename;
    if (typeof expected_loss === 'number') body.expected_loss = expected_loss;
    if (typeof prebuffer === 'number') body.prebuffer = prebuffer;
    if (typeof group === 'string') body.group = group;
    if (typeof rtp_participant === 'object' && rtp_participant) body.rtp = rtp_participant;

    const response = await this.message(body, jsep);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.CONFIGURED) {
      /* Janus does not reply with configured data, so we need to re-use the requested configuration */
      /* Use feed and room from handle status */
      evtdata.feed = this.feed;
      evtdata.room = this.room;
      if (typeof body.display !== 'undefined') evtdata.display = body.display;
      if (typeof body.muted !== 'undefined') evtdata.muted = body.muted;
      if (typeof body.quality !== 'undefined') evtdata.quality = body.quality;
      if (typeof body.volume !== 'undefined') evtdata.volume = body.volume;
      if (typeof body.record !== 'undefined') evtdata.record = body.record;
      if (typeof body.filename !== 'undefined') evtdata.filename = body.filename;
      if (typeof body.prebuffer !== 'undefined') evtdata.prebuffer = body.prebuffer;
      if (typeof body.group !== 'undefined') evtdata.group = body.group;
      if (typeof body.rtp !== 'undefined') evtdata.rtp_participant = body.rtp;
      return evtdata;
    }
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Request an audiobridge handle hangup.
   *
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_AUDIO_HANGINGUP>}
   *
   */
  async audioHangup() {
    const body = {
      request: REQUEST_AUDIO_HANGUP,
    };

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.AUDIO_HANGINGUP)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Leave an audiobridge room.
   *
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_LEAVING>}
   */
  async leave() {
    const body = {
      request: REQUEST_LEAVE,
    };

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.LEAVING)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /*----------------*/
  /* Management API */
  /*----------------*/

  /* These are the APIs needed to manage audiobridge resources (rooms, forwarders ...) */

  /**
   * List participants inside a room.
   *
   * @param {Object} params
   * @param {number|string} params.room - The room where to execute the list
   * @param {string} [params.secret] - The optional secret needed for managing the room
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_PARTICIPANTS_LIST>}
   */
  async listParticipants({ room, secret }) {
    const body = {
      request: REQUEST_LIST_PARTICIPANTS,
      room,
    };
    if (typeof secret === 'string') body.secret = secret;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.PARTICIPANTS_LIST)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Kick an user out from a room.
   *
   * @param {Object} params
   * @param {number|string} params.room - The involved room
   * @param {number|string} params.feed - The feed to kick out
   * @param {string} [params.secret] - The optional secret needed for managing the room
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_KICK_RESPONSE>}
   */
  async kick({ room, feed, secret }) {
    const body = {
      request: REQUEST_KICK,
      room,
      id: feed,
    };
    if (typeof secret === 'string') body.secret = secret;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.SUCCESS) {
      /* Add data missing from Janus response */
      evtdata.room = body.room;
      evtdata.feed = body.id;
      return evtdata;
    }
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Check if a room exists.
   *
   * @param {Object} params
   * @param {number|string} params.room - The involved room
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_EXISTS>}
   */
  async exists({ room }) {
    const body = {
      request: REQUEST_EXISTS,
      room,
    };

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.EXISTS)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * List available audiobridge rooms.
   *
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_ROOMS_LIST>}
   */
  async list() {
    const body = {
      request: REQUEST_LIST_ROOMS,
    };

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.ROOMS_LIST)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Create an audiobridge room.
   *
   * @param {Object} params
   * @param {number|string} params.room - The room identifier
   * @param {string} [params.description] - A room description
   * @param {boolean} [params.permanent] - Set to true to persist the room in the Janus config file
   * @param {number} [params.sampling_rate] - The sampling rate (bps) to be used in the room
   * @param {number} [params.bitrate] - The bitrate (bps) to be used in the room, if missing the encoder decides
   * @param {boolean} [params.is_private] - Set room as private (hidden in list)
   * @param {string} [params.secret] - The secret to be used when managing the room
   * @param {string} [params.pin] - The ping needed for joining the room
   * @param {string} [params.admin_key] - The admin key needed for invoking the API
   * @param {boolean} [params.record] - True to record the mixed audio
   * @param {string} [params.filename] - The recording filename
   * @param {string} [params.rec_dir] - The optional recording folder
   * @param {boolean} [params.talking_events] - True to enable talking events
   * @param {number} [params.talking_level_threshold] - Audio level threshold for talking events in the range [0, 127]
   * @param {number} [params.talking_packets_threshold] - Audio packets threshold for talking events
   * @param {number} [params.expected_loss] - The expected loss percentage in the audiobridge, if > 0 enables FEC
   * @param {number} [params.prebuffer] - The prebuffer to use for every participant
   * @param {boolean} [params.allow_rtp] - Allow plain RTP participants
   * @param {string[]} [params.groups] - The available groups in the room
   * @param {boolean} [params.denoise] - Enable denoising with rnnoise for all participants
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_CREATED>}
   */
  async create({ room, description, permanent, sampling_rate, bitrate, is_private, secret, pin, admin_key, record, filename, rec_dir,
    talking_events, talking_level_threshold, talking_packets_threshold, expected_loss, prebuffer, allow_rtp, groups, denoise }) {
    const body = {
      request: REQUEST_CREATE,
      room,
    };
    if (typeof description === 'string') body.description = description;
    if (typeof permanent === 'boolean') body.permanent = permanent;
    if (typeof sampling_rate === 'number') body.sampling = sampling_rate;
    if (typeof bitrate === 'number') body.default_bitrate = bitrate;
    if (typeof is_private === 'boolean') body.is_private = is_private;
    if (typeof secret === 'string') body.secret = secret;
    if (typeof pin === 'string') body.pin = pin;
    if (typeof admin_key === 'string') body.admin_key = admin_key;
    if (typeof record === 'boolean') body.record = record;
    if (typeof filename === 'string') body.record_file = filename;
    if (typeof rec_dir === 'string') body.record_dir = rec_dir;
    if (typeof talking_events === 'boolean') body.audiolevel_event = talking_events;
    if (typeof talking_level_threshold === 'number' && talking_level_threshold >= 0 && talking_level_threshold <= 127) body.audio_level_average = talking_level_threshold;
    if (typeof talking_packets_threshold === 'number' && talking_packets_threshold > 0) body.audio_active_packets = talking_packets_threshold;
    if (typeof expected_loss === 'number') body.default_expectedloss = expected_loss;
    if (typeof prebuffer === 'number') body.default_prebuffering = prebuffer;
    if (typeof allow_rtp === 'boolean') body.allow_rtp_participants = allow_rtp;
    if (Array.isArray(groups)) body.groups = groups;
    if (typeof denoise === 'boolean') body.denoise = denoise;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.CREATED)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Destroy an audiobridge room.
   *
   * @param {Object} params
   * @param {number|string} params.room - The room to destroy
   * @param {boolean} [params.permanent] - Set to true to remove the room from the Janus config file
   * @param {string} [params.secret] - The optional secret needed to manage the room
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_DESTROYED>}
   */
  async destroy({ room, permanent, secret }) {
    const body = {
      request: REQUEST_DESTROY,
      room,
    };
    if (typeof permanent === 'boolean') body.permanent = permanent;
    if (typeof secret === 'string') body.secret = secret;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.DESTROYED)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Enable/disable mixed audio recording.
   *
   * @param {Object} params
   * @param {number|string} params.room - The room identifier
   * @param {boolean} params.record - Enable/disable recording
   * @param {string} [params.secret] - The secret to be used when managing the room
   * @param {string} [params.filename] - The recording filename
   * @param {string} [params.rec_dir] - The optional recording folder
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_RECORDING>}
   */
  async enableRecording({ room, record, filename, rec_dir, secret }) {
    const body = {
      request: REQUEST_RECORDING,
      room,
      record,
    };
    if (typeof filename === 'string') body.record_file = filename;
    if (typeof rec_dir === 'string') body.record_dir = rec_dir;
    if (typeof secret === 'string') body.secret = secret;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.RECORDING) {
      evtdata.room = body.room;
      return evtdata;
    }
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Edit an audiobridge token list.
   *
   * @param {Object} params
   * @param {number|string} params.room - The involved room
   * @param {"enable"|"disable"|"add"|"remove"} params.action - The action to perform
   * @param {string[]} params.list - The list of tokens to add/remove
   * @param {string} [params.secret] - The optional secret needed to manage the room
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_ALLOWED>}
   */
  async allow({ room, action, list, secret }) {
    const body = {
      request: REQUEST_ALLOW,
      room,
      action,
    };
    if (list && list.length > 0) body.allowed = list;
    if (typeof secret === 'string') body.secret = secret;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.SUCCESS)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Start a RTP forwarder.
   *
   * @param {Object} params
   * @param {number|string} params.room - The involved room
   * @param {boolean} [params.always] - Whether silence should be forwarded when the room is empty
   * @param {string} params.host - The host to forward to
   * @param {string} [params.host_family] - ipv4|ipv6; by default, first family returned by DNS request
   * @param {number} params.audio_port - The port to forward to
   * @param {number} [params.ssrc] - The SSRC to use to use when forwarding
   * @param {number} [params.ptype] - The payload type to use to use when forwarding
   * @param {string} [params.codec] - The codec to use in the forwarder
   * @param {string} [params.group] - The group to forward
   * @param {string} [params.secret] - The optional secret needed to manage the room
   * @param {string} [params.admin_key] - The admin key needed for invoking the API
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_RTP_FWD>}
   */
  async startForward({ room, always, host, host_family, audio_port, ssrc, ptype, codec, group, secret, admin_key }) {
    const body = {
      request: REQUEST_RTP_FWD_START,
      room,
    };
    if (typeof always === 'boolean') body.always_on = always;
    if (typeof host === 'string') body.host = host;
    if (typeof host_family === 'string') body.host_family = host_family;
    if (typeof audio_port === 'number') body.port = audio_port;
    if (typeof ssrc === 'number') body.ssrc = ssrc;
    if (typeof ptype === 'number') body.ptype = ptype;
    if (typeof codec === 'string') body.codec = codec;
    if (typeof group === 'string') body.group = group;
    if (typeof secret === 'string') body.secret = secret;
    if (typeof admin_key === 'string') body.admin_key = admin_key;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.RTP_FWD)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Stop a RTP forwarder.
   *
   * @param {Object} params
   * @param {number|string} params.room - The involved room
   * @param {number} params.stream - The forwarder identifier to stop
   * @param {string} [params.secret] - The optional secret needed to manage the room
   * @param {string} [params.admin_key] - The admin key needed for invoking the API
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_RTP_FWD>}
   */
  async stopForward({ room, stream, secret, admin_key }) {
    const body = {
      request: REQUEST_RTP_FWD_STOP,
      room,
      stream_id: stream,
    };
    if (typeof secret === 'string') body.secret = secret;
    if (typeof admin_key === 'string') body.admin_key = admin_key;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.RTP_FWD)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * List active forwarders.
   *
   * @param {Object} params
   * @param {number|string} params.room - The involved room
   * @param {string} [params.secret] - The optional secret needed to manage the room
   * @param {string} [params.admin_key] - The admin key needed for invoking the API
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_FWD_LIST>}
   */
  async listForward({ room, secret, admin_key }) {
    const body = {
      request: REQUEST_RTP_FWD_LIST,
      room,
    };
    if (typeof secret === 'string') body.secret = secret;
    if (typeof admin_key === 'string') body.admin_key = admin_key;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.FWD_LIST)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Mute an user in the audiobridge.
   *
   * @param {Object} params
   * @param {number|string} params.room - The involved room
   * @param {number|string} params.feed - The feed to mute
   * @param {string} [params.secret] - The optional secret needed for managing the room
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_MUTE_PARTICIPANT_RESPONSE>}
   */
  async mute({ room, feed, secret }) {
    const body = {
      request: REQUEST_MUTE_PARTICIPANT,
      room,
      id: feed,
    };
    if (typeof secret === 'string') body.secret = secret;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.SUCCESS) {
      /* Add data missing from Janus response */
      evtdata.room = body.room;
      evtdata.feed = body.id;
      return evtdata;
    }
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Unmute an user in the audiobridge.
   *
   * @param {Object} params
   * @param {number|string} params.room - The involved room
   * @param {number|string} params.feed - The feed to unmute
   * @param {string} [params.secret] - The optional secret needed for managing the room
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_UNMUTE_PARTICIPANT_RESPONSE>}
   */
  async unmute({ room, feed, secret }) {
    const body = {
      request: REQUEST_UNMUTE_PARTICIPANT,
      room,
      id: feed,
    };
    if (typeof secret === 'string') body.secret = secret;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.SUCCESS) {
      /* Add data missing from Janus response */
      evtdata.room = body.room;
      evtdata.feed = body.id;
      return evtdata;
    }
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Mute the given room for every participant.
   *
   * @param {Object} params
   * @param {number|string} params.room - The involved room
   * @param {string} [params.secret] - The optional secret needed to manage the room
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_MUTE_ROOM_RESPONSE>}
   */
  async muteRoom({ room, secret }) {
    const body = {
      request: REQUEST_MUTE_ROOM,
      room,
    };
    if (typeof secret === 'string') body.secret = secret;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.SUCCESS) {
      evtdata.room = body.room;
      return evtdata;
    }
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Unmute the given room for every participant.
   *
   * @param {Object} params
   * @param {number|string} params.room - The involved room
   * @param {string} [params.secret] - The optional secret needed to manage the room
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_UNMUTE_ROOM_RESPONSE>}
   */
  async unmuteRoom({ room, secret }) {
    const body = {
      request: REQUEST_UNMUTE_ROOM,
      room,
    };
    if (typeof secret === 'string') body.secret = secret;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.SUCCESS) {
      evtdata.room = body.room;
      return evtdata;
    }
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Suspend an audiobridge participant.
   *
   * @param {Object} params
   * @param {number|string} params.room - The involved room
   * @param {number|string} params.feed - The feed id to be suspended
   * @param {boolean} [params.stop_record] - Whether the recording of this participant should be stopped too
   * @param {boolean} [params.pause_events] - Wheter to pause notification events for suspended participants
   * @param {string} [params.secret] - The optional secret needed to manage the room
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_SUSPEND_RESPONSE>}
   */
  async suspend({ room, feed, stop_record, pause_events, secret }) {
    const body = {
      request: REQUEST_SUSPEND_PARTICIPANT,
      room,
      id: feed
    };
    if (typeof stop_record === 'boolean') body.stop_record = stop_record;
    if (typeof pause_events === 'boolean') body.pause_events = pause_events;
    if (typeof secret === 'string') body.secret = secret;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.SUCCESS) {
      evtdata.feed = feed;
      return evtdata;
    }
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Resume an audiobridge participant after a suspend.
   *
   * @param {Object} params
   * @param {number|string} params.room - The involved room
   * @param {number|string} params.feed - The feed id to be resumed
   * @param {boolean} [params.record] - Whether to start recording this resumed feed
   * @param {string} [params.filename] - The recording filename
   * @param {string} [params.secret] - The optional secret needed to manage the room
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_RESUME_RESPONSE>}
   */
  async resume({ room, feed, record, filename, secret }) {
    const body = {
      request: REQUEST_RESUME_PARTICIPANT,
      room,
      id: feed
    };
    if (typeof record === 'boolean') body.record = record;
    if (typeof filename === 'string') body.filename = filename;
    if (typeof secret === 'string') body.secret = secret;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.SUCCESS) {
      evtdata.feed = feed;
      return evtdata;
    }
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Play a file inside a room.
   *
   * @param {Object} params
   * @param {number|string} params.room - The involved room
   * @param {string} [params.secret] - The optional secret needed to manage the room
   * @param {string} [params.group] - The optional group to play in
   * @param {string} [params.file_id] - The optional ID of the announcement
   * @param {string} params.filename - The path to the Opus file to play
   * @param {boolean} [params.loop] - Whether the file should be played in a loop
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_PLAY_FILE_RESPONSE>}
   */
  async playFile({ room, secret, group, file_id, filename, loop }) {
    const body = {
      request: REQUEST_PLAY_FILE,
      room,
    };
    if (typeof secret === 'string') body.secret = secret;
    if (typeof group === 'string') body.group = group;
    if (typeof file_id === 'string') body.file_id = file_id;
    if (typeof filename === 'string') body.filename = filename;
    if (typeof loop === 'boolean') body.loop = loop;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.SUCCESS) {
      evtdata.room = body.room;
      return evtdata;
    }
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Check whether a file is playing inside a room.
   *
   * @param {Object} params
   * @param {number|string} params.room - The involved room
   * @param {string} [params.secret] - The optional secret needed to manage the room
   * @param {string} params.file_id - The involved announcement ID
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_IS_PLAYING_RESPONSE>}
   */
  async isPlaying({ room, secret, file_id }) {
    const body = {
      request: REQUEST_IS_PLAYING,
      room,
    };
    if (typeof secret === 'string') body.secret = secret;
    if (typeof file_id === 'string') body.file_id = file_id;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.SUCCESS) {
      evtdata.room = body.room;
      return evtdata;
    }
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Stop playing a file inside a room.
   *
   * @param {Object} params
   * @param {number|string} params.room - The involved room
   * @param {string} [params.secret] - The optional secret needed to manage the room
   * @param {string} params.file_id - The involved announcement ID
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_STOP_FILE_RESPONSE>}
   */
  async stopFile({ room, secret, file_id }) {
    const body = {
      request: REQUEST_STOP_FILE,
      room,
    };
    if (typeof secret === 'string') body.secret = secret;
    if (typeof file_id === 'string') body.file_id = file_id;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.SUCCESS) {
      evtdata.room = body.room;
      return evtdata;
    }
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Stop playing all files inside a room.
   *
   * @param {Object} params
   * @param {number|string} params.room - The involved room
   * @param {string} [params.secret] - The optional secret needed to manage the room
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_STOP_ALL_FILES_RESPONSE>}
   */
  async stopAllFiles({ room, secret }) {
    const body = {
      request: REQUEST_STOP_ALL_FILES,
      room,
    };
    if (typeof secret === 'string') body.secret = secret;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.SUCCESS) {
      evtdata.room = body.room;
      return evtdata;
    }
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * List announcements inside a room.
   *
   * @param {Object} params
   * @param {number|string} params.room - The room where to execute the list
   * @param {string} [params.secret] - The optional secret needed for managing the room
   * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_ANNOUNCEMENTS_LIST>}
   */
  async listAnnouncements({ room, secret }) {
    const body = {
      request: REQUEST_LIST_ANNOUNCEMENTS,
      room,
    };
    if (typeof secret === 'string') body.secret = secret;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.ANNOUNCEMENTS_LIST)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

}

/**
 * The payload of the plugin message (cfr. Janus docs).
 * {@link https://janus.conf.meetecho.com/docs/audiobridge.html}
 *
 * @private
 * @typedef {Object} AudioBridgeData
 */

/**
 * @typedef {Object} RtpParticipant
 * @property {string} ip - IP address you want media to be sent to
 * @property {number} port - The port you want media to be sent to
 * @property {number} payload_type - The payload type to use for RTP packets
 */

/**
 * The response event to a join request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_JOINED
 * @property {number|string} room - The involved room
 * @property {number|string} feed - The feed identifier
 * @property {module:audiobridge-plugin~RtpParticipant} [rtp_participant] - The descriptor in case this is a plain RTP participant
 * @property {object[]} participants - The list of participants
 * @property {number|string} participants[].feed - The participant feed identifier
 * @property {string} [participants[].display] - The participant display name
 * @property {boolean} [participants[].muted] - The muted status of the participant
 * @property {boolean} [participants[].setup] - True if participant PeerConnection is up
 */

/**
 * The response event for configure request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_CONFIGURED
 * @property {number|string} room - The involved room
 * @property {number|string} feed - The feed identifier
 * @property {string} [display] - The display name, if available
 * @property {boolean} [muted] - The muted status
 * @property {number} [quality] - [0-10] Opus-related complexity to use
 * @property {number} [volume] - Volume percent value
 * @property {boolean} [record] - True if recording is active for this feed
 * @property {string} [filename] - The recording filename
 * @property {number} [prebuffer] - Number of packets to buffer before decoding
 * @property {string} [group] - Group to assign to this participant
 * @property {RTCSessionDescription} [jsep] - The JSEP answer
 */

/**
 * The response event for audiobridge hangup request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_AUDIO_HANGINGUP
 * @property {number|string} room - The involved room
 * @property {number|string} feed - The feed that is being hung up
 */

/**
 * The response event for audiobridge leave request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_LEAVING
 * @property {number|string} room - The involved room
 * @property {number|string} feed- The feed that is leaving
 */

/**
 * The response event for audiobridge participants list request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_PARTICIPANTS_LIST
 * @property {number|string} room - The involved room
 * @property {object[]} participants - The list of participants
 * @property {number|string} participants[].feed - The participant feed identifier
 * @property {string} [participants[].display] - The participant display name
 * @property {boolean} [participants[].muted] - The muted status of the participant
 * @property {boolean} [participants[].setup] - True if participant PeerConnection is up
 * @property {boolean} [participants[].talking] - True if participant is talking
 * @property {boolean} [participants[].suspended]  - True if participant is suspended
 */

/**
 * The response event for audiobridge participant kick request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_KICK_RESPONSE
 * @property {number|string} room - The involved room
 * @property {number|string} feed - The feed that has been kicked out
 */

/**
 * The response event for audiobridge room exists request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_EXISTS
 * @property {number|string} room - The involved room
 * @property {boolean} exists - True if the rooms exists
 */

/**
 * The response event for audiobridge room list request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_ROOMS_LIST
 * @property {object[]} list - The list of the rooms as returned by Janus
 */

/**
 * The response event for audiobridge forwarder start request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_RTP_FWD
 * @property {number|string} room - The involved room
 * @property {Object} forwarder - Forwarder descriptor
 * @property {string} forwarder.host - The target host
 * @property {number} forwarder.audio_port - The target port
 * @property {number} forwarder.audio_stream - The identifier of the forwarder
 * @property {string} [forwarder.group] - The group that is being forwarded
 */

/**
 * The response event for audiobridge room create request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_CREATED
 * @property {number|string} room - The created room
 * @property {boolean} permanent - True if the room is being persisted in the Janus config file
 */

/**
 * The response event for audiobridge room destroy request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_DESTROYED
 * @property {number|string} room - The destroyed room
 */

/**
 * The response event for audiobridge ACL token edit request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_RECORDING
 * @property {number|string} room - The involved room
 * @property {boolean} record - Wheter recording is active or not
 */

/**
 * The response event for audiobridge forwarders list request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_FWD_LIST
 * @property {number|string} room - The involved room
 * @property {object[]} forwarders - The list of forwarders
 * @property {string} forwarders[].host - The target host
 * @property {number} forwarders[].audio_port - The target port
 * @property {number} forwarders[].audio_stream - The forwarder identifier
 * @property {boolean} forwarders[].always - Whether this forwarder works even when no participant is in or not
 * @property {string} [forwarders[].group] - The group that is being forwarded
 */

/**
 * The response event for audiobridge mute participant request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_MUTE_PARTICIPANT_RESPONSE
 * @property {number|string} room - The involved room
 * @property {number|string} feed - The involved feed id
 */

/**
 * The response event for audiobridge unmute participant request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_UNMUTE_PARTICIPANT_RESPONSE
 * @property {number|string} room - The involved room
 * @property {number|string} feed - The involved feed id
 */

/**
 * The response event for audiobridge mute room request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_MUTE_ROOM_RESPONSE
 * @property {number|string} room - The involved room
 */

/**
 * The response event for audiobridge unmute room request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_UNMUTE_ROOM_RESPONSE
 * @property {number|string} room - The involved room
 */

/**
 * The response event for audiobridge suspend request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_SUSPEND_RESPONSE
 * @property {number|string} room - The involved room
 * @property {number|string} feed - The involved feed id
 */

/**
 * The response event for audiobridge resume request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_RESUME_RESPONSE
 * @property {number|string} room - The involved room
 * @property {number|string} feed - The involved feed id
 */

/**
 * The response event for audiobridge ACL token edit request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_ALLOWED
 * @property {number|string} room - The involved room
 * @property {string[]} list - The updated, complete, list of allowed tokens
 */

/**
 * The response event for audiobridge play_file request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_PLAY_FILE_RESPONSE
 * @property {number|string} room - The involved room
 * @property {string} file_id - The involved file id
 */

/**
 * The response event for audiobridge is_playing request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_IS_PLAYING_RESPONSE
 * @property {number|string} room - The involved room
 * @property {string} file_id - The involved file id
 * @property {boolean} playing - True if the file is being played
 */

/**
 * The response event for audiobridge stop_file request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_STOP_FILE_RESPONSE
 * @property {number|string} room - The involved room
 * @property {string} file_id - The involved file id
 */

/**
 * The response event for audiobridge stop_all_files request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_STOP_ALL_FILES_RESPONSE
 * @property {number|string} room - The involved room
 * @property {string[]} file_id_list - The list of file ids that was stopped
 */

/**
 * The response event for audiobridge announcements list request.
 *
 * @typedef {Object} AUDIOBRIDGE_EVENT_ANNOUNCEMENTS_LIST
 * @property {number|string} room - The involved room
 * @property {object[]} announcements - The list of announcements
 * @property {string} announcements[].file_id - The announcement identifier
 * @property {string} announcements[].filename - The path to the Opus file
 * @property {boolean} announcements[].playing - True if the announcement is playing
 * @property {boolean} announcements[].loop - True if the announcement will be played in a loop
 */

/**
 * The exported plugin descriptor.
 *
 * @type {Object}
 * @property {string} id - The plugin identifier used when attaching to Janus
 * @property {module:audiobridge-plugin~AudioBridgeHandle} Handle - The custom class implementing the plugin
 * @property {Object} EVENT - The events emitted by the plugin
 * @property {string} EVENT.AUDIOBRIDGE_DESTROYED {@link module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_DESTROYED AUDIOBRIDGE_DESTROYED}
 * @property {string} EVENT.AUDIOBRIDGE_CONFIGURED {@link module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_CONFIGURED AUDIOBRIDGE_CONFIGURED}
 * @property {string} EVENT.AUDIOBRIDGE_KICKED - {@link module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_KICKED AUDIOBRIDGE_KICKED}
 * @property {string} EVENT.AUDIOBRIDGE_PEER_JOINED {@link module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_PEER_JOINED AUDIOBRIDGE_PEER_JOINED}
 * @property {string} EVENT.AUDIOBRIDGE_PEER_CONFIGURED {@link module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_PEER_CONFIGURED AUDIOBRIDGE_PEER_CONFIGURED}
 * @property {string} EVENT.AUDIOBRIDGE_PEER_KICKED {@link module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_PEER_KICKED AUDIOBRIDGE_PEER_KICKED}
 * @property {string} EVENT.AUDIOBRIDGE_PEER_LEAVING {@link module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_PEER_LEAVING AUDIOBRIDGE_PEER_LEAVING}
 * @property {string} EVENT.AUDIOBRIDGE_TALKING {@link module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_TALKING AUDIOBRIDGE_TALKING}
 * @property {string} EVENT.AUDIOBRIDGE_PEER_TALKING {@link module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_PEER_TALKING AUDIOBRIDGE_PEER_TALKING}
 * @property {string} EVENT.AUDIOBRIDGE_SUSPENDED {@link module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_SUSPENDED AUDIOBRIDGE_SUSPENDED}
 * @property {string} EVENT.AUDIOBRIDGE_PEER_SUSPENDED {@link module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_PEER_SUSPENDED AUDIOBRIDGE_PEER_SUSPENDED}
 * @property {string} EVENT.AUDIOBRIDGE_RESUMED {@link module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_RESUMED AUDIOBRIDGE_RESUMED}
 * @property {string} EVENT.AUDIOBRIDGE_PEER_RESUMED {@link module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_PEER_RESUMED AUDIOBRIDGE_PEER_RESUMED}
 * @property {string} EVENT.AUDIOBRIDGE_ROOM_MUTED {@link module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_ROOM_MUTED AUDIOBRIDGE_ROOM_MUTED}
 * @property {string} EVENT.AUDIOBRIDGE_ANNOUNCEMENT_STARTED {@link module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_ANNOUNCEMENT_STARTED AUDIOBRIDGE_ANNOUNCEMENT_STARTED}
 * @property {string} EVENT.AUDIOBRIDGE_ANNOUNCEMENT_STOPPED {@link module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_ANNOUNCEMENT_STOPPED AUDIOBRIDGE_ANNOUNCEMENT_STOPPED}
 * @property {string} EVENT.AUDIOBRIDGE_ERROR {@link module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_ERROR AUDIOBRIDGE_ERROR}
 */
export default {
  id: PLUGIN_ID,
  Handle: AudioBridgeHandle,

  EVENT: {
    /**
     * The audiobridge room has been destroyed.
     *
     * @event module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_DESTROYED
     * @type {Object}
     * @property {number|string} room - The destroyed room identifier
     */
    AUDIOBRIDGE_DESTROYED: PLUGIN_EVENT.DESTROYED,

    /**
     * The current user has been configured.
     *
     * @event module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_CONFIGURED
     * @type {Object}
     * @property {number|string} room - The involved room identifier
     * @property {number|string} feed - The user feed identifier
     * @property {string} [display] - The user display name
     * @property {boolean} [muted] - True if the user is muted
     * @property {boolean} [setup] - True if the user PeerConnection is up
     */
    AUDIOBRIDGE_CONFIGURED: PLUGIN_EVENT.CONFIGURED,

    /**
     * The current user has been kicked out.
     *
     * @event module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_KICKED
     * @type {Object}
     * @property {number|string} room - The involved room identifier
     * @property {number|string} feed - The user feed identifier
     */
    AUDIOBRIDGE_KICKED: PLUGIN_EVENT.KICKED,

    /**
     * A new participant joined.
     *
     * @event module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_PEER_JOINED
     * @type {Object}
     * @property {number|string} room - The involved room identifier
     * @property {number|string} feed - The joined participant feed identifier
     * @property {string} [display] - The joined participant display name
     * @property {boolean} [muted] - True if the participant is muted
     * @property {boolean} [setup] - True if the participant PeerConnection is up
     */
    AUDIOBRIDGE_PEER_JOINED: PLUGIN_EVENT.PEER_JOINED,

    /**
     * A participant has been configured.
     *
     * @event module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_PEER_CONFIGURED
     * @type {Object}
     * @property {number|string} room - The involved room identifier
     * @property {number|string} feed - The configured participant feed identifier
     * @property {string} [display] - The configured participant display name
     * @property {boolean} [muted] - True if the participant is muted
     * @property {boolean} [setup] - True if the participant PeerConnection is up
     */
    AUDIOBRIDGE_PEER_CONFIGURED: PLUGIN_EVENT.PEER_CONFIGURED,

    /**
     * A participant has been kicked out.
     *
     * @event module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_PEER_KICKED
     * @type {Object}
     * @property {number|string} room - The involved room identifier
     * @property {number|string} feed - The kicked participant feed identifier
     */
    AUDIOBRIDGE_PEER_KICKED: PLUGIN_EVENT.PEER_KICKED,

    /**
     * A participant is leaving.
     *
     * @event module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_PEER_LEAVING
     * @type {Object}
     * @property {number|string} room - The involved room identifier
     * @property {number|string} feed - The leaving participant feed identifier
     */
    AUDIOBRIDGE_PEER_LEAVING: PLUGIN_EVENT.PEER_LEAVING,

    /**
     * Notify if the current user is talking.
     *
     * @event module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_TALKING
     * @type {Object}
     * @property {number|string} room - The involved room identifier
     * @property {number|string} feed - The user feed identifier
     * @property {boolean} talking - True if the user is talking
     */
    AUDIOBRIDGE_TALKING: PLUGIN_EVENT.TALKING,

    /**
     * Notify if a participant is talking.
     *
     * @event module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_PEER_TALKING
     * @type {Object}
     * @property {number|string} room - The involved room identifier
     * @property {number|string} feed - The participant feed identifier
     * @property {boolean} talking - True if the participant is talking
     */
    AUDIOBRIDGE_PEER_TALKING: PLUGIN_EVENT.PEER_TALKING,

    /**
     * The current user has been suspended.
     *
     * @event module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_SUSPENDED
     * @type {Object}
     * @property {number|string} room - The involved room identifier
     * @property {number|string} feed - The user feed identifier
     */
    AUDIOBRIDGE_SUSPENDED: PLUGIN_EVENT.SUSPENDED,
    /**
     * Notify if a participant has been suspended.
     *
     * @event module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_PEER_SUSPENDED
     * @type {Object}
     * @property {number|string} room - The involved room identifier
     * @property {number|string} feed - The participant feed identifier
     * @property {string} display - The participant display name
     */
    AUDIOBRIDGE_PEER_SUSPENDED: PLUGIN_EVENT.PEER_SUSPENDED,

    /**
     * The current user has been resumed.
     *
     * @event module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_RESUMED
     * @type {Object}
     * @property {number|string} room - The involved room identifier
     * @property {number|string} feed - The user feed identifier
     */
    AUDIOBRIDGE_RESUMED: PLUGIN_EVENT.RESUMED,

    /**
     * Notify if a participant has been resumed.
     *
     * @event module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_PEER_RESUMED
     * @type {Object}
     * @property {number|string} room - The involved room identifier
     * @property {number|string} feed - The participant feed identifier
     * @property {string} display - The participant display name
     */
    AUDIOBRIDGE_PEER_RESUMED: PLUGIN_EVENT.PEER_RESUMED,

    /**
     * The room has been muted or not.
     *
     * @event module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_ROOM_MUTED
     * @type {Object}
     * @property {number|string} room - The involved room identifier
     * @property {boolean} muted - True if the room is muted
     */
    AUDIOBRIDGE_ROOM_MUTED: PLUGIN_EVENT.ROOM_MUTED,

    /**
     * The announcement has been started.
     *
     * @event module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_ANNOUNCEMENT_STARTED
     * @type {Object}
     * @property {number|string} room - The involved room identifier
     * @property {string} file_id - Unique string ID of the announcement
     */
    AUDIOBRIDGE_ANNOUNCEMENT_STARTED: PLUGIN_EVENT.ANNOUNCEMENT_STARTED,

    /**
     * The announcement has been stopped.
     *
     * @event module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_ANNOUNCEMENT_STOPPED
     * @type {Object}
     * @property {number|string} room - The involved room identifier
     * @property {string} file_id - Unique string ID of the announcement
     */
    AUDIOBRIDGE_ANNOUNCEMENT_STOPPED: PLUGIN_EVENT.ANNOUNCEMENT_STOPPED,

    /**
     * Generic audiobridge error.
     *
     * @event module:audiobridge-plugin~AudioBridgeHandle#event:AUDIOBRIDGE_ERROR
     * @type {Error}
     */
    AUDIOBRIDGE_ERROR: PLUGIN_EVENT.ERROR,
  },
};
