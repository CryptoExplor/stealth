// js/main.js
import { ethers } from 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.umd.min.js';
import { Stealth, sendWithRetryOrSkip, maybeDummyCall, chooseAction, sleep } from './stealth.js';
import { injectStealthDefaults, loadConfiguration } from './config.js';
import { scanRecentBlocks, testRpcConnections } from './rpc.js';
import { ui, setUIEnabled, initConsoleCharts, updateWalletBalanceChart, updateActionDistChart, log, openConfirmationModal } from './ui.js';

// Global application state
const appState = {
    isRunning: false,
    stopFlag: false,
    wallets: [],
    rpcConfigs: [], // [{url, chainId}]
    currentRecipientPool: {}, // {chainId: [addresses]}
    manualRecipientList: [], // For user-provided list
    predefinedRecipientList: [], // Now loaded from CSV
    config: {},
    stats: {
        totalActions: 0,
        successfulActions: 0,
        failedActions: 0,
        actionCounts: { send: 0, idle: 0, 'balance-check': 0, skipped: 0 }
    },
    logEntries: [], // For CSV export
    charts: {
        walletBalance: null,
        actionDist: null,
    },
    pendingConfirmation: null,
    connectedAddress: null,
    lastHumanLikeSpike: null,
};

/**
 * Main function to start the blockchain interaction loop.
 * @param {object} appState - The global application state object.
 */
