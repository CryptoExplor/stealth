// js/ui.js
import { Stealth } from './stealth.js'; // Import Stealth utilities for log-normal delay
import { loadConfiguration, applyProfile, stealthProfiles } from './config.js'; // Import config functions

// UI element references (global for easy access within this module)
export const ui = {
    connectWalletBtn: document.getElementById('connect-wallet-btn'),
    walletStatusDisplay: document.getElementById('wallet-status-display'),
    walletFeatureControls: document.querySelectorAll('.wallet-feature-control'),
    startBtn: document.getElementById('start-btn'),
    stopBtn: document.getElementById('stop-btn'),
    clearAllDataBtn: document.getElementById('clear-all-data-btn'),
    maxTxnsPerWallet: document.getElementById('max-txns-per-wallet'),
    walletIdleChance: document.getElementById('wallet-idle-chance'),
    minAmount: document.getElementById('min-amount'),
    maxAmount: document.getElementById('max-amount'),
    minDelay: document.getElementById('min-delay'),
    maxDelay: document.getElementById('max-delay'),
    gasMultiplier: document.getElementById('gas-multiplier'),
    maxRetries: document.getElementById('max-retries'),
    minGasFactor: document.getElementById('min-gas-factor'),
    maxGasFactor: document.getElementById('max-gas-factor'),
    blockLookback: document.getElementById('block-lookback'),
    probJitterFactor: document.getElementById('prob-jitter-factor'),
    simulatedErrorChance: document.getElementById('simulated-error-chance'),
    thinkTimeChance: document.getElementById('think-time-chance'),
    minThinkTime: document.getElementById('min-think-time'),
    maxThinkTime: document.getElementById('max-think-time'),
    activityBurstChance: document.getElementById('activity-burst-chance'),
    minBurstActions: document.getElementById('min-burst-actions'),
    maxBurstActions: document.getElementById('max-burst-actions'),
    minLullTime: document.getElementById('min-lull-time'),
    maxLullTime: document.getElementById('max-lull-time'),
    enableTimeOfDayBias: document.getElementById('enable-time-of-day-bias'),
    rpcSwitchDelay: document.getElementById('rpc-switch-delay'),
    walletSwitchDelay: document.getElementById('wallet-switch-delay'),
    rpcUrls: document.getElementById('rpc-urls'),
    testRpcBtn: document.getElementById('test-rpc-btn'),
    probSend: document.getElementById('prob-send'),
    probIdleAction: document.getElementById('prob-idle-action'),
    probBalanceCheck: document.getElementById('prob-balance-check'),
    probSumWarning: document.getElementById('prob-sum-warning'),
    privateKeys: document.getElementById('private-keys'),
    loadKeysBtn: document.getElementById('load-keys-btn'),
    keysLoadedCount: document.getElementById('keys-loaded-count'),
    walletListDisplay: document.getElementById('wallet-list-display'),
    noWalletsMsg: document.getElementById('no-wallets-msg'),
    recipientMode: document.getElementsByName('recipient-mode'),
    fixedAddressSection: document.getElementById('fixed-address-section'),
    fixedAddress: document.getElementById('fixed-address'),
    listAddressesSection: document.getElementById('list-addresses-section'),
    listAddresses: document.getElementById('list-addresses'),
    loadAddressesFromListBtn: document.getElementById('load-addresses-from-list-btn'),
    listAddressesCount: document.getElementById('list-addresses-count'),
    predefinedAddressesSection: document.getElementById('predefined-addresses-section'),
    predefinedFileInput: document.getElementById('predefined-file-input'),
    loadPredefinedFileBtn: document.getElementById('load-predefined-file-btn'),
    predefinedAddressesInfo: document.getElementById('predefined-addresses-info'),
    predefinedAddressesDisplay: document.getElementById('predefined-addresses-display'),
    predefinedAddressesCount: document.getElementById('predefined-addresses-count'),
    liveLog: document.getElementById('live-log'),
    downloadLogBtn: document.getElementById('download-log-btn'),
    downloadLogCsvBtn: document.getElementById('download-log-csv-btn'),
    downloadLogJsonBtn: document.getElementById('download-log-json-btn'),
    clearLogBtn: document.getElementById('clear-log-btn'),
    summarizeLogBtn: document.getElementById('summarize-log-btn'),
    progressBar: document.getElementById('progress-bar'),
    progressText: document.getElementById('progress-text'),
    statusDisplay: document.getElementById('status-display'),
    successCount: document.getElementById('success-count'),
    failCount: document.getElementById('fail-count'),
    gasDisplay: document.getElementById('gas-display'),
    walletBalanceChartCanvas: document.getElementById('wallet-balance-chart'),
    actionDistChartCanvas: document.getElementById('action-dist-chart'),
    explainSendTxBtn: document.getElementById('explain-send-tx-btn'),
    geminiModal: document.getElementById('gemini-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalContent: document.getElementById('modal-content'),
    closeModalBtn: document.querySelector('#gemini-modal .close-button'),
    confirmationModal: document.getElementById('confirmation-modal'),
    confirmMessage: document.getElementById('confirm-message'),
    confirmActionBtn: document.getElementById('confirm-action-btn'),
    cancelConfirmBtn: document.getElementById('cancel-confirm-btn'),
    closeConfirmBtn: document.querySelector('#confirmation-modal .close-confirm-button'),
    humanSpikeDisplay: document.getElementById('human-spike-display'),
    stealthProfileSelector: document.getElementById('stealth-profile'),
    advanceConsoleToggle: document.getElementById('advance-console-toggle'),
    advanceConsoleSubmenu: document.getElementById('advance-console-submenu'),
    themeToggle: document.getElementById('theme-toggle'),
    themeToggleIcon: document.getElementById('theme-toggle-icon'),
    apiKeyInput: document.getElementById('api-key-input'),
};

/**
 * Sets the enabled/disabled state of various UI elements based on wallet connection status.
 * @param {boolean} enabled - True to enable, false to disable.
 */
export const setUIEnabled = (enabled) => {
    ui.walletFeatureControls.forEach(control => {
        control.disabled = !enabled;
        if (control.type === 'radio' || control.type === 'checkbox') {
             control.parentElement.style.opacity = enabled ? '1' : '0.6';
             control.parentElement.style.cursor = enabled ? 'default' : 'not-allowed';
        }
    });
    ui.connectWalletBtn.disabled = false; // Always allow connecting wallet
    const selectedRecipientMode = Array.from(ui.recipientMode).find(r => r.checked)?.value;
    if (enabled) {
        ui.fixedAddressSection.classList.toggle('hidden', selectedRecipientMode !== 'fixed');
        ui.listAddressesSection.classList.toggle('hidden', selectedRecipientMode !== 'list');
        ui.predefinedAddressesSection.classList.toggle('hidden', selectedRecipientMode !== 'predefined');
    } else {
        ui.fixedAddressSection.classList.add('hidden');
        ui.listAddressesSection.classList.add('hidden');
        ui.predefinedAddressesSection.classList.add('hidden');
    }
    if (!enabled) {
        ui.privateKeys.value = '';
        ui.keysLoadedCount.textContent = '';
        // Note: appState.wallets clear is handled in clearAllData
        ui.rpcUrls.value = `https://mainnet.infura.io/v3/YOUR_PROJECT_ID,1\nhttps://rpc.goerli.dev,5`;
        ui.probSend.value = "60";
        ui.probIdleAction.value = "20";
        ui.probBalanceCheck.value = "20";
        ui.stealthProfileSelector.value = "balanced";
        // Note: injectStealthDefaults is called in main.js after UI setup
    }
};

/**
 * Opens the Gemini explanation modal.
 * @param {string} title - The title for the modal.
 * @param {string} contentHtml - The HTML content for the modal body.
 */
export const openGeminiModal = (title, contentHtml) => {
    ui.modalTitle.textContent = title;
    ui.modalContent.innerHTML = contentHtml;
    ui.geminiModal.classList.remove('hidden');
};

/**
 * Closes the Gemini explanation modal.
 */
export const closeGeminiModal = () => {
    ui.geminiModal.classList.add('hidden');
    ui.modalContent.innerHTML = '<div class="modal-loader"></div><p class="text-center mt-4">Generating explanation...</p>';
};

/**
 * Opens the confirmation modal.
 * @param {string} message - The message to display in the confirmation modal.
 * @param {function} callback - Callback function to execute after confirmation (receives boolean).
 * @param {object} appState - The global application state object.
 */
export const openConfirmationModal = (message, callback, appState) => {
    ui.confirmMessage.textContent = message;
    appState.pendingConfirmation = callback;
    ui.confirmationModal.classList.remove('hidden');
};

/**
 * Closes the confirmation modal.
 * @param {object} appState - The global application state object.
 */
export const closeConfirmationModal = (appState) => {
    ui.confirmationModal.classList.add('hidden');
    appState.pendingConfirmation = null;
};

/**
 * Confirms the pending action in the modal.
 * @param {object} appState - The global application state object.
 */
export const confirmAction = (appState) => {
    if (appState.pendingConfirmation) {
        appState.pendingConfirmation(true);
    }
    closeConfirmationModal(appState);
};

/**
 * Cancels the pending action in the modal.
 * @param {object} appState - The global application state object.
 */
export const cancelAction = (appState) => {
    if (appState.pendingConfirmation) {
        appState.pendingConfirmation(false);
    }
    closeConfirmationModal(appState);
};

/**
 * Logs a message to the live log display and stores it in appState.logEntries.
 * @param {string} message - The message to log.
 * @param {string} type - The type of log ('info', 'success', 'error', 'warning', 'skipped').
 * @param {object} [actionData={}] - Additional data for log entry (e.g., chainId, walletAddress).
 * @param {object} appState - The global application state object.
 */
export const log = (message, type = 'info', actionData = {}, appState) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntryDiv = document.createElement('div');
    logEntryDiv.innerHTML = `<span class="text-gray-500 mr-2">${timestamp}</span> <span class="log-${type}">${message}</span>`;
    ui.liveLog.appendChild(logEntryDiv);
    ui.liveLog.scrollTop = ui.liveLog.scrollHeight;

    if (appState) { // Only push to logEntries if appState is provided (not during initial UI setup logs)
        appState.logEntries.push({
            Timestamp: new Date().toISOString(),
            ChainID: actionData.chainId || '',
            WalletAddress: actionData.walletAddress || '',
            Action: actionData.action || 'Log',
            Status: type.toUpperCase(),
            Details: message.replace(/<[^>]*>?/gm, '').replace(/,/g, ';'), // Remove HTML and escape commas
            DelayUsedMs: actionData.delayUsedMs || '',
            GasFactorUsed: actionData.gasFactorUsed || '',
        });
    }
};

