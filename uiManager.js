/**
 * uiManager.js
 *
 * This module is responsible for all user interface interactions,
 * including defining UI element references, managing modal windows,
 * logging messages to the console, updating charts, and setting up
 * all event listeners for the application.
 */

// Import necessary utilities
import { Stealth, setConfigValue, sleep } from './utils.js';

// Define UI elements once for efficient access
export const ui = {
    connectWalletBtn: null,
    walletStatusDisplay: null,
    walletFeatureControls: null,
    startBtn: null,
    stopBtn: null,
    clearAllDataBtn: null,
    maxTxnsPerWallet: null,
    walletIdleChance: null,
    minAmount: null,
    maxAmount: null,
    minDelay: null,
    maxDelay: null,
    gasMultiplier: null,
    maxRetries: null,
    minGasFactor: null,
    maxGasFactor: null,
    blockLookback: null,
    probJitterFactor: null,
    simulatedErrorChance: null,
    thinkTimeChance: null,
    minThinkTime: null,
    maxThinkTime: null,
    activityBurstChance: null,
    minBurstActions: null,
    maxBurstActions: null,
    minLullTime: null,
    maxLullTime: null,
    enableTimeOfDayBias: null,
    rpcSwitchDelay: null,
    walletSwitchDelay: null,
    rpcUrls: null,
    testRpcBtn: null,
    probSend: null,
    probIdleAction: null,
    probBalanceCheck: null,
    probSumWarning: null,
    privateKeys: null,
    loadKeysBtn: null,
    keysLoadedCount: null,
    walletListDisplay: null,
    noWalletsMsg: null,
    recipientMode: null,
    fixedAddressSection: null,
    fixedAddress: null,
    listAddressesSection: null,
    listAddresses: null,
    loadAddressesFromListBtn: null,
    listAddressesCount: null,
    predefinedAddressesSection: null,
    predefinedFileInput: null,
    loadPredefinedFileBtn: null,
    predefinedAddressesInfo: null,
    predefinedAddressesDisplay: null,
    predefinedAddressesCount: null,
    liveLog: null,
    downloadLogBtn: null,
    downloadLogCsvBtn: null,
    downloadLogJsonBtn: null,
    clearLogBtn: null,
    summarizeLogBtn: null,
    progressBar: null,
    progressText: null,
    statusDisplay: null,
    successCount: null,
    failCount: null,
    gasDisplay: null,
    walletBalanceChartCanvas: null,
    actionDistChartCanvas: null,
    explainSendTxBtn: null,
    geminiModal: null,
    modalTitle: null,
    modalContent: null,
    closeModalBtn: null,
    confirmationModal: null,
    confirmMessage: null,
    confirmActionBtn: null,
    cancelConfirmBtn: null,
    closeConfirmBtn: null,
    humanSpikeDisplay: null,
    stealthProfileSelector: null,
    advanceConsoleToggle: null,
    advanceConsoleSubmenu: null,
    themeToggle: null,
    themeToggleIcon: null,
    apiKeyInput: null,
    personaModeSelector: null,
};

// Function to initialize UI element references after DOM is loaded
export const initializeUI = () => {
    for (const key in ui) {
        ui[key] = document.getElementById(key) || document.querySelector(`[name="${key}"]`) || ui[key];
    }
    // Specific selections not by ID
    ui.walletFeatureControls = document.querySelectorAll('.wallet-feature-control');
    ui.recipientMode = document.getElementsByName('recipient-mode');
    ui.closeModalBtn = document.querySelector('#gemini-modal .close-button');
    ui.closeConfirmBtn = document.querySelector('#confirmation-modal .close-confirm-button');
};


/**
 * Enables or disables various UI elements based on the application state.
 * @param {boolean} enabled - True to enable, false to disable.
 * @param {object} appState - The main application state object.
 */
export const setUIEnabled = (enabled, appState) => {
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
        appState.wallets = [];
        updateWalletBalanceChart(appState);
        // Reset RPC URLs to include Sepolia by default
        ui.rpcUrls.value = `https://mainnet.infura.io/v3/YOUR_PROJECT_ID,1\nhttps://rpc.goerli.dev,5\nhttps://sepolia.infura.io/v3/YOUR_PROJECT_ID,11155111`;
        ui.probSend.value = "60";
        ui.probIdleAction.value = "20";
        ui.probBalanceCheck.value = "20";
        ui.stealthProfileSelector.value = "balanced";
        ui.personaModeSelector.value = "random"; // Reset persona mode
        // Note: injectStealthDefaults is now called directly in advance.html's DOMContentLoaded
    }
};

/**
 * Opens the Gemini explanation modal with a given title and content.
 * @param {string} title - The title for the modal.
 * @param {string} contentHtml - The HTML content to display inside the modal.
 */
export const openGeminiModal = (title, contentHtml) => {
    ui.modalTitle.textContent = title;
    ui.modalContent.innerHTML = contentHtml;
    ui.geminiModal.classList.remove('hidden');
};

/**
 * Closes the Gemini explanation modal and resets its content.
 */
export const closeGeminiModal = () => {
    ui.geminiModal.classList.add('hidden');
    ui.modalContent.innerHTML = '<div class="modal-loader"></div><p class="text-center mt-4">Generating explanation...</p>';
};

/**
 * Opens a confirmation modal with a message and a callback function.
 * @param {string} message - The message to display in the confirmation modal.
 * @param {Function} callback - The function to call when the user confirms or cancels.
 * @param {object} appState - The main application state object.
 */
export const openConfirmationModal = (message, callback, appState) => {
    ui.confirmMessage.textContent = message;
    appState.pendingConfirmation = callback;
    ui.confirmationModal.classList.remove('hidden');
};

/**
 * Closes the confirmation modal and clears the pending confirmation callback.
 * @param {object} appState - The main application state object.
 */
export const closeConfirmationModal = (appState) => {
    ui.confirmationModal.classList.add('hidden');
    appState.pendingConfirmation = null;
};

/**
 * Handles the confirmation action for the modal.
 * @param {object} appState - The main application state object.
 */
export const confirmAction = (appState) => {
    if (appState.pendingConfirmation) {
        appState.pendingConfirmation(true);
    }
    closeConfirmationModal(appState);
};

/**
 * Handles the cancellation action for the modal.
 * @param {object} appState - The main application state object.
 */
export const cancelAction = (appState) => {
    if (appState.pendingConfirmation) {
        appState.pendingConfirmation(false);
    }
    closeConfirmationModal(appState);
};


/**
 * Logs a message to the live log display and stores it for export.
 * @param {string} message - The message to log.
 * @param {string} [type='info'] - The type of log (info, success, error, warning, skipped).
 * @param {object} [actionData={}] - Additional data related to the action for logging.
 * @param {object} appState - The main application state object.
 */
export const log = (message, type = 'info', actionData = {}, appState) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntryDiv = document.createElement('div');
    logEntryDiv.innerHTML = `<span class="text-gray-500 mr-2">${timestamp}</span> <span class="log-${type}">${message}</span>`;
    ui.liveLog.appendChild(logEntryDiv);
    ui.liveLog.scrollTop = ui.liveLog.scrollHeight;

    appState.logEntries.push({
        Timestamp: new Date().toISOString(),
        ChainID: actionData.chainId || '',
        WalletAddress: actionData.walletAddress || '',
        Action: actionData.action || 'Log',
        Status: type.toUpperCase(),
        Details: message.replace(/<[^>]*>?/gm, '').replace(/,/g, ';'), // Remove HTML and escape commas
        DelayUsedMs: actionData.delayUsedMs || '',
        GasFactorUsed: actionData.gasFactorUsed || '',
        Persona: actionData.personaName || '',
        UserAgent: actionData.userAgent || '',
    });
};

/**
 * Initializes the Chart.js instances for wallet balances and action distribution.
 * @param {object} appState - The main application state object.
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
 * Updates the wallet balance chart and the wallet list display.
 * @param {object} appState - The main application state object.
 */
export const updateWalletBalanceChart = (appState) => {
    const chart = appState.charts.walletBalance;
    chart.data.labels = appState.wallets.map(w => `...${w.address.slice(-6)}`);
    chart.data.datasets[0].data = appState.wallets.map(w => w.balance);
    chart.update();

    if (appState.wallets.length > 0) {
        ui.noWalletsMsg.classList.add('hidden');
        ui.walletListDisplay.innerHTML = appState.wallets.map(w =>
            `<li>Wallet: ...${w.address.slice(-10)} | Balance: ${w.balance} ETH | Persona: ${w.persona.name}</li>`
        ).join('');
    } else {
        ui.noWalletsMsg.classList.remove('hidden');
        ui.walletListDisplay.innerHTML = '<li id="no-wallets-msg">No wallets loaded yet.</li>';
    }
};

/**
 * Updates the action distribution chart based on the action type.
 * @param {string} actionType - The type of action performed ('send', 'idle', 'balance-check', 'skipped').
 * @param {object} appState - The main application state object.
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
 * @param {object} appState - The main application state object.
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
 * Sets up all event listeners for the UI elements.
 * @param {object} appState - The main application state object.
 * @param {object} handlers - An object containing handler functions for various events.
 * - connectWallet: Function to handle wallet connection.
 * - startInteraction: Function to start blockchain interaction.
 * - stopInteraction: Function to stop blockchain interaction.
 * - clearAllData: Function to clear all application data.
 * - loadWallets: Function to load private keys.
 * - testRpcConnections: Function to test RPC connections.
 * - downloadLogCsv: Function to download log as CSV.
 * - downloadLogJson: Function to download log as JSON.
 * - clearLog: Function to clear the log.
 * - handleSummarizeLog: Function to summarize the log using Gemini.
 * - handleExplainSendTx: Function to explain send transaction using Gemini.
 * - loadConfiguration: Function to load/validate configuration.
 * - loadAddressesFromList: Function to load recipient addresses from list.
 * - loadPredefinedListFromFile: Function to load predefined addresses from file.
 * - applyProfile: Function to apply a stealth profile.
 * - getPersonaByMode: Function to get a persona based on mode.
 */
export const setupEventListeners = (appState, handlers) => {
    ui.connectWalletBtn.addEventListener('click', handlers.connectWallet);
    ui.startBtn.addEventListener('click', () => handlers.startInteraction(appState));
    ui.stopBtn.addEventListener('click', handlers.stopInteraction);
    ui.clearAllDataBtn.addEventListener('click', () => handlers.clearAllData(appState));
    ui.loadKeysBtn.addEventListener('click', () => handlers.loadWallets(appState));
    ui.testRpcBtn.addEventListener('click', () => handlers.testRpcConnections(appState));
    ui.downloadLogCsvBtn.addEventListener('click', () => handlers.downloadLogCsv(appState));
    ui.downloadLogJsonBtn.addEventListener('click', () => handlers.downloadLogJson(appState));
    ui.clearLogBtn.addEventListener('click', () => handlers.clearLog(appState));
    ui.summarizeLogBtn.addEventListener('click', () => handlers.handleSummarizeLog(appState));
    ui.explainSendTxBtn.addEventListener('click', () => handlers.handleExplainSendTx(appState));
    ui.loadAddressesFromListBtn.addEventListener('click', () => handlers.loadAddressesFromList(appState));
    ui.loadPredefinedFileBtn.addEventListener('click', () => handlers.loadPredefinedListFromFile(appState));

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
            handlers.loadConfiguration(appState);
        });
    });

    document.querySelectorAll('#prob-send, #prob-idle-action, #prob-balance-check').forEach(input => {
        input.addEventListener('input', () => handlers.loadConfiguration(appState));
    });

    // Add event listeners for all configuration inputs that trigger loadConfiguration
    const configInputs = [
        ui.maxTxnsPerWallet, ui.walletIdleChance, ui.minAmount, ui.maxAmount,
        ui.minDelay, ui.maxDelay, ui.gasMultiplier, ui.minGasFactor,
        ui.maxGasFactor, ui.blockLookback, ui.probJitterFactor,
        ui.simulatedErrorChance, ui.thinkTimeChance, ui.minThinkTime,
        ui.maxThinkTime, ui.activityBurstChance, ui.minBurstActions,
        ui.maxBurstActions, ui.minLullTime, ui.maxLullTime,
        ui.rpcSwitchDelay, ui.walletSwitchDelay, ui.apiKeyInput
    ];
    configInputs.forEach(input => {
        if (input) { // Check if element exists before adding listener
            input.addEventListener('input', () => handlers.loadConfiguration(appState));
        }
    });
    if (ui.enableTimeOfDayBias) {
        ui.enableTimeOfDayBias.addEventListener('change', () => handlers.loadConfiguration(appState));
    }
    if (ui.rpcUrls) {
        ui.rpcUrls.addEventListener('input', () => handlers.loadConfiguration(appState));
    }


    // Event listener for Stealth Profile Selector
    ui.stealthProfileSelector.addEventListener("change", (e) => {
        const selected = e.target.value;
        if (selected !== "custom") {
            handlers.applyProfile(selected, appState);
        } else {
            handlers.loadConfiguration(appState);
            log(`Switched to 'Manual Custom' profile. Current settings will be used.`, 'info', {}, appState);
        }
    });

    // Event listener for Persona Mode Selector
    ui.personaModeSelector.addEventListener("change", (e) => {
        handlers.loadConfiguration(appState); // Update config with new persona mode
        if (appState.wallets.length > 0) {
            log('Persona mode changed. Re-assigning personas to loaded wallets...', 'info', {}, appState);
            appState.wallets.forEach(wallet => {
                wallet.persona = handlers.getPersonaByMode(appState.config.personaMode);
                log(`🧍 Re-assigned persona for ...${wallet.address.slice(-6)}: ${wallet.persona.name} | delay ×${wallet.persona.behavior.delayFactor.toFixed(2)} | idle ${Math.round(wallet.persona.behavior.idleChance * 100)}%`, 'info', { personaName: wallet.persona.name, userAgent: wallet.persona.userAgent }, appState);
            });
            updateWalletBalanceChart(appState);
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
        initConsoleCharts(appState); // Re-initialize charts to apply new theme colors
        updateWalletBalanceChart(appState);
        updateActionDistChart('send', appState); // Pass a dummy action to trigger chart update
    });
};
