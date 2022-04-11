import Handle from "../handle.js";
/**
 * The class implementing the VideoRoom plugin (ref. {@link https://janus.conf.meetecho.com/docs/videoroom.html}).<br>
 *
 * It extends the base Janode Handle class and overrides the "handleMessage" method.<br>
 *
 * Moreover it defines many methods to support VideoRoom operations.<br>
 *
 * @hideconstructor
 */
export class VideoRoomHandle extends Handle {
    /**
     * Either the feed identifier assigned to this publisher handle or the publisher's feed in case this handle is a subscriber.
     *
     * @type {number|string}
     */
    feed: number | string;
    /**
     * The identifier of the videoroom the handle has joined.
     *
     * @type {number|string}
     */
    room: number | string;
    /**
     * The custom "handleMessage" needed for handling VideoRoom messages.
     *
     * @private
     * @param {object} janus_message
     * @returns {object} A falsy value for unhandled events, a truthy value for handled events
     */
    // private handleMessage;
    /**
     * Join a videoroom as publisher.
     *
     * @param {object} params
     * @param {number|string} params.room - The room to join to
     * @param {number|string} [params.feed=0] - The feed identifier to use, if missing it is picked by Janus
     * @param {boolean} [params.audio] - True to request audio relaying
     * @param {boolean} [params.video] - True to request video relaying
     * @param {boolean} [params.data] - True to request datachannel relaying
     * @param {string} [params.display] - The display name to use
     * @param {number} [params.bitrate] - Bitrate cap
     * @param {string} [params.token] - The optional token needed to join the room
     * @param {string} [params.pin] - The optional pin needed to join the room
     * @param {boolean} [params.record] - Enable the recording
     * @param {string} [params.filename] - If recording, the base path/file to use for the recording
     * @returns {Promise<module:videoroom-plugin~VIDEOROOM_EVENT_PUB_JOINED>}
     */
    joinPublisher({ room, feed, audio, video, data, bitrate, record, filename, display, token, pin }: {
        room: number | string;
        feed?: number | string;
        audio?: boolean;
        video?: boolean;
        data?: boolean;
        display?: string;
        bitrate?: number;
        token?: string;
        pin?: string;
        record?: boolean;
        filename?: string;
    }): Promise<VIDEOROOM_EVENT_PUB_JOINED>;
    /**
     * Join and configure videoroom handle as publisher.
     *
     * @param {object} params
     * @param {number|string} params.room - The room to join to
     * @param {number|string} [params.feed=0] - The feed identifier to use, if missing it is picked by Janus
     * @param {boolean} [params.audio] - True to request audio relaying
     * @param {boolean} [params.video] - True to request video relaying
     * @param {boolean} [params.data] - True to request datachannel relaying
     * @param {string} [params.display] - The display name to use
     * @param {number} [params.bitrate] - Bitrate cap
     * @param {string} [params.token] - The optional token needed to join the room
     * @param {string} [params.pin] - The optional pin needed to join the room
     * @param {boolean} [params.record] - Enable the recording
     * @param {string} [params.filename] - If recording, the base path/file to use for the recording
     * @param {RTCSessionDescription} [params.jsep] - The JSEP offer
     * @returns {Promise<module:videoroom-plugin~VIDEOROOM_EVENT_PUB_JOINED>}
     */
    joinConfigurePublisher({ room, feed, audio, video, data, bitrate, record, filename, display, token, pin, jsep }: {
        room: number | string;
        feed?: number | string;
        audio?: boolean;
        video?: boolean;
        data?: boolean;
        display?: string;
        bitrate?: number;
        token?: string;
        pin?: string;
        record?: boolean;
        filename?: string;
        jsep?: RTCSessionDescription;
    }): Promise<VIDEOROOM_EVENT_PUB_JOINED>;
    /**
     * Configure a publisher or subscriber handle.<br>
     * Room is detected from the context since a handle must have joined before.<br>
     * Can also be used by publishers to publish a feed.<br>
     *
     * Use this API also to trigger ICE restarts. Publishers can omit the
     * restart/update flags, while subscribers need to use them to force
     * the operation.
     *
     * @param {object} params
     * @param {boolean} [params.audio] - True to request audio relaying
     * @param {boolean} [params.video] - True to request video relaying
     * @param {boolean} [params.data] - True to request datachannel relaying
     * @param {string} [params.display] - The display name to use (publishers only)
     * @param {number} [params.bitrate] - Bitrate cap (publishers only)
     * @param {boolean} [params.record] - True to record the feed (publishers only)
     * @param {string} [params.filename] - If recording, the base path/file to use for the recording (publishers only)
     * @param {boolean} [params.restart] - Set to force a ICE restart
     * @param {boolean} [params.update] - Set to force a renegotiation
     * @param {RTCSessionDescription} [params.jsep] - The JSEP offer (publishers only)
     * @returns {Promise<module:videoroom-plugin~VIDEOROOM_EVENT_CONFIGURED>}
     */
    configure({ audio, video, data, bitrate, record, filename, display, restart, update, jsep }: {
        audio?: boolean;
        video?: boolean;
        data?: boolean;
        display?: string;
        bitrate?: number;
        record?: boolean;
        filename?: string;
        restart?: boolean;
        update?: boolean;
        jsep?: RTCSessionDescription;
    }): Promise<VIDEOROOM_EVENT_CONFIGURED>;
    /**
     * Publish a feed in the room.
     * Room is detected from the context since a handle must have joined before.
     *
     * @param {object} params
     * @param {boolean} [params.audio] - True to request audio relaying
     * @param {boolean} [params.video] - True to request video relaying
     * @param {boolean} [params.data] - True to request datachannel relaying
     * @param {string} [params.display] - The display name to use
     * @param {number} [params.bitrate] - Bitrate cap
     * @param {boolean} [params.record] - True to record the feed
     * @param {string} [params.filename] - If recording, the base path/file to use for the recording
     * @param {RTCSessionDescription} params.jsep - The JSEP offer
     * @returns {Promise<module:videoroom-plugin~VIDEOROOM_EVENT_CONFIGURED>}
     */
    publish({ audio, video, data, bitrate, record, filename, display, jsep }: {
        audio?: boolean;
        video?: boolean;
        data?: boolean;
        display?: string;
        bitrate?: number;
        record?: boolean;
        filename?: string;
        jsep: RTCSessionDescription;
    }): Promise<VIDEOROOM_EVENT_CONFIGURED>;
    /**
     * Unpublish a feed in the room.
     *
     * @returns {Promise<module:videoroom-plugin~VIDEOROOM_EVENT_UNPUBLISHED>}
     */
    unpublish(): Promise<VIDEOROOM_EVENT_UNPUBLISHED>;
    /**
     * Join a room as subscriber.
     *
     * @param {object} params
     * @param {number|string} params.room - The room to join
     * @param {number|string} [params.feed=0] - The feed the user wants to subscribe to
     * @param {boolean} [params.audio] - True to subscribe to the audio feed
     * @param {boolean} [params.video] - True to subscribe to the video feed
     * @param {boolean} [params.data] - True to subscribe to the datachannels of the feed
     * @param {string} [params.token] - The optional token needed
     * @returns {Promise<module:videoroom-plugin~VIDEOROOM_EVENT_SUB_JOINED>}
     */
    joinSubscriber({ room, feed, audio, video, data, token }: {
        room: number | string;
        feed?: number | string;
        audio?: boolean;
        video?: boolean;
        data?: boolean;
        token?: string;
    }): Promise<VIDEOROOM_EVENT_SUB_JOINED>;
    /**
     * Alias for "joinSubscriber".
     *
     * @see module:videoroom-plugin~VideoRoomHandle#joinSubscriber
     */
    joinListener(params: any): Promise<VIDEOROOM_EVENT_SUB_JOINED>;
    /**
     * Start a subscriber stream.
     *
     * @param {object} params
     * @param {RTCSessionDescription} params.jsep - The JSEP answer
     * @returns {Promise<module:videoroom-plugin~VIDEOROOM_EVENT_STARTED>}
     */
    start({ jsep }: {
        jsep: RTCSessionDescription;
    }): Promise<VIDEOROOM_EVENT_STARTED>;
    /**
     * Pause a subscriber feed.
     *
     * @returns {Promise<module:videoroom-plugin~VIDEOROOM_EVENT_PAUSED>}
     */
    pause(): Promise<VIDEOROOM_EVENT_PAUSED>;
    /**
     * Leave a room.
     * Can be used by both publishers and subscribers.
     *
     * @returns {Promise<module:videoroom-plugin~VIDEOROOM_EVENT_LEAVING>}
     */
    leave(): Promise<VIDEOROOM_EVENT_LEAVING>;
    /**
     * List the participants inside a room.
     *
     * @param {object} params
     * @param {number|string} params.room - The room where the list is being requested
     * @param {string} params.secret - The optional secret for the operation
     * @returns {Promise<module:videoroom-plugin~VIDEOROOM_EVENT_PARTICIPANTS_LIST>}
     */
    listParticipants({ room, secret }: {
        room: number | string;
        secret: string;
    }): Promise<VIDEOROOM_EVENT_PARTICIPANTS_LIST>;
    /**
     * Kick a publisher out from a room.
     *
     * @param {object} params
     * @param {number|string} params.room - The room where the kick is being requested
     * @param {number|string} params.feed - The identifier of the feed to kick out
     * @param {string} params.secret - The optional secret for the operation
     * @returns {Promise<module:videoroom-plugin~VIDEOROOM_EVENT_KICKED>}
     */
    kick({ room, feed, secret }: {
        room: number | string;
        feed: number | string;
        secret: string;
    }): Promise<VIDEOROOM_EVENT_KICKED>;
    /**
     * Check if a room exists.
     *
     * @param {object} params
     * @param {number|string} params.room - The room to check
     * @returns {Promise<module:videoroom-plugin~VIDEOROOM_EVENT_EXISTS>}
     */
    exists({ room }: {
        room: number | string;
    }): Promise<VIDEOROOM_EVENT_EXISTS>;
    /**
     * List all the available rooms.
     *
     * @returns {Promise<module:videoroom-plugin~VIDEOROOM_EVENT_LIST>}
     */
    list(): Promise<VIDEOROOM_EVENT_LIST>;
    /**
     * Create a new room.
     *
     * @param {object} params
     * @param {number|string} [params.room] - The room identifier, if missing picked by janus
     * @param {string} [params.description] - A textual description of the room
     * @param {number} [params.max_publishers] - The max number of publishers allowed
     * @param {boolean} [params.permanent] - True to make Janus persist the room on th config file
     * @param {boolean} [params.is_private] - Make the room private (hidden from listing)
     * @param {string} [params.secret] - The secret that will be used to modify the room
     * @param {string} [params.pin] - The pin needed to access the room
     * @param {number} [params.bitrate] - The bitrate cap that will be used for publishers
     * @param {boolean} [params.bitrate_cap] - Make the bitrate cap an insormountable limit
     * @param {number} [params.fir_freq] - The PLI interval in seconds
     * @param {string} [params.audiocodec] - Comma separated list of allowed audio codecs
     * @param {string} [params.videocodec] - Comma separated list of allowed video codecs
     * @param {boolean} [params.talking_events] - True to enable talking events
     * @param {number} [params.talking_level_threshold] - Audio level threshold for talking events in the range [0, 127]
     * @param {number} [params.talking_packets_threshold] - Audio packets threshold for talking events
     * @param {boolean} [params.record] - Wheter to enable recording of any publisher
     * @param {string} [params.rec_dir] - Folder where recordings should be stored
     * @param {boolean} [params.videoorient] - Whether the video-orientation RTP extension must be negotiated
     * @param {string} [params.h264_profile] - H264 specific profile to prefer
     * @returns {Promise<module:videoroom-plugin~VIDEOROOM_EVENT_CREATED>}
     */
    create({ room, description, max_publishers, permanent, is_private, secret, pin, bitrate, bitrate_cap, fir_freq, audiocodec, videocodec, talking_events, talking_level_threshold, talking_packets_threshold, record, rec_dir, videoorient, h264_profile }: {
        room?: number | string;
        description?: string;
        max_publishers?: number;
        permanent?: boolean;
        is_private?: boolean;
        secret?: string;
        pin?: string;
        bitrate?: number;
        bitrate_cap?: boolean;
        fir_freq?: number;
        audiocodec?: string;
        videocodec?: string;
        talking_events?: boolean;
        talking_level_threshold?: number;
        talking_packets_threshold?: number;
        record?: boolean;
        rec_dir?: string;
        videoorient?: boolean;
        h264_profile?: string;
    }): Promise<VIDEOROOM_EVENT_CREATED>;
    /**
     * Destroy a room.
     *
     * @param {object} params
     * @param {number|string} params.room - The room to destroy
     * @param {boolean} [params.permanent] - True to remove the room from the Janus config file
     * @param {string} [params.secret] - The secret needed to manage the room
     * @returns {Promise<module:videoroom-plugin~VIDEOROOM_EVENT_DESTROYED>}
     */
    destroy({ room, permanent, secret }: {
        room: number | string;
        permanent?: boolean;
        secret?: string;
    }): Promise<VIDEOROOM_EVENT_DESTROYED>;
    /**
     * Edit the ACL tokens for a room.
     *
     * @param {object} params
     * @param {number|string} params.room - The room where to change the acl
     * @param {"enable"|"disable"|"add"|"remove"} params.action - The action to execute on the acl
     * @param {string[]} params.list - The list of tokens to execute the action onto
     * @param {string} [params.secret] - The secret needed to manage the room
     * @returns {Promise<module:videoroom-plugin~VIDEOROOM_EVENT_ALLOWED>}
     */
    allow({ room, action, list, secret }: {
        room: number | string;
        action: "enable" | "disable" | "add" | "remove";
        list: string[];
        secret?: string;
    }): Promise<VIDEOROOM_EVENT_ALLOWED>;
    /**
     * Start a RTP forwarding in a room.
     *
     * @param {object} params
     * @param {number|string} params.room - The room where to start a forwarder
     * @param {number|string} params.feed - The feed identifier to forward (must be published)
     * @param {string} params.host - The target host for the forwarder
     * @param {number} [params.audio_port] - The target audio RTP port, if audio is to be forwarded
     * @param {number} [params.audio_rtcp_port] - The target audio RTCP port, if audio is to be forwarded
     * @param {number} [params.audio_ssrc] - The SSRC that will be used for audio RTP
     * @param {number} [params.video_port] - The target video RTP port, if video is to be forwarded
     * @param {number} [params.video_rtcp_port] - The target video RTCP port, if video is to be forwarded
     * @param {number} [params.video_ssrc] - The SSRC that will be used for video RTP
     * @param {number} [params.data_port] - The target datachannels port, if datachannels are to be forwarded
     * @param {string} [params.secret] - The secret needed for managing the room
     * @param {string} [params.admin_key] - The admin key needed for invoking the API
     * @returns {Promise<module:videoroom-plugin~VIDEOROOM_EVENT_RTP_FWD_STARTED>}
     */
    startForward({ room, feed, host, audio_port, audio_rtcp_port, audio_ssrc, video_port, video_rtcp_port, video_ssrc, data_port, secret, admin_key }: {
        room: number | string;
        feed: number | string;
        host: string;
        audio_port?: number;
        audio_rtcp_port?: number;
        audio_ssrc?: number;
        video_port?: number;
        video_rtcp_port?: number;
        video_ssrc?: number;
        data_port?: number;
        secret?: string;
        admin_key?: string;
    }): Promise<VIDEOROOM_EVENT_RTP_FWD_STARTED>;
    /**
     * Stop a RTP forwarder in a room.
     *
     * @param {object} params
     * @param {number|string} params.room - The room where to stop a forwarder
     * @param {number|string} params.feed - The feed identifier for the forwarder to stop (must be published)
     * @param {number|string} params.stream - The forwarder identifier as returned by the start forward API
     * @param {string} [params.secret] - The secret needed for managing the room
     * @returns {Promise<module:videoroom-plugin~VIDEOROOM_EVENT_RTP_FWD_STOPPED>}
     */
    stopForward({ room, feed, stream, secret }: {
        room: number | string;
        feed: number | string;
        stream: number | string;
        secret?: string;
    }): Promise<VIDEOROOM_EVENT_RTP_FWD_STOPPED>;
    /**
     * List the active forwarders in a room.
     *
     * @param {object} params
     * @param {number|string} params.room - The room where to list the forwarders
     * @param {string} [params.secret] - The secret needed for managing the room
     * @returns {Promise<module:videoroom-plugin~VIDEOROOM_EVENT_RTP_FWD_LIST>}
     */
    listForward({ room, secret }: {
        room: number | string;
        secret?: string;
    }): Promise<VIDEOROOM_EVENT_RTP_FWD_LIST>;
}
declare var _default: {
    id: string
    Handle: VideoRoomHandle
    EVENT: object
};
export default _default;
/**
 * The payload of the plugin message (cfr. Janus docs).
 * {@link https://janus.conf.meetecho.com/docs/videoroom.html}
 */
