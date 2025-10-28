function checkDuplicateTransaction(symbol, shares, date, type) {
  const dateObj = new Date(date);
  
  const duplicates = transactions.filter(t => {
    const tDate = new Date(t.date);
    const daysDiff = Math.abs((dateObj - tDate) / (1000 * 60 * 60 * 24));
    const sharesDiff = Math.abs(t.shares - shares);
    
    return t.symbol === symbol &&
           t.type === type &&
           daysDiff <= 1 && // Within 1 day
           sharesDiff <= (shares * 0.1); // Within 10% of shares
  });
  
  return duplicates;
}
function handleCsvImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    let csvData;
    
    if (file.name.endsWith('.xlsx')) {
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      csvData = XLSX.utils.sheet_to_csv(firstSheet);
    } else {
      csvData = new TextDecoder().decode(data);
    }
    
    processCsvData(csvData);
    event.target.value = '';
  };
  reader.readAsArrayBuffer(file);
}
function exportTransactionsToCSV() {
  if (transactions.length === 0) {
    alert('No transactions to export');
    return;
  }

  const headers = ['Date', 'Symbol', 'Portfolio', 'Type', 'Shares', 'Price', 'PremiumType'];
  
  const rows = transactions.map(t => {
    const portfolioObj = portfolios.find(p => p.id === t.portfolio);
    const portfolioName = portfolioObj ? portfolioObj.name : t.portfolio.toUpperCase();
    
    return [
      formatDateDDMMYYYY(t.date),
      t.symbol,
      portfolioName,
      t.type,
      t.shares,
      t.price,
      t.premium_type || ''
    ];
  });

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  const timestamp = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `portfolio-transactions-${timestamp}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  alert(`✅ Exported ${transactions.length} transactions to CSV`);
}
// ============ TICKER SEARCH ============
// ============ CSV TEMPLATE DOWNLOAD ============

function downloadCsvTemplate() {
  // Get current portfolio names
  const portfolioNames = portfolios
    .filter(p => p.id !== 'total')
    .map(p => p.name)
    .join(', ');
  
  // Create template with headers and example rows
  const headers = ['Type', 'Portfolio', 'Symbol', 'Shares', 'Price', 'Date'];
  
  // Example rows with user's actual portfolio names
  const exampleRows = [];
  
  // Add examples for each portfolio
  portfolios.filter(p => p.id !== 'total').forEach((portfolio, index) => {
    if (index === 0) {
      exampleRows.push(['buy', portfolio.name, 'AAPL', '100', '150.00', '01/01/2024']);
      exampleRows.push(['sell', portfolio.name, 'AAPL', '50', '175.00', '01/06/2024']);
    } else if (index === 1) {
      exampleRows.push(['buy', portfolio.name, 'GOOG', '25', '140.50', '15/02/2024']);
      exampleRows.push(['dividend', portfolio.name, 'MSFT', '0.75', '0', '20/03/2024']);
    } else {
      exampleRows.push(['buy', portfolio.name, 'TSLA', '10', '200.00', '10/04/2024']);
    }
  });
  
  // If no custom portfolios, add generic examples
  if (exampleRows.length === 0) {
    exampleRows.push(
      ['buy', 'YourPortfolio', 'AAPL', '100', '150.00', '01/01/2024'],
      ['sell', 'YourPortfolio', 'AAPL', '50', '175.00', '01/06/2024'],
      ['dividend', 'YourPortfolio', 'MSFT', '0.75', '0', '20/03/2024']
    );
  }
  
  // Create CSV content
  const csvContent = [headers, ...exampleRows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
  
  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  const timestamp = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `portfolio-import-template-${timestamp}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Show helpful message
  alert(
    `📋 CSV Template Downloaded!\n\n` +
    `Your portfolios: ${portfolioNames || 'None (create in Settings first)'}\n\n` +
    `Instructions:\n` +
    `1. Open the template in Excel/Sheets\n` +
    `2. Replace example data with your transactions\n` +
    `3. Keep the headers unchanged\n` +
    `4. Use portfolio names: ${portfolioNames || 'YourPortfolio'}\n` +
    `5. Date format: DD/MM/YYYY or YYYY-MM-DD\n` +
    `6. Import using "📥 Import CSV" button`
  );
}
function searchTicker() {
  const tickerInput = document.getElementById('tickerSearchInput').value.toUpperCase().trim();
  if (!tickerInput) return;
  
  const table = document.getElementById('tickerTable');
  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';

  const tickerTxns = transactions.filter(function(t) {
    return t.symbol === tickerInput && isValidTransaction(t);
  });
  
  if (tickerTxns.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td></td><td colspan="7">No data available for ' + tickerInput + '</td>';
    tbody.appendChild(row);
    return;
  }

  let totalShares = 0;
  let totalDividends = 0;
  tickerTxns.forEach(function(t) {
    if (t.type === 'buy') totalShares += t.shares;
    else if (t.type === 'sell') totalShares -= t.shares;
    else if (t.type === 'dividend') {
      totalShares += t.shares;
      totalDividends += t.shares * t.price;
    }
  });

  getLivePrice(tickerInput);
  const summaryRow = document.createElement('tr');
  var priceDisplay = livePrices[tickerInput] ? '$' + livePrices[tickerInput].toFixed(2) : 'N/A';
  
  // Get portfolio names for summary
  const portfolioNames = [...new Set(tickerTxns.map(t => {
    const pObj = portfolios.find(p => p.id === t.portfolio);
    return pObj ? pObj.name : t.portfolio;
  }))].join(', ');
  
  summaryRow.innerHTML = '<td><input type="checkbox" class="select-row" data-type="summary"></td><td>SUMMARY</td><td>' + portfolioNames + '</td><td>' + tickerInput + '</td><td>' + totalShares.toFixed(2) + '</td><td>' + priceDisplay + '</td><td>' + formatDateDDMMYYYY(Date.now()) + '</td><td>$' + totalDividends.toFixed(2) + '</td>';
  tbody.appendChild(summaryRow);

  tickerTxns.forEach(function(t, index) {
    const value = t.type === 'dividend' ? t.shares * t.price : t.type === 'buy' ? -t.shares * t.price : t.shares * t.price;
    const txRow = document.createElement('tr');
    
    // Map portfolio ID to name
    const portfolioObj = portfolios.find(p => p.id === t.portfolio);
    const portfolioName = portfolioObj ? portfolioObj.name : t.portfolio.toUpperCase();
    
    // Store all data in data attributes for easy deletion
    txRow.innerHTML = '<td><input type="checkbox" class="select-row" data-type="' + t.type + '" data-portfolio="' + t.portfolio + '" data-symbol="' + t.symbol + '" data-shares="' + t.shares + '" data-price="' + t.price + '" data-date="' + t.date + '"></td><td>' + t.type.toUpperCase() + '</td><td>' + portfolioName + '</td><td>' + t.symbol + '</td><td>' + t.shares.toFixed(2) + '</td><td>$' + t.price.toFixed(2) + '</td><td>' + formatDateDDMMYYYY(t.date) + '</td><td>' + (t.type === 'dividend' ? '$' + value.toFixed(2) : '') + '</td>';
    tbody.appendChild(txRow);
  });
}

