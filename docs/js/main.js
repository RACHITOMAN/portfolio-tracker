function updateTables(symbolData, portfolioData, soldData) {
  const tables = {
    total: document.getElementById('totalTable'),
    sold: document.getElementById('soldTable'),
    all: document.getElementById('allTable')
  };
  
  // Add custom portfolio tables
  portfolios.filter(p => p.id !== 'total').forEach(p => {
    tables[p.id] = document.getElementById(p.id + 'Table');
  });
  
  for (const portfolio in tables) {
    const table = tables[portfolio];
    if (!table) continue;
    const tbody = table.querySelector('tbody');
    if (!tbody) continue;
    tbody.innerHTML = '';
    
    if (portfolio === 'all') {
  let filteredTransactions = transactions;
  
  // Apply ticker modal filter (from clickable tickers)
  if (activeTickerFilter) {
    filteredTransactions = filteredTransactions.filter(t => t.symbol === activeTickerFilter);
  }
  
  // Apply dropdown/search filters
  if (transactionFilters.type) {
    filteredTransactions = filteredTransactions.filter(t => t.type === transactionFilters.type);
  }
  if (transactionFilters.portfolio) {
    filteredTransactions = filteredTransactions.filter(t => t.portfolio === transactionFilters.portfolio);
  }
  if (transactionFilters.symbol) {
    filteredTransactions = filteredTransactions.filter(t => 
      t.symbol.toLowerCase().includes(transactionFilters.symbol.toLowerCase())
    );
  }
  filteredTransactions.forEach(function(t, index) {
  // Find the actual index in the main transactions array
  const actualIndex = transactions.findIndex(tx => tx.id === t.id);  
  const row = document.createElement('tr');
  row.ondblclick = function() { showEditModal(actualIndex); };
  row.style.cursor = 'pointer';
  row.title = 'Double-click to edit';
  const portfolioName = getPortfolioName(t.portfolio);
  const portfolioColor = getPortfolioColorDot(t.portfolio);
  row.innerHTML = '<td><input type="checkbox" class="select-row" data-index="' + actualIndex + '"></td><td>' + t.type.toUpperCase() + '</td><td>' + portfolioColor + portfolioName + '</td><td>' + makeTickerClickable(t.symbol) + '</td><td>' + t.shares.toFixed(2) + '</td><td>$' + t.price.toFixed(2) + '</td><td>' + formatDateDDMMYYYY(t.date) + '</td>';
  tbody.appendChild(row);
});
}
    else if (portfolio === 'sold') {
      for (const key in soldData) {
        const data = soldData[key];
        const symbol = data.symbol || key;
        const row = document.createElement('tr');
        
        const firstBuyDate = new Date(data.firstBuy);
        const lastSellDate = new Date(data.lastSell);
        const daysHeld = Math.ceil((lastSellDate - firstBuyDate) / (1000 * 60 * 60 * 24));
        
        const dates = [new Date(data.firstBuy), new Date(data.lastSell)];
        const values = [-data.totalCost, data.totalProceeds];

        const xirr = calculateXIRR(dates, values);
        
        const currentPrice = livePrices[symbol] || 0;
        const unrealizedGain = currentPrice > 0 ? ((currentPrice - data.avgBuyPrice) * data.sharesSold) - data.realizedGain : 0;
        
        const portfolioName = getPortfolioName(data.portfolio);
const portfolioColor = getPortfolioColorDot(data.portfolio);
        
       row.innerHTML = '<td><input type="checkbox" class="select-row"></td>' +
          '<td>' + makeTickerClickable(symbol) + (data.isPremium ? ' (Premium)' : '') + '</td>' +
          '<td>' + portfolioColor + portfolioName + '</td>' +
          '<td>' + data.sharesSold.toFixed(2) + '</td>' +
          '<td>$' + data.avgBuyPrice.toFixed(2) + '</td>' +
          '<td>$' + data.avgSellPrice.toFixed(2) + '</td>' +
          '<td>$' + (currentPrice || 0).toFixed(2) + '</td>' +
          '<td class="' + (data.realizedGain < 0 ? 'negative' : 'positive') + '">$' + data.realizedGain.toFixed(2) + '</td>' +
          '<td class="' + (data.gainPercent < 0 ? 'negative' : 'positive') + '">' + data.gainPercent + '%</td>' +
          '<td>' + daysHeld + '</td>' +
'<td>' + (daysHeld < 90 ? '>90 days' : (xirr * 100).toFixed(2) + '%') + '</td>' +
          '<td class="' + (unrealizedGain < 0 ? 'positive' : 'negative') + '">$' + unrealizedGain.toFixed(2) + '</td>';
        tbody.appendChild(row);
      }
    } else {
      for (const symbol in symbolData) {
        const data = symbolData[symbol];
        if (!data.netShares || data.netShares <= 0.001) continue;
        if (portfolio !== 'total' && data.portfolio !== portfolio) continue;

        const row = document.createElement('tr');
        let portfolioTotalValue = portfolioData.totalValue;

        if (portfolio !== 'total') {
          portfolioTotalValue = 0;
          for (const sym in symbolData) {
            const d = symbolData[sym];
            if (d.portfolio === portfolio && d.netShares > 0) {
              portfolioTotalValue += d.currentValue;
            }
          }
        }

        var portfolioPercent = (portfolioTotalValue > 0) ? (data.currentValue / portfolioTotalValue * 100).toFixed(2) : '0.00';
row.innerHTML = '<td><input type="checkbox" class="select-row"></td><td>' + makeTickerClickable(symbol) + '</td><td>' + (data.netShares || 0).toFixed(2) + '</td><td>$' + (data.avgCost || 0).toFixed(2) + '</td><td>' + generatePriceCell(symbol, data.currentPrice) + '</td><td>$' + (data.totalCost || 0).toFixed(2) + '</td><td>$' + (data.currentValue || 0).toFixed(2) + '</td><td class="' + (data.gainLoss < 0 ? 'negative' : '') + '">$' + (data.gainLoss || 0).toFixed(2) + '</td><td class="' + ((data.gainLossPercent || 0) < 0 ? 'negative' : '') + '">' + (data.gainLossPercent || 0) + '%</td><td>' + (data.weightedDays < 90 ? '>90 days' : ((data.xirr || 0) * 100).toFixed(2) + '%') + '</td><td>' + Math.round(data.weightedDays || 0) + ' days</td><td>' + portfolioPercent + '%</td>';      
  tbody.appendChild(row);
      }
    }
  }

  for (const portfolio in sortState) {
    const state = sortState[portfolio];
    const table = tables[portfolio];
    if (table && state) sortTable(table, state.column, state.direction);
  }
}

