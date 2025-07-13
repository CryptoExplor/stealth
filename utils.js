// utils.js

/**
 * Pauses execution for a specified number of milliseconds.
 * @param {number} ms - The number of milliseconds to sleep.
 * @returns {Promise<void>} A promise that resolves after the specified delay.
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Copies text to the clipboard. Uses document.execCommand('copy') for broader iframe compatibility.
 * @param {string} text - The text to copy.
 * @param {function} log - The logging function from main appState.
 */
export function copyToClipboard(text, log) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        log(`Copied "${text}" to clipboard.`, 'info');
    } catch (err) {
        log('Failed to copy to clipboard (unsupported by browser/iframe).', 'error');
    }
    document.body.removeChild(textarea);
}

/**
 * Logs a message to the live log display and stores it in appState.logEntries.
 * @param {string} message - The message to log.
 * @param {string} [type='info'] - The type of log (e.g., 'info', 'success', 'error', 'warning', 'skipped').
 * @param {object} [actionData={}] - Additional data for log entry (chainId, walletAddress, action, etc.).
 * @param {object} ui - UI elements object from main appState.
 * @param {Array} logEntries - Reference to appState.logEntries.
 */
export function log(message, type = 'info', actionData = {}, ui, logEntries) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntryDiv = document.createElement('div');
    logEntryDiv.innerHTML = `<span class="text-gray-500 mr-2">${timestamp}</span> <span class="log-${type}">${message}</span>`;
    ui.liveLog.appendChild(logEntryDiv);
    ui.liveLog.scrollTop = ui.liveLog.scrollHeight;

    logEntries.push({
        Timestamp: new Date().toISOString(),
        ChainID: actionData.chainId || '',
        WalletAddress: actionData.walletAddress || '',
        Action: actionData.action || 'Log',
        Status: type.toUpperCase(),
        Details: message.replace(/<[^>]*>?/gm, '').replace(/,/g, ';'),
        DelayUsedMs: actionData.delayUsedMs || '',
        GasFactorUsed: actionData.gasFactorUsed || '',
        Persona: actionData.personaName || '',
        UserAgent: actionData.userAgent || '',
    });
}

/**
 * Helper to set values by ID for configuration inputs.
 * @param {string} id - The ID of the HTML element.
 * @param {*} value - The value to set.
 */
export const setConfigValue = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = value;
    else if (el.tagName === "TEXTAREA") el.value = value.join('\n');
    else el.value = value;
};

/**
 * Wraps a string to a maximum length for display.
 * @param {string} str - The input string.
 * @param {number} [maxLen=16] - The maximum line length.
 * @returns {string|Array<string>} The wrapped string or an array of lines.
 */
export const wrapLabel = (str, maxLen = 16) => {
    if (str.length <= maxLen) {
        return str;
    }
    const words = str.split(' ');
    const lines = [];
    let currentLine = '';
    for (const word of words) {
        if ((currentLine + ' ' + word).length > maxLen && currentLine.length > 0) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine += (currentLine.length === 0 ? '' : ' ') + word;
        }
    }
    if (currentLine.length > 0) {
        lines.push(currentLine);
    }
    return lines;
};