function clearTickerSearch() {
  document.getElementById('tickerSearchInput').value = '';
  const tbody = document.getElementById('tickerTable').querySelector('tbody');
  tbody.innerHTML = '';
}
function refreshPricesAndNames() {
  globalSymbolData = {};  // ← ADD THIS LINE TO RESET THE DATA
  const portfolioHoldings = {};
  
  // Initialize portfolio holdings counters
  portfolios.filter(p => p.id !== 'total').forEach(p => {
    portfolioHoldings[p.id] = {};
  });
  
  transactions.forEach(function(t) {
    if (!isValidTransaction(t)) return;
    if (!globalSymbolData[t.symbol]) {
      globalSymbolData[t.symbol] = { 
        buys: 0,
        sells: 0, 
        totalCost: 0, 
        firstDate: t.date, 
        lastDate: t.date,
        portfolio: t.portfolio
      };
    }
    
    if (t.type === 'buy' || t.type === 'dividend' || t.type === 'premium') {
      // Add shares for buys and DRIP dividends
      if (t.type === 'buy' || (t.type === 'dividend' && t.shares > 0)) {
        globalSymbolData[t.symbol].buys += t.shares;
      }
      
      // Add cost for buys only (DRIP is $0 cost)
      if (t.type === 'buy') {
        globalSymbolData[t.symbol].totalCost += t.shares * t.price;
      }
      
      // Subtract cash dividends from cost basis
      if (t.type === 'dividend' && t.shares === 0 && t.price > 0) {
        globalSymbolData[t.symbol].totalCost -= t.price;
      }
      
      globalSymbolData[t.symbol].portfolio = t.portfolio;
    } else if (t.type === 'sell') {
      globalSymbolData[t.symbol].sells += t.shares;
    }
    
    if (t.date < globalSymbolData[t.symbol].firstDate) globalSymbolData[t.symbol].firstDate = t.date;
    if (t.date > globalSymbolData[t.symbol].lastDate) globalSymbolData[t.symbol].lastDate = t.date;
  });

  const portfolioData = { totalValue: 0, totalCost: 0 };
  
  portfolios.filter(p => p.id !== 'total').forEach(p => {
    portfolioData[p.id] = 0;
  });
  
  for (const symbol in globalSymbolData) {
    const netShares = globalSymbolData[symbol].buys - globalSymbolData[symbol].sells;
    if (netShares > 0.001) {
      let baseCost = globalSymbolData[symbol].totalCost;
      
      const coveredCallPremiums = transactions.filter(function(t) {
        return t.symbol === symbol && 
               t.type === 'premium' && 
               t.premium_type === 'covered_call';
      }).reduce(function(sum, t) {
        return sum + (t.shares * t.price);
      }, 0);
      
      const cspAssignedPremiums = transactions.filter(function(t) {
        return t.symbol === symbol && 
               t.type === 'premium' && 
               t.premium_type === 'csp_assigned';
      }).reduce(function(sum, t) {
        return sum + (t.shares * t.price);
      }, 0);
      
      const adjustedTotalCost = baseCost - coveredCallPremiums - cspAssignedPremiums;
      
      const avgCost = globalSymbolData[symbol].buys > 0 ? adjustedTotalCost / globalSymbolData[symbol].buys : 0;
      const currentPrice = livePrices[symbol] || 0;
      const currentValue = netShares * currentPrice;
      const totalCostForHolding = netShares * avgCost;
      
      globalSymbolData[symbol].netShares = netShares;
      globalSymbolData[symbol].avgCost = avgCost;
      globalSymbolData[symbol].currentPrice = currentPrice;
      globalSymbolData[symbol].currentValue = currentValue;
      globalSymbolData[symbol].totalCost = totalCostForHolding;
      globalSymbolData[symbol].gainLoss = currentValue - totalCostForHolding;
      globalSymbolData[symbol].gainLossPercent = totalCostForHolding ? (globalSymbolData[symbol].gainLoss / totalCostForHolding * 100).toFixed(2) : 0;
      globalSymbolData[symbol].xirr = calculateXIRRForSymbol(symbol, transactions, livePrices);
      
      const buyTxns = transactions.filter(function(t) {
        return t.symbol === symbol && (t.type === 'buy' || t.type === 'dividend');
      });
      const totalBuyShares = buyTxns.reduce(function(sum, t) {
        return sum + t.shares;
      }, 0);
      globalSymbolData[symbol].weightedDays = totalBuyShares > 0 ? buyTxns.reduce(function(sum, t) {
        var days = calculateDaysHeld(t.date);
        return sum + t.shares * days;
      }, 0) / totalBuyShares : 0;

      const portfolio = globalSymbolData[symbol].portfolio;
      if (portfolioHoldings[portfolio]) {
        portfolioHoldings[portfolio][symbol] = true;
      }
      portfolioData.totalValue += (currentValue || 0);
      portfolioData.totalCost += (totalCostForHolding || 0);
    }
  }

  portfolios.filter(p => p.id !== 'total').forEach(p => {
    portfolioData[p.id] = Object.keys(portfolioHoldings[p.id] || {}).length;
  });

  const soldData = {};

  transactions.forEach(function(t) {
    if (t.type === 'sell') {
      const saleKey = t.symbol + '_sale_' + t.date;
      
      const symbolTxns = transactions.filter(function(tx) {
        return tx.symbol === t.symbol && new Date(tx.date) <= new Date(t.date);
      });
      
      let totalBought = 0;
      let totalCost = 0;
      
      symbolTxns.forEach(function(tx) {
        if (tx.type === 'buy') {
          totalBought += tx.shares;
          totalCost += tx.shares * tx.price;
        }
      });
      
      const avgCostBasis = totalBought > 0 ? totalCost / totalBought : 0;
      const costBasisForSale = t.shares * avgCostBasis;
      const proceeds = t.shares * t.price;

      const coveredCallPremiums = transactions.filter(function(tx) {
        return tx.symbol === t.symbol && 
               tx.type === 'premium' && 
               tx.premium_type === 'covered_call' &&
               new Date(tx.date) <= new Date(t.date);
      }).reduce(function(sum, tx) {
        return sum + (tx.shares * tx.price);
      }, 0);

      const totalProceeds = proceeds + coveredCallPremiums;
      const realizedGain = totalProceeds - costBasisForSale;
      const gainPercent = costBasisForSale > 0 ? (realizedGain / costBasisForSale * 100).toFixed(2) : '0.00';
      
      const firstBuy = transactions.find(function(tx) {
        return tx.symbol === t.symbol && tx.type === 'buy';
      });
      
      soldData[saleKey] = {
        symbol: t.symbol,
        portfolio: t.portfolio,
        sharesSold: t.shares,
        avgBuyPrice: avgCostBasis,
        avgSellPrice: t.price,
        totalCost: costBasisForSale,
        totalProceeds: totalProceeds,
        realizedGain: realizedGain,
        gainPercent: gainPercent,
        firstBuy: firstBuy ? firstBuy.date : t.date,
        lastSell: t.date,
        isPartialSale: true
      };
    }
  });

  transactions.forEach(function(t) {
    if (t.type === 'premium' && t.premium_type === 'csp_expired') {
      const key = t.symbol + '_premium_' + t.date;
      soldData[key] = {
        portfolio: t.portfolio,
        symbol: t.symbol,
        sharesSold: t.shares,
        avgBuyPrice: 0,
        avgSellPrice: t.price,
        totalCost: 0,
        totalProceeds: t.shares * t.price,
        realizedGain: t.shares * t.price,
        gainPercent: t.price > 0 ? '100.00' : t.price < 0 ? '-100.00' : '0.00',
        firstBuy: t.date,
        lastSell: t.date,
        isPremium: true,
        premiumType: 'CSP Expired'
      };
    }
  });

  updateTables(globalSymbolData, portfolioData, soldData);
  const activeTab = document.querySelector('.tab.active');
  const currentPortfolio = activeTab ? activeTab.dataset.tab : 'total';
  const portfolioFilter = ['total', ...portfolios.filter(p => p.id !== 'total').map(p => p.id)].includes(currentPortfolio) ? currentPortfolio : 'total';
 
  updateSummary(globalSymbolData, portfolioData, portfolioFilter, soldData);
  updateCashFlowTable();
  updateDividendsTable(); // ← ADD THIS LINE
}
// Initialize price mode on page load
function initializePriceMode() {
  const apiModeRadio = document.getElementById('priceMode_api');
  const manualModeRadio = document.getElementById('priceMode_manual');
  const apiKeySection = document.getElementById('apiKeySection');
  
  if (!apiModeRadio || !manualModeRadio) {
    console.warn('Price mode radio buttons not found');
    return;
  }
  
  // Set initial state from localStorage
  if (priceMode === 'manual') {
    manualModeRadio.checked = true;
    apiKeySection.classList.add('hidden');
  } else {
    apiModeRadio.checked = true;
    apiKeySection.classList.remove('hidden');
  }
  
  // Event listeners for radio buttons
  apiModeRadio.addEventListener('change', function() {
    if (this.checked) {
      priceMode = 'api';
      localStorage.setItem('priceMode', 'api');
      apiKeySection.classList.remove('hidden');
      removeSaveButton();
      location.reload(); // Reload to update display
    }
  });
  
  manualModeRadio.addEventListener('change', function() {
    if (this.checked) {
      priceMode = 'manual';
      localStorage.setItem('priceMode', 'manual');
      apiKeySection.classList.add('hidden');
      location.reload(); // Reload to update display
    }
  });
}