function updateSummary(symbolData, portfolioData, currentPortfolio, soldData) {
  currentPortfolio = currentPortfolio || 'total';
  
  if (currentPortfolio === 'sold') {
    let totalRealizedGain = 0;
    const portfolioRealizedGains = {};
    
    portfolios.filter(p => p.id !== 'total').forEach(p => {
      portfolioRealizedGains[p.id] = 0;
    });
    
    for (const key in soldData) {
      const data = soldData[key];
      totalRealizedGain += data.realizedGain;
      if (portfolioRealizedGains[data.portfolio] !== undefined) {
        portfolioRealizedGains[data.portfolio] += data.realizedGain;
      }
    }
    
    document.getElementById('totalValue').textContent = '$' + totalRealizedGain.toFixed(2);
    document.getElementById('totalCost').textContent = 'Total Realized Gain';
    
    const portfolioNames = portfolios.filter(p => p.id !== 'total').map(p => p.name);
    if (portfolioNames.length > 0) {
      document.getElementById('realizedGainLoss').textContent = '$' + portfolioRealizedGains[portfolios[1].id].toFixed(2);
      document.getElementById('realizedGainPercent').textContent = portfolioNames[0];
    }
    
    if (portfolioNames.length > 1) {
      document.getElementById('totalGainLoss').textContent = '$' + portfolioRealizedGains[portfolios[2].id].toFixed(2);
      document.getElementById('totalGainLossPercent').textContent = portfolioNames[1];
    }
    
    document.getElementById('portfolioXIRR').closest('.summary-card').style.display = 'none';
    document.getElementById('weightedDaysHeld').closest('.summary-card').style.display = 'none';
    
    return;
  }
  
  document.getElementById('portfolioXIRR').closest('.summary-card').style.display = 'block';
  document.getElementById('weightedDaysHeld').closest('.summary-card').style.display = 'block';
  
  let filteredSymbolData = symbolData;
  let displayValue = portfolioData.totalValue;
  let displayCost = portfolioData.totalCost;
  let holdings = {};
  
  portfolios.filter(p => p.id !== 'total').forEach(p => {
    holdings[p.id] = portfolioData[p.id] || 0;
  });
  
  let totalRealizedGain = 0;
  let totalRealizedCost = 0;
  
  for (const key in soldData) {
    const data = soldData[key];
    if (currentPortfolio === 'total' || data.portfolio === currentPortfolio) {
      totalRealizedGain += data.realizedGain;
      totalRealizedCost += data.totalCost;
    }
  }
  
  if (currentPortfolio !== 'total') {
    filteredSymbolData = {};
    displayValue = 0;
    displayCost = 0;
    
    for (const symbol in symbolData) {
      if (symbolData[symbol].portfolio === currentPortfolio && symbolData[symbol].netShares > 0) {
        filteredSymbolData[symbol] = symbolData[symbol];
        displayValue += symbolData[symbol].currentValue;
        displayCost += symbolData[symbol].totalCost;
      }
    }
  }
  
  document.getElementById('totalValue').textContent = '$' + displayValue.toFixed(2);
  document.getElementById('totalCost').textContent = '$' + displayCost.toFixed(2);

  const totalGainLoss = displayValue - displayCost;
  document.getElementById('totalGainLoss').textContent = '$' + totalGainLoss.toFixed(2);
  document.getElementById('totalGainLossPercent').textContent = (displayCost ? (totalGainLoss / displayCost * 100).toFixed(2) : 0.00) + '%';
  
  document.getElementById('realizedGainLoss').textContent = '$' + totalRealizedGain.toFixed(2);
  const realizedGainPercent = totalRealizedCost > 0 ? (totalRealizedGain / totalRealizedCost * 100).toFixed(2) : '0.00';
  document.getElementById('realizedGainPercent').textContent = realizedGainPercent + '%';
  
  const totalHoldings = Object.values(filteredSymbolData).filter(function(d) {
    return d.netShares > 0;
  }).length;
  
  if (currentPortfolio === 'total') {
    document.getElementById('stockCount').textContent = totalHoldings + ' Holdings';
    const breakdownParts = portfolios.filter(p => p.id !== 'total').map(p => {
      return p.name + ': ' + (holdings[p.id] || 0);
    });
    document.getElementById('holdingsBreakdown').textContent = breakdownParts.join(' | ');
  } else {
    document.getElementById('stockCount').textContent = totalHoldings + ' Holdings';
    const currentPortfolioName = portfolios.find(p => p.id === currentPortfolio)?.name || currentPortfolio.toUpperCase();
    document.getElementById('holdingsBreakdown').textContent = currentPortfolioName + ' Portfolio';
  }
  
  const filteredTransactions = currentPortfolio === 'total' ? transactions : transactions.filter(function(t) {
    return t.portfolio === currentPortfolio;
  });
  
  const portfolioXIRR = calculatePortfolioXIRR(filteredTransactions, filteredSymbolData, livePrices);
  document.getElementById('portfolioXIRR').textContent = (portfolioXIRR * 100).toFixed(2) + '%';

  let totalWeightedDays = 0;
  let totalValue = 0;

  for (const symbol in filteredSymbolData) {
    const data = filteredSymbolData[symbol];
    if (data.netShares > 0) {
      totalWeightedDays += data.currentValue * data.weightedDays;
      totalValue += data.currentValue;
    }
  }

  const weightedDaysHeld = totalValue > 0 ? totalWeightedDays / totalValue : 0;
  document.getElementById('weightedDaysHeld').textContent = Math.round(weightedDaysHeld) + ' days';
}
async function init() {
    initializePriceMode();  // <-- ADD THIS LINE
  checkFirstVisit();
  initializePortfolios();
  initializeTabs();
  initializeSortListeners();
  
  await loadDataFromSupabase();

  // CSV Template Download
const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
if (downloadTemplateBtn) {
  downloadTemplateBtn.addEventListener('click', downloadCsvTemplate);
}
  // Modal handlers
  document.getElementById('closeWelcomeBtn').addEventListener('click', function() {
    document.getElementById('welcomeModal').classList.remove('active');
    checkApiKey();
  });

  document.getElementById('settingsBtn').addEventListener('click', function() {
    loadApiKey();
    document.getElementById('settingsModal').classList.add('active');
  });

  document.getElementById('helpBtn').addEventListener('click', function() {
    document.getElementById('welcomeModal').classList.add('active');
  });

  document.querySelector('#settingsModal .close').addEventListener('click', function() {
    document.getElementById('settingsModal').classList.remove('active');
  });

  document.getElementById('saveApiKeyBtn').addEventListener('click', saveApiKey);
  document.getElementById('addPortfolioBtn').addEventListener('click', addPortfolio);
document.getElementById('dividendType').addEventListener('change', handleDividendTypeChange);

  // Window click to close modal
  window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
      event.target.classList.remove('active');
    }
  });
  
  // Transaction and cash flow handlers
  document.getElementById('addCashFlowBtn').addEventListener('click', addCashFlow);
  document.getElementById('addTransactionBtn').addEventListener('click', addTransaction);
  document.getElementById('clearDataBtn').addEventListener('click', confirmClearData);
  document.getElementById('deleteSelected').addEventListener('click', confirmDeleteSelected);