const startInteraction = async (appState) => { // Removed ethers from parameters
    openConfirmationModal('Are you sure you want to start Blockchain Interaction? Ensure your settings and keys are for test purposes only, as this involves real blockchain interactions.', async (confirmed) => {
        if (!confirmed) {
            log('Interaction start cancelled by user.', 'info', {}, appState);
            return;
        }

        if (!loadConfiguration(appState, ui, (msg, type) => log(msg, type, {}, appState))) {
            log('Configuration is invalid. Please fix errors before starting.', 'error', {}, appState);
            return;
        }

        if (appState.wallets.length === 0) {
            log('Please load wallets first.', 'error', {}, appState);
            return;
        }
        if (appState.rpcConfigs.length === 0) {
            log('Please provide at least one RPC URL and Chain ID.', 'error', {}, appState);
            return;
        }
        if (appState.config.recipientMode === 'fixed' && !ethers.isAddress(appState.config.fixedAddress)) {
            log('Invalid fixed recipient address.', 'error', {}, appState);
            return;
        }
        if (appState.config.recipientMode === 'list' && appState.manualRecipientList.length === 0) {
            log('Recipient list is empty. Please load addresses into the list or choose another recipient mode.', 'error', {}, appState);
            return;
        }
        if (appState.config.recipientMode === 'predefined' && appState.predefinedRecipientList.length === 0) {
            log('Predefined recipient list is empty. Please load a CSV file with addresses.', 'error', {}, appState);
            return;
        }
        if (appState.config.recipientMode === 'self-interact' && appState.wallets.length < 2) {
            log('To use "interact with each other" mode, you need at least 2 loaded wallets.', 'error', {}, appState);
            return;
        }
        
        appState.isRunning = true;
        appState.stopFlag = false;
        appState.stats = { totalActions: 0, successfulActions: 0, failedActions: 0, actionCounts: { send: 0, idle: 0, 'balance-check': 0, skipped: 0 } };
        appState.logEntries = [];
        appState.charts.actionDist.data.labels = ['Send', 'Idle', 'Balance Check', 'Skipped'];
        appState.charts.actionDist.data.datasets[0].data = [0, 0, 0, 0];
        appState.charts.actionDist.update();


        ui.startBtn.disabled = true;
        ui.stopBtn.disabled = false;
        ui.statusDisplay.textContent = 'Running';
        ui.successCount.textContent = appState.stats.successfulActions.toString();
        ui.failCount.textContent = appState.stats.failedActions.toString();
        ui.progressText.textContent = '0';
        ui.progressBar.style.width = `100%`;


        log(`Starting Blockchain Interaction process across ${appState.rpcConfigs.length} chains and ${appState.wallets.length} wallets.`, 'info', {}, appState);

        // Pre-scan all RPCs for addresses for the 'pool' mode
        if (appState.config.recipientMode === 'pool') {
            log('Pre-scanning all configured chains for recipient addresses for the dynamic pool...', 'info', {}, appState);
            for (const rpcConfig of appState.rpcConfigs) {
                await scanRecentBlocks(rpcConfig.url, rpcConfig.chainId, appState); // Removed ethers from call
            }
            log('Pre-scanning complete.', 'info', {}, appState);
        }

        // Chain-switch jitter: occasionally stay on the same chain
        let lastRpcIndex = -1;

        // Main Interaction loop: continuously runs until stop button is clicked
        while (appState.isRunning && !appState.stopFlag) {
            // Randomly select an RPC configuration for this session
            let rpcConfigIndex;
            if (lastRpcIndex !== -1 && Math.random() < 0.2) { // 20% chance to reuse last chain
                rpcConfigIndex = lastRpcIndex;
            } else {
                rpcConfigIndex = Math.floor(Math.random() * appState.rpcConfigs.length);
            }
            lastRpcIndex = rpcConfigIndex;
            const rpcConfig = appState.rpcConfigs[rpcConfigIndex];
            const rpcUrl = rpcConfig.url;
            const chainId = rpcConfig.chainId;
            const provider = new ethers.JsonRpcProvider(rpcUrl);

            // RPC health probing
            try {
                await provider.getBlockNumber();
            } catch (rpcError) {
                log(`❌ Failed to connect to RPC ${rpcUrl}: ${rpcError.message}. Removing this RPC and continuing.`, 'error', {}, appState);
                appState.rpcConfigs.splice(rpcConfigIndex, 1);
                if (appState.rpcConfigs.length === 0) {
                    log('❌ No RPC endpoints left. Stopping interaction.', 'error', {}, appState);
                    appState.stopFlag = true;
                    break;
                }
                continue; // Skip to next iteration with remaining RPCs
            }

            if (appState.rpcConfigs.length > 1 && appState.config.rpcSwitchDelay > 0) {
                log(`Pausing for RPC switch delay (${appState.config.rpcSwitchDelay / 1000}s)...`, 'info', {}, appState);
                await sleep(appState.config.rpcSwitchDelay);
            }

            const walletInfoIndex = Math.floor(Math.random() * appState.wallets.length);
            const walletInfo = appState.wallets[walletInfoIndex];
            const walletAddress = walletInfo.address;
            let wallet = new ethers.Wallet(walletInfo.privateKey, provider);

            log(`🌐 Initiating session for Wallet ...${walletAddress.slice(-6)} on Chain ID ${chainId} (${rpcUrl})...`, 'info', {}, appState);

            if (appState.wallets.length > 1 && appState.config.walletSwitchDelay > 0) {
                log(`Pausing for wallet switch delay (${appState.config.walletSwitchDelay / 1000}s)...`, 'info', {}, appState);
                await sleep(appState.config.walletSwitchDelay);
            }

            if (Math.random() * 100 < appState.config.walletIdleChance) {
                log(`Wallet ...${walletAddress.slice(-6)} is idle this session on Chain ID ${chainId}.`, 'info', { chainId, walletAddress, action: 'idle' }, appState);
                updateActionDistChart('idle', appState);
                const delay = Stealth.generateLogNormalDelay(appState.config.minDelay, appState.config.maxDelay);
                await sleep(delay);
                continue; // Move to next wallet/chain session
            }

            try {
                const balanceWei = await provider.getBalance(walletAddress);
                if (balanceWei < ethers.parseEther("0.001")) { // Ensure sufficient balance for gas
                    log(`Skipping wallet ...${walletAddress.slice(-6)} on Chain ID ${chainId} due to critically low balance (${ethers.formatEther(balanceWei)} ETH).`, 'warning', { chainId, walletAddress, action: 'skipped' }, appState);
                    updateActionDistChart('skipped', appState);
                    const delay = Stealth.generateLogNormalDelay(appState.config.minDelay, appState.config.maxDelay);
                    await sleep(delay); // Add delay even for skipped
                    continue; // Move to next wallet/chain session
                } else if (balanceWei < ethers.parseEther("0.005")) { // Warning for slightly low balance
                     log(`Wallet ...${walletAddress.slice(-6)} on Chain ID ${chainId} has low balance (${ethers.formatEther(balanceWei)} ETH).`, 'warning', { chainId, walletAddress, action: 'info' }, appState);
                }
            } catch (balanceError) {
                log(`Failed to check balance for ...${walletAddress.slice(-6)} on Chain ID ${chainId}: ${balanceError.message}`, 'error', { chainId, walletAddress, action: 'skipped' }, appState);
                updateActionDistChart('skipped', appState);
                const delay = Stealth.generateLogNormalDelay(appState.config.minDelay, appState.config.maxDelay);
                await sleep(delay);
                continue; // Move to next wallet/chain session
            }

            let actionsForWallet;
            let currentSessionType = 'normal';
            if (Math.random() * 100 < appState.config.activityBurstChance) {
                actionsForWallet = Math.floor(Stealth.getRandomInRange(appState.config.minBurstActions, appState.config.maxBurstActions + 1));
                currentSessionType = 'burst';
                log(`Wallet ...${walletAddress.slice(-6)} entered an activity burst, performing ${actionsForWallet} actions.`, 'info', {}, appState);
            } else {
                actionsForWallet = Math.floor(Stealth.getRandomInRange(1, appState.config.maxTxnsPerWallet + 1));
            }
            log(`Wallet ...${walletAddress.slice(-6)} will perform ${actionsForWallet} action(s) on Chain ID ${chainId}.`, 'info', {}, appState);


            for (let i = 1; i <= actionsForWallet; i++) {
                if (appState.stopFlag) break; // Break from inner loop if stop requested

                appState.stats.totalActions++;
                ui.progressText.textContent = `${appState.stats.totalActions}`;
                ui.progressBar.style.width = `100%`;

                // Gas Price Check (still relevant for skipping if too high, before applying random factor)
                let currentGasPrice = null;
                let maxPriorityFeePerGas = null;
                let maxFeePerGas = null;

                try {
                    const feeData = await provider.getFeeData();
                    currentGasPrice = feeData.gasPrice; // For legacy transactions
                    maxPriorityFeePerGas = feeData.maxPriorityFeePerGas; // For EIP-1559
                    maxFeePerGas = feeData.maxFeePerGas; // For EIP-1559

                    ui.gasDisplay.textContent = `${(Number(ethers.formatUnits(currentGasPrice || maxFeePerGas, 'gwei'))).toFixed(2)} gwei`;

                    // High Gas Price Multiplier Check
                    const thresholdGasPrice = currentGasPrice ? (currentGasPrice * BigInt(Math.round(appState.config.gasMultiplier * 100))) / BigInt(100) : null;
                    const thresholdMaxFeePerGas = maxFeePerGas ? (maxFeePerGas * BigInt(Math.round(appState.config.gasMultiplier * 100))) / BigInt(100) : null;

                    if ((currentGasPrice && thresholdGasPrice && currentGasPrice > thresholdGasPrice) ||
                        (maxFeePerGas && thresholdMaxFeePerGas && maxFeePerGas > thresholdMaxFeePerGas)) {
                        log(`Gas price (${(Number(ethers.formatUnits(currentGasPrice || maxFeePerGas, 'gwei'))).toFixed(2)} gwei) is too high. Skipping action for ...${walletAddress.slice(-6)} on Chain ID ${chainId}.`, 'warning', { chainId, walletAddress, action: 'skipped' }, appState);
                        updateActionDistChart('skipped', appState);
                        break;
                    }
                } catch (gasError) {
                    log(`Failed to get gas price for Chain ID ${chainId}: ${gasError.message}. Proceeding without high gas check.`, 'warning', { chainId, walletAddress, action: 'skipped' }, appState);
                }
                
                // Perform a dummy call before the main action
                await maybeDummyCall(provider, appState, log);
                if (appState.stopFlag) break;

                const chosenBehavior = chooseAction(walletInfo.sessionProbabilities);
                log(`[Action ${i}/${actionsForWallet}] Wallet ...${walletAddress.slice(-6)} chose to: ${chosenBehavior.toUpperCase()}`, 'info', { chainId, walletAddress, action: chosenBehavior }, appState);

                let actionSuccess = false;
                let delayUsed = 0;

                switch (chosenBehavior) {
                    case "send":
                        let recipientAddress;
                        const currentChainRecipientPool = appState.currentRecipientPool[chainId];
                        
                        if (appState.config.recipientMode === 'fixed') {
                            recipientAddress = ui.fixedAddress.value.trim();
                            if (!ethers.isAddress(recipientAddress)) {
                                log(`Fixed recipient address "${recipientAddress}" is invalid. Skipping send.`, 'error', { chainId, walletAddress, action: 'send' }, appState);
                                updateActionDistChart('skipped', appState);
                                break;
                            }
                        } else if (appState.config.recipientMode === 'list') {
                            if (appState.manualRecipientList.length === 0) {
                                log(`Recipient list is empty. Skipping send for wallet ...${walletAddress.slice(-6)}.`, 'warning', { chainId, walletAddress, action: 'send' }, appState);
                                updateActionDistChart('skipped', appState);
                                break;
                            }
                            recipientAddress = appState.manualRecipientList[Math.floor(Math.random() * appState.manualRecipientList.length)];
                        }
                        else if (appState.config.recipientMode === 'predefined') {
                            if (appState.predefinedRecipientList.length === 0) {
                                log(`Predefined recipient list is empty. Skipping send for wallet ...${walletAddress.slice(-6)}.`, 'warning', { chainId, walletAddress, action: 'send' }, appState);
                                updateActionDistChart('skipped', appState);
                                break;
                            }
                            recipientAddress = appState.predefinedRecipientList[Math.floor(Math.random() * appState.predefinedRecipientList.length)];
                        }
                        else if (appState.config.recipientMode === 'self-interact') {
                            const otherWallets = appState.wallets.filter(w => w.address.toLowerCase() !== walletAddress.toLowerCase());
                            if (otherWallets.length === 0) {
                                log(`No other loaded wallets to interact with. Skipping send for wallet ...${walletAddress.slice(-6)}.`, 'warning', { chainId, walletAddress, action: 'send' }, appState);
                                updateActionDistChart('skipped', appState);
                                break;
                            }
                            recipientAddress = otherWallets[Math.floor(Math.random() * otherWallets.length)].address;
                            log(`Sending to another loaded wallet: ${recipientAddress.slice(0,6)}...${recipientAddress.slice(-4)}`, 'info', {}, appState);
                        }
                        else if (appState.config.recipientMode === 'pool') {
                            // Fallback logic for dynamic pool if no external addresses are found for the current chain
                            if (currentChainRecipientPool && currentChainRecipientPool.length > 0) {
                                recipientAddress = currentChainRecipientPool[Math.floor(Math.random() * currentChainRecipientPool.length)];
                            } else {
                                // If pool is empty, fall back to loaded wallets
                                const otherWallets = appState.wallets.filter(w => w.address.toLowerCase() !== walletAddress.toLowerCase());
                                if (otherWallets.length > 0) {
                                    recipientAddress = otherWallets[Math.floor(Math.random() * otherWallets.length)].address;
                                    log(`Dynamic pool empty for Chain ID ${chainId}. Falling back to sending to another loaded wallet: ${recipientAddress.slice(0,6)}...${recipientAddress.slice(-4)}`, 'info', {}, appState);
                                } else {
                                    log(`Dynamic pool empty and no other loaded wallets to interact with. Skipping send for wallet ...${walletAddress.slice(-6)}.`, 'warning', { chainId, walletAddress, action: 'send' }, appState);
                                    updateActionDistChart('skipped', appState);
                                    break;
                                }
                            }
                        } else {
                            log(`No valid recipient selection for 'send' action. Skipping.`, 'warning', { chainId, walletAddress, action: 'send' }, appState);
                            updateActionDistChart('skipped', appState);
                            break;
                        }

                        const amount = Stealth.getRandomInRange(appState.config.minAmount, appState.config.maxAmount);
                        const tx = {
                            to: recipientAddress,
                            value: ethers.parseEther(amount.toFixed(12))
                        };

                        const randomGasFactor = Stealth.getRandomInRange(appState.config.minGasFactor, appState.config.maxGasFactor);
                        if (maxFeePerGas && maxPriorityFeePerGas) { // EIP-1559 chain
                            // Apply random factor to base fee and priority fee
                            tx.maxFeePerGas = (maxFeePerGas * BigInt(Math.round(randomGasFactor * 100))) / BigInt(100);
                            tx.maxPriorityFeePerGas = (maxPriorityFeePerGas * BigInt(Math.round(randomGasFactor * 100))) / BigInt(100);
                            if (tx.maxFeePerGas < tx.maxPriorityFeePerGas) {
                                tx.maxFeePerGas = tx.maxPriorityFeePerGas + ethers.parseUnits('1', 'gwei'); // Add a small buffer if needed
                            }
                        } else if (currentGasPrice) { // Legacy chain
                            tx.gasPrice = (currentGasPrice * BigInt(Math.round(randomGasFactor * 100))) / BigInt(100);
                        }
                        log(`Attempting to send with random gas factor: x${randomGasFactor.toFixed(2)}`, 'info', {}, appState);

                        // NONCE JITTER: randomize nonce offset
                        try {
                            const currentNonce = await provider.getTransactionCount(walletAddress);
                            const nonceOffset = Math.floor(Stealth.getRandomInRange(0, 3)); // jitter 0-2
                            tx.nonce = currentNonce + nonceOffset;
                            log(`Nonce jitter applied: using nonce ${tx.nonce}`, 'info', {}, appState);
                        } catch (nonceError) {
                            log(`Failed to get nonce for wallet ...${walletAddress.slice(-6)}: ${nonceError.message}`, 'warning', {}, appState);
                        }
                        // Simulated error (before actual send)
                        if (Math.random() * 100 < appState.config.simulatedErrorChance) {
                            log(`⚠️ Simulated network error (pre-send). Transaction will be skipped.`, 'warning', { chainId, walletAddress }, appState);
                            actionSuccess = false;
                            updateActionDistChart('skipped', appState);
                            break; // Skip to next wallet/session
                        }
                        const sendResult = await sendWithRetryOrSkip(wallet, tx, appState.config.maxRetries, chainId, randomGasFactor, appState, log, updateActionDistChart);
                        actionSuccess = sendResult.success;
                        
                        if (actionSuccess) {
                            appState.stats.actionCounts.send++;
                            log(`✅ Transaction sent successfully to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)} with ${amount} ETH.`, 'success', {
                                chainId,
                                walletAddress,
                                action: 'send',
                                gasFactorUsed: randomGasFactor.toFixed(2)
                            }, appState);
                            updateActionDistChart('send', appState);
                        } else {
                            log(`❌ Transaction failed after retries.`, 'error', { chainId, walletAddress, action: 'send' }, appState);
                            updateActionDistChart('skipped', appState);
                        }
                        break; // Break from switch after send

                    case "idle-action":
                        log(`Wallet ...${walletAddress.slice(-6)} is idling for this action.`, 'info', { chainId, walletAddress, action: 'idle' }, appState);
                        updateActionDistChart('idle', appState);
                        actionSuccess = true;
                        break;

                    case "balance-check":
                        try {
                            const currentBalanceWei = await provider.getBalance(walletAddress);
                            log(`Wallet ...${walletAddress.slice(-6)} checked balance: ${ethers.formatEther(currentBalanceWei).slice(0, 8)} ETH`, 'info', { chainId, walletAddress, action: 'balance-check' }, appState);
                            actionSuccess = true;
                        } catch (error) {
                            log(`Failed to check balance for ...${walletAddress.slice(-6)}: ${error.message}`, 'error', { chainId, walletAddress, action: 'balance-check' }, appState);
                        }
                        updateActionDistChart('balance-check', appState);
                        break;
                }

                if (actionSuccess) {
                    appState.stats.successfulActions++;
                } else {
                    // Only count failure if it wasn't already counted as skipped (e.g. by sendWithRetry)
                    if (chosenBehavior === 'send') {
                        const lastLog = appState.logEntries[appState.logEntries.length - 1];
                        if (!lastLog.Details.includes('skipped after max retries')) {
                            appState.stats.failedActions++;
                        }
                    } else {
                         appState.stats.failedActions++;
                    }
                }
                ui.successCount.textContent = appState.stats.successfulActions.toString();
                ui.failCount.textContent = appState.stats.failedActions.toString();

                try {
                    const newBalanceWei = await provider.getBalance(wallet.address);
                    walletInfo.balance = parseFloat(ethers.formatEther(newBalanceWei)).toFixed(6);
                    updateWalletBalanceChart(appState);
                } catch (balanceUpdateError) {
                    log(`Failed to update balance for ...${walletInfo.address.slice(-6)}: ${balanceUpdateError.message}`, 'warning', {}, appState);
                }

                if (i < actionsForWallet && !appState.stopFlag) {
                    let currentMinDelay = appState.config.minDelay;
                    let currentMaxDelay = appState.config.maxDelay;

                    if (appState.config.enableTimeOfDayBias) {
                        const currentHour = new Date().getHours();
                        if (currentHour >= 1 && currentHour < 6) {
                            currentMinDelay *= 2;
                            currentMaxDelay *= 2;
                            log(`Applying time-of-day bias: increased delay due to night hours.`, 'info', {}, appState);
                        }
                    }

                    if (Math.random() * 100 < appState.config.thinkTimeChance) {
                        delayUsed = Stealth.generateLogNormalDelay(appState.config.minThinkTime, appState.config.maxThinkTime);
                        log(`Waiting for a human-like "think time" burst of ${Math.round(delayUsed/1000)} seconds...`, 'info', {}, appState);
                        appState.lastHumanLikeSpike = new Date().toLocaleTimeString();
                        ui.humanSpikeDisplay.textContent = appState.lastHumanLikeSpike;
                        await sleep(delayUsed);
                    } else {
                        delayUsed = Stealth.generateLogNormalDelay(currentMinDelay, currentMaxDelay);
                        log(`Waiting for ${Math.round(delayUsed/1000)} seconds before next action...`, 'info', { delayUsedMs: delayUsed }, appState);
                        await sleep(delayUsed);
                    }
                }
            }

            if (appState.stopFlag) break;

            if (currentSessionType === 'burst' && appState.config.minLullTime > 0) {
                const lullDelay = Stealth.generateLogNormalDelay(appState.config.minLullTime, appState.config.maxLullTime);
                log(`Activity burst completed. Entering lull period for ${Math.round(lullDelay/1000)} seconds...`, 'info', {}, appState);
                appState.lastHumanLikeSpike = new Date().toLocaleTimeString();
                ui.humanSpikeDisplay.textContent = appState.lastHumanLikeSpike;
                await sleep(lullDelay);
            } else {
                const sessionDelay = Stealth.generateLogNormalDelay(appState.config.minDelay, appState.config.maxDelay);
                log(`Session for Wallet ...${walletAddress.slice(-6)} on Chain ID ${chainId} completed. Waiting for ${Math.round(sessionDelay/1000)} seconds before next session...`, 'info', { delayUsedMs: sessionDelay }, appState);
                await sleep(sessionDelay);
            }

            // Random UI interaction: toggle theme as a human-like behavior
            if (Math.random() < 0.05) {
                ui.themeToggle.click();
                await sleep(500);
                ui.themeToggle.click();
                log('Performed a random theme toggle for UI interaction.', 'info', {}, appState);
            }
        }

        log('Interaction process finished.', 'success', {}, appState);
        stopInteraction(appState);
    }, appState);
};