// Add save button when manual prices are being edited
function showSaveButton() {
  let saveBtn = document.getElementById('saveManualPricesBtn');
  if (!saveBtn) {
    saveBtn = document.createElement('button');
    saveBtn.id = 'saveManualPricesBtn';
    saveBtn.innerHTML = '💾 Save Manual Prices';
    saveBtn.className = 'btn-primary';
    saveBtn.style.background = '#28a745';
    saveBtn.onclick = saveManualPrices;
    
    const controlsDiv = document.querySelector('.controls');
    if (controlsDiv) {
      controlsDiv.appendChild(saveBtn);
    }
  }
  saveBtn.classList.add('show');
}

// Remove save button
function removeSaveButton() {
  const saveBtn = document.getElementById('saveManualPricesBtn');
  if (saveBtn) saveBtn.remove();
}

// Save manually entered prices
function saveManualPrices() {
  const inputs = document.querySelectorAll('.price-input');
  let savedCount = 0;
  
  inputs.forEach(input => {
    const symbol = input.dataset.symbol;
    const price = parseFloat(input.value);
    
    if (symbol && !isNaN(price) && price > 0) {
      manualPrices[symbol] = price;
      savedCount++;
    }
  });
  
  localStorage.setItem('manualPrices', JSON.stringify(manualPrices));
  alert(`✅ Saved ${savedCount} price${savedCount !== 1 ? 's' : ''}`);
  location.reload(); // Reload to update display
}