/**
 * Initializes the Chart.js instances for wallet balance and action distribution.
 * @param {object} appState - The global application state object.
 */
export const initConsoleCharts = (appState) => {
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-main') } } },
        scales: {
            x: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-accent') } },
            y: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-accent') } }
        }
    };

    if (appState.charts.walletBalance) {
        appState.charts.walletBalance.destroy();
    }
    appState.charts.walletBalance = new Chart(ui.walletBalanceChartCanvas, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'ETH Balance', data: [], backgroundColor: '#60a5fa', borderColor: '#3b82f6', borderWidth: 1 }] },
        options: { ...chartOptions, indexAxis: 'y' }
    });

    if (appState.charts.actionDist) {
        appState.charts.actionDist.destroy();
    }
    appState.charts.actionDist = new Chart(ui.actionDistChartCanvas, {
        type: 'doughnut',
        data: {
            labels: ['Send', 'Idle', 'Balance Check', 'Skipped'],
            datasets: [{
                label: 'Actions',
                data: [0, 0, 0, 0],
                backgroundColor: ['#3b82f6', '#a8a29e', '#f59e0b', '#ef4444'],
                borderColor: '#ffffff',
                borderWidth: 1
            }]
        },
        options: { ...chartOptions, scales: {} }
    });
};

/**
 * Updates the wallet balance chart with current wallet data.
 * @param {object} appState - The global application state object.
 */
