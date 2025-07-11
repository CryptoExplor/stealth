// js/wallet.js
import { ethers } from 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.umd.min.js';
import { log, setUIEnabled, ui } from './ui.js'; // Import ui as well for walletStatusDisplay

/**
 * Connects to the user's MetaMask or compatible wallet.
 * @param {object} appState - The global application state object.
 */
export const connectWallet = async (appState) => {
    if (typeof window.ethereum === 'undefined') {
        log('MetaMask or compatible wallet not detected. Please install one.', 'error', {}, appState);
        ui.walletStatusDisplay.innerHTML = `❌ No wallet detected. <a href="https://metamask.io/" class="underline text-blue-400" target="_blank">Install MetaMask</a>`;
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
            ui.walletStatusDisplay.innerHTML = `⚠️ Wallet not authorized.`;
            setUIEnabled(false);
            return;
        }
        appState.connectedAddress = accounts[0];
        log(`Wallet connected: ${appState.connectedAddress}`, 'success', {}, appState);
        ui.walletStatusDisplay.innerHTML = `✅ Connected: <strong>${appState.connectedAddress.slice(0, 6)}...${appState.connectedAddress.slice(-4)}</strong>`;
        setUIEnabled(true);

        // Event listeners for wallet changes
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
        ui.walletStatusDisplay.innerHTML = `❌ Connection failed: ${error.message}`;
        setUIEnabled(false);
    }
};

/**
 * Checks for an existing wallet connection on page load.
 * @param {object} appState - The global application state object.
 */
export const checkExistingWalletConnection = async (appState) => {
    if (typeof window.ethereum === 'undefined') {
        ui.walletStatusDisplay.textContent = '❌ Wallet not detected.';
        setUIEnabled(false); // Ensure UI is disabled if no wallet
        return;
    }

    try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            appState.connectedAddress = accounts[0];
            ui.walletStatusDisplay.innerHTML = `✅ Connected: <strong>${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}</strong>`;
            setUIEnabled(true);
            log(`Existing wallet connection found: ${accounts[0]}`, 'info', {}, appState);
        } else {
            ui.walletStatusDisplay.textContent = 'No wallet connected.';
            setUIEnabled(false);
            log('No existing wallet connection found on startup.', 'info', {}, appState);
        }
    } catch (err) {
        ui.walletStatusDisplay.textContent = `⚠️ Error checking connection: ${err.message}`;
        log(`Error checking existing wallet connection: ${err.message}`, 'error', {}, appState);
        setUIEnabled(false);
    }
};
