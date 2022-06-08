import Handle from  '../handle.js'
/**
 * The payload of the plugin message (cfr. Janus docs).
 * {@link https://janus.conf.meetecho.com/docs/audiobridge.html}
 */

export type AudioBridgeMsg = 'join'
|'listparticipants'
|'kick'
|'configure'
|'leave'
|'hangup'
|'exists'
|'list'
|'create'
|'destroy'
|'allowed'
|'rtp_forward'
|'stop_rtp_forward'
|'listforwarders'
|'enable_recording'


export type AudioBridgeData = object;
export type RtpParticipant = {
    /**
     * - IP address you want media to be sent to
     */
    ip: string;
    /**
     * - The port you want media to be sent to
     */
    port: number;
    /**
     * - The payload type to use for RTP packets
     */
    payload_type: number;
};
/**
 * The response event to a join request.
 */
export type AUDIOBRIDGE_EVENT_JOINED = {
    /**
     * - The involved room
     */
    room: number | string;
    /**
     * - The feed identifier
     */
    feed: number | string;
    /**
     * - The display name, if available
     */
    display?: string;
    /**
     * - True if the peer is a plain RTP participant
     */
    rtp?: any;
    /**
     * - True if the peer is a plain RTP participant
     */
    participants: Array<{
        feed: number | string
        display: string
        muted: boolean
        setup: boolean
    }>;

};
/**
 * The response event for configure request.
 */
export type AUDIOBRIDGE_EVENT_CONFIGURED = {
    /**
     * - The involved room
     */
    room: number | string;
    /**
     * - The feed identifier
     */
    feed: number | string;
    /**
     * - The display name, if available
     */
    display?: string;
    /**
     * - The muted status
     */
    muted?: boolean;
    /**
     * - [0-10] Opus-related complexity to use
     */
    quality?: number;
    /**
     * - Volume percent value
     */
    volume?: number;
    /**
     * - True if recording is active for this feed
     */
    record?: boolean;
    /**
     * - The recording filename
     */
    filename?: string;
    /**
     * - Number of packets to buffer before decoding
     */
    prebuffer?: number;
    /**
     * - Group to assign to this participant
     */
    group?: string;
    /**
     * - The JSEP answer
     */
    jsep?: RTCSessionDescription;
};
/**
 * The response event for audiobridge hangup request.
 */
export type AUDIOBRIDGE_EVENT_AUDIO_HANGINGUP = {
    /**
     * - The involved room
     */
    room: number | string;
    /**
     * - The feed that is being hung up
     */
    feed: number | string;
};
/**
 * The response event for audiobridge leave request.
 */
export type AUDIOBRIDGE_EVENT_LEAVING = {
    /**
     * - The involved room
     */
    room: number | string;
    /**
     * The feed that is leaving
     */
    "feed-": number | string;
};
/**
 * The response event for audiobridge participants list request.
 */
export type AUDIOBRIDGE_EVENT_PARTICIPANTS_LIST = {
    /**
     * - The involved room
     */
    room: number | string;
    /**
     * - The list of participants
     */
    participants: {
        feed: number | string;
        display?: string;
        muted?: boolean;
        setup?: boolean;
        talking?: boolean;
    };
};
/**
 * The response event for audiobridge participant kick request.
 */
export type AUDIOBRIDGE_EVENT_KICK_RESPONSE = {
    /**
     * - The involved room
     */
    room: number | string;
    /**
     * - The feed that has been kicked out
     */
    feed: number | string;
};
/**
 * The response event for audiobridge room exists request.
 */
export type AUDIOBRIDGE_EVENT_EXISTS = {
    /**
     * - The involved room
     */
    room: number | string;
    /**
     * - True if the rooms exists
     */
    exists: boolean;
};
/**
 * The response event for audiobridge room list request.
 */
export type AUDIOBRIDGE_EVENT_ROOMS_LIST = {
    /**
     * - The list of the rooms as returned by Janus
     */
    list: object[];
};
/**
 * The response event for audiobridge forwarder start request.
 */