// CSV Import
document.getElementById('importCsvBtn').addEventListener('click', function() {
  document.getElementById('csvFileInput').click();
});
document.getElementById('csvFileInput').addEventListener('change', handleCsvImport);

// CSV Export
const exportBtn = document.getElementById('exportCsvBtn');
if (exportBtn) {
  exportBtn.addEventListener('click', exportTransactionsToCSV);
} else {
  console.warn('Export CSV button not found in HTML');
}

// Ticker Search with Debounce
const tickerSearchInput = document.getElementById('tickerSearchInput');
const searchTickerBtn = document.getElementById('searchTickerBtn');
const clearTickerBtn = document.getElementById('clearTickerBtn');

if (tickerSearchInput) {
  const debouncedSearch = debounce(searchTicker, 300);
  tickerSearchInput.addEventListener('input', debouncedSearch);
}

if (searchTickerBtn) {
  searchTickerBtn.addEventListener('click', searchTicker);
}

if (clearTickerBtn) {
  clearTickerBtn.addEventListener('click', clearTickerSearch);
}
  
 // CSV Export
  document.getElementById('exportCsvBtn').addEventListener('click', exportTransactionsToCSV);
  // Debounced ticker search
  const debouncedSearch = debounce(searchTicker, 300);
  document.getElementById('tickerSearchInput').addEventListener('input', debouncedSearch);
  
  document.getElementById('searchTickerBtn').addEventListener('click', searchTicker);
  document.getElementById('clearTickerBtn').addEventListener('click', clearTickerSearch);
  document.getElementById('searchTickerBtn').addEventListener('click', searchTicker);
  document.getElementById('clearTickerBtn').addEventListener('click', clearTickerSearch);
  document.getElementById('deleteCashFlowSelected').addEventListener('click', deleteCashFlowSelected);
  document.getElementById('refreshPricesBtn').addEventListener('click', refreshAllPrices);
  
  // Cash flow CSV import
  if (document.getElementById('importCashFlowCsvBtn')) {
    document.getElementById('importCashFlowCsvBtn').addEventListener('click', () => {
      document.getElementById('cashFlowCsvFileInput').click();
    });
  }
  if (document.getElementById('cashFlowCsvFileInput')) {
    document.getElementById('cashFlowCsvFileInput').addEventListener('change', handleCashFlowCsvImport);
  }
  
  // Premium type toggle
  // Type-specific field toggles
document.getElementById('type').addEventListener('change', function() {
  const premiumTypeSelect = document.getElementById('premiumType');
  const dividendTypeSelect = document.getElementById('dividendType');
  const sharesInput = document.getElementById('shares');
  const priceInput = document.getElementById('price');
  
  // Hide all sub-selectors by default
  premiumTypeSelect.style.display = 'none';
  dividendTypeSelect.style.display = 'none';

  // Reset fields and styling
  sharesInput.placeholder = 'Shares/Amount';
  priceInput.placeholder = 'Price';
  sharesInput.disabled = false;
  priceInput.disabled = false;
  sharesInput.style.background = 'white';  // ADD THIS
  sharesInput.style.color = 'black';       // ADD THIS
  priceInput.style.background = 'white';   // ADD THIS
  priceInput.style.color = 'black';        // ADD THIS
  sharesInput.value = '';                  // ADD THIS
  priceInput.value = '';                   // ADD THIS
  
  // Show appropriate sub-selector
  if (this.value === 'premium') {
    premiumTypeSelect.style.display = 'inline-block';
  } else if (this.value === 'dividend') {
    dividendTypeSelect.style.display = 'inline-block';
    handleDividendTypeChange(); // Set initial state
  }
});
}

init();