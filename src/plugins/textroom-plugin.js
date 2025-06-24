'use strict';

/**
 * This module contains the implementation of the TextRoom plugin (ref. {@link https://janus.conf.meetecho.com/docs/textroom.html}).
 * Notice this only covers what's possible via the Janus API: messages only sent via datachannels are not covered by this module.
 * @module textroom-plugin
 */

import Handle from '../handle.js';

/* The plugin ID exported in the plugin descriptor */
const PLUGIN_ID = 'janus.plugin.textroom';

/* These are the requests defined for the Janus TextRoom API */
const REQUEST_SETUP = 'setup';
const REQUEST_ACK = 'ack';
const REQUEST_RESTART = 'restart';
const REQUEST_LIST_ROOMS = 'list';
const REQUEST_LIST_PARTICIPANTS = 'listparticipants';
const REQUEST_EXISTS = 'exists';
const REQUEST_CREATE = 'create';
const REQUEST_ALLOW = 'allowed';
const REQUEST_ANNOUNCEMENT = 'announcement';
const REQUEST_KICK = 'kick';
const REQUEST_DESTROY = 'destroy';

/* These are the events/responses that the Janode plugin will manage */
/* Some of them will be exported in the plugin descriptor */
const PLUGIN_EVENT = {
  ROOMS_LIST: 'textroom_list',
  PARTICIPANTS_LIST: 'textroom_participants_list',
  EXISTS: 'textroom_exists',
  CREATED: 'textroom_created',
  DESTROYED: 'textroom_destroyed',
  SUCCESS: 'textroom_success',
  ERROR: 'textroom_error',
};

/**
 * The class implementing the TextRoom plugin (ref. {@link https://janus.conf.meetecho.com/docs/textroom.html}).
 * Notice this only covers what's possible via the Janus API: messages only sent via datachannels are not covered by this module.<br>
 *
 * It extends the base Janode Handle class and overrides the base "handleMessage" method.<br>
 *
 * Moreover it defines many methods to support TextRoom operations.
 *
 * @hideconstructor
 * @extends module:handle~Handle
 */
class TextRoomHandle extends Handle {
  /**
   * Create a Janode TextRoom handle.
   *
   * @param {module:session~Session} session - A reference to the parent session
   * @param {number} id - The handle identifier
   */
  constructor(session, id) {
    super(session, id);
  }