export type AUDIOBRIDGE_EVENT_RTP_FWD = {
    /**
     * - The involved room
     */
    room: number | string;
    /**
     * - Forwarder descriptor
     */
    forwarder: {
        host: string;
        audio_port: number;
        audio_stream: number;
        group?: string;
    };
};
/**
 * The response event for audiobridge room create request.
 */
export type AUDIOBRIDGE_EVENT_CREATED = {
    /**
     * - The created room
     */
    room: number | string;
    /**
     * - True if the room is being persisted in the Janus config file
     */
    permanent: boolean;
};
/**
 * The response event for audiobridge room destroy request.
 */
export type AUDIOBRIDGE_EVENT_DESTROYED = {
    /**
     * - The destroyed room
     */
    room: number | string;
};
/**
 * The response event for audiobridge forwarders list request.
 */
export type AUDIOBRIDGE_EVENT_FWD_LIST = {
    /**
     * - The involved room
     */
    room: number | string;
    /**
     * - The list of forwarders
     */
    forwarders: {
        host: string;
        audio_port: number;
        audio_stream: number;
        always: boolean;
        group?: string;
    };
};
/**
 * The response event for audiobridge ACL token edit request.
 */
export type AUDIOBRIDGE_EVENT_ALLOWED = {
    /**
     * - The involved room
     */
    room: number | string;
    /**
     * - The updated, complete, list of allowed tokens
     */
    list: string[];
};

export type AUDIOBRIDGE_EVENT_ENABLE_RECORDING = {
    room: number | string;
    secret: string;
    record: boolean;
    filename ?: string;
    dir ?: string;
}

