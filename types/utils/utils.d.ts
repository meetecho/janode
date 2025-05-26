export function randomString(len?: number): string;
export function getNumericID(_: any): string;
export function newIterator(list: any[]): CircularIterator;
export function delayOp(ms: number): Promise<void>;
export function checkUrl(url_string: string, admitted: Array<string>): boolean;
export function getCliArgument(arg_name: string, arg_type: ("string" | "number" | "boolean"), arg_default: string | number | boolean): string | number | boolean | void;
export type CircularIterator = {
    /**
     * - Advance the iterator and get the new element
     */
    nextElem: Function;
    /**
     * - Get the current element without advancing
     */
    currElem: Function;
};
