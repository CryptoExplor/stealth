// stealth.js

/**
 * Utility for random number generation and log-normal delay calculation.
 */
export const Stealth = {
    /**
     * Generates a random number within a specified range (min inclusive, max exclusive).
     * @param {number} min - The minimum value.
     * @param {number} max - The maximum value.
     * @returns {number} A random number within the range.
     */
    getRandomInRange: (min, max) => Math.random() * (max - min) + min,

    /**
     * Generates a random delay using a log-normal distribution.
     * @param {number} min - Minimum delay in milliseconds.
     * @param {number} max - Maximum delay in milliseconds.
     * @param {number} [delayFactor=1] - A factor to adjust the delay based on persona.
     * @returns {number} The calculated log-normal delay in milliseconds.
     */
    generateLogNormalDelay: (min, max, delayFactor = 1) => {
        const mu = Math.log(min);
        const sigma = (Math.log(max) - Math.log(min)) / 4; // Adjust sigma for desired spread
        let u1 = Math.random();
        let u2 = Math.random();
        // Box-Muller transform to get a standard normal deviate
        let z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        // Scale and shift to log-normal distribution, then apply persona delayFactor
        return Math.exp(mu + sigma * z0) * delayFactor;
    }
};
