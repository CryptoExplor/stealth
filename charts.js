// charts.js

/**
 * Initializes the Chart.js instances for wallet balances and action distribution.
 * @param {object} appState - The global application state.
 * @param {object} ui - The UI elements object.
 */
export const initConsoleCharts = (appState, ui) => {
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
 * @param {object} appState - The global application state.
 * @param {object} ui - The UI elements object.
 */
export const updateWalletBalanceChart = (appState, ui) => {
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
 * @param {object} appState - The global application state.
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