export const updateWalletBalanceChart = (appState) => {
    const chart = appState.charts.walletBalance;
    chart.data.labels = appState.wallets.map(w => `...${w.address.slice(-6)}`);
    chart.data.datasets[0].data = appState.wallets.map(w => w.balance);
    chart.update();

    if (appState.wallets.length > 0) {
        ui.noWalletsMsg.classList.add('hidden');
        ui.walletListDisplay.innerHTML = appState.wallets.map(w =>
            `<li>Wallet: ...${w.address.slice(-10)} | Balance: ${w.balance} ETH</li>`
        ).join('');
    } else {
        ui.noWalletsMsg.classList.remove('hidden');
        ui.walletListDisplay.innerHTML = '<li id="no-wallets-msg">No wallets loaded yet.</li>';
    }
};

/**
 * Updates the action distribution chart for a specific action type.
 * @param {string} actionType - The type of action performed ('send', 'idle', 'balance-check', 'skipped').
 * @param {object} appState - The global application state object.
 */
export const updateActionDistChart = (actionType, appState) => {
    appState.stats.actionCounts[actionType]++;
    const chart = appState.charts.actionDist;
    const dataMap = {
        send: 0, idle: 1, 'balance-check': 2, skipped: 3
    };
    if (dataMap[actionType] !== undefined) {
        chart.data.datasets[0].data[dataMap[actionType]] = appState.stats.actionCounts[actionType];
        chart.update();
    }
};

/**
 * Copies text to the clipboard.
 * @param {string} text - The text to copy.
 * @param {object} appState - The global application state object.
 */
export const copyToClipboard = (text, appState) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        log(`Copied "${text}" to clipboard.`, 'info', {}, appState);
    } catch (err) {
        log('Failed to copy to clipboard (unsupported by browser/iframe).', 'error', {}, appState);
    }
    document.body.removeChild(textarea);
};

/**
 * Loads wallets from the private keys textarea and checks their balances.
 * @param {object} appState - The global application state object.
 * @param {ethers.JsonRpcProvider} ethers - The ethers.js library.
 */
