/**
 * The class implementing the Streaming plugin (ref. {@link https://janus.conf.meetecho.com/docs/streaming.html}).<br>
 *
 * It extends the base Janode Handle class and overrides the "handleMessage" method.<br>
 *
 * Moreover it defines many methods to support Streaming operations.<br>
 *
 * @hideconstructor
 */
export class StreamingHandle extends Handle {
    /**
     * The mountpoint this handle has subscribed to.
     *
     * @type {number|string}
     */
    mp: number | string;
    /**
     * The custom "handleMessage" needed for handling Streamiing messages.
     *
     * @private
     * @param {object} janus_message
     * @returns {object} A falsy value for unhandled events, a truthy value for handled events
     */
    // private handleMessage;
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
    watch({ id, pin, audio, video, data, restart }: {
        id: number | string;
        pin?: string;
        audio?: boolean;
        video?: boolean;
        data?: boolean;
        restart?: boolean;
    }): Promise<STREAMING_EVENT_STATUS>;
    /**
     * Start a mountpoint stream.
     *
     * @param {object} params
     * @property {RTCSessionDescription} params.jsep
     * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_STATUS>}
     */
    start({ jsep }: {
        jsep: RTCSessionDescription
    }): Promise<STREAMING_EVENT_STATUS>;
    /**
     * Pause the current stream.
     *
     * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_STATUS>}
     */
    pause(): Promise<STREAMING_EVENT_STATUS>;
    /**
     * Stop the current stream.
     *
     * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_STATUS>}
     */
    stop(): Promise<STREAMING_EVENT_STATUS>;
    /**
     * Switch to another mountpoint.
     *
     * @param {object} params
     * @param {number|string} params.id - The mp id to switch to
     * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_SWITCHED>}
     */
    switch({ id }: {
        id: number | string;
    }): Promise<STREAMING_EVENT_SWITCHED>;
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
    configure({ audio, video, data, substream, temporal, fallback, spatial_layer, temporal_layer }: {
        audio?: boolean;
        video?: boolean;
        data?: boolean;
        substream?: number;
        temporal?: number;
        fallback?: number;
        spatial_layer?: number;
        temporal_layer?: number;
    }): Promise<STREAMING_EVENT_CONFIGURED>;
    /**
     * List all the available mountpoints.
     *
     * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_LIST>}
     */
    list(): Promise<STREAMING_EVENT_LIST>;
    /**
     * Get mountpoint info.
     *
     * @param {object} params
     * @param {number|string} params.id
     * @param {string} [params.secret]
     * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_INFO>}
     */
    info({ id, secret }: {
        id: number | string;
        secret?: string;
    }): Promise<STREAMING_EVENT_INFO>;
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
    startRecording({ id, audio, video, data, secret }: {
        id: number | string;
        audio?: string;
        video?: string;
        data?: string;
        secret?: string;
    }): Promise<STREAMING_EVENT_OK>;
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
    stopRecording({ id, audio, video, data, secret }: {
        id: number | string;
        audio?: boolean;
        video?: boolean;
        data?: boolean;
        secret?: string;
    }): Promise<STREAMING_EVENT_OK>;
    /**
     * Enable a mountpoint.
     *
     * @param {object} params
     * @param {number|string} params.id
     * @param {string} [params.secret]
     * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_OK>}
     */
    enable({ id, secret }: {
        id: number | string;
        secret?: string;
    }): Promise<STREAMING_EVENT_OK>;
    /**
     * Disable a mountpoint.
     *
     * @param {object} params
     * @param {number|string} params.id
     * @param {boolean} [stop_recording=true] - True if the user wants to also stop the recording of a disabled moutnpoint
     * @param {string} [params.secret]
     * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_OK>}
     */
    disable({ id, stop_recording, secret }: {
        id: number | string;
        stop_recording?:boolean
        secret ?: string
    }): Promise<STREAMING_EVENT_OK>;
    /**
     * Create a RTP live mountpoint.
     *
     * @param {object} params
     * @param {number|string} [params.id=0] - The id for the new mountpoint (if omitted Janus will pick one)
     * @param {string} [params.description] - A description for the mp
     * @param {string} [params.secret] - The secret that'll be needed to edit this mountpoint
     * @param {string} [params.pin] - The pin that'll be needed to connect to the new mountpoint
     * @param {boolean} [params.permanent=false] - True if Janus must persist the mp on a config file
     * @param {boolean} [params.is_private=false] - Flag the mp as private
     * @param {object} [params.audio] - The audio descriptor for the mp
     * @param {number} [params.audio.port] - Port used for audio RTP
     * @param {number} [params.audio.rtcpport] - Port used for audio RTCP
     * @param {string} [params.audio.mcast] - Multicast address to listen to
     * @param {number} [params.audio.pt] - Payload type that will be used
     * @param {string} [params.audio.rtpmap] - rtpmap type that will be used
     * @param {boolean} [params.audio.skew] - Set skew compensation
     * @param {object} [params.video] - The video descriptor for the mp
     * @param {number} [params.video.port] - Port used for video RTP
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
     * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_CREATED>}
     */
    createRtpMountpoint({ id, name, description, secret, pin, permanent, is_private, audio, video, data, threads, metadata }: {
        id?: number | string;
        name?: string
        description?: string;
        secret?: string;
        pin?: string;
        permanent?: boolean;
        is_private?: boolean;
        audio?: {
            port?: number;
            rtcpport?: number;
            mcast?: string;
            pt?: number;
            rtpmap?: string;
            skew?: boolean;
        };
        video?: {
            port?: number;
            rtcpport?: number;
            mcast?: string;
            pt?: number;
            rtpmap?: string;
            skew?: boolean;
            fmtp?: string;
            buffer?: boolean;
        };
        data?: {
            port?: number;
            buffer?: boolean;
        };
        threads?: number;
        metadata?: object;
    }): Promise<STREAMING_EVENT_CREATED>;
    /**
     * Destroy a mountpoint.
     *
     * @param {object} params
     * @param {number|string} params.id
     * @param {string} [params.secret]
     * @returns {Promise<module:streaming-plugin~STREAMING_EVENT_DESTROYED>}
     */
    destroyMountpoint({ id, secret }: {
        id: number | string;
        secret?: string;
    }): Promise<STREAMING_EVENT_DESTROYED>;
}
declare var _default: {
    id: string,
    Handle: StreamingHandle
    EVENT: object
};
export default _default;
/**
 * The payload of the plugin message (cfr. Janus docs).
 * {@link https://janus.conf.meetecho.com/docs/streaming.html}
 */
