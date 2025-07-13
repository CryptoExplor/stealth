// wallet.js

import { ethers } from 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.umd.min.js';
import { log } from './utils.js';
import { Stealth } from './stealth.js';
import { WalletPersonaManager } from './walletPersonaManager.js';
import { updateWalletBalanceChart, updateActionDistChart } from './charts.js';

/**
 * Connects to the user's MetaMask or compatible wallet.
 * @param {object} appState - The global application state.
 * @param {object} ui - The UI elements object.
 */
export const connectWallet = async (appState, ui) => {
    if (typeof window.ethereum === 'undefined') {
        log('MetaMask or compatible wallet not detected. Please install one.', 'error', {}, ui, appState.logEntries);
        ui.walletStatusDisplay.innerHTML = `No wallet detected. Please install <a href="https://metamask.io/" target="_blank" class="underline text-blue-500">MetaMask</a> or a compatible browser extension.`;
        ui.setUIEnabled(false); // Use the passed setUIEnabled
        return;
    }

    log('window.ethereum detected. Requesting accounts...', 'info', {}, ui, appState.logEntries);
    ui.walletStatusDisplay.innerHTML = 'Connecting... (Check your wallet extension for a pop-up)';
    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

        if (accounts.length === 0) {
            log('No accounts found. Please connect your wallet and select an account.', 'error', {}, ui, appState.logEntries);
            appState.connectedAddress = null;
            ui.walletStatusDisplay.innerHTML = `No wallet connected.`;
            ui.setUIEnabled(false);
            return;
        }
        appState.connectedAddress = accounts[0];
        log(`Wallet connected: ${appState.connectedAddress}`, 'success', {}, ui, appState.logEntries);
        ui.walletStatusDisplay.innerHTML = `Connected: <strong>${appState.connectedAddress.slice(0, 6)}...${appState.connectedAddress.slice(-4)}</strong>`;
        ui.setUIEnabled(true);

        window.ethereum.on('accountsChanged', (newAccounts) => {
            log('Wallet accounts changed event detected.', 'info', {}, ui, appState.logEntries);
            if (newAccounts.length === 0) {
                log('Wallet disconnected or no accounts selected.', 'warning', {}, ui, appState.logEntries);
                appState.connectedAddress = null;
                ui.walletStatusDisplay.innerHTML = `No wallet connected.`;
                ui.setUIEnabled(false);
            } else if (appState.connectedAddress && newAccounts[0].toLowerCase() !== appState.connectedAddress.toLowerCase()) {
                log(`Account changed to: ${newAccounts[0]}`, 'info', {}, ui, appState.logEntries);
                appState.connectedAddress = newAccounts[0];
                ui.walletStatusDisplay.innerHTML = `Connected: <strong>${appState.connectedAddress.slice(0, 6)}...${appState.connectedAddress.slice(-4)}</strong>`;
                ui.setUIEnabled(true);
            } else if (!appState.connectedAddress) {
                log(`Wallet reconnected with account: ${newAccounts[0]}`, 'info', {}, ui, appState.logEntries);
                appState.connectedAddress = newAccounts[0];
                ui.walletStatusDisplay.innerHTML = `Connected: <strong>${appState.connectedAddress.slice(0, 6)}...${appState.connectedAddress.slice(-4)}</strong>`;
                ui.setUIEnabled(true);
            }
        });

        window.ethereum.on('chainChanged', (chainId) => {
            log(`Network changed to Chain ID: ${parseInt(chainId, 16)}. Please ensure your RPC configurations match this network.`, 'warning', {}, ui, appState.logEntries);
        });

        window.ethereum.on('disconnect', (error) => {
            log(`Wallet disconnected: ${error.message || 'Unknown error'}`, 'error', {}, ui, appState.logEntries);
            appState.connectedAddress = null;
            ui.walletStatusDisplay.innerHTML = `No wallet connected.`;
            ui.setUIEnabled(false);
        });

    } catch (error) {
        log(`Wallet connection failed: ${error.message}`, 'error', {}, ui, appState.logEntries);
        appState.connectedAddress = null;
        ui.walletStatusDisplay.innerHTML = `Connection failed.`;
        ui.setUIEnabled(false);
    }
};

/**
 * Loads private keys from the UI, initializes wallet objects, and checks their balances.
 * @param {object} appState - The global application state.
 * @param {object} ui - The UI elements object.
 */
export const loadWallets = async (appState, ui) => {
    const keys = ui.privateKeys.value.split('\n').map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) {
        log('No private keys provided. Please paste private keys into the text area.', 'error', {}, ui, appState.logEntries);
        return;
    }
    if (appState.rpcConfigs.size === 0) {
        log('Please provide at least one RPC URL and Chain ID in Configuration.', 'error', {}, ui, appState.logEntries);
        return;
    }

    log(`Attempting to load ${keys.length} wallets and check balances...`, 'info', {}, ui, appState.logEntries);
    appState.wallets = [];
    ui.keysLoadedCount.textContent = `Loading 0 / ${keys.length}...`;

    const firstChainId = appState.rpcConfigs.keys().next().value;
    if (!firstChainId) {
        log('No valid RPC configurations found to load wallets.', 'error', {}, ui, appState.logEntries);
        return;
    }
    const firstRpcUrl = appState.rpcConfigs.get(firstChainId)[0].url;
    const defaultProvider = new ethers.JsonRpcProvider(firstRpcUrl);

    const baseProbs = appState.config.probabilities;
    const jitterFactor = appState.config.probJitterFactor / 100;

    for (let i = 0; i < keys.length; i++) {
        try {
            const wallet = new ethers.Wallet(keys[i], defaultProvider);
            const balanceWei = await defaultProvider.getBalance(wallet.address);
            const balanceEth = ethers.formatEther(balanceWei);

            const persona = WalletPersonaManager.getPersonaByMode(appState.config.personaMode);

            let currentSend = Math.max(0, baseProbs.send + Stealth.getRandomInRange(-jitterFactor, jitterFactor) * baseProbs.send);
            let currentIdle = Math.max(0, baseProbs.idle + Stealth.getRandomInRange(-jitterFactor, jitterFactor) * baseProbs.idle);
            let currentBalanceCheck = Math.max(0, baseProbs['balance-check'] + Stealth.getRandomInRange(-jitterFactor, jitterFactor) * baseProbs['balance-check']);

            const sum = currentSend + currentIdle + currentBalanceCheck;
            const walletSessionProbs = {
                send: (currentSend / sum) * 100,
                idle: (currentIdle / sum) * 100,
                'balance-check': (currentBalanceCheck / sum) * 100
            };

            appState.wallets.push({
                privateKey: keys[i],
                address: wallet.address,
                balance: parseFloat(balanceEth).toFixed(6),
                sessionProbabilities: walletSessionProbs,
                persona: persona
            });
            log(`🧍 Assigned persona: ${persona.name} | delay ×${persona.behavior.delayFactor.toFixed(2)} | idle ${Math.round(persona.behavior.idleChance * 100)}%`, 'info', {}, ui, appState.logEntries);
            ui.keysLoadedCount.textContent = `Loaded ${i + 1} / ${keys.length}...`;
        } catch (error) {
            log(`Failed to load key #${i+1}: Invalid key or RPC issue - ${error.message}`, 'error', {}, ui, appState.logEntries);
        }
    }

    log(`Successfully loaded ${appState.wallets.length} wallets and their balances.`, 'success', {}, ui, appState.logEntries);
    ui.keysLoadedCount.textContent = `Loaded ${appState.wallets.length} wallets.`;
    updateWalletBalanceChart(appState, ui);
};

/**
 * Tests the configured RPC connections.
 * @param {object} appState - The global application state.
 * @param {object} ui - The UI elements object.
 * @param {function} loadConfig - The function to load configuration.
 */
export const testRpcConnections = async (appState, ui, loadConfig) => {
    loadConfig(); // Ensure latest config is loaded
    if (appState.rpcConfigs.size === 0) {
        log('No RPC URLs configured to test.', 'warning', {}, ui, appState.logEntries);
        return;
    }

    log('Testing RPC connections...', 'info', {}, ui, appState.logEntries);
    for (const [chainId, rpcUrlsForChain] of appState.rpcConfigs.entries()) {
        log(`Testing RPCs for Chain ID ${chainId}:`, 'info', {}, ui, appState.logEntries);
        for (const rpcEntry of rpcUrlsForChain) {
            const provider = new ethers.JsonRpcProvider(rpcEntry.url);
            try {
                const network = await provider.getNetwork();
                const blockNumber = await provider.getBlockNumber();
                if (network.chainId === BigInt(chainId)) {
                    log(`✅ RPC ${rpcEntry.url} connected (Chain ID: ${network.chainId}, Latest Block: ${blockNumber})`, 'success', {}, ui, appState.logEntries);
                } else {
                    log(`⚠️ RPC ${rpcEntry.url} connected but Chain ID mismatch. Configured: ${chainId}, Actual: ${network.chainId}. Latest Block: ${blockNumber}.`, 'warning', {}, ui, appState.logEntries);
                }
            }
            catch (error) {
                log(`❌ Failed to connect to RPC ${rpcEntry.url}: ${error.message}`, 'error', {}, ui, appState.logEntries);
            }
        }
    }
    log('RPC connection testing complete.', 'info', {}, ui, appState.logEntries);
};

/**
 * Loads recipient addresses from a custom list provided in the UI.
 * @param {object} appState - The global application state.
 * @param {object} ui - The UI elements object.
 */
export const loadAddressesFromList = (appState, ui) => {
    const addressesInput = ui.listAddresses.value.split('\n').map(addr => addr.trim()).filter(Boolean);
    const validAddresses = [];
    let invalidCount = 0;

    addressesInput.forEach(addr => {
        if (ethers.isAddress(addr)) {
            validAddresses.push(addr);
        } else {
            invalidCount++;
            log(`Invalid address in list: "${addr}"`, 'warning', {}, ui, appState.logEntries);
        }
    });

    appState.manualRecipientList = validAddresses;
    ui.listAddressesCount.textContent = `Loaded ${validAddresses.length} valid addresses. ${invalidCount > 0 ? `(${invalidCount} invalid ignored)` : ''}`;
    if (validAddresses.length > 0) {
        log(`Successfully loaded ${validAddresses.length} recipient addresses from list.`, 'success', {}, ui, appState.logEntries);
    } else {
        log('No valid addresses loaded from list.', 'warning', {}, ui, appState.logEntries);
    }
};

/**
 * Loads predefined recipient addresses from a CSV file.
 * @param {object} appState - The global application state.
 * @param {object} ui - The UI elements object.
 */
export const loadPredefinedListFromFile = (appState, ui) => {
    const file = ui.predefinedFileInput.files[0];
    if (!file) {
        log('No file selected for predefined list.', 'warning', {}, ui, appState.logEntries);
        ui.predefinedAddressesInfo.textContent = 'No file loaded.';
        ui.predefinedAddressesCount.textContent = '';
        appState.predefinedRecipientList = [];
        updatePredefinedAddressesDisplay(appState, ui);
        return;
    }

    ui.predefinedAddressesInfo.textContent = `Loading file: ${file.name}...`;
    log(`Attempting to load predefined addresses from ${file.name}...`, 'info', {}, ui, appState.logEntries);

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        const addresses = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        const validAddresses = [];
        let invalidCount = 0;

        addresses.forEach(addr => {
            if (ethers.isAddress(addr)) {
                validAddresses.push(addr);
            } else {
                invalidCount++;
                log(`Invalid address in predefined file: "${addr}"`, 'warning', {}, ui, appState.logEntries);
            }
        });

        appState.predefinedRecipientList = validAddresses;
        ui.predefinedAddressesInfo.textContent = `File loaded: ${file.name}`;
        ui.predefinedAddressesCount.textContent = `List contains ${validAddresses.length} valid addresses. ${invalidCount > 0 ? `(${invalidCount} invalid ignored)` : ''}`;
        if (validAddresses.length > 0) {
            log(`Successfully loaded ${validAddresses.length} addresses from "${file.name}".`, 'success', {}, ui, appState.logEntries);
        } else {
            log(`No valid addresses found in "${file.name}".`, 'warning', {}, ui, appState.logEntries);
        }
        updatePredefinedAddressesDisplay(appState, ui);
    };

    reader.onerror = (e) => {
        log(`Error reading file: ${e.target.error.name}`, 'error', {}, ui, appState.logEntries);
        ui.predefinedAddressesInfo.textContent = 'Error loading file.';
        ui.predefinedAddressesCount.textContent = '';
        appState.predefinedRecipientList = [];
        updatePredefinedAddressesDisplay(appState, ui);
    };

    reader.readAsText(file);
};

/**
 * Updates the display of predefined addresses in the UI.
 * @param {object} appState - The global application state.
 * @param {object} ui - The UI elements object.
 */
export const updatePredefinedAddressesDisplay = (appState, ui) => {
    ui.predefinedAddressesDisplay.innerHTML = '';
    if (appState.predefinedRecipientList.length > 0) {
        appState.predefinedRecipientList.forEach(addr => {
            const li = document.createElement('li');
            li.textContent = addr;
            ui.predefinedAddressesDisplay.appendChild(li);
        });
    } else {
        ui.predefinedAddressesDisplay.innerHTML = '<li>No predefined addresses loaded.</li>';
    }
};

/**
 * Chooses an action based on the wallet's session probabilities.
 * @param {object} walletSessionProbs - Probabilities for 'send', 'idle', 'balance-check'.
 * @returns {string} The chosen action type.
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
 * Scans recent blockchain blocks for new recipient addresses.
 * @param {string} rpcUrl - The RPC URL to use for scanning.
 * @param {number} chainId - The chain ID of the network.
 * @param {object} appState - The global application state.
 * @param {object} ui - The UI elements object.
 */
export const scanRecentBlocks = async (rpcUrl, chainId, appState, ui) => {
    appState.currentRecipientPool[chainId] = appState.currentRecipientPool[chainId] || [];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    log(`Scanning ${appState.config.blockLookback} blocks on Chain ID ${chainId} using ${rpcUrl}...`, 'info', {}, ui, appState.logEntries);
    try {
        const currentBlockNumber = await provider.getBlockNumber();
        const startBlock = Math.max(0, currentBlockNumber - appState.config.blockLookback);
        const newAddresses = new Set();

        for (let blk = startBlock; blk <= currentBlockNumber; blk++) {
            const block = await provider.getBlock(blk, true);
            if (block && block.transactions) {
                block.transactions.forEach(tx => {
                    if (tx.to && ethers.isAddress(tx.to)) {
                        newAddresses.add(tx.to);
                    }
                });
            }
        }

        const existingAddresses = new Set(appState.currentRecipientPool[chainId]);
        newAddresses.forEach(addr => existingAddresses.add(addr));
        appState.currentRecipientPool[chainId] = Array.from(existingAddresses);
        log(`Found ${newAddresses.size} new addresses. Total recipients for chain ${chainId}: ${appState.currentRecipientPool[chainId].length}`, 'success', {}, ui, appState.logEntries);
    } catch (error) {
        log(`Failed to scan blocks for chain ${chainId} using ${rpcUrl}: ${error.message}`, 'error', {}, ui, appState.logEntries);
    }
};

/**
 * Performs a transaction with retries if it fails.
 * @param {ethers.Wallet} wallet - The wallet instance.
 * @param {object} txParams - The transaction parameters.
 * @param {number} chainId - The chain ID.
 * @param {number} gasFactorUsed - The gas factor applied.
 * @param {object} appState - The global application state.
 * @param {object} ui - The UI elements object.
 * @returns {Promise<{success: boolean, receipt: object|null}>} Transaction result.
 */
export async function sendWithRetryOrSkip(wallet, txParams, chainId, gasFactorUsed, appState, ui) {
    let retries = 0;
    const maxRetries = appState.config.maxRetries;

    while (retries <= maxRetries) {
        try {
            const populatedTx = await wallet.populateTransaction(txParams);
            log(`🚀 Sending TX with populated fields`, 'info', {}, ui, appState.logEntries);

            const txResponse = await wallet.sendTransaction(populatedTx);

            log(`✅ Tx sent! Hash: <a href="https://etherscan.io/tx/${txResponse.hash}" target="_blank" class="underline">${txResponse.hash}</a><button class="log-copy-btn" data-tx-hash="${txResponse.hash}">📋</button>`, 'success', {
                chainId,
                walletAddress: wallet.address,
                action: 'send',
                gasFactorUsed: gasFactorUsed.toFixed(2)
            }, ui, appState.logEntries);

            const receipt = await txResponse.wait();
            log(`✅ Tx confirmed!`, 'success', {}, ui, appState.logEntries);
            return { success: true, receipt };

        } catch (err) {
            console.warn("❌ TX Send Failed:", err);
            log(`❌ TX Failed (Attempt ${retries + 1}/${maxRetries + 1}): ${err.message}`, 'error', {
                chainId,
                walletAddress: wallet.address,
                action: 'send'
            }, ui, appState.logEntries);

            if (retries < maxRetries) {
                const retryDelay = Math.pow(2, retries) * 1000 + Stealth.getRandomInRange(0, 500); // Exponential backoff with jitter
                log(`Retrying in ${retryDelay / 1000} seconds...`, 'warning', {}, ui, appState.logEntries);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                retries++;
            } else {
                log(`❌ TX skipped after max retries (${maxRetries}).`, 'error', {
                    chainId,
                    walletAddress: wallet.address,
                    action: 'send'
                }, ui, appState.logEntries);
                updateActionDistChart('skipped', appState);
                return { success: false, receipt: null };
            }
        }
    }
    return { success: false, receipt: null }; // Should not be reached
}

/**
 * Performs a harmless "dummy" read call to simulate network interaction.
 * @param {ethers.JsonRpcProvider} provider - The ethers provider instance.
 * @param {object} appState - The global application state.
 * @param {object} ui - The UI elements object.
 */
export async function maybeDummyCall(provider, appState, ui) {
    if (Math.random() < 0.1) { // 10% chance
        log("Doing dummy blockNumber check…", 'info', {}, ui, appState.logEntries);
        try {
            await provider.getBlockNumber();
            log("Dummy blockNumber check successful.", 'info', {}, ui, appState.logEntries);
        } catch (e) {
            log(`Dummy blockNumber check failed: ${e.message}`, 'warning', {}, ui, appState.logEntries);
        }
    }
    if (Math.random() < 0.1) { // 10% chance for gas price check
        log("Doing dummy gas price check…", 'info', {}, ui, appState.logEntries);
        try {
            await provider.getGasPrice();
            log("Dummy gas price check successful.", 'info', {}, ui, appState.logEntries);
        } catch (e) {
            log(`Dummy gas price check failed: ${e.message}`, 'warning', {}, ui, appState.logEntries);
        }
    }
    if (Math.random() < 0.05 && appState.wallets.length > 0) { // 5% chance to check a random wallet balance
        const randomWallet = appState.wallets[Math.floor(Math.random() * appState.wallets.length)];
        log(`Doing dummy balance check for ...${randomWallet.address.slice(-6)}...`, 'info', {}, ui, appState.logEntries);
        try {
            const bal = await provider.getBalance(randomWallet.address);
            log(`Dummy balance check successful: ${ethers.formatEther(bal).slice(0,8)} ETH`, 'info', {}, ui, appState.logEntries);
        } catch (e) {
            log(`Dummy balance check failed: ${e.message}`, 'warning', {}, ui, appState.logEntries);
        }
    }
}
