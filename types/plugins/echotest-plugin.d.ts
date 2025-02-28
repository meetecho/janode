import {PluginDescriptor} from "../janode.js"
import Handle from "../handle.js"

/**
 * The payload of the plugin message (cfr. Janus docs).
 * {@link https://janus.conf.meetecho.com/docs/echotest.html}
 */
export type EchoTestData = object
export type ECHOTEST_EVENT_RESULT = {
    /**
     * - The result status (ok, done ...)
     */
    result: string
    /**
     * - The answer from Janus
     */
    jsep?: RTCSessionDescription
}
/**
 * The class implementing the EchoTest plugin (ref. {@link https://janus.conf.meetecho.com/docs/echotest.html}).<br>
 *
 * It extends the base Janode Handle class and overrides the base "handleMessage" method.<br>
 *
 * Moreover it defines some methods to support EchoTest operations.<br>
 *
 * @hideconstructor
 */
export class EchoTestHandle extends Handle {
    /**
     * The custom "handleMessage" needed for handling EchoTest messages.
     *
     * @private
     * @param {object} janus_message
     * @returns {object} A falsy value for unhandled events, a truthy value for handled events
     */
    //private handleMessage
    /**
     * Start/update an echotest session.
     *
     * @param {object} params
     * @param {boolean} [audio] - True to request audio in this session
     * @param {boolean} [video] - True to request video in this session
     * @param {RTCSessionDescription} [jsep=null] - The JSEP offer
     * @param {number} [bitrate=0] - The bitrate to force in the session
     * @param {boolean} [record=false] - True to record the session
     * @param {string} [filename=null]  - The filename of the recording
     * @returns {Promise<module:echotest-plugin~ECHOTEST_EVENT_RESULT>}
     */
    start({ audio, video, jsep, bitrate, record, filename }: {
        audio: boolean
        video: boolean
        jsep: RTCSessionDescription
        bitrate: number
        record: boolean
        filename:string
    }): Promise<ECHOTEST_EVENT_RESULT>
}
declare var _default: PluginDescriptor
export default _default