export type VideoRoomData = object;
/**
 * The response event when a publisher has joined.
 */
export type VIDEOROOM_EVENT_PUB_JOINED = {
    /**
     * - The involved room
     */
    room: number | string;
    /**
     * - The feed identifier
     */
    feed: number | string;
    /**
     * - The dsplay name, if available
     */
    display?: string;
    /**
     * - A description of the room, if available
     */
    description: string;
    /**
     * - The list of active publishers
     */
    publishers: {
        feed: number | string;
        display: string;
    };
    /**
     * - The JSEP answer
     */
    jsep?: RTCSessionDescription;
};
/**
 * The response event when a subscriber has joined.
 */
export type VIDEOROOM_EVENT_SUB_JOINED = {
    /**
     * - The involved room
     */
    room: number | string;
    /**
     * - The published feed identifier
     */
    feed: number | string;
    /**
     * - The published feed display name
     */
    display: string;
};
/**
 * The response event to a participant list request.
 */
export type VIDEOROOM_EVENT_PARTICIPANTS_LIST = {
    /**
     * - The involved room
     */
    room: number | string;
    /**
     * - The current published feed
     */
    feed: number | string;
    /**
     * - The list of current participants
     */
    participants: {
        feed: number | string;
        display?: string;
        publisher: boolean;
        talking?: boolean;
    };
};
/**
 * The response event for room create request.
 */