  /**
   * The custom "handleMessage" needed for handling TextRoom messages.
   *
   * @private
   * @param {Object} janus_message
   * @returns {Object} A falsy value for unhandled events, a truthy value for handled events
   */
  handleMessage(janus_message) {
    const { plugindata, transaction } = janus_message;
    if (plugindata && plugindata.data && plugindata.data.textroom) {
      /**
       * @type {TextRoomData}
       */
      const message_data = plugindata.data;
      const { textroom, error, error_code, room } = message_data;

      /* Prepare an object for the output Janode event */
      const janode_event = this._newPluginEvent(janus_message);

      /* Add room information if available */
      if (room) janode_event.data.room = room;

      /* The plugin will emit an event only if the handle does not own the transaction */
      /* That means that a transaction has already been closed or this is an async event */
      const emit = (this.ownsTransaction(transaction) === false);

      switch (textroom) {

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
          /* Participants list API */
          if (typeof message_data.participants !== 'undefined') {
            janode_event.data.participants = message_data.participants;
            janode_event.event = PLUGIN_EVENT.PARTICIPANTS_LIST;
            break;
          }

          /* Generic success (might be token disable) */
          if (typeof message_data.allowed !== 'undefined') {
            janode_event.data.list = message_data.allowed;
          }
          /* In this case the "event" field of the Janode event is "success" */
          janode_event.event = PLUGIN_EVENT.SUCCESS;
          break;

        /* TextRoom room created */
        case 'created':
          janode_event.event = PLUGIN_EVENT.CREATED;
          janode_event.data.permanent = message_data.permanent;
          break;

        /* TextRoom room destroyed */
        case 'destroyed':
          janode_event.event = PLUGIN_EVENT.DESTROYED;
          janode_event.data.permanent = message_data.permanent;
          break;

        /* Generic event (e.g. errors) */
        case 'event':
          /* TextRoom error */
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
              janode_event.event = PLUGIN_EVENT.SUCCESS;
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

  /* These are the APIs that users need to work with the textroom plugin */

  /**
   * Setup a datachannel connection.
   *
   * @returns {Promise<module:textroom-plugin~TEXTROOM_EVENT_SUCCESS>}
   */
  async setup() {
    const body = {
      request: REQUEST_SETUP,
    };

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.SUCCESS)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Complete the setup or restart of a datachannel connection.
   *
   * @param {Object} params
   * @param {RTCSessionDescription} params.jsep
   * @returns {Promise<module:textroom-plugin~TEXTROOM_EVENT_SUCCESS>}
   */
  async ack(jsep) {
    const body = {
      request: REQUEST_ACK,
    };

    const response = await this.message(body, jsep);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.SUCCESS)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Restart the setup of a datachannel connection.
   *
   * @returns {Promise<module:textroom-plugin~TEXTROOM_EVENT_SUCCESS>}
   */
  async restart() {
    const body = {
      request: REQUEST_RESTART,
    };

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.SUCCESS)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /*----------------*/
  /* Management API */
  /*----------------*/

  /* These are the APIs needed to manage textroom resources (rooms, forwarders ...) */

  /**
   * List available textroom rooms.
   *
   * @param {Object} params
   * @param {string} [params.admin_key] - The admin key needed for invoking the API
   * @returns {Promise<module:textroom-plugin~TEXTROOM_EVENT_ROOMS_LIST>}
   */
  async list({ admin_key }) {
    const body = {
      request: REQUEST_LIST_ROOMS,
    };
    if (typeof admin_key === 'string') body.admin_key = admin_key;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.ROOMS_LIST)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * List participants inside a room.
   *
   * @param {Object} params
   * @param {number|string} params.room - The room where to execute the list
   * @returns {Promise<module:textroom-plugin~TEXTROOM_EVENT_PARTICIPANTS_LIST>}
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
   * Check if a room exists.
   *
   * @param {Object} params
   * @param {number|string} params.room - The involved room
   * @returns {Promise<module:textroom-plugin~TEXTROOM_EVENT_EXISTS>}
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
   * Create a textroom room.
   *
   * @param {Object} params
   * @param {number|string} params.room - The room identifier
   * @param {string} [params.admin_key] - The admin key needed for invoking the API
   * @param {string} [params.description] - A room description
   * @param {string} [params.secret] - The secret to be used when managing the room
   * @param {string} [params.pin] - The ping needed for joining the room
   * @param {boolean} [params.is_private] - Set room as private (hidden in list)
   * @param {boolean} [params.history] - Set number of messages to store as a history
   * @param {boolean} [params.post] - Set HTTP backend to forward incoming chat messages to
   * @param {boolean} [params.permanent] - Set to true to persist the room in the Janus config file
   * @returns {Promise<module:textroom-plugin~TEXTROOM_EVENT_CREATED>}
   */
  async create({ room, admin_key, description, secret, pin, is_private, history, post, permanent }) {
    const body = {
      request: REQUEST_CREATE,
      room,
    };
    if (typeof admin_key === 'string') body.admin_key = admin_key;
    if (typeof description === 'string') body.description = description;
    if (typeof secret === 'string') body.secret = secret;
    if (typeof pin === 'string') body.pin = pin;
    if (typeof is_private === 'boolean') body.is_private = is_private;
    if (typeof history === 'number') body.history = history;
    if (typeof post === 'string') body.post = post;
    if (typeof permanent === 'boolean') body.permanent = permanent;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.CREATED)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Edit a textroom token list.
   *
   * @param {Object} params
   * @param {number|string} params.room - The involved room
   * @param {"enable"|"disable"|"add"|"remove"} params.action - The action to perform
   * @param {string[]} params.list - The list of tokens to add/remove
   * @param {string} [params.secret] - The optional secret needed to manage the room
   * @returns {Promise<module:textroom-plugin~TEXTROOM_EVENT_ALLOWED_RESPONSE>}
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
   * Send an announcement to a textroom room.
   *
   * @param {Object} params
   * @param {number|string} params.room - The involved room
   * @param {string} params.text - The content of the announcement, as text
   * @param {string} [params.secret] - The optional secret needed to manage the room
   * @returns {Promise<module:textroom-plugin~TEXTROOM_EVENT_SUCCESS>}
   */
  async announcement({ room, text, secret }) {
    const body = {
      request: REQUEST_ANNOUNCEMENT,
      room,
      text,
    };
    if (typeof secret === 'string') body.secret = secret;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.SUCCESS)
      return evtdata;
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Kick an user out from a room.
   *
   * @param {Object} params
   * @param {number|string} params.room - The involved room
   * @param {string} params.username - The user to kick out
   * @param {string} [params.secret] - The optional secret needed for managing the room
   * @returns {Promise<module:textroom-plugin~TEXTROOM_EVENT_KICK_RESPONSE>}
   */
  async kick({ room, username, secret }) {
    const body = {
      request: REQUEST_KICK,
      room,
      username,
    };
    if (typeof secret === 'string') body.secret = secret;

    const response = await this.message(body);
    const { event, data: evtdata } = this._getPluginEvent(response);
    if (event === PLUGIN_EVENT.SUCCESS) {
      /* Add data missing from Janus response */
      evtdata.room = body.room;
      evtdata.username = body.username;
      return evtdata;
    }
    const error = new Error(`unexpected response to ${body.request} request`);
    throw (error);
  }

  /**
   * Destroy a textroom room.
   *
   * @param {Object} params
   * @param {number|string} params.room - The room to destroy
   * @param {boolean} [params.permanent] - Set to true to remove the room from the Janus config file
   * @param {string} [params.secret] - The optional secret needed to manage the room
   * @returns {Promise<module:textroom-plugin~TEXTROOM_EVENT_DESTROYED>}
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

}

/**
 * The payload of the plugin message (cfr. Janus docs).
 * {@link https://janus.conf.meetecho.com/docs/textroom.html}
 *
 * @private
 * @typedef {Object} TextRoomData
 */

/**
 * The response event for textroom WebRTC establishment.
 *
 * @typedef {Object} TEXTROOM_EVENT_SUCCESS
 */

/**
 * The response event for textroom room list request.
 *
 * @typedef {Object} TEXTROOM_EVENT_ROOMS_LIST
 * @property {object[]} list - The list of the rooms as returned by Janus
 */

/**
 * The response event for textroom participants list request.
 *
 * @typedef {Object} TEXTROOM_EVENT_PARTICIPANTS_LIST
 * @property {number|string} room - The involved room
 * @property {object[]} participants - The list of participants as returned by Janus
 */

/**
 * The response event for textroom room exists request.
 *
 * @typedef {Object} TEXTROOM_EVENT_EXISTS
 * @property {number|string} room - The involved room
 * @property {boolean} exists - True if the rooms exists
 */

/**
 * The response event for textroom room create request.
 *
 * @typedef {Object} TEXTROOM_EVENT_CREATED
 * @property {number|string} room - The created room
 * @property {boolean} permanent - True if the room is being persisted in the Janus config file
 */

/**
 * The response event for textroom room destroy request.
 *
 * @typedef {Object} TEXTROOM_EVENT_DESTROYED
 * @property {number|string} room - The destroyed room
 * @property {boolean} permanent - True if the room removal is being persisted in the Janus config file
 */

/**
 * The response event for textroom participant kick request.
 *
 * @typedef {Object} TEXTROOM_EVENT_KICK_RESPONSE
 * @property {number|string} room - The involved room
 * @property {string} username - The username that has been kicked out
 */

/**
 * The response event for textroom ACL token edit request.
 *
 * @typedef {Object} TEXTROOM_EVENT_ALLOWED_RESPONSE
 * @property {number|string} room - The involved room
 * @property {string[]} list - The updated, complete, list of allowed tokens
 */

/**
 * The exported plugin descriptor.
 *
 * @type {Object}
 * @property {string} id - The plugin identifier used when attaching to Janus
 * @property {module:textroom-plugin~TextRoomHandle} Handle - The custom class implementing the plugin
 * @property {Object} EVENT - The events emitted by the plugin
 * @property {string} EVENT.TEXTROOM_ERROR {@link module:textroom-plugin~TextRoomHandle#event:TEXTROOM_ERROR TEXTROOM_ERROR}
 */
export default {
  id: PLUGIN_ID,
  Handle: TextRoomHandle,

  EVENT: {
    /**
     * Generic textroom error.
     *
     * @event module:textroom-plugin~TextRoomHandle#event:TEXTROOM_ERROR
     * @type {Error}
     */
    TEXTROOM_ERROR: PLUGIN_EVENT.ERROR,
  },
};