export const loadWallets = async (appState, ethers) => {
    const keys = ui.privateKeys.value.split('\n').map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) {
        log('No private keys provided. Please paste private keys into the text area.', 'error', {}, appState);
        return;
    }
    if (appState.rpcConfigs.length === 0) {
        log('Please provide at least one RPC URL and Chain ID in Configuration.', 'error', {}, appState);
        return;
    }

    log(`Attempting to load ${keys.length} wallets and check balances...`, 'info', {}, appState);
    appState.wallets = [];
    ui.keysLoadedCount.textContent = `Loading 0 / ${keys.length}...`;

    const defaultProvider = new ethers.JsonRpcProvider(appState.rpcConfigs[0].url);
    const baseProbs = appState.config.probabilities;
    const jitterFactor = appState.config.probJitterFactor / 100; // Convert % to decimal

    for (let i = 0; i < keys.length; i++) {
        try {
            const wallet = new ethers.Wallet(keys[i], defaultProvider);
            const balanceWei = await defaultProvider.getBalance(wallet.address);
            const balanceEth = ethers.formatEther(balanceWei);

            // Calculate per-wallet probabilities with jitter
            let sendJitter = Stealth.getRandomInRange(-jitterFactor, jitterFactor) * baseProbs.send;
            let idleJitter = Stealth.getRandomInRange(-jitterFactor, jitterFactor) * baseProbs.idle;
            let balanceCheckJitter = Stealth.getRandomInRange(-jitterFactor, jitterFactor) * baseProbs['balance-check'];

            let currentSend = Math.max(0, baseProbs.send + sendJitter);
            let currentIdle = Math.max(0, baseProbs.idle + idleJitter);
            let currentBalanceCheck = Math.max(0, baseProbs['balance-check'] + balanceCheckJitter);

            // Normalize probabilities to sum to 100
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
                sessionProbabilities: walletSessionProbs // Store per-wallet probabilities
            });
            ui.keysLoadedCount.textContent = `Loaded ${i + 1} / ${keys.length} wallets.`;
        } catch (error) {
            log(`Failed to load key #${i+1}: Invalid key or RPC issue - ${error.message}`, 'error', {}, appState);
        }
    }

    log(`Successfully loaded ${appState.wallets.length} wallets and their balances.`, 'success', {}, appState);
    ui.keysLoadedCount.textContent = `Loaded ${appState.wallets.length} wallets.`;
    updateWalletBalanceChart(appState);
};

/**
 * Loads recipient addresses from the custom list textarea.
 * @param {object} appState - The global application state object.
 * @param {ethers.JsonRpcProvider} ethers - The ethers.js library.
 */
export const loadAddressesFromList = (appState, ethers) => {
    const addressesInput = ui.listAddresses.value.split('\n').map(addr => addr.trim()).filter(Boolean);
    const validAddresses = [];
    let invalidCount = 0;

    addressesInput.forEach(addr => {
        if (ethers.isAddress(addr)) {
            validAddresses.push(addr);
        } else {
            invalidCount++;
            log(`Invalid address in list: "${addr}"`, 'warning', {}, appState);
        }
    });

    appState.manualRecipientList = validAddresses;
    ui.listAddressesCount.textContent = `Loaded ${validAddresses.length} valid addresses. ${invalidCount > 0 ? `(${invalidCount} invalid ignored)` : ''}`;
    if (validAddresses.length > 0) {
        log(`Successfully loaded ${validAddresses.length} recipient addresses from list.`, 'success', {}, appState);
    } else {
        log('No valid addresses loaded from list.', 'warning', {}, appState);
    }
};

/**
 * Loads predefined recipient addresses from a CSV file.
 * @param {object} appState - The global application state object.
 * @param {ethers.JsonRpcProvider} ethers - The ethers.js library.
 */
export const loadPredefinedListFromFile = (appState, ethers) => {
    const file = ui.predefinedFileInput.files[0];
    if (!file) {
        log('No file selected for predefined list.', 'warning', {}, appState);
        ui.predefinedAddressesInfo.textContent = 'No file loaded.';
        ui.predefinedAddressesCount.textContent = '';
        appState.predefinedRecipientList = [];
        updatePredefinedAddressesDisplay(appState);
        return;
    }

    ui.predefinedAddressesInfo.textContent = `Loading file: ${file.name}...`;
    log(`Attempting to load predefined addresses from ${file.name}...`, 'info', {}, appState);

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
                log(`Invalid address in predefined file: "${addr}"`, 'warning', {}, appState);
            }
        });

        appState.predefinedRecipientList = validAddresses;
        ui.predefinedAddressesInfo.textContent = `File loaded: ${file.name}`;
        ui.predefinedAddressesCount.textContent = `List contains ${validAddresses.length} valid addresses. ${invalidCount > 0 ? `(${invalidCount} invalid ignored)` : ''}`;
        if (validAddresses.length > 0) {
            log(`Successfully loaded ${validAddresses.length} addresses from "${file.name}".`, 'success', {}, appState);
        } else {
            log(`No valid addresses found in "${file.name}".`, 'warning', {}, appState);
        }
        updatePredefinedAddressesDisplay(appState);
    };

    reader.onerror = (e) => {
        log(`Error reading file: ${e.target.error.name}`, 'error', {}, appState);
        ui.predefinedAddressesInfo.textContent = 'Error loading file.';
        ui.predefinedAddressesCount.textContent = '';
        appState.predefinedRecipientList = [];
        updatePredefinedAddressesDisplay(appState);
    };

    reader.readAsText(file);
};