export type VIDEOROOM_EVENT_CREATED = {
    /**
     * - The created room
     */
    room: number | string;
    /**
     * - True if the room has been persisted on the Janus configuratin file
     */
    permanent: boolean;
};
/**
 * The response event for room destroy request.
 */
export type VIDEOROOM_EVENT_DESTROYED = {
    /**
     * - The destroyed room
     */
    room: number | string;
    /**
     * - True if the room has been removed from the Janus configuratin file
     */
    permanent: boolean;
};
/**
 * The response event for room exists request.
 */
export type VIDEOROOM_EVENT_EXISTS = {
    /**
     * - The queried room
     */
    room: number | string;
};
/**
 * Descriptrion of an active RTP forwarder.
 */
export type RtpForwarder = {
    /**
     * - The target host
     */
    host: string;
    /**
     * - The RTP audio target port
     */
    audio_port?: number;
    /**
     * - The RTCP audio target port
     */
    audio_rtcp_port?: number;
    /**
     * - The audio forwarder identifier
     */
    audio_stream?: number;
    /**
     * - The RTP video target port
     */
    video_port?: number;
    /**
     * - The RTCP video target port
     */
    video_rtcp_port?: number;
    /**
     * - The video forwarder identifier
     */
    video_stream?: number;
    /**
     * - The datachannels target port
     */
    data_port?: number;
    /**
     * - The datachannels forwarder identifier
     */
    data_stream?: number;
    /**
     * - SSRC this forwarder is using
     */
    ssrc?: number;
    /**
     * - payload type this forwarder is using
     */
    pt?: number;
    /**
     * - video substream this video forwarder is relaying
     */
    substream?: number;
    /**
     * - whether the RTP stream is encrypted
     */
    srtp?: boolean;
};
/**
 * The response event for RTP forward start request.
 */