export class AudioBridgeHandle extends Handle {
    /**
     * The feed identifier assigned to this handle when it joined the audio bridge.
     *
     * @type {number|string}
     */
    feed: number | string;
    /**
     * The identifier of the room the audiobridge handle has joined.
     *
     * @type {number|string}
     */
    room: number | string;
    /**
     * The custom "handleMessage" needed for handling AudioBridge messages.
     *
     * @private
     * @param {object} janus_message
     * @returns {object} A falsy value for unhandled events, a truthy value for handled events
     */
    // private handleMessage;
    /**
     * Join an audiobridge room.
     *
     * @param {object} params
     * @param {number|string} params.room - The room to join
     * @param {number} [params.feed=0] - The feed identifier for the participant, picked by Janus if omitted
     * @param {string} [params.display] - The display name to use
     * @param {boolean} [params.muted] - True to join in muted status
     * @param {string} [params.pin] - The pin needed to join
     * @param {string} [params.token] - The token to use when joining
     * @param {number} [params.quality] - The opus quality for the encoder
     * @param {number} [params.volume] - The percent volume
     * @param {boolean} [params.record] - True to enable recording
     * @param {string} [params.filename] - The recording filename
     * @param {module:audiobridge-plugin~RtpParticipant|boolean} [params.rtp_participant] - True if this feed is a plain RTP participant (use an object to pass a participant descriptor)
     * @param {string} [params.group] - The group to assign to this participant
     * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_JOINED>}
     */
    join({ room, feed, display, muted, pin, token, quality, volume, record, filename, rtp_participant, group }: {
        room: number | string;
        feed?: number;
        display?: string;
        muted?: boolean;
        pin?: string;
        token?: string;
        quality?: number;
        volume?: number;
        record?: boolean;
        filename?: string;
        rtp_participant?: any;
        group?: string;
    }): Promise<AUDIOBRIDGE_EVENT_JOINED>
    /**
     * Configure an audiobridge handle.
     *
     * @param {object} params
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
     * @param {RTCSessionDescription} [params.jsep=null] - JSEP offer
     * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_CONFIGURED>}
     */
    configure({ display, muted, quality, bitrate, volume, record, filename, expected_loss, prebuffer, group, jsep }: {
        display?: string;
        muted?: boolean;
        quality?: number;
        bitrate?: number;
        volume?: number;
        record?: boolean;
        filename?: string;
        expected_loss?: number;
        prebuffer?: number;
        group?: string;
        jsep?: RTCSessionDescription;
    }): Promise<AUDIOBRIDGE_EVENT_CONFIGURED>
    /**
     * Request an audiobridge handle hangup.
     *
     * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_AUDIO_HANGINGUP>}
     *
     */
    audioHangup(): Promise<AUDIOBRIDGE_EVENT_AUDIO_HANGINGUP>
    /**
     * Leave an audiobridge room.
     *
     * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_LEAVING>}
     */
    leave(): Promise<AUDIOBRIDGE_EVENT_LEAVING>
    /**
     * List participants inside a room.
     *
     * @param {object} params
     * @param {number|string} params.room - The room where to execute the list
     * @param {string} [params.secret] - The optional secret needed for managing the room
     * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_PARTICIPANTS_LIST>}
     */
    listParticipants({ room, secret }: {
        room: number | string
        secret?: string
    }): Promise<AUDIOBRIDGE_EVENT_PARTICIPANTS_LIST>
    /**
     * Kick an user out from a room.
     *
     * @param {object} params
     * @param {number|string} params.room - The involved room
     * @param {number|string} params.feed - The feed to kick out
     * @param {string} [params.secret] - The optional secret needed for managing the room
     * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_KICK_RESPONSE>}
     */
    kick({ room, feed, secret }: {
        room: number | string
        feed: number | string
        secret?: string
    }): Promise<AUDIOBRIDGE_EVENT_KICK_RESPONSE>
    /**
     * Check if a room exists.
     *
     * @param {object} params
     * @param {number|string} params.room - The involved room
     * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_EXISTS>}
     */
    exists({ room }: {
        room: number | string;
    }): Promise<AUDIOBRIDGE_EVENT_EXISTS>
    /**
     * List available audiobridge rooms.
     *
     * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_ROOMS_LIST>}
     */
    list(): Promise<AUDIOBRIDGE_EVENT_ROOMS_LIST>
    /**
     * Create an audiobridge room.
     *
     * @param {object} params
     * @param {number|string} params.room - The room identifier
     * @param {string} [params.description] - A room description
     * @param {boolean} [params.permanent] - Set to true to persist the room in the Janus config file
     * @param {number} [params.sampling_rate] - The sampling rate (bps) to be used in the room
     * @param {number} [params.bitrate] - The bitrate (bps) to be used in the room, if missing the encoder decides
     * @param {boolean} [params.is_private] - Set room as private (hidden in list)
     * @param {string} [params.secret] - The secret to be used when managing the room
     * @param {string} [params.pin] - The ping needed for joining the room
     * @param {boolean} [params.record] - True to record the mixed audio
     * @param {string} [params.filename] - The recording filename
     * @param {boolean} [params.talking_events] - True to enable talking events
     * @param {number} [params.talking_level_threshold] - Audio level threshold for talking events in the range [0, 127]
     * @param {number} [params.talking_packets_threshold] - Audio packets threshold for talking events
     * @param {number} [params.expected_loss] - The expected loss percentage in the audiobridge, if > 0 enables FEC
     * @param {number} [params.prebuffer] - The prebuffer to use for every participant
     * @param {boolean} [params.allow_rtp] - Allow plain RTP participants
     * @param {string[]} [params.groups] - The available groups in the room
     * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_CREATED>}
     */
    create({ room, description, permanent, sampling_rate, bitrate, is_private, secret, pin, record, filename, talking_events, talking_level_threshold, talking_packets_threshold, expected_loss, prebuffer, allow_rtp, groups }: {
        room: number | string;
        description?: string;
        permanent?: boolean;
        sampling_rate?: number;
        bitrate?: number;
        is_private?: boolean;
        secret?: string;
        pin?: string;
        record?: boolean;
        filename?: string;
        talking_events?: boolean;
        talking_level_threshold?: number;
        talking_packets_threshold?: number;
        expected_loss?: number;
        prebuffer?: number;
        allow_rtp?: boolean;
        groups?: string[];
    }): Promise<AUDIOBRIDGE_EVENT_CREATED>
    /**
     * Destroy an audiobridge room.
     *
     * @param {object} params
     * @param {number|string} params.room - The room to destroy
     * @param {boolean} [params.permanent] - Set to true to remove the room from the Janus config file
     * @param {string} [params.secret] - The optional secret needed to manage the room
     * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_DESTROYED>}
     */
    destroy({ room, permanent, secret }: {
        room: number | string
        permanent?: boolean
        secret?: string
    }): Promise<AUDIOBRIDGE_EVENT_DESTROYED>
    /**
     * Edit an audiobridge token list.
     *
     * @param {object} params
     * @param {number|string} params.room - The involved room
     * @param {"enable"|"disable"|"add"|"remove"} params.action - The action to perform
     * @param {string[]} params.list - The list of tokens to add/remove
     * @param {string} [params.secret] - The optional secret needed to manage the room
     * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_ALLOWED>}
     */
    allow({ room, action, list, secret }: {
        room: number | string;
        action: "enable" | "disable" | "add" | "remove";
        list: string[];
        secret?: string;
    }): Promise<AUDIOBRIDGE_EVENT_ALLOWED>
    /**
     * Start a RTP forwarder.
     *
     * @param {object} params
     * @param {number|string} params.room - The involved room
     * @param {boolean} [params.always] - Whether silence should be forwarded when the room is empty
     * @param {string} params.host - The host to forward to
     * @param {number} params.audio_port - The port to forward to
     * @param {string} [params.group] - The group to forward
     * @param {string} [params.secret] - The optional secret needed to manage the room
     * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_RTP_FWD>}
     */
    startForward({ room, always, host, audio_port, group, secret }: {
        room: number | string;
        always?: boolean;
        host: string;
        audio_port: number;
        group?: string;
        secret?: string;
    }): Promise<AUDIOBRIDGE_EVENT_RTP_FWD>
    /**
     * Stop a RTP forwarder.
     *
     * @param {object} params
     * @param {number|string} params.room - The involved room
     * @param {number} params.stream - The forwarder identifier to stop
     * @param {string} [params.secret] - The optional secret needed to manage the room
     * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_RTP_FWD>}
     */
    stopForward({ room, stream, secret }: {
        room: number | string;
        stream: number;
        secret?: string;
    }): Promise<AUDIOBRIDGE_EVENT_RTP_FWD>
    /**
     * List active forwarders.
     *
     * @param {object} params
     * @param {number|string} params.room - The involved room
     * @param {string} [params.secret] - The optional secret needed to manage the room
     * @returns {Promise<module:audiobridge-plugin~AUDIOBRIDGE_EVENT_FWD_LIST>}
     */
    listForward({ room, secret }: {
        room: number | string;
        secret?: string;
    }): Promise<AUDIOBRIDGE_EVENT_FWD_LIST>

    enableRecording({ room, secret, record, filename }: {
        room: number | string;
        secret: string;
        record: boolean;
        filename ?: string;
    }): Promise<{success: boolean}>

}

export type AudioBridgeEvent = {
    AUDIOBRIDGE_DESTROYED: string
    AUDIOBRIDGE_KICKED: string
    AUDIOBRIDGE_PEER_JOINED: string
    AUDIOBRIDGE_PEER_CONFIGURED: string
    AUDIOBRIDGE_PEER_KICKED: string
    AUDIOBRIDGE_PEER_LEAVING: string
    AUDIOBRIDGE_TALKING: string
    AUDIOBRIDGE_PEER_TALKING: string
    AUDIOBRIDGE_ERROR: string
}
declare var _default: {
  id: string
  Handle: AudioBridgeHandle
  EVENT: AudioBridgeEvent
}
export default _default