/**
 * Updates the display of predefined addresses.
 * @param {object} appState - The global application state object.
 */
export const updatePredefinedAddressesDisplay = (appState) => {
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
 * Calls the Gemini API to get an explanation.
 * @param {string} prompt - The prompt for the Gemini API.
 * @param {object} appState - The global application state object.
 */
export async function callGeminiApi(prompt, appState) {
    log('Calling Gemini API for explanation...', 'info', {}, appState);
    openGeminiModal('Getting Explanation...', '<div class="modal-loader"></div><p class="text-center mt-4">Generating explanation...</p>');
    const apiKey = ui.apiKeyInput.value.trim() || "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }]
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const explanation = result.candidates[0].content.parts[0].text;
            ui.modalTitle.textContent = "Gemini Explanation";
            ui.modalContent.innerHTML = `<p>${explanation.replace(/\n/g, '<br>')}</p>`;
            return explanation;
        } else {
            ui.modalTitle.textContent = "Gemini Explanation Error";
            ui.modalContent.innerHTML = `<p class="text-red-500">No explanation generated. The model might have been unable to process the request or returned an unexpected format.</p>`;
            return "No explanation generated.";
        }
    } catch (error) {
        console.error("Gemini API call failed:", error);
        ui.modalTitle.textContent = "Gemini API Error";
        ui.modalContent.innerHTML = `<p class="text-red-500">Failed to get explanation: ${error.message}. Please check your network connection or try again later.</p>`;
        return `Failed to get explanation: ${error.message}.`;
    }
}

/**
 * Handles the "Explain Send Tx" button click, generating a prompt for Gemini.
 * @param {object} appState - The global application state object.
 */
export const handleExplainSendTx = async (appState) => {
    const minAmount = ui.minAmount.value;
    const maxAmount = ui.maxAmount.value;
    const recipientMode = Array.from(ui.recipientMode).find(r => r.checked).value;
    const fixedAddress = ui.fixedAddress.value.trim();
    const listAddressCount = appState.manualRecipientList.length;
    const predefinedAddressCount = appState.predefinedRecipientList.length;
    const loadedWalletCount = appState.wallets.length;

    let recipientDescription = '';
    if (recipientMode === 'fixed' && fixedAddress) {
        recipientDescription = `a fixed address (${fixedAddress.substring(0, 6)}...)`;
    } else if (recipientMode === 'list' && listAddressCount > 0) {
        recipientDescription = `a random address from a custom list of ${listAddressCount} addresses`;
    } else if (recipientMode === 'predefined' && predefinedAddressCount > 0) {
        recipientDescription = `a random address from a predefined list of ${predefinedAddressCount} addresses`;
    } else if (recipientMode === 'self-interact' && loadedWalletCount > 1) {
        recipientDescription = `a random address from the other ${loadedWalletCount - 1} loaded wallets (excluding the sender)`;
    }
    else {
        recipientDescription = 'a random address from a dynamically scanned pool (with fallback to loaded wallets if no external addresses are found)';
    }

    const prompt = `I am setting up a script to send Ethereum. The amount will be between ${minAmount} and ${maxAmount} ETH. The recipient will be ${recipientDescription}. Explain the typical purpose of such transactions in a blockchain context and any general risks a user should be aware of.`;
    await callGeminiApi(prompt, appState);
};

/**
 * Handles the "Summarize Log" button click, generating a prompt for Gemini.
 * @param {object} appState - The global application state object.
 */
export const handleSummarizeLog = async (appState) => {
    if (appState.logEntries.length === 0) {
        openGeminiModal('No Log Data', '<p class="text-accent">There are no log entries to summarize yet. Start Interaction to generate logs!</p>');
        return;
    }

    const recentLogEntries = appState.logEntries.slice(-100); // Summarize last 100 entries
    const formattedLog = recentLogEntries.map(entry => {
        return `${entry.Timestamp} [${entry.Status}] ${entry.Action} - ${entry.Details}`;
    }).join('\n');

    const prompt = `Please summarize the following blockchain transaction log. Identify key events, common patterns (e.g., successful transactions, repeated errors), and any notable observations. If there are errors, categorize them if possible.
    --- Log Data ---
    ${formattedLog}
    --- End Log Data ---
    Provide a concise summary and any insights you can derive.`;

    await callGeminiApi(prompt, appState);
};