export type VIDEOROOM_EVENT_RTP_FWD_STARTED = {
    /**
     * - The involved room
     */
    room: number | string;
    /**
     * - The forwarder object
     */
    forwarder: RtpForwarder;
};
/**
 * The response event for RTP forward stop request.
 */
export type VIDEOROOM_EVENT_RTP_FWD_STOPPED = {
    /**
     * - The involved room
     */
    room: number | string;
    /**
     * - The feed identifier being forwarded
     */
    feed: number | string;
    /**
     * - The forwarder identifier
     */
    stream: number;
};
/**
 * The response event for RTP forwarders list request.
 */
export type VIDEOROOM_EVENT_RTP_FWD_LIST = {
    /**
     * - The involved room
     */
    room: number | string;
    /**
     * - The list of forwarders
     */
    forwarders: {
        feed: number | string;
        forwarders: RtpForwarder[];
    };
};
/**
 * The response event for videoroom list request.
 */
export type VIDEOROOM_EVENT_LIST = {
    /**
     * - The list of the room as returned by Janus
     */
    list: object[];
};
/**
 * The response event for ACL tokens edit (allowed) request.
 */
export type VIDEOROOM_EVENT_ALLOWED = {
    /**
     * - The updated, complete, list of allowed tokens
     */
    list: string[];
};
/**
 * The response event for publisher/subscriber configure request.
 */
