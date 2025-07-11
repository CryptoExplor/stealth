// js/stealth.js
import { ethers } from 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.umd.min.js'; // Import ethers

/**
 * Utility for random number generation.
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
     * @returns {number} A log-normally distributed delay in milliseconds.
     */
    generateLogNormalDelay: (min, max) => {
        const mu = Math.log(min);
        const sigma = (Math.log(max) - Math.log(min)) / 4; // Adjust sigma for desired spread
        let u1 = Math.random();
        let u2 = Math.random();
        // Box-Muller transform to get a standard normal deviate
        let z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        // Scale and shift to log-normal distribution
        return Math.exp(mu + sigma * z0);
    }
};

/**
 * Chooses an action based on provided probabilities.
 * @param {object} walletSessionProbs - Probabilities for 'send', 'idle', and 'balance-check'.
 * @returns {string} The chosen action ('send', 'idle-action', or 'balance-check').
 */
export const chooseAction = (walletSessionProbs) => {
    const rand = Math.random() * 100;
    let cumulativeProb = 0;

    if (rand < (cumulativeProb += walletSessionProbs.send)) return 'send';
    if (rand < (cumulativeProb += walletSessionProbs.idle)) return 'idle-action';
    if (rand < (cumulativeProb += walletSessionProbs['balance-check'])) return 'balance-check';
    return 'idle-action'; // Fallback
};

/**
 * Sends a transaction with retry logic.
 * @param {ethers.Wallet} wallet - The ethers.js wallet instance.
 * @param {object} txParams - The transaction parameters.
 * @param {number} maxRetries - Maximum number of retries.
 * @param {number} chainId - The chain ID of the current network.
 * @param {number} gasFactorUsed - The gas factor applied to the transaction.
 * @param {object} appState - The global application state object.
 * @param {function} log - Logging function from ui.js.
 * @param {function} updateActionDistChart - Function to update action distribution chart from ui.js.
 * @returns {Promise<{success: boolean, receipt: object|null}>} Result of the transaction.
 */
export async function sendWithRetryOrSkip(wallet, txParams, maxRetries, chainId, gasFactorUsed, appState, log, updateActionDistChart) {
    for (let attempt = 1; attempt <= 1 + maxRetries; attempt++) {
        try {
            // Simulated error chance
            if (Math.random() * 100 < appState.config.simulatedErrorChance) {
                throw new Error("Simulated network error: Transaction dropped/failed.");
            }

            log(`Attempting to send (Attempt ${attempt}/${1 + maxRetries})...`, 'info', {}, appState); // Pass appState to log
            const txResponse = await wallet.sendTransaction(txParams);
            log(`Tx sent! Hash: <a href="https://etherscan.io/tx/${txResponse.hash}" target="_blank" class="underline">${txResponse.hash}</a><button class="log-copy-btn" data-tx-hash="${txResponse.hash}">📋</button>`, 'success', { chainId, walletAddress: wallet.address, action: 'send', gasFactorUsed: gasFactorUsed.toFixed(2) }, appState); // Pass appState to log

            const receipt = await txResponse.wait();
            log(`✅ Tx confirmed on attempt ${attempt}!`, 'success', {}, appState); // Pass appState to log
            return { success: true, receipt: receipt };
        } catch (err) {
            console.warn(`❌ Tx failed on attempt ${attempt}:`, err);
            log(`❌ Tx failed on attempt ${attempt}: ${err.message}`, 'error', { chainId, walletAddress: wallet.address, action: 'send' }, appState); // Pass appState to log

            if (attempt <= maxRetries) {
                const delay = Stealth.generateLogNormalDelay(3000, 8000); // Use a specific, shorter delay for retries
                log(`Retrying after ${Math.round(delay / 1000)}s…`, 'warning', {}, appState); // Pass appState to log
                await sleep(delay);
            }
        }
    }
    log("⚠️ Tx skipped after max retries.", 'log-skipped', { chainId, walletAddress: wallet.address, action: 'skipped' }, appState); // Pass appState to log
    updateActionDistChart('skipped', appState); // Pass appState to updateActionDistChart
    return { success: false, receipt: null };
}

/**
 * Performs a harmless "dummy" read call to simulate human-like interaction.
 * @param {ethers.JsonRpcProvider} provider - The ethers.js provider instance.
 * @param {object} appState - The global application state object.
 * @param {function} log - Logging function from ui.js.
 */
export async function maybeDummyCall(provider, appState, log) {
    if (Math.random() < 0.1) { // 10% chance
        log("Doing dummy blockNumber check…", 'info', {}, appState); // Pass appState to log
        try {
            await provider.getBlockNumber();
            log("Dummy blockNumber check successful.", 'info', {}, appState); // Pass appState to log
        } catch (e) {
            log(`Dummy blockNumber check failed: ${e.message}`, 'warning', {}, appState); // Pass appState to log
        }
    }
    if (Math.random() < 0.1) { // 10% chance for gas price check
        log("Doing dummy gas price check…", 'info', {}, appState); // Pass appState to log
        try {
            await provider.getGasPrice();
            log("Dummy gas price check successful.", 'info', {}, appState); // Pass appState to log
        } catch (e) {
            log(`Dummy gas price check failed: ${e.message}`, 'warning', {}, appState); // Pass appState to log
        }
    }
    if (Math.random() < 0.05 && appState.wallets.length > 0) { // 5% chance to check a random wallet balance
        const randomWallet = appState.wallets[Math.floor(Math.random() * appState.wallets.length)];
        log(`Doing dummy balance check for ...${randomWallet.address.slice(-6)}...`, 'info', {}, appState); // Pass appState to log
        try {
            const bal = await provider.getBalance(randomWallet.address);
            log(`Dummy balance check successful: ${ethers.formatEther(bal).slice(0,8)} ETH`, 'info', {}, appState); // Pass appState to log
        } catch (e) {
            log(`Dummy balance check failed: ${e.message}`, 'warning', {}, appState); // Pass appState to log
        }
    }
}

/**
 * Simple sleep function.
 * @param {number} ms - Milliseconds to sleep.
 * @returns {Promise<void>}
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
