export default Logger;
declare namespace Logger {
    function debug(...args: any[]): void;
    function verbose(...args: any[]): void;
    function info(...args: any[]): void;
    function warn(...args: any[]): void;
    function error(...args: any[]): void;
    function setLevel(lvl?: "none" | "error" | "warn" | "info" | "verb" | "debug"): string;
}