/**
 * Downloads the log data as a CSV file.
 * @param {object} appState - The global application state object.
 */
export const downloadLogCsv = (appState) => {
    if (appState.logEntries.length === 0) {
        openGeminiModal('No Data', '<p class="text-accent">No log data to download.</p>');
        return;
    }

    const headers = Object.keys(appState.logEntries[0]).join(',');
    const rows = appState.logEntries.map(entry =>
        Object.values(entry).map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')
    );

    const csvContent = headers + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tx_log_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    log('Log downloaded as CSV.', 'info', {}, appState);
};

/**
 * Downloads the log data as a JSON file.
 * @param {object} appState - The global application state object.
 */
export const downloadLogJson = (appState) => {
    if (appState.logEntries.length === 0) {
        openGeminiModal('No Data', '<p class="text-accent">No log data to download.</p>');
        return;
    }

    const jsonContent = JSON.stringify(appState.logEntries, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tx_log_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    log('Log downloaded as JSON.', 'info', {}, appState);
};

/**
 * Clears the live log display and appState.logEntries.
 * @param {object} appState - The global application state object.
 */
export const clearLog = (appState) => {
    openConfirmationModal('Are you sure you want to clear the live log? This will remove all displayed and stored log entries.', (confirmed) => {
        if (confirmed) {
            ui.liveLog.innerHTML = '';
            appState.logEntries = [];
            log('Live log cleared.', 'info', {}, appState);
        }
    }, appState);
};

/**
 * Connects to the user's MetaMask or compatible wallet.
 * @param {object} appState - The global application state object.
 * @param {function} setUIEnabled - Function to enable/disable UI elements.
 */
export const connectWallet = async (appState, setUIEnabled) => {
    if (typeof window.ethereum === 'undefined') {
        log('MetaMask or compatible wallet not detected. Please install one.', 'error', {}, appState);
        ui.walletStatusDisplay.innerHTML = `No wallet detected. Please install <a href="https://metamask.io/" target="_blank" class="underline text-blue-500">MetaMask</a> or a compatible browser extension.`;
        setUIEnabled(false);
        return;
    }

    log('window.ethereum detected. Requesting accounts...', 'info', {}, appState);
    ui.walletStatusDisplay.innerHTML = 'Connecting... (Check your wallet extension for a pop-up)';
    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

        if (accounts.length === 0) {
            log('No accounts found. Please connect your wallet and select an account.', 'error', {}, appState);
            appState.connectedAddress = null;
            ui.walletStatusDisplay.innerHTML = `No wallet connected.`;
            setUIEnabled(false);
            return;
        }
        appState.connectedAddress = accounts[0];
        log(`Wallet connected: ${appState.connectedAddress}`, 'success', {}, appState);
        ui.walletStatusDisplay.innerHTML = `Connected: <strong>${appState.connectedAddress.slice(0, 6)}...${appState.connectedAddress.slice(-4)}</strong>`;
        setUIEnabled(true);

        window.ethereum.on('accountsChanged', (newAccounts) => {
            log('Wallet accounts changed event detected.', 'info', {}, appState);
            if (newAccounts.length === 0) {
                log('Wallet disconnected or no accounts selected.', 'warning', {}, appState);
                appState.connectedAddress = null;
                ui.walletStatusDisplay.innerHTML = `No wallet connected.`;
                setUIEnabled(false);
            } else if (appState.connectedAddress && newAccounts[0].toLowerCase() !== appState.connectedAddress.toLowerCase()) {
                log(`Account changed to: ${newAccounts[0]}`, 'info', {}, appState);
                appState.connectedAddress = newAccounts[0];
                ui.walletStatusDisplay.innerHTML = `Connected: <strong>${appState.connectedAddress.slice(0, 6)}...${appState.connectedAddress.slice(-4)}</strong>`;
                setUIEnabled(true);
            } else if (!appState.connectedAddress) {
                log(`Wallet reconnected with account: ${newAccounts[0]}`, 'info', {}, appState);
                appState.connectedAddress = newAccounts[0];
                ui.walletStatusDisplay.innerHTML = `Connected: <strong>${appState.connectedAddress.slice(0, 6)}...${appState.connectedAddress.slice(-4)}</strong>`;
                setUIEnabled(true);
            }
        });

        window.ethereum.on('chainChanged', (chainId) => {
            log(`Network changed to Chain ID: ${parseInt(chainId, 16)}. Please ensure your RPC configurations match this network.`, 'warning', {}, appState);
        });

        window.ethereum.on('disconnect', (error) => {
            log(`Wallet disconnected: ${error.message || 'Unknown error'}`, 'error', {}, appState);
            appState.connectedAddress = null;
            ui.walletStatusDisplay.innerHTML = `No wallet connected.`;
            setUIEnabled(false);
        });

    } catch (error) {
        log(`Wallet connection failed: ${error.message}`, 'error', {}, appState);
        appState.connectedAddress = null;
        ui.walletStatusDisplay.innerHTML = `Connection failed.`;
        setUIEnabled(false);
    }
};

