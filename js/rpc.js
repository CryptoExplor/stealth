// js/rpc.js
import { log } from './ui.js';

/**
 * Scans recent blocks on a given RPC endpoint to find new recipient addresses.
 * @param {string} rpcUrl - The RPC URL to scan.
 * @param {number} chainId - The chain ID of the RPC.
 * @param {object} appState - The global application state object.
 * @param {ethers.JsonRpcProvider} ethers - The ethers.js library.
 */
export const scanRecentBlocks = async (rpcUrl, chainId, appState, ethers) => {
    appState.currentRecipientPool[chainId] = appState.currentRecipientPool[chainId] || [];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    log(`Scanning ${appState.config.blockLookback} blocks on Chain ID ${chainId}...`, 'info');
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
        log(`Found ${newAddresses.size} new addresses. Total recipients for chain ${chainId}: ${appState.currentRecipientPool[chainId].length}`, 'success');
    } catch (error) {
        log(`Failed to scan blocks for chain ${chainId}: ${error.message}`, 'error');
    }
};

/**
 * Tests the configured RPC connections.
 * @param {object} appState - The global application state object.
 * @param {function} loadConfiguration - Function to load configuration from config.js.
 * @param {ethers.JsonRpcProvider} ethers - The ethers.js library.
 */
export const testRpcConnections = async (appState, loadConfiguration, ethers) => {
    loadConfiguration(); // Ensure latest RPCs are loaded
    if (appState.rpcConfigs.length === 0) {
        log('No RPC URLs configured to test.', 'warning');
        return;
    }

    log('Testing RPC connections...', 'info');
    for (const rpcConfig of appState.rpcConfigs) {
        const provider = new ethers.JsonRpcProvider(rpcConfig.url);
        try {
            const network = await provider.getNetwork();
            const blockNumber = await provider.getBlockNumber();
            if (network.chainId === BigInt(rpcConfig.chainId)) {
                log(`✅ RPC ${rpcConfig.url} connected (Chain ID: ${network.chainId}, Latest Block: ${blockNumber})`, 'success');
            } else {
                log(`⚠️ RPC ${rpcConfig.url} connected but Chain ID mismatch. Configured: ${rpcConfig.chainId}, Actual: ${network.chainId}. Latest Block: ${blockNumber}.`, 'warning');
            }
        }
        catch (error) {
            log(`❌ Failed to connect to RPC ${rpcConfig.url}: ${error.message}`, 'error');
        }
    }
    log('RPC connection testing complete.', 'info');
};