// Get current price based on mode
function getCurrentPrice(symbol) {
  if (priceMode === 'manual') {
    return manualPrices[symbol] || 0;
  } else {
    return livePrices[symbol] || 0;
  }
}

// Handle checkbox toggle for price editing
function handlePriceCheckbox(checkbox, symbol, currentPrice) {
  const priceCell = checkbox.closest('td');
  
  if (checkbox.checked) {
    // Replace price display with input
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'price-input';
    input.dataset.symbol = symbol;
    input.value = currentPrice || '';
    input.step = '0.01';
    input.min = '0';
    input.placeholder = '0.00';
    
    priceCell.innerHTML = '';
    priceCell.appendChild(input);
    priceCell.appendChild(checkbox);
    
    input.focus();
    showSaveButton();
  } else {
    // Restore price display
    const input = priceCell.querySelector('.price-input');
    const newPrice = input ? parseFloat(input.value) : currentPrice;
    
    priceCell.innerHTML = `
      <div class="price-cell">
        <span>$${(newPrice || 0).toFixed(2)}</span>
        <input type="checkbox" class="price-edit-checkbox" data-symbol="${symbol}">
      </div>
    `;
    
    // Re-attach event listener
    const newCheckbox = priceCell.querySelector('.price-edit-checkbox');
    newCheckbox.addEventListener('change', function() {
      handlePriceCheckbox(this, symbol, newPrice);
    });
  }
}
async function processCsvData(csvData) {
  const lines = csvData.split('\n').filter(function(line) {
    return line.trim();
  });
  if (lines.length <= 1) return;
  
  const headers = lines[0].split(',').map(function(h) {
    return h.trim().toLowerCase();
  });
  const dataLines = lines.slice(1);
  
  const newTransactions = [];
  
  dataLines.forEach(function(line) {
    const values = line.split(',').map(function(v) {
      return v.trim();
    });
    if (values.length !== headers.length) return;
    
    const transaction = {};
    headers.forEach(function(header, index) {
      var value = values[index];
      if (header === 'date') {
        var dateObj;
        if (value.includes('/')) {
          var parts = value.split('/');
          if (parts.length === 3) {
            dateObj = new Date(parts[2] + '-' + parts[1] + '-' + parts[0]);
          }
        } else {
          dateObj = new Date(value);
        }
        
        if (dateObj && !isNaN(dateObj.getTime())) {
          value = dateObj.toISOString().split('T')[0] + 'T00:00:00Z';
        } else {
          value = new Date().toISOString().split('T')[0] + 'T00:00:00Z';
        }
      } else if (header === 'shares' || header === 'price') {
        value = parseFloat(value) || 0;
      } else if (header === 'symbol') {
        value = value.toUpperCase();
      } else if (header === 'portfolio') {
        // Map portfolio name to portfolio ID
        const portfolioObj = portfolios.find(p => p.name.toUpperCase() === value.toUpperCase());
        if (portfolioObj) {
          value = portfolioObj.id;
        } else {
          console.warn('Portfolio not found:', value);
        }
      }
      transaction[header] = value;
    });
    
    if (isValidTransaction(transaction)) {
      newTransactions.push(transaction);
      transactions.push(transaction);
    }
  });
  
  console.log('✅ Parsed', newTransactions.length, 'transactions from CSV');
  if (newTransactions.length > 0) {
    await saveDataToSupabase();
    alert(`✅ Imported ${newTransactions.length} transactions successfully!`);
  } else {
    alert('❌ No valid transactions found in CSV file');
  }
  
  var newSymbols = [];
  var seen = {};
  transactions.forEach(function(t) {
    if (!seen[t.symbol]) {
      if (!livePrices[t.symbol]) {
        newSymbols.push(t.symbol);
      }
      seen[t.symbol] = true;
    }
  });
  
  if (newSymbols.length > 0) {
    await fetchLivePrices(newSymbols);
    refreshPricesAndNames();
  } else {
    refreshPricesAndNames();
  }
}
async function savePricesCache() {
  for (const symbol in livePrices) {
    if (livePrices[symbol] > 0) {
      await supabase
        .from('price_cache')
        .upsert({ 
          symbol: symbol, 
          price: livePrices[symbol],
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'symbol' 
        });
    }
  }
  console.log('✅ Saved prices to Supabase');
}

