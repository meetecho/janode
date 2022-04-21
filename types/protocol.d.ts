export namespace JANUS {
    namespace REQUEST {
        const SERVER_INFO: string;
        const CREATE_SESSION: string;
        const KEEPALIVE: string;
        const DESTROY_SESSION: string;
        const ATTACH_PLUGIN: string;
        const MESSAGE: string;
        const TRICKLE: string;
        const HANGUP: string;
        const DETACH_PLUGIN: string;
    }
    const ACK: string;
    namespace RESPONSE {
        export const SUCCESS: string;
        const SERVER_INFO_1: string;
        export { SERVER_INFO_1 as SERVER_INFO };
        export const ERROR: string;
    }
    namespace EVENT {
        const EVENT_1: string;
        export { EVENT_1 as EVENT };
        export const DETACHED: string;
        const HANGUP_1: string;
        export { HANGUP_1 as HANGUP };
        export const MEDIA: string;
        export const TIMEOUT: string;
        export const WEBRTCUP: string;
        export const SLOWLINK: string;
        export const TRICKLE: string;
    }
    namespace ADMIN {
        const LIST_SESSIONS: string;
        const LIST_HANDLES: string;
        const HANDLE_INFO: string;
        const START_PCAP: string;
        const STOP_PCAP: string;
    }
}
export namespace JANODE {
    export namespace EVENT_2 {
        const CONNECTION_CLOSED: string;
        const SESSION_DESTROYED: string;
        const HANDLE_DETACHED: string;
        const HANDLE_HANGUP: string;
        const HANDLE_MEDIA: string;
        const HANDLE_TRICKLE: string;
        const HANDLE_WEBRTCUP: string;
        const HANDLE_SLOWLINK: string;
        const CONNECTION_ERROR: string;
    }
    export { EVENT_2 as EVENT };
}
export function isResponseData(data: object): boolean;
export function isEventData(data: object): boolean;
export function isErrorData(data: object): boolean;
export function isTimeoutData(data: object): boolean;
export function isAckData(data: object): boolean;
