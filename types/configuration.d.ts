import { ServerObjectConf } from './janode.js'
export default Configuration;
/**
 * Class representing a Janode configuration.
 * The purpose of the class is basically filtering the input config and distinguish Janus API and Admin API connections.
 */
type AddressConfig = {
    url: string
    apisecret?: string
}
declare class Configuration {
    /**
     * Create a configuration.
     *
     * @private
     * @param {module:janode~RawConfiguration} config
     */
    private constructor();
    address: AddressConfig[];
    retry_time_secs: number;
    max_retries: number;
    is_admin: boolean;
    /**
     * Get the server list of this configuration.
     *
     * @returns {module:janode~ServerObjectConf[]} The address array
     */
    getAddress(): ServerObjectConf;
    /**
     * Get the number of seconds between any attempt.
     *
     * @returns {number} The value of the property
     */
    getRetryTimeSeconds(): number;
    /**
     * Get the max number of retries.
     *
     * @returns {number} The value of the property
     */
    getMaxRetries(): number;
    /**
     * Check if the configuration is for an admin connection.
     *
     * @returns {boolean} True if the configuration will be used for an admin connection
     */
    isAdmin(): boolean;
}