async function fetchLivePrices(symbols) {
  const apiKey = localStorage.getItem('apiKey');
  if (!apiKey) {
    alert('Please set your API key in Settings');
    return;
  }
  
  // Show loading spinner
  const spinner = document.createElement('div');
  spinner.id = 'loadingSpinner';
  spinner.className = 'loading-spinner';
  spinner.innerHTML = '⏳ Loading prices...';
  document.body.appendChild(spinner);
  
  let processed = 0;
  console.log('Starting to fetch ' + symbols.length + ' prices...');
  
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    try {
      if (processed > 0 && processed % 8 === 0) {
        console.log('Rate limit pause after ' + processed + ' requests...');
        spinner.innerHTML = `⏳ Loading prices... (${processed}/${symbols.length}) - Waiting 60s`;
        await new Promise(function(resolve) {
          setTimeout(resolve, 62000);
        });
      }
      
      const proxyUrl = 'https://corsproxy.io/?';
      const apiUrl = 'https://api.twelvedata.com/price?symbol=' + symbol + '&apikey=' + apiKey;
      const response = await fetch(proxyUrl + encodeURIComponent(apiUrl));     
      const data = await response.json();
      
      if (data.code === 429) {
        console.log('Rate limited, waiting 62 seconds...');
        spinner.innerHTML = `⏳ Rate limited - Waiting 60s (${processed}/${symbols.length})`;
        await new Promise(function(resolve) {
          setTimeout(resolve, 62000);
        });
        i--;
        continue;
      }
      
      livePrices[symbol] = data.price ? parseFloat(data.price) : 0;
      processed++;
      spinner.innerHTML = `⏳ Loading prices... (${processed}/${symbols.length})`;
      console.log('Fetched ' + processed + '/' + symbols.length + ': ' + symbol + ' = $' + livePrices[symbol]);
      
      await new Promise(function(resolve) {
        setTimeout(resolve, 2000);
      });
    } catch (error) {
      console.error('Error fetching ' + symbol + ':', error);
      if (!livePrices[symbol]) {
        livePrices[symbol] = 0;
      }
      processed++;
    }
  }
  
  console.log('All prices fetched, saving cache...');
  spinner.innerHTML = '💾 Saving prices...';
  await savePricesCache();
  console.log('Cache saved, returning...');
  
  // Hide loading spinner
  const spinnerEl = document.getElementById('loadingSpinner');
  if (spinnerEl) spinnerEl.remove();
}

