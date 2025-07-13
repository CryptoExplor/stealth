// main.js

import { ethers } from 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.umd.min.js';
import { log, sleep } from './utils.js';
import { Stealth } from './stealth.js';
import { WalletPersonaManager } from './walletPersonaManager.js';
import { loadConfiguration, injectStealthDefaults } from './config.js';
import { initConsoleCharts, updateWalletBalanceChart, updateActionDistChart } from './charts.js';
import { connectWallet, chooseAction, scanRecentBlocks, sendWithRetryOrSkip, maybeDummyCall } from './wallet.js';
import { ui, setUIEnabled, openConfirmationModal } from './ui.js';


// Global application state
const appState = {
    isRunning: false,
    stopFlag: false,
    wallets: [], // Each wallet object will now include a 'persona' property
    // appState.rpcConfigs will now be a Map: Map<chainId, [{url: string, provider: ethers.JsonRpcProvider}]>
    rpcConfigs: new Map(),
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
 * Starts the blockchain interaction process.
 * @param {object} appState - The global application state.
 * @param {object} ui - The UI elements object.
 */
const startInteraction = async (appState, ui) => {
    openConfirmationModal('Are you sure you want to start Blockchain Interaction? Ensure your settings and keys are for test purposes only, as this involves real blockchain interactions.', async (confirmed) => {
        if (!confirmed) {
            log('Interaction start cancelled by user.', 'info', {}, ui, appState.logEntries);
            return;
        }

        if (!loadConfiguration(appState, ui)) {
            log('Configuration is invalid. Please fix errors before starting.', 'error', {}, ui, appState.logEntries);
            return;
        }

        if (appState.wallets.length === 0) {
            log('Please load wallets first.', 'error', {}, ui, appState.logEntries);
            return;
        }
        if (appState.rpcConfigs.size === 0) {
            log('Please provide at least one RPC URL and Chain ID.', 'error', {}, ui, appState.logEntries);
            return;
        }
        if (appState.config.recipientMode === 'fixed' && !ethers.isAddress(appState.config.fixedAddress)) {
            log('Invalid fixed recipient address.', 'error', {}, ui, appState.logEntries);
            return;
        }
        if (appState.config.recipientMode === 'list' && appState.manualRecipientList.length === 0) {
            log('Recipient list is empty. Please load addresses into the list or choose another recipient mode.', 'error', {}, ui, appState.logEntries);
            return;
        }
        if (appState.config.recipientMode === 'predefined' && appState.predefinedRecipientList.length === 0) {
            log('Predefined recipient list is empty. Please load a CSV file with addresses.', 'error', {}, ui, appState.logEntries);
            return;
        }
        if (appState.config.recipientMode === 'self-interact' && appState.wallets.length < 2) {
            log('To use "interact with each other" mode, you need at least 2 loaded wallets.', 'error', {}, ui, appState.logEntries);
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


        log(`Starting Blockchain Interaction process across ${appState.rpcConfigs.size} chains and ${appState.wallets.length} wallets.`, 'info', {}, ui, appState.logEntries);

        if (appState.config.recipientMode === 'pool') {
            log('Pre-scanning all configured chains for recipient addresses for the dynamic pool...', 'info', {}, ui, appState.logEntries);
            for (const [chainId, rpcUrlsForChain] of appState.rpcConfigs.entries()) {
                let rpcToScan = rpcUrlsForChain[0].url;
                let scanProvider = new ethers.JsonRpcProvider(rpcToScan);
                try {
                    await scanProvider.getBlockNumber();
                } catch (error) {
                    log(`Initial RPC ${rpcToScan} for Chain ID ${chainId} failed for scanning: ${error.message}. Trying alternatives for scan.`, 'warning', {}, ui, appState.logEntries);
                    for (let i = 1; i < rpcUrlsForChain.length; i++) {
                        rpcToScan = rpcUrlsForChain[i].url;
                        scanProvider = new ethers.JsonRpcProvider(rpcToScan);
                        try {
                            await scanProvider.getBlockNumber();
                            log(`Successfully switched to ${rpcToScan} for scanning Chain ID ${chainId}.`, 'info', {}, ui, appState.logEntries);
                            break;
                        } catch (altError) {
                            log(`Alternative RPC ${rpcToScan} for Chain ID ${chainId} also failed for scanning: ${altError.message}.`, 'warning', {}, ui, appState.logEntries);
                        }
                    }
                }
                await scanRecentBlocks(rpcToScan, chainId, appState, ui);
            }
            log('Pre-scanning complete.', 'info', {}, ui, appState.logEntries);
        }

        while (appState.isRunning && !appState.stopFlag) {
            if (appState.rpcConfigs.size === 0) {
                log('❌ No RPC endpoints configured. Stopping interaction.', 'error', {}, ui, appState.logEntries);
                appState.stopFlag = true;
                break;
            }

            const availableChainIds = Array.from(appState.rpcConfigs.keys());
            if (availableChainIds.length === 0) {
                log('❌ No active chains with RPCs. Stopping interaction.', 'error', {}, ui, appState.logEntries);
                appState.stopFlag = true;
                break;
            }

            const selectedChainId = availableChainIds[Math.floor(Math.random() * availableChainIds.length)];
            const rpcUrlsForChain = appState.rpcConfigs.get(selectedChainId);

            let provider = null;
            let currentRpcUrl = null;
            let rpcFound = false;

            for (const rpcEntry of rpcUrlsForChain) {
                const tempProvider = new ethers.JsonRpcProvider(rpcEntry.url);
                try {
                    await tempProvider.getBlockNumber();
                    provider = tempProvider;
                    currentRpcUrl = rpcEntry.url;
                    rpcFound = true;
                    log(`✅ Using RPC: ${currentRpcUrl} for Chain ID ${selectedChainId}`, 'info', {}, ui, appState.logEntries);
                    break;
                } catch (rpcError) {
                    log(`❌ RPC ${rpcEntry.url} for Chain ID ${selectedChainId} failed health check: ${rpcError.message}. Trying next.`, 'warning', {}, ui, appState.logEntries);
                }
            }

            if (!rpcFound) {
                log(`❌ All RPCs for Chain ID ${selectedChainId} failed. Skipping this chain for now.`, 'error', {}, ui, appState.logEntries);
                await sleep(appState.config.rpcSwitchDelay);
                continue;
            }

            if (appState.rpcConfigs.size > 1 && appState.config.rpcSwitchDelay > 0) {
                log(`Pausing for RPC switch delay (${appState.config.rpcSwitchDelay / 1000}s)...`, 'info', {}, ui, appState.logEntries);
                await sleep(appState.config.rpcSwitchDelay);
            }

            const walletInfoIndex = Math.floor(Math.random() * appState.wallets.length);
            const walletInfo = appState.wallets[walletInfoIndex];
            const walletAddress = walletInfo.address;
            let wallet = new ethers.Wallet(walletInfo.privateKey, provider);

            log(`🌐 Initiating session for Wallet ...${walletAddress.slice(-6)} on Chain ID ${selectedChainId} (${currentRpcUrl}). Persona: ${walletInfo.persona.name}`, 'info', { personaName: walletInfo.persona.name, userAgent: walletInfo.persona.userAgent }, ui, appState.logEntries);

            if (appState.wallets.length > 1 && appState.config.walletSwitchDelay > 0) {
                log(`Pausing for wallet switch delay (${appState.config.walletSwitchDelay / 1000}s)...`, 'info', {}, ui, appState.logEntries);
                await sleep(appState.config.walletSwitchDelay);
            }

            if (Math.random() * 100 < walletInfo.persona.behavior.idleChance * 100) {
                log(`Wallet ...${walletAddress.slice(-6)} is idling for this session on Chain ID ${selectedChainId} (Persona Idle).`, 'info', { chainId: selectedChainId, walletAddress, action: 'idle' }, ui, appState.logEntries);
                updateActionDistChart('idle', appState);
                const delay = Stealth.generateLogNormalDelay(appState.config.minDelay, appState.config.maxDelay, walletInfo.persona.behavior.delayFactor);
                await sleep(delay);
                continue;
            }

            try {
                const balanceWei = await wallet.provider.getBalance(walletAddress);
                if (balanceWei < ethers.parseEther("0.001")) {
                    log(`Skipping wallet ...${walletAddress.slice(-6)} on Chain ID ${selectedChainId} due to critically low balance (${ethers.formatEther(balanceWei)} ETH).`, 'warning', { chainId: selectedChainId, walletAddress, action: 'skipped' }, ui, appState.logEntries);
                    updateActionDistChart('skipped', appState);
                    const delay = Stealth.generateLogNormalDelay(appState.config.minDelay, appState.config.maxDelay, walletInfo.persona.behavior.delayFactor);
                    await sleep(delay);
                    continue;
                } else if (balanceWei < ethers.parseEther("0.005")) {
                     log(`Wallet ...${walletAddress.slice(-6)} on Chain ID ${selectedChainId} has low balance (${ethers.formatEther(balanceWei)} ETH).`, 'warning', { chainId: selectedChainId, walletAddress, action: 'info' }, ui, appState.logEntries);
                }
            } catch (balanceError) {
                log(`Failed to check balance for ...${walletAddress.slice(-6)} on Chain ID ${selectedChainId}: ${balanceError.message}. Skipping session.`, 'error', { chainId: selectedChainId, walletAddress, action: 'skipped' }, ui, appState.logEntries);
                updateActionDistChart('skipped', appState);
                const delay = Stealth.generateLogNormalDelay(appState.config.minDelay, appState.config.maxDelay, walletInfo.persona.behavior.delayFactor);
                await sleep(delay);
                continue;
            }

            let actionsForWallet;
            let currentSessionType = 'normal';
            if (Math.random() * 100 < appState.config.activityBurstChance) {
                actionsForWallet = Math.floor(Stealth.getRandomInRange(appState.config.minBurstActions, appState.config.maxBurstActions + 1));
                currentSessionType = 'burst';
                log(`Wallet ...${walletAddress.slice(-6)} entered an activity burst, performing ${actionsForWallet} actions.`, 'info', {}, ui, appState.logEntries);
            } else {
                actionsForWallet = Math.floor(Stealth.getRandomInRange(1, appState.config.maxTxnsPerWallet + 1));
            }
            log(`Wallet ...${walletAddress.slice(-6)} will perform ${actionsForWallet} action(s) on Chain ID ${selectedChainId}.`, 'info', {}, ui, appState.logEntries);


            for (let i = 1; i <= actionsForWallet; i++) {
                if (appState.stopFlag) break;

                appState.stats.totalActions++;
                ui.progressText.textContent = `${appState.stats.totalActions}`;
                ui.progressBar.style.width = `100%`;

                let currentGasPrice = null;
                let maxPriorityFeePerGas = null;
                let maxFeePerGas = null;

                try {
                    const feeData = await wallet.provider.getFeeData();
                    currentGasPrice = feeData.gasPrice;
                    maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
                    maxFeePerGas = feeData.maxFeePerGas;

                    ui.gasDisplay.textContent = `${(Number(ethers.formatUnits(currentGasPrice || maxFeePerGas, 'gwei'))).toFixed(2)} gwei`;

                    const thresholdGasPrice = currentGasPrice ? (currentGasPrice * BigInt(Math.round(appState.config.gasMultiplier * 100))) / BigInt(100) : null;
                    const thresholdMaxFeePerGas = maxFeePerGas ? (maxFeePerGas * BigInt(Math.round(appState.config.gasMultiplier * 100))) / BigInt(100) : null;

                    if ((currentGasPrice && thresholdGasPrice && currentGasPrice > thresholdGasPrice) ||
                        (maxFeePerGas && thresholdMaxFeePerGas && maxFeePerGas > thresholdMaxFeePerGas)) {
                        log(`Gas price (${(Number(ethers.formatUnits(currentGasPrice || maxFeePerGas, 'gwei'))).toFixed(2)} gwei) is too high. Skipping action for ...${walletAddress.slice(-6)} on Chain ID ${selectedChainId}.`, 'warning', { chainId: selectedChainId, walletAddress, action: 'skipped' }, ui, appState.logEntries);
                        updateActionDistChart('skipped', appState);
                        break;
                    }
                } catch (gasError) {
                    log(`Failed to get gas price for Chain ID ${selectedChainId}: ${gasError.message}. Proceeding without high gas check.`, 'warning', { chainId: selectedChainId, walletAddress, action: 'skipped' }, ui, appState.logEntries);
                }

                await maybeDummyCall(wallet.provider, appState, ui);
                if (appState.stopFlag) break;

                const chosenBehavior = chooseAction(walletInfo.sessionProbabilities);
                log(`[Action ${i}/${actionsForWallet}] Wallet ...${walletAddress.slice(-6)} chose to: ${chosenBehavior.toUpperCase()}`, 'info', { chainId: selectedChainId, walletAddress, action: chosenBehavior }, ui, appState.logEntries);

                let actionSuccess = false;
                let delayUsed = 0;

                switch (chosenBehavior) {
                    case "send":
                        let recipientAddress;
                        const currentChainRecipientPool = appState.currentRecipientPool[selectedChainId];

                        if (appState.config.recipientMode === 'fixed') {
                            recipientAddress = ui.fixedAddress.value.trim();
                            if (!ethers.isAddress(recipientAddress)) {
                                log(`Fixed recipient address "${recipientAddress}" is invalid. Skipping send.`, 'error', { chainId: selectedChainId, walletAddress, action: 'send' }, ui, appState.logEntries);
                                updateActionDistChart('skipped', appState);
                                break;
                            }
                        } else if (appState.config.recipientMode === 'list') {
                            if (appState.manualRecipientList.length === 0) {
                                log(`Recipient list is empty. Skipping send for wallet ...${walletAddress.slice(-6)}.`, 'warning', { chainId: selectedChainId, walletAddress, action: 'send' }, ui, appState.logEntries);
                                updateActionDistChart('skipped', appState);
                                break;
                            }
                            recipientAddress = appState.manualRecipientList[Math.floor(Math.random() * appState.manualRecipientList.length)];
                        }
                        else if (appState.config.recipientMode === 'predefined') {
                            if (appState.predefinedRecipientList.length === 0) {
                                log(`Predefined recipient list is empty. Skipping send for wallet ...${walletAddress.slice(-6)}.`, 'warning', { chainId: selectedChainId, walletAddress, action: 'send' }, ui, appState.logEntries);
                                updateActionDistChart('skipped', appState);
                                break;
                            }
                            recipientAddress = appState.predefinedRecipientList[Math.floor(Math.random() * appState.predefinedRecipientList.length)];
                        }
                        else if (appState.config.recipientMode === 'self-interact') {
                            const otherWallets = appState.wallets.filter(w => w.address.toLowerCase() !== walletAddress.toLowerCase());
                            if (otherWallets.length === 0) {
                                log(`No other loaded wallets to interact with. Skipping send for wallet ...${walletAddress.slice(-6)}.`, 'warning', { chainId: selectedChainId, walletAddress, action: 'send' }, ui, appState.logEntries);
                                updateActionDistChart('skipped', appState);
                                break;
                            }
                            recipientAddress = otherWallets[Math.floor(Math.random() * otherWallets.length)].address;
                            log(`Sending to another loaded wallet: ${recipientAddress.slice(0,6)}...${recipientAddress.slice(-4)}`, 'info', {}, ui, appState.logEntries);
                        }
                        else if (appState.config.recipientMode === 'pool') {
                            if (currentChainRecipientPool && currentChainRecipientPool.length > 0) {
                                recipientAddress = currentChainRecipientPool[Math.floor(Math.random() * currentChainRecipientPool.length)];
                            } else {
                                const otherWallets = appState.wallets.filter(w => w.address.toLowerCase() !== walletAddress.toLowerCase());
                                if (otherWallets.length > 0) {
                                    recipientAddress = otherWallets[Math.floor(Math.random() * otherWallets.length)].address;
                                    log(`Dynamic pool empty for Chain ID ${selectedChainId}. Falling back to sending to another loaded wallet: ${recipientAddress.slice(0,6)}...${recipientAddress.slice(-4)}`, 'info', {}, ui, appState.logEntries);
                                } else {
                                    log(`Dynamic pool empty and no other loaded wallets to interact with. Skipping send for wallet ...${walletAddress.slice(-6)}.`, 'warning', { chainId: selectedChainId, walletAddress, action: 'send' }, ui, appState.logEntries);
                                    updateActionDistChart('skipped', appState);
                                    break;
                                }
                            }
                        } else {
                            log(`No valid recipient selection for 'send' action. Skipping.`, 'warning', { chainId: selectedChainId, walletAddress, action: 'send' }, ui, appState.logEntries);
                            updateActionDistChart('skipped', appState);
                            break;
                        }

                        const amount = Stealth.getRandomInRange(appState.config.minAmount, appState.config.maxAmount);
                        const tx = {
                            to: recipientAddress,
                            value: ethers.parseEther(amount.toFixed(12))
                        };

                        const randomGasFactor = Stealth.getRandomInRange(appState.config.minGasFactor, appState.config.maxGasFactor);
                        if (maxFeePerGas && maxPriorityFeePerGas) {
                            tx.maxFeePerGas = (maxFeePerGas * BigInt(Math.round(randomGasFactor * 100))) / BigInt(100);
                            tx.maxPriorityFeePerGas = (maxPriorityFeePerGas * BigInt(Math.round(randomGasFactor * 100))) / BigInt(100);
                            if (tx.maxFeePerGas < tx.maxPriorityFeePerGas) {
                                tx.maxFeePerGas = tx.maxPriorityFeePerGas + ethers.parseUnits('1', 'gwei');
                            }
                        } else if (currentGasPrice) {
                            tx.gasPrice = (currentGasPrice * BigInt(Math.round(randomGasFactor * 100))) / BigInt(100);
                        }
                        log(`Attempting to send with random gas factor: x${randomGasFactor.toFixed(2)}`, 'info', {}, ui, appState.logEntries);

                        if (Math.random() * 100 < appState.config.simulatedErrorChance) {
                            log(`⚠️ Simulated network error (pre-send). Transaction will be skipped.`, 'warning', { chainId: selectedChainId, walletAddress }, ui, appState.logEntries);
                            actionSuccess = false;
                            updateActionDistChart('skipped', appState);
                            break;
                        }
                        const sendResult = await sendWithRetryOrSkip(wallet, tx, selectedChainId, randomGasFactor, appState, ui);
                        actionSuccess = sendResult.success;

                        if (actionSuccess) {
                            appState.stats.actionCounts.send++;
                            log(`✅ Transaction sent successfully to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)} with ${amount} ETH.`, 'success', {
                                chainId: selectedChainId,
                                walletAddress,
                                action: 'send',
                                gasFactorUsed: randomGasFactor.toFixed(2),
                                personaName: walletInfo.persona.name,
                                userAgent: walletInfo.persona.userAgent
                            }, ui, appState.logEntries);
                            updateActionDistChart('send', appState);
                        } else {
                            log(`❌ Transaction failed.`, 'error', { chainId: selectedChainId, walletAddress, action: 'send', personaName: walletInfo.persona.name, userAgent: walletInfo.persona.userAgent }, ui, appState.logEntries);
                            updateActionDistChart('skipped', appState);
                        }
                        break;

                    case "idle-action":
                        log(`Wallet ...${walletAddress.slice(-6)} is idling for this action.`, 'info', { chainId: selectedChainId, walletAddress, action: 'idle', personaName: walletInfo.persona.name, userAgent: walletInfo.persona.userAgent }, ui, appState.logEntries);
                        updateActionDistChart('idle', appState);
                        actionSuccess = true;
                        break;

                    case "balance-check":
                        try {
                            const currentBalanceWei = await wallet.provider.getBalance(walletAddress);
                            log(`Wallet ...${walletAddress.slice(-6)} checked balance: ${ethers.formatEther(currentBalanceWei).slice(0, 8)} ETH`, 'info', { chainId: selectedChainId, walletAddress, action: 'balance-check', personaName: walletInfo.persona.name, userAgent: walletInfo.persona.userAgent }, ui, appState.logEntries);
                            actionSuccess = true;
                        } catch (error) {
                            log(`Failed to check balance for ...${walletAddress.slice(-6)}: ${error.message}`, 'error', { chainId: selectedChainId, walletAddress, action: 'balance-check', personaName: walletInfo.persona.name, userAgent: walletInfo.persona.userAgent }, ui, appState.logEntries);
                        }
                        updateActionDistChart('balance-check', appState);
                        break;
                }

                if (actionSuccess) {
                    appState.stats.successfulActions++;
                } else {
                    const lastLog = appState.logEntries[appState.logEntries.length - 1];
                    if (!lastLog.Details.includes('skipped after max retries')) {
                        appState.stats.failedActions++;
                    }
                }
                ui.successCount.textContent = appState.stats.successfulActions.toString();
                ui.failCount.textContent = appState.stats.failedActions.toString();
                if(chosenBehavior !== 'send') updateActionDistChart(chosenBehavior, appState);

                try {
                    const newBalanceWei = await wallet.provider.getBalance(wallet.address);
                    walletInfo.balance = parseFloat(ethers.formatEther(newBalanceWei)).toFixed(6);
                    updateWalletBalanceChart(appState, ui);
                } catch (balanceUpdateError) {
                    log(`Failed to update balance for ...${walletInfo.address.slice(-6)}: ${balanceUpdateError.message}`, 'warning', {}, ui, appState.logEntries);
                }

                if (i < actionsForWallet && !appState.stopFlag) {
                    let currentMinDelay = appState.config.minDelay;
                    let currentMaxDelay = appState.config.maxDelay;

                    if (appState.config.enableTimeOfDayBias) {
                        const currentHour = new Date().getHours();
                        if (currentHour >= 1 && currentHour < 6) {
                            currentMinDelay *= (2 + walletInfo.persona.behavior.idleChance);
                            currentMaxDelay *= (2 + walletInfo.persona.behavior.idleChance);
                            log(`Applying time-of-day bias: increased delay due to night hours and persona.`, 'info', {}, ui, appState.logEntries);
                        }
                    }

                    if (Math.random() * 100 < appState.config.thinkTimeChance) {
                        delayUsed = Stealth.generateLogNormalDelay(appState.config.minThinkTime, appState.config.maxThinkTime, walletInfo.persona.behavior.delayFactor);
                        log(`Waiting for a human-like "think time" burst of ${Math.round(delayUsed/1000)} seconds...`, 'info', {}, ui, appState.logEntries);
                        appState.lastHumanLikeSpike = new Date().toLocaleTimeString();
                        ui.humanSpikeDisplay.textContent = appState.lastHumanLikeSpike;
                        await sleep(delayUsed);
                    } else {
                        delayUsed = Stealth.generateLogNormalDelay(currentMinDelay, currentMaxDelay, walletInfo.persona.behavior.delayFactor);
                        log(`Waiting for ${Math.round(delayUsed/1000)} seconds before next action...`, 'info', { delayUsedMs: delayUsed }, ui, appState.logEntries);
                        await sleep(delayUsed);
                    }
                }
            }

            if (appState.stopFlag) break;

            if (currentSessionType === 'burst' && appState.config.minLullTime > 0) {
                const lullDelay = Stealth.generateLogNormalDelay(appState.config.minLullTime, appState.config.maxLullTime, walletInfo.persona.behavior.delayFactor);
                log(`Activity burst completed. Entering lull period for ${Math.round(lullDelay/1000)} seconds...`, 'info', {}, ui, appState.logEntries);
                appState.lastHumanLikeSpike = new Date().toLocaleTimeString();
                ui.humanSpikeDisplay.textContent = appState.lastHumanLikeSpike;
                await sleep(lullDelay);
            } else {
                const sessionDelay = Stealth.generateLogNormalDelay(appState.config.minDelay, appState.config.maxDelay, walletInfo.persona.behavior.delayFactor);
                log(`Session for Wallet ...${walletAddress.slice(-6)} on Chain ID ${selectedChainId} completed. Waiting for ${Math.round(sessionDelay/1000)} seconds before next session...`, 'info', { delayUsedMs: sessionDelay }, ui, appState.logEntries);
                await sleep(sessionDelay);
            }

            if (Math.random() < 0.05) {
                ui.themeToggle.click();
                await sleep(500);
                ui.themeToggle.click();
                log('Performed a random theme toggle for UI interaction.', 'info', {}, ui, appState.logEntries);
            }
        }

        log('Interaction process finished.', 'success', {}, ui, appState.logEntries);
        stopInteraction(appState, ui);
    }, appState);
};

/**
 * Stops the blockchain interaction process.
 * @param {object} appState - The global application state.
 * @param {object} ui - The UI elements object.
 */
const stopInteraction = (appState, ui) => {
    appState.isRunning = false;
    appState.stopFlag = true;
    ui.startBtn.disabled = true;
    ui.stopBtn.disabled = true;
    ui.statusDisplay.textContent = 'Idle';
};

/**
 * Clears all configuration, loaded wallets, and log data.
 * @param {object} appState - The global application state.
 * @param {object} ui - The UI elements object.
 */
const clearAllData = (appState, ui) => {
    openConfirmationModal('Are you sure you want to clear ALL configurations, loaded wallets, and log data? This action cannot be undone.', (confirmed) => {
        if (confirmed) {
            appState.isRunning = false;
            appState.stopFlag = false;
            appState.wallets = [];
            appState.rpcConfigs = new Map();
            appState.currentRecipientPool = {};
            appState.manualRecipientList = [];
            ui.listAddresses.value = '';
            ui.listAddressesCount.textContent = '';
            appState.predefinedRecipientList = [];
            ui.predefinedFileInput.value = '';
            ui.predefinedAddressesInfo.textContent = 'No file loaded.';
            ui.predefinedAddressesDisplay.innerHTML = '<li>No predefined addresses loaded.</li>'; // Reset display
            appState.config = {};
            appState.stats = { totalActions: 0, successfulActions: 0, failedActions: 0, actionCounts: { send: 0, idle: 0, 'balance-check': 0, skipped: 0 } };
            appState.logEntries = [];
            appState.lastHumanLikeSpike = null;
            ui.humanSpikeDisplay.textContent = 'Never';

            ui.privateKeys.value = '';
            injectStealthDefaults(); // Re-inject defaults
            ui.stealthProfileSelector.value = "balanced";
            ui.personaModeSelector.value = "random";

            setUIEnabled(false, appState); // Pass appState
            initConsoleCharts(appState, ui);
            updateWalletBalanceChart(appState, ui);
        }
    }, appState);
};


document.addEventListener('DOMContentLoaded', () => {
    injectStealthDefaults(); // Apply default config on load
    initConsoleCharts(appState, ui); // Initialize charts
    ui.initQrCodeDisplay(); // Initialize QR code

    // Pass appState and UI to setupEventListeners
    ui.setupEventListeners(appState, startInteraction, stopInteraction, clearAllData);
    setUIEnabled(false, appState); // Disable UI until wallet is connected

    // Set initial active sidebar toggle
    ui.advanceConsoleToggle.classList.add('active');
    ui.advanceConsoleSubmenu.classList.add('open');

    // Initial wallet connection check on startup
    if (typeof window.ethereum !== 'undefined') {
         log('MetaMask or compatible wallet detected on startup. Checking for existing connection...', 'info', {}, ui, appState.logEntries);
         window.ethereum.request({ method: 'eth_accounts' })
            .then(accounts => {
                if (accounts.length > 0) {
                    appState.connectedAddress = accounts[0];
                    log(`Existing wallet connection found: ${appState.connectedAddress}`, 'info', {}, ui, appState.logEntries);
                    ui.walletStatusDisplay.innerHTML = `Connected: <strong>${appState.connectedAddress.slice(0, 6)}...${appState.connectedAddress.slice(-4)}</strong>`;
                    setUIEnabled(true, appState);
                } else {
                     ui.walletStatusDisplay.innerHTML = `No wallet connected.`;
                     log('No existing wallet connection found on startup.', 'info', {}, ui, appState.logEntries);
                     setUIEnabled(false, appState);
                }
            })
            .catch(error => {
                log(`Error checking existing wallet connection: ${error.message}`, 'error', {}, ui, appState.logEntries);
                 ui.walletStatusDisplay.innerHTML = `Error: ${error.message}`;
                 setUIEnabled(false, appState);
            });

         window.ethereum.on('accountsChanged', (newAccounts) => {
             log('Wallet accounts changed event detected (startup listener).', 'info', {}, ui, appState.logEntries);
             if (newAccounts.length === 0) {
                 log('Wallet disconnected or no accounts selected (startup listener).', 'warning', {}, ui, appState.logEntries);
                 appState.connectedAddress = null;
                 ui.walletStatusDisplay.innerHTML = `No wallet connected.`;
                 setUIEnabled(false, appState);
             } else {
                 log(`Account changed to: ${newAccounts[0]} (startup listener)`, 'info', {}, ui, appState.logEntries);
                 appState.connectedAddress = newAccounts[0];
                 ui.walletStatusDisplay.innerHTML = `Connected: <strong>${appState.connectedAddress.slice(0, 6)}...${appState.connectedAddress.slice(-4)}</strong>`;
                 setUIEnabled(true, appState);
             }
         });

         window.ethereum.on('chainChanged', (chainId) => {
             log(`Network changed to Chain ID: ${parseInt(chainId, 16)} (startup listener). Please ensure RPCs match.`, 'warning', {}, ui, appState.logEntries);
         });

         window.ethereum.on('disconnect', (error) => {
            log(`Wallet disconnected: ${error.message || 'Unknown error'} (startup listener)`, 'error', {}, ui, appState.logEntries);
            appState.connectedAddress = null;
            ui.walletStatusDisplay.innerHTML = `No wallet connected.`;
            setUIEnabled(false, appState);
        });

    } else {
        ui.walletStatusDisplay.innerHTML = `No wallet detected. Please install <a href="https://metamask.io/" target="_blank" class="underline text-blue-500">MetaMask</a>.`;
        log('MetaMask or compatible wallet not detected on startup.', 'error', {}, ui, appState.logEntries);
        setUIEnabled(false, appState);
    }

    log('Console initialized. Please connect your wallet to begin.', 'info', {}, ui, appState.logEntries);
});
