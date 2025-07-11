// js/config.js
import { log } from './ui.js'; // Import the log function

// Utility for setting UI element values
const setConfigValue = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = value;
    else if (el.tagName === "TEXTAREA") el.value = value.join('\n');
    else el.value = value;
};

// Default stealth configuration values
export const stealthDefaults = {
    "max-txns-per-wallet": 5,
    "wallet-idle-chance": 30,
    "block-lookback": 200,
    "simulated-error-chance": 3,
    "enable-time-of-day-bias": true,
    "prob-send": 60,
    "prob-idle-action": 20,
    "prob-balance-check": 20,
    "min-amount": 0.0000001,
    "max-amount": 0.0002,
    "min-delay": 10,
    "max-delay": 30,
    "min-gas-factor": 0.9,
    "max-gas-factor": 1.5,
    "gas-multiplier": 2,
    "max-retries": 2,
    "prob-jitter-factor": 5,
    "think-time-chance": 10,
    "min-think-time": 60,
    "max-think-time": 120,
    "activity-burst-chance": 50,
    "min-burst-actions": 2,
    "max-burst-actions": 5,
    "min-lull-time": 300,
    "max-lull-time": 900,
    "rpc-switch-delay": 5,
    "wallet-switch-delay": 5,
    "rpc-urls": [
        "https://mainnet.infura.io/v3/YOUR_PROJECT_ID,1",
        "https://rpc.goerli.dev,5"
    ]
};

// Predefined stealth profiles
export const stealthProfiles = {
    balanced: {
        "max-txns-per-wallet": 5,
        "wallet-idle-chance": 30,
        "block-lookback": 300,
        "simulated-error-chance": 2,
        "enable-time-of-day-bias": true,
        "prob-send": 60,
        "prob-idle-action": 20,
        "prob-balance-check": 20,
        "min-amount": 0.0001,
        "max-amount": 0.0002,
        "min-delay": 10,
        "max-delay": 30,
        "min-gas-factor": 0.9,
        "max-gas-factor": 1.1,
        "gas-multiplier": 2,
        "max-retries": 2,
        "prob-jitter-factor": 5,
        "think-time-chance": 10,
        "min-think-time": 60,
        "max-think-time": 120,
        "activity-burst-chance": 50,
        "min-burst-actions": 2,
        "max-burst-actions": 5,
        "min-lull-time": 300,
        "max-lull-time": 900,
        "rpc-switch-delay": 5,
        "wallet-switch-delay": 5,
        "rpc-urls": [
            "https://mainnet.infura.io/v3/YOUR_PROJECT_ID,1",
            "https://rpc.goerli.dev,5"
        ]
    },
    aggressive: {
        "max-txns-per-wallet": 8,
        "wallet-idle-chance": 10,
        "block-lookback": 100,
        "simulated-error-chance": 1,
        "enable-time-of-day-bias": false,
        "prob-send": 80,
        "prob-idle-action": 10,
        "prob-balance-check": 10,
        "min-amount": 0.0002,
        "max-amount": 0.0004,
        "min-delay": 5,
        "max-delay": 15,
        "min-gas-factor": 1.0,
        "max-gas-factor": 1.3,
        "gas-multiplier": 3,
        "max-retries": 1,
        "prob-jitter-factor": 2,
        "think-time-chance": 2,
        "min-think-time": 10,
        "max-think-time": 20,
        "activity-burst-chance": 80,
        "min-burst-actions": 3,
        "max-burst-actions": 8,
        "min-lull-time": 60,
        "max-lull-time": 180,
        "rpc-switch-delay": 2,
        "wallet-switch-delay": 2,
        "rpc-urls": [
            "https://rpc.ankr.com/eth,1",
            "https://rpc.ankr.com/eth_goerli,5"
        ]
    },
    ultraSlow: {
        "max-txns-per-wallet": 2,
        "wallet-idle-chance": 50,
        "block-lookback": 500,
        "simulated-error-chance": 5,
        "enable-time-of-day-bias": true,
        "prob-send": 40,
        "prob-idle-action": 40,
        "prob-balance-check": 20,
        "min-amount": 0.00005,
        "max-amount": 0.0001,
        "min-delay": 20,
        "max-delay": 90,
        "min-gas-factor": 0.8,
        "max-gas-factor": 1.0,
        "gas-multiplier": 1.5,
        "max-retries": 3,
        "prob-jitter-factor": 8,
        "think-time-chance": 25,
        "min-think-time": 90,
        "max-think-time": 180,
        "activity-burst-chance": 20,
        "min-burst-actions": 1,
        "max-burst-actions": 3,
        "min-lull-time": 900,
        "max-lull-time": 1800,
        "rpc-switch-delay": 8,
        "wallet-switch-delay": 8,
        "rpc-urls": [
            "https://rpc.ankr.com/eth_sepolia,11155111"
        ]
    }
};

/**
 * Injects default configuration values into the UI elements.
 */
export const injectStealthDefaults = () => {
    Object.entries(stealthDefaults).forEach(([id, value]) => {
        setConfigValue(id, value);
    });
};

/**
 * Applies a selected stealth profile to the UI configuration.
 * @param {string} profileName - The name of the profile to apply.
 * @param {object} appState - The global application state object.
 * @param {object} ui - UI element references.
 * @param {function} loadConfiguration - Function to load configuration from ui.js.
 */
export const applyProfile = (profileName, appState, ui, loadConfiguration) => {
    const profile = stealthProfiles[profileName];
    if (!profile) {
        log(`Error: Stealth profile '${profileName}' not found.`, 'error', {}, appState); // Pass appState to log
        return;
    }
    Object.entries(profile).forEach(([id, value]) => {
        setConfigValue(id, value);
    });
    loadConfiguration(appState, ui, log); // Pass appState, ui, and log to loadConfiguration
    log(`Applied '${profileName}' stealth profile. Configuration updated.`, 'success', {}, appState); // Pass appState to log
};