async function getLivePrice(symbol) {
  if (livePrices[symbol]) return;
  
  const apiKey = localStorage.getItem('apiKey');
  if (!apiKey) {
    alert('Please set your API key in Settings');
    return;
  }
  
  // Show mini loading indicator
  const spinner = document.createElement('div');
  spinner.id = 'loadingSpinner';
  spinner.className = 'loading-spinner';
  spinner.innerHTML = `⏳ Loading ${symbol} price...`;
  document.body.appendChild(spinner);
  
  try {
    const proxyUrl = 'https://corsproxy.io/?';
    const apiUrl = 'https://api.twelvedata.com/price?symbol=' + symbol + '&apikey=' + apiKey;
    const response = await fetch(proxyUrl + encodeURIComponent(apiUrl));
    const data = await response.json();
    livePrices[symbol] = data.price ? parseFloat(data.price) : 0;
    
    await supabase
      .from('price_cache')
      .upsert({ 
        symbol: symbol, 
        price: livePrices[symbol],
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'symbol' 
      });
    
    refreshPricesAndNames();
  } catch (error) {
    console.error('Error fetching price for ' + symbol, error);
    livePrices[symbol] = 0;
    refreshPricesAndNames();
  } finally {
    // Hide spinner
    const spinnerEl = document.getElementById('loadingSpinner');
    if (spinnerEl) spinnerEl.remove();
  }
}

async function refreshAllPrices() {
  if (!confirm('This will fetch fresh prices for all stocks. It may take 7-8 minutes due to API rate limits. Continue?')) {
    return;
  }
  
  const symbols = [...new Set(transactions.map(t => t.symbol))];
  console.log('Refreshing prices for ' + symbols.length + ' symbols...');
  
  const btn = document.getElementById('refreshPricesBtn');
  const originalText = btn ? btn.textContent : '';
  
  // Disable button during fetch
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.style.cursor = 'not-allowed';
  }
  
  try {
    livePrices = {};
    await fetchLivePrices(symbols);
    refreshPricesAndNames();
    alert('✅ Prices refreshed successfully!');
  } catch (error) {
    console.error('Error refreshing prices:', error);
    alert('❌ Error refreshing prices. Check console for details.');
  } finally {
    // Reset button
    if (btn) {
      btn.textContent = originalText;
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    }
  }
}