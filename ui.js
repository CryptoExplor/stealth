// ui.js

import { copyToClipboard, log } from './utils.js';
import { connectWallet, loadWallets, testRpcConnections, loadAddressesFromList, loadPredefinedListFromFile } from './wallet.js';
import { initConsoleCharts, updateWalletBalanceChart, updateActionDistChart } from './charts.js';
import { loadConfiguration, applyProfile, injectStealthDefaults } from './config.js';
import { WalletPersonaManager } from './walletPersonaManager.js';

// Centralized UI elements for easier access
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
    personaModeSelector: document.getElementById('persona-mode'),
    donationAddress: '0x1C46ccEA4D62d3eEC4DCE3501aa96d0Ff5FcA954',
    copyAddressBtn: document.getElementById('copy-address-btn'),
    copyIcon: document.getElementById('copy-icon'),
    checkIcon: document.getElementById('check-icon'),
    showQrBtn: document.getElementById('show-qr-btn'),
    qrCodeModal: document.getElementById('qr-code-modal'),
    closeQrModalBtn: document.querySelector('#qr-code-modal .close-qr-button'),
    qrCodeContainer: document.getElementById('qr-code-container'),
    qrAddressDisplay: document.getElementById('qr-address-display'),
};

/**
 * Enables or disables UI elements based on connection status.
 * @param {boolean} enabled - True to enable, false to disable.
 * @param {object} appState - The global application state.
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
        updateWalletBalanceChart(appState, ui);
        ui.rpcUrls.value = `https://mainnet.infura.io/v3/YOUR_PROJECT_ID,1\nhttps://rpc.goerli.dev,5\nhttps://sepolia.infura.io/v3/YOUR_PROJECT_ID,11155111`;
        ui.probSend.value = "60";
        ui.probIdleAction.value = "20";
        ui.probBalanceCheck.value = "20";
        ui.stealthProfileSelector.value = "balanced";
        ui.personaModeSelector.value = "random";
        injectStealthDefaults();
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
 * @param {string} message - The confirmation message.
 * @param {function} callback - The callback function to execute on confirmation.
 * @param {object} appState - The global application state.
 */
export const openConfirmationModal = (message, callback, appState) => {
    ui.confirmMessage.textContent = message;
    appState.pendingConfirmation = callback;
    ui.confirmationModal.classList.remove('hidden');
};

/**
 * Closes the confirmation modal.
 * @param {object} appState - The global application state.
 */
export const closeConfirmationModal = (appState) => {
    ui.confirmationModal.classList.add('hidden');
    appState.pendingConfirmation = null;
};

/**
 * Handles the confirmation action for the modal.
 * @param {object} appState - The global application state.
 */
export const confirmAction = (appState) => {
    if (appState.pendingConfirmation) {
        appState.pendingConfirmation(true);
    }
    closeConfirmationModal(appState);
};

/**
 * Handles the cancellation action for the modal.
 * @param {object} appState - The global application state.
 */
export const cancelAction = (appState) => {
    if (appState.pendingConfirmation) {
        appState.pendingConfirmation(false);
    }
    closeConfirmationModal(appState);
};

/**
 * Calls the Gemini API to get an explanation or summary.
 * @param {string} prompt - The prompt to send to the Gemini API.
 * @param {object} appState - The global application state.
 */
export async function callGeminiApi(prompt, appState) {
    log('Calling Gemini API for explanation...', 'info', {}, ui, appState.logEntries);
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
 * Handles the "Explain Send Tx" button click, generating a Gemini explanation.
 * @param {object} appState - The global application state.
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
 * Handles the "Summarize Log" button click, generating a Gemini summary of recent logs.
 * @param {object} appState - The global application state.
 */
export const handleSummarizeLog = async (appState) => {
    if (appState.logEntries.length === 0) {
        openGeminiModal('No Log Data', '<p class="text-accent">There are no log entries to summarize yet. Start Interaction to generate logs!</p>');
        return;
    }

    const recentLogEntries = appState.logEntries.slice(-100);
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
 * Downloads the log entries as a CSV file.
 * @param {object} appState - The global application state.
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
    log('Log downloaded as CSV.', 'info', {}, ui, appState.logEntries);
};

/**
 * Downloads the log entries as a JSON file.
 * @param {object} appState - The global application state.
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
    log('Log downloaded as JSON.', 'info', {}, ui, appState.logEntries);
};

/**
 * Clears the live log display and stored log entries.
 * @param {object} appState - The global application state.
 */
export const clearLog = (appState) => {
    openConfirmationModal('Are you sure you want to clear the live log? This will remove all displayed and stored log entries.', (confirmed) => {
        if (confirmed) {
            ui.liveLog.innerHTML = '';
            appState.logEntries = [];
            log('Live log cleared.', 'info', {}, ui, appState.logEntries);
        }
    }, appState);
};

/**
 * Initializes the QR code display for the donation address.
 */
export const initQrCodeDisplay = () => {
    ui.checkIcon.classList.add('hidden');
    if(typeof QRCode !== 'undefined') {
        new QRCode(ui.qrCodeContainer, {
            text: ui.donationAddress,
            width: 200,
            height: 200,
            colorDark : "#2d3748",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
        ui.qrAddressDisplay.textContent = ui.donationAddress;
    } else {
        console.error("QRCode library is not loaded.")
        ui.qrCodeContainer.innerHTML = "QR Code library failed to load. Please check your connection.";
    }
};

/**
 * Sets up all event listeners for UI interactions.
 * @param {object} appState - The global application state.
 * @param {function} startInteraction - The function to start the interaction.
 * @param {function} stopInteraction - The function to stop the interaction.
 * @param {function} clearAllData - The function to clear all data.
 */
export const setupEventListeners = (appState, startInteraction, stopInteraction, clearAllData) => {
    ui.connectWalletBtn.addEventListener('click', () => connectWallet(appState, ui));
    ui.startBtn.addEventListener('click', () => startInteraction(appState, ui));
    ui.stopBtn.addEventListener('click', () => stopInteraction(appState, ui));
    ui.clearAllDataBtn.addEventListener('click', () => clearAllData(appState, ui));
    ui.loadKeysBtn.addEventListener('click', () => loadWallets(appState, ui));
    ui.testRpcBtn.addEventListener('click', () => testRpcConnections(appState, ui, () => loadConfiguration(appState, ui)));
    ui.downloadLogCsvBtn.addEventListener('click', () => downloadLogCsv(appState));
    ui.downloadLogJsonBtn.addEventListener('click', () => downloadLogJson(appState));
    ui.clearLogBtn.addEventListener('click', () => clearLog(appState));
    ui.summarizeLogBtn.addEventListener('click', () => handleSummarizeLog(appState));
    ui.explainSendTxBtn.addEventListener('click', () => handleExplainSendTx(appState));
    ui.loadAddressesFromListBtn.addEventListener('click', () => loadAddressesFromList(appState, ui));
    ui.loadPredefinedFileBtn.addEventListener('click', () => loadPredefinedListFromFile(appState, ui));

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
            copyToClipboard(copyBtn.dataset.txHash, (msg, type) => log(msg, type, {}, ui, appState.logEntries));
        }
    });

    ui.recipientMode.forEach(radio => {
        radio.addEventListener('change', (e) => {
            ui.fixedAddressSection.classList.toggle('hidden', e.target.value !== 'fixed');
            ui.listAddressesSection.classList.toggle('hidden', e.target.value !== 'list');
            ui.predefinedAddressesSection.classList.toggle('hidden', e.target.value !== 'predefined');
            loadConfiguration(appState, ui);
        });
    });

    document.querySelectorAll('#prob-send, #prob-idle-action, #prob-balance-check').forEach(input => {
        input.addEventListener('input', () => loadConfiguration(appState, ui));
    });

    ui.minAmount.addEventListener('input', () => loadConfiguration(appState, ui));
    ui.maxAmount.addEventListener('input', () => loadConfiguration(appState, ui));
    ui.minDelay.addEventListener('input', () => loadConfiguration(appState, ui));
    ui.maxDelay.addEventListener('input', () => loadConfiguration(appState, ui));
    ui.gasMultiplier.addEventListener('input', () => loadConfiguration(appState, ui));
    ui.minGasFactor.addEventListener('input', () => loadConfiguration(appState, ui));
    ui.maxGasFactor.addEventListener('input', () => loadConfiguration(appState, ui));
    ui.blockLookback.addEventListener('input', () => loadConfiguration(appState, ui));
    ui.probJitterFactor.addEventListener('input', () => loadConfiguration(appState, ui));
    ui.simulatedErrorChance.addEventListener('input', () => loadConfiguration(appState, ui));
    ui.thinkTimeChance.addEventListener('input', () => loadConfiguration(appState, ui));
    ui.minThinkTime.addEventListener('input', () => loadConfiguration(appState, ui));
    ui.maxThinkTime.addEventListener('input', () => loadConfiguration(appState, ui));
    ui.activityBurstChance.addEventListener('input', () => loadConfiguration(appState, ui));
    ui.minBurstActions.addEventListener('input', () => loadConfiguration(appState, ui));
    ui.maxBurstActions.addEventListener('input', () => loadConfiguration(appState, ui));
    ui.minLullTime.addEventListener('input', () => loadConfiguration(appState, ui));
    ui.maxLullTime.addEventListener('input', () => loadConfiguration(appState, ui));
    ui.enableTimeOfDayBias.addEventListener('change', () => loadConfiguration(appState, ui));
    ui.rpcSwitchDelay.addEventListener('input', () => loadConfiguration(appState, ui));
    ui.walletSwitchDelay.addEventListener('input', () => loadConfiguration(appState, ui));
    ui.apiKeyInput.addEventListener('input', () => loadConfiguration(appState, ui));

    ui.stealthProfileSelector.addEventListener("change", (e) => {
        const selected = e.target.value;
        if (selected !== "custom") {
            applyProfile(selected, appState, ui);
        } else {
            loadConfiguration(appState, ui);
            log(`Switched to 'Manual Custom' profile. Current settings will be used.`, 'info', {}, ui, appState.logEntries);
        }
    });

    ui.personaModeSelector.addEventListener("change", (e) => {
        loadConfiguration(appState, ui);
        if (appState.wallets.length > 0) {
            log('Persona mode changed. Re-assigning personas to loaded wallets...', 'info', {}, ui, appState.logEntries);
            appState.wallets.forEach(wallet => {
                wallet.persona = WalletPersonaManager.getPersonaByMode(appState.config.personaMode);
                log(`🧍 Re-assigned persona for ...${wallet.address.slice(-6)}: ${wallet.persona.name} | delay ×${wallet.persona.behavior.delayFactor.toFixed(2)} | idle ${Math.round(wallet.persona.behavior.idleChance * 100)}%`, 'info', {}, ui, appState.logEntries);
            });
            updateWalletBalanceChart(appState, ui);
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
        initConsoleCharts(appState, ui);
        updateWalletBalanceChart(appState, ui);
        updateActionDistChart('send', appState); // Pass appState
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

    // Footer QR and Copy functionality
    ui.copyAddressBtn.addEventListener('click', () => {
        copyToClipboard(ui.donationAddress, (msg, type) => log(msg, type, {}, ui, appState.logEntries));
        ui.copyIcon.classList.add('hidden');
        ui.checkIcon.classList.remove('hidden');
        setTimeout(() => {
            ui.copyIcon.classList.remove('hidden');
            ui.checkIcon.classList.add('hidden');
        }, 2000);
    });

    ui.showQrBtn.addEventListener('click', () => {
        ui.qrCodeModal.classList.remove('hidden');
    });

    const closeQrModal = () => {
        ui.qrCodeModal.classList.add('hidden');
    }
    ui.closeQrModalBtn.addEventListener('click', closeQrModal);
    window.addEventListener('click', (event) => {
        if (event.target === ui.qrCodeModal) {
            closeQrModal();
        }
    });
};