export type VIDEOROOM_EVENT_CONFIGURED = {
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
     * - True if the request had it true
     */
    restart?: boolean;
    /**
     * - True if the request had it true
     */
    update?: boolean;
    /**
     * - A string with the value returned by Janus
     */
    configured: string;
    /**
     * - The JSEP answer
     */
    jsep?: RTCSessionDescription;
};
/**
 * The response event for subscriber start request.
 */
export type VIDEOROOM_EVENT_STARTED = {
    /**
     * - The involved room
     */
    room: number | string;
    /**
     * - The feed that started
     */
    feed: number | string;
    /**
     * - A string with the value returned by Janus
     */
    started: string;
};
/**
 * The response event for subscriber pause request.
 */
export type VIDEOROOM_EVENT_PAUSED = {
    /**
     * - The involved room
     */
    room: number | string;
    /**
     * - The feed that has been paused
     */
    feed: number | string;
    /**
     * - A string with the value returned by Janus
     */
    paused: string;
};
/**
 * The response event for publisher unpublish request.
 */
export type VIDEOROOM_EVENT_UNPUBLISHED = {
    /**
     * - The involved room
     */
    room: number | string;
    /**
     * - The feed that unpublished
     */
    feed: number | string;
};
/**
 * The response event for publiher/subscriber leave request.
 */
export type VIDEOROOM_EVENT_LEAVING = {
    /**
     * - The involved room
     */
    room: number | string;
    /**
     * - The feed that left
     */
    feed: number | string;
    /**
     * - An optional string with the reason of the leaving
     */
    reason?: string;
};
/**
 * The response event for the kick request.
 */
export type VIDEOROOM_EVENT_KICKED = {
    /**
     * - The involved room
     */
    room: number | string;
    /**
     * - The feed that has been kicked
     */
    feed: number | string;
};