export type StreamingData = object;
/**
 * Success response for streaming requests.
 */
export type STREAMING_EVENT_OK = object;
/**
 * Response event for mountpoint info request.
 */
export type STREAMING_EVENT_INFO = object;
/**
 * Response event for mountpoint list request.
 */
export type STREAMING_EVENT_LIST = {
    /**
     * - The list of mountpoints as returned by Janus
     */
    list: object[];
};
/**
 * Response event for mountpoint create request.
 */
export type STREAMING_EVENT_CREATED = {
    /**
     * - The name of the mountpoint
     */
    name: string;
    /**
     * - The identifier for the mountpoint
     */
    id: number | string;
    /**
     * - An optional description
     */
    description: string;
    /**
     * - The port for RTP audio
     */
    audio_port?: number;
    /**
     * - The port RTCP audio
     */
    audio_rtcp_port?: number;
    /**
     * - The port for RTP video
     */
    video_port?: number;
    /**
     * - The port for RTCP video
     */
    video_rtcp_port?: number;
    /**
     * - The port for datachannels
     */
    data_port?: number;
};
/**
 * Response event for mountpoint destroy request.
 */
export type STREAMING_EVENT_DESTROYED = {
    /**
     * - The identifier of the dstroyed mountpoint
     */
    id: number | string;
};
/**
 * A streaming status update event.
 */
export type STREAMING_EVENT_STATUS = {
    /**
     * - The current status of the stream
     */
    status: string;
    /**
     * - The involved mountpoint identifier
     */
    id?: number | string;
    /**
     * - True if the request had it true
     */
    restart?: boolean;
    /**
     * - Optional JSEP offer from Janus
     */
    jsep?: RTCSessionDescription;
};
/**
 * Response event for mountpoint switch request.
 */
export type STREAMING_EVENT_SWITCHED = {
    /**
     * - The string as returned by Janus
     */
    switched: string;
    /**
     * - The identifier of the mp that has been switched to
     */
    id: number | string;
};
/**
 * Response event for configure stream request
 */
export type STREAMING_EVENT_CONFIGURED = object;
import Handle from "../handle.js";