/**
 * Stops the blockchain interaction process.
 * @param {object} appState - The global application state object.
 */
const stopInteraction = (appState) => {
    appState.isRunning = false;
    appState.stopFlag = true;
    ui.startBtn.disabled = false;
    ui.stopBtn.disabled = true;
    ui.statusDisplay.textContent = 'Idle';
};

/**
 * Clears all application data, including wallets, config, and logs.
 * @param {object} appState - The global application state object.
 */
const clearAllData = (appState) => {
    openConfirmationModal('Are you sure you want to clear ALL configurations, loaded wallets, and log data? This action cannot be undone.', (confirmed) => {
        if (confirmed) {
            appState.isRunning = false;
            appState.stopFlag = false;
            appState.wallets = [];
            appState.rpcConfigs = [];
            appState.currentRecipientPool = {};
            appState.manualRecipientList = [];
            ui.listAddresses.value = '';
            ui.listAddressesCount.textContent = '';
            appState.predefinedRecipientList = [];
            ui.predefinedFileInput.value = '';
            ui.predefinedAddressesInfo.textContent = 'No file loaded.';
            ui.updatePredefinedAddressesDisplay(appState); // Call from ui.js
            appState.config = {};
            appState.stats = { totalActions: 0, successfulActions: 0, failedActions: 0, actionCounts: { send: 0, idle: 0, 'balance-check': 0, skipped: 0 } };
            appState.logEntries = [];
            appState.lastHumanLikeSpike = null;
            ui.humanSpikeDisplay.textContent = 'Never';

            ui.privateKeys.value = '';
            injectStealthDefaults();
            ui.stealthProfileSelector.value = "balanced";

            setUIEnabled(false);
            initConsoleCharts(appState);
            updateWalletBalanceChart(appState);
            log('All data cleared.', 'info', {}, appState);
        }
    }, appState);
};