/**
 * Loads configuration from UI elements into the appState.config object.
 * Performs validation checks for various configuration parameters.
 * @param {object} appState - The global application state object.
 * @param {object} ui - UI element references.
 * @param {function} log - Logging function from ui.js.
 * @returns {boolean} True if configuration is valid, false otherwise.
 */
export const loadConfiguration = (appState, ui, log) => {
    const probInputs = document.querySelectorAll('.prob-input');
    let totalProb = 0;
    probInputs.forEach(input => totalProb += parseInt(input.value) || 0);

    if (totalProb !== 100) {
        ui.probSumWarning.classList.remove('hidden');
        log('Error: Probabilities must sum to 100%!', 'error', {}, appState); // Pass appState to log
        return false;
    } else {
        ui.probSumWarning.classList.add('hidden');
    }

    const minAmount = parseFloat(ui.minAmount.value);
    const maxAmount = parseFloat(ui.maxAmount.value);
    if (minAmount > maxAmount) {
        log('Error: Minimum amount cannot be greater than maximum amount.', 'error', {}, appState); // Pass appState to log
        return false;
    }

    const minDelay = parseInt(ui.minDelay.value);
    const maxDelay = parseInt(ui.maxDelay.value);
    if (minDelay > maxDelay) {
        log('Error: Minimum delay cannot be greater than maximum delay.', 'error', {}, appState); // Pass appState to log
        return false;
    }

    const minGasFactor = parseFloat(ui.minGasFactor.value);
    const maxGasFactor = parseFloat(ui.maxGasFactor.value);
    if (minGasFactor > maxGasFactor || minGasFactor <= 0) {
        log('Error: Minimum gas factor must be greater than 0 and less than or equal to maximum gas factor.', 'error', {}, appState); // Pass appState to log
        return false;
    }

    const minThinkTime = parseInt(ui.minThinkTime.value);
    const maxThinkTime = parseInt(ui.maxThinkTime.value);
    if (minThinkTime > maxThinkTime) {
        log('Error: Minimum Think Time cannot be greater than maximum Think Time.', 'error', {}, appState); // Pass appState to log
        return false;
    }

    const minBurstActions = parseInt(ui.minBurstActions.value);
    const maxBurstActions = parseInt(ui.maxBurstActions.value);
    if (minBurstActions > maxBurstActions) {
        log('Error: Minimum Burst Actions cannot be greater than maximum Burst Actions.', 'error', {}, appState); // Pass appState to log
        return false;
    }
    const minLullTime = parseInt(ui.minLullTime.value);
    const maxLullTime = parseInt(ui.maxLullTime.value);
    if (minLullTime > maxLullTime) {
        log('Error: Minimum Lull Time cannot be greater than maximum Lull Time.', 'error', {}, appState); // Pass appState to log
        return false;
    }

    appState.config = {
        maxTxnsPerWallet: parseInt(ui.maxTxnsPerWallet.value) || 3,
        walletIdleChance: parseInt(ui.walletIdleChance.value) || 25,
        minAmount: minAmount || 0.0001,
        maxAmount: maxAmount || 0.0002,
        minDelay: minDelay * 1000 || 10000,
        maxDelay: maxDelay * 1000 || 30000,
        gasMultiplier: parseFloat(ui.gasMultiplier.value) || 2,
        minGasFactor: minGasFactor || 0.9,
        maxGasFactor: maxGasFactor || 1.1,
        blockLookback: parseInt(ui.blockLookback.value) || 100,
        probJitterFactor: parseInt(ui.probJitterFactor.value) || 5,
        simulatedErrorChance: parseInt(ui.simulatedErrorChance.value) || 0,
        thinkTimeChance: parseInt(ui.thinkTimeChance.value) || 10,
        minThinkTime: parseInt(ui.minThinkTime.value) * 1000 || 60000,
        maxThinkTime: parseInt(ui.maxThinkTime.value) * 1000 || 120000,
        activityBurstChance: parseInt(ui.activityBurstChance.value) || 50,
        minBurstActions: parseInt(ui.minBurstActions.value) || 2,
        maxBurstActions: parseInt(ui.maxBurstActions.value) || 5,
        minLullTime: parseInt(ui.minLullTime.value) * 1000 || 300000,
        maxLullTime: parseInt(ui.maxLullTime.value) * 1000 || 900000,
        enableTimeOfDayBias: ui.enableTimeOfDayBias.checked,
        rpcSwitchDelay: parseInt(ui.rpcSwitchDelay.value) * 1000 || 5000,
        walletSwitchDelay: parseInt(ui.walletSwitchDelay.value) * 1000 || 5000,
        recipientMode: Array.from(ui.recipientMode).find(r => r.checked).value,
        fixedAddress: ui.fixedAddress.value.trim(),
        probabilities: {
            send: parseInt(ui.probSend.value) || 60,
            idle: parseInt(ui.probIdleAction.value) || 20,
            'balance-check': parseInt(ui.probBalanceCheck.value) || 20,
        }
    };

    appState.rpcConfigs = ui.rpcUrls.value.split('\n').map(line => {
        const [url, chainIdStr] = line.split(',').map(s => s.trim());
        const chainId = parseInt(chainIdStr);
        if (!url || isNaN(chainId)) {
            log(`Warning: Invalid RPC entry ignored: "${line}". Format should be "URL,ChainID".`, 'warning', {}, appState); // Pass appState to log
            return null;
        }
        return { url, chainId: chainId };
    }).filter(Boolean);

    return true;
};