/**
 * Sets up all event listeners for UI interactions.
 * @param {object} appState - The global application state object.
 * @param {function} startInteraction - Function to start the interaction loop.
 * @param {function} stopInteraction - Function to stop the interaction loop.
 * @param {function} clearAllData - Function to clear all data.
 * @param {function} testRpcConnections - Function to test RPC connections.
 * @param {ethers.JsonRpcProvider} ethers - The ethers.js library.
 */
export const setupEventListeners = (appState, startInteraction, stopInteraction, clearAllData, testRpcConnections, ethers) => {
    ui.connectWalletBtn.addEventListener('click', () => connectWallet(appState, setUIEnabled));
    ui.startBtn.addEventListener('click', () => startInteraction(appState, ethers));
    ui.stopBtn.addEventListener('click', () => stopInteraction(appState));
    ui.clearAllDataBtn.addEventListener('click', () => clearAllData(appState));
    ui.loadKeysBtn.addEventListener('click', () => loadWallets(appState, ethers));
    ui.testRpcBtn.addEventListener('click', () => testRpcConnections(appState, () => loadConfiguration(appState, ui, log), ethers));
    ui.downloadLogCsvBtn.addEventListener('click', () => downloadLogCsv(appState));
    ui.downloadLogJsonBtn.addEventListener('click', () => downloadLogJson(appState));
    ui.clearLogBtn.addEventListener('click', () => clearLog(appState));
    ui.summarizeLogBtn.addEventListener('click', () => handleSummarizeLog(appState));
    ui.explainSendTxBtn.addEventListener('click', () => handleExplainSendTx(appState));
    ui.loadAddressesFromListBtn.addEventListener('click', () => loadAddressesFromList(appState, ethers));
    ui.loadPredefinedFileBtn.addEventListener('click', () => loadPredefinedListFromFile(appState, ethers));

    ui.closeModalBtn.addEventListener('click', closeGeminiModal);
    window.addEventListener('click', (event) => {
        if (event.target === ui.geminiModal) {
            closeGeminiModal();
        }
    });

    ui.confirmActionBtn.addEventListener('click', () => confirmAction(appState));
    ui.cancelConfirmBtn.addEventListener('click', () => cancelAction(appState));
    ui.closeConfirmBtn.addEventListener('click', () => cancelAction(appState));
    window.addEventListener('click', (event) => {
        if (event.target === ui.confirmationModal) {
            cancelAction(appState);
        }
    });

    ui.liveLog.addEventListener('click', (event) => {
        const copyBtn = event.target.closest('.log-copy-btn');
        if (copyBtn && copyBtn.dataset.txHash) {
            copyToClipboard(copyBtn.dataset.txHash, appState);
        }
    });

    ui.recipientMode.forEach(radio => {
        radio.addEventListener('change', (e) => {
            ui.fixedAddressSection.classList.toggle('hidden', e.target.value !== 'fixed');
            ui.listAddressesSection.classList.toggle('hidden', e.target.value !== 'list');
            ui.predefinedAddressesSection.classList.toggle('hidden', e.target.value !== 'predefined');
            loadConfiguration(appState, ui, log);
        });
    });

    document.querySelectorAll('#prob-send, #prob-idle-action, #prob-balance-check').forEach(input => {
        input.addEventListener('input', () => loadConfiguration(appState, ui, log));
    });

    ui.minAmount.addEventListener('input', () => loadConfiguration(appState, ui, log));
    ui.maxAmount.addEventListener('input', () => loadConfiguration(appState, ui, log));
    ui.minDelay.addEventListener('input', () => loadConfiguration(appState, ui, log));
    ui.maxDelay.addEventListener('input', () => loadConfiguration(appState, ui, log));
    ui.gasMultiplier.addEventListener('input', () => loadConfiguration(appState, ui, log));
    ui.minGasFactor.addEventListener('input', () => loadConfiguration(appState, ui, log));
    ui.maxGasFactor.addEventListener('input', () => loadConfiguration(appState, ui, log));
    ui.blockLookback.addEventListener('input', () => loadConfiguration(appState, ui, log));
    ui.probJitterFactor.addEventListener('input', () => loadConfiguration(appState, ui, log));
    ui.simulatedErrorChance.addEventListener('input', () => loadConfiguration(appState, ui, log));
    ui.thinkTimeChance.addEventListener('input', () => loadConfiguration(appState, ui, log));
    ui.minThinkTime.addEventListener('input', () => loadConfiguration(appState, ui, log));
    ui.maxThinkTime.addEventListener('input', () => loadConfiguration(appState, ui, log));
    ui.activityBurstChance.addEventListener('input', () => loadConfiguration(appState, ui, log));
    ui.minBurstActions.addEventListener('input', () => loadConfiguration(appState, ui, log));
    ui.maxBurstActions.addEventListener('input', () => loadConfiguration(appState, ui, log));
    ui.minLullTime.addEventListener('input', () => loadConfiguration(appState, ui, log));
    ui.maxLullTime.addEventListener('input', () => loadConfiguration(appState, ui, log));
    ui.enableTimeOfDayBias.addEventListener('change', () => loadConfiguration(appState, ui, log));
    ui.rpcSwitchDelay.addEventListener('input', () => loadConfiguration(appState, ui, log));
    ui.walletSwitchDelay.addEventListener('input', () => loadConfiguration(appState, ui, log));
    ui.apiKeyInput.addEventListener('input', () => loadConfiguration(appState, ui, log));

    ui.stealthProfileSelector.addEventListener("change", (e) => {
        const selected = e.target.value;
        if (selected !== "custom") {
            applyProfile(selected, ui, log, () => loadConfiguration(appState, ui, log));
        } else {
            loadConfiguration(appState, ui, log);
            log(`Switched to 'Manual Custom' profile. Current settings will be used.`, 'info', {}, appState);
        }
    });
    
    ui.advanceConsoleToggle.addEventListener('click', () => {
        ui.advanceConsoleToggle.classList.toggle('active');
        ui.advanceConsoleSubmenu.classList.toggle('open');
    });

    document.querySelectorAll('#sidebar .nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            if (this.getAttribute('href') && !this.getAttribute('href').startsWith('#')) {
                return;
            }
            e.preventDefault();
            
            document.querySelectorAll('#sidebar .nav-link, #sidebar .submenu-toggle').forEach(el => el.classList.remove('active'));
            
            const parentSubmenu = this.closest('.submenu');
            if (parentSubmenu) {
                parentSubmenu.previousElementSibling.classList.add('active');
            } else {
                 this.classList.add('active');
            }
            
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    ui.themeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        const isDarkMode = document.documentElement.classList.contains('dark');
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        ui.themeToggleIcon.classList.toggle('fa-sun', isDarkMode);
        ui.themeToggleIcon.classList.toggle('fa-moon', !isDarkMode);
        initConsoleCharts(appState);
        updateWalletBalanceChart(appState);
        updateActionDistChart('send', appState); // Trigger a dummy update to refresh colors
    });

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
        ui.themeToggleIcon.classList.add('fa-sun');
        ui.themeToggleIcon.classList.remove('fa-moon');
    } else {
        document.documentElement.classList.remove('dark');
        ui.themeToggleIcon.classList.add('fa-moon');
        ui.themeToggleIcon.classList.remove('fa-sun');
    }

    // Footer QR code and copy functionality
    const donationAddressStr = '0x1C46ccEA4D62d3eEC4DCE3501aa96d0Ff5FcA954';
    const copyBtn = document.getElementById('copy-address-btn');
    const copyIcon = document.getElementById('copy-icon');
    const checkIcon = document.getElementById('check-icon');
    checkIcon.classList.add('hidden');
    const showQrBtn = document.getElementById('show-qr-btn');
    const qrModal = document.getElementById('qr-code-modal');
    const closeQrModalBtn = qrModal.querySelector('.close-qr-button');
    const qrCodeContainer = document.getElementById('qr-code-container');
    const qrAddressDisplay = document.getElementById('qr-address-display');

    if(typeof QRCode !== 'undefined') {
        new QRCode(qrCodeContainer, {
            text: donationAddressStr,
            width: 200,
            height: 200,
            colorDark : "#2d3748",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
        qrAddressDisplay.textContent = donationAddressStr;
    } else {
        console.error("QRCode library is not loaded.")
        qrCodeContainer.innerHTML = "QR Code library failed to load. Please check your connection.";
    }

    copyBtn.addEventListener('click', () => {
        copyToClipboard(donationAddressStr, appState);
        copyIcon.classList.add('hidden');
        checkIcon.classList.remove('hidden');
        setTimeout(() => {
            copyIcon.classList.remove('hidden');
            checkIcon.classList.add('hidden');
        }, 2000);
    });

    showQrBtn.addEventListener('click', () => {
        qrModal.classList.remove('hidden');
    });

    const closeQrModal = () => {
        qrModal.classList.add('hidden');
    }
    closeQrModalBtn.addEventListener('click', closeQrModal);
    window.addEventListener('click', (event) => {
        if (event.target === qrModal) {
            closeQrModal();
        }
    });
};