document.addEventListener('DOMContentLoaded', () => {
    // Initialize charts and setup event listeners
    initConsoleCharts(appState);
    // Removed ethers from this call, as ui.js functions will now import it directly
    ui.setupEventListeners(appState, startInteraction, stopInteraction, clearAllData, testRpcConnections);

    // Load initial configuration and set UI state
    injectStealthDefaults(); // Apply default config values to UI
    loadConfiguration(appState, ui, (msg, type) => log(msg, type, {}, appState)); // Load config from UI into appState
    setUIEnabled(false); // Disable features until wallet is connected

    // Set initial active state for sidebar
    ui.advanceConsoleToggle.classList.add('active');
    ui.advanceConsoleSubmenu.classList.add('open');

    // Check for existing MetaMask connection on startup
    if (typeof window.ethereum !== 'undefined') {
         log('MetaMask or compatible wallet detected on startup. Checking for existing connection...', 'info', {}, appState);
         window.ethereum.request({ method: 'eth_accounts' })
            .then(accounts => {
                if (accounts.length > 0) {
                    appState.connectedAddress = accounts[0];
                    log(`Existing wallet connection found: ${appState.connectedAddress}`, 'info', {}, appState);
                    ui.walletStatusDisplay.innerHTML = `Connected: <strong>${appState.connectedAddress.slice(0, 6)}...${appState.connectedAddress.slice(-4)}</strong>`;
                    setUIEnabled(true);
                } else {
                     ui.walletStatusDisplay.innerHTML = `No wallet connected.`;
                     log('No existing wallet connection found on startup.', 'info', {}, appState);
                     setUIEnabled(false);
                }
            })
            .catch(error => {
                log(`Error checking existing wallet connection: ${error.message}`, 'error', {}, appState);
                 ui.walletStatusDisplay.innerHTML = `Error: ${error.message}`;
                 setUIEnabled(false);
            });

         window.ethereum.on('accountsChanged', (newAccounts) => {
             log('Wallet accounts changed event detected (startup listener).', 'info', {}, appState);
             if (newAccounts.length === 0) {
                 log('Wallet disconnected or no accounts selected (startup listener).', 'warning', {}, appState);
                 appState.connectedAddress = null;
                 ui.walletStatusDisplay.innerHTML = `No wallet connected.`;
                 setUIEnabled(false);
             } else {
                 log(`Account changed to: ${newAccounts[0]} (startup listener)`, 'info', {}, appState);
                 appState.connectedAddress = newAccounts[0];
                 ui.walletStatusDisplay.innerHTML = `Connected: <strong>${appState.connectedAddress.slice(0, 6)}...${appState.connectedAddress.slice(-4)}</strong>`;
                 setUIEnabled(true);
             }
         });

         window.ethereum.on('chainChanged', (chainId) => {
             log(`Network changed to Chain ID: ${parseInt(chainId, 16)} (startup listener). Please ensure RPCs match.`, 'warning', {}, appState);
         });

         window.ethereum.on('disconnect', (error) => {
            log(`Wallet disconnected: ${error.message || 'Unknown error'} (startup listener)`, 'error', {}, appState);
            appState.connectedAddress = null;
            ui.walletStatusDisplay.innerHTML = `No wallet connected.`;
            setUIEnabled(false);
        });

    } else {
        ui.walletStatusDisplay.innerHTML = `No wallet detected. Please install <a href="https://metamask.io/" target="_blank" class="underline text-blue-500">MetaMask</a>.`;
        log('MetaMask or compatible wallet not detected on startup.', 'error', {}, appState);
        setUIEnabled(false);
    }

    log('Console initialized. Please connect your wallet to begin.', 'info', {}, appState);
});
