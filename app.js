const CACHE_DURATION = 4 * 60 * 60 * 1000;
let transactions = [];
let livePrices = {};
let cashFlows = [];
let sortState = {
  total: { column: 'symbol', direction: 'asc' },
  rm: { column: 'symbol', direction: 'asc' },
  sa: { column: 'symbol', direction: 'asc' },
  pro: { column: 'symbol', direction: 'asc' },
  cashflow: { column: 'date', direction: 'desc' },
  ticker: { column: 'symbol', direction: 'asc' },
  all: { column: 'symbol', direction: 'asc' },
  sold: { column: 'symbol', direction: 'asc' }
};

function formatDateDDMMYYYY(date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-GB');
}

function calculateDaysHeld(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate || Date.now());
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function isValidTransaction(t) {
  if (!t || !t.symbol || !t.shares || isNaN(new Date(t.date).getTime())) {
    return false;
  }
  if (t.type === 'dividend' && t.price === 0) {
    return true;
  }
  if (t.type === 'premium') {
    return true;
  }
  return t.price && t.price > 0;
}

function isValidForXIRR(dates, values) {
  const hasEnoughData = dates.length >= 2 && values.length >= 2;
  const hasPositive = values.some(v => v > 0);
  const hasNegative = values.some(v => v < 0);
  const uniqueDates = new Set(dates.map(d => d.toISOString().split('T')[0])).size;
  return hasEnoughData && hasPositive && hasNegative && uniqueDates > 1;
}

function calculateXIRR(dates, values, eps, maxIterations) {
  eps = eps || 1e-6;
  maxIterations = maxIterations || 100;
  if (!isValidForXIRR(dates, values)) return 0;
  const initialGuesses = [-0.9, -0.5, -0.1, 0.1, 0.5, 0.9];
  for (let g = 0; g < initialGuesses.length; g++) {
    let xirr = initialGuesses[g];
    let iteration = 0;
    while (iteration < maxIterations) {
      const npv = values.reduce(function(sum, value, i) {
        return sum + value / Math.pow(1 + xirr, calculateDaysHeld(dates[0], dates[i]) / 365);
      }, 0);
      const derivative = values.reduce(function(sum, value, i) {
        return sum - value * calculateDaysHeld(dates[0], dates[i]) / (365 * Math.pow(1 + xirr, calculateDaysHeld(dates[0], dates[i]) / 365 + 1));
      }, 0);
      if (Math.abs(derivative) < 1e-10) break;
      const newXirr = xirr - npv / derivative;
      if (Math.abs(newXirr - xirr) < eps) return newXirr;
      xirr = newXirr;
      iteration++;
    }
  }
  return 0;
}

function calculateXIRRForSymbol(symbol, allTransactions, livePrices) {
  const symbolTxns = allTransactions.filter(function(t) {
    return t.symbol === symbol && isValidTransaction(t);
  });
  if (symbolTxns.length === 0) return 0;
  const dates = [];
  const values = [];
  let remainingShares = 0;
  symbolTxns.forEach(function(t) {
    const date = new Date(t.date);
    if (isNaN(date.getTime())) return;
    const amount = t.type === 'buy' ? -t.shares * t.price : t.type === 'sell' ? t.shares * t.price : t.shares * t.price;
    dates.push(date);
    values.push(amount);
    if (t.type === 'buy') remainingShares += t.shares;
    else if (t.type === 'sell') remainingShares -= t.shares;
  });
  const today = new Date();
  const currentPrice = livePrices[symbol] || 0;
  if (remainingShares > 0 && currentPrice > 0) {
    dates.push(today);
    values.push(remainingShares * currentPrice);
  }
  return calculateXIRR(dates, values);
}

function calculatePortfolioXIRR(transactions, symbolData, livePrices) {
  const dates = [];
  const values = [];
  
  transactions.forEach(function(t) {
    if (!isValidTransaction(t)) return;

    if (!symbolData[t.symbol]) {
      symbolData[t.symbol] = { 
        buys: 0, 
        sells: 0, 
        totalCost: 0, 
        firstDate: t.date, 
        lastDate: t.date,
        portfolio: t.portfolio
      };
    }
    
    if (t.type === 'buy' || t.type === 'dividend' || t.type === 'premium') {
      if (t.type === 'buy' || t.type === 'dividend') {
        symbolData[t.symbol].buys += t.shares;
      }
      
      if (t.type === 'buy') {
        symbolData[t.symbol].totalCost += t.shares * t.price;
      }
      
      symbolData[t.symbol].portfolio = t.portfolio;
    } else if (t.type === 'sell') {
      symbolData[t.symbol].sells += t.shares;
    }
    
    const date = new Date(t.date);
    const amount = t.type === 'buy' ? -t.shares * t.price : 
           t.type === 'sell' ? t.shares * t.price : 
           t.shares * t.price;

    dates.push(date);
    values.push(amount);
  });
  
  let totalCurrentValue = 0;
  for (const symbol in symbolData) {
    if (symbolData[symbol].netShares > 0) {
      totalCurrentValue += symbolData[symbol].currentValue;
    }
  }
  
  if (totalCurrentValue > 0) {
    dates.push(new Date());
    values.push(totalCurrentValue);
  }
  
  return calculateXIRR(dates, values);
}

function initializeTabs() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      if (tab.id === 'importCsvBtn') {
        document.getElementById('csvFileInput').click();
        return;
      }
      
      tabs.forEach(function(t) {
        t.classList.remove('active');
      });
      tabContents.forEach(function(tc) {
        tc.classList.remove('active');
      });
      tab.classList.add('active');
      const content = document.getElementById(tab.dataset.tab);
      if (content) content.classList.add('active');
      
      const mainControls = document.querySelectorAll('.controls')[0];
      const portfolioTabs = ['total', 'rm', 'sa', 'pro'];
      const tabsWithDelete = ['total', 'rm', 'sa', 'pro', 'all', 'ticker', 'sold'];

      if (mainControls) {
        mainControls.querySelectorAll('select, input, button').forEach(el => el.style.display = '');
        
        if (portfolioTabs.includes(tab.dataset.tab)) {
          mainControls.style.display = 'flex';
        } else if (tabsWithDelete.includes(tab.dataset.tab)) {
          mainControls.style.display = 'flex';
          mainControls.querySelectorAll('select, input:not([type="checkbox"]), #addTransactionBtn, #clearDataBtn, #importCsvBtn, #refreshPricesBtn').forEach(el => el.style.display = 'none');
          document.getElementById('deleteSelected').style.display = 'inline-block';
        } else {
          mainControls.style.display = 'none';
        }
      }
      
      refreshPricesAndNames();
    });
  });
}

function initializeSortListeners() {
  const tables = {
    total: document.getElementById('totalTable'),
    rm: document.getElementById('rmTable'),
    sa: document.getElementById('saTable'),
    pro: document.getElementById('proTable'),
    ticker: document.getElementById('tickerTable'),
    all: document.getElementById('allTable'),
    sold: document.getElementById('soldTable')
  };
  for (const portfolio in tables) {
    const table = tables[portfolio];
    if (table) {
      const headers = table.querySelectorAll('th');
      headers.forEach(function(header) {
        header.addEventListener('click', function() {
          const column = header.dataset.sort;
          if (!column || column === 'select') return;
          const currentDirection = sortState[portfolio].direction;
          const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
          sortState[portfolio] = { column: column, direction: newDirection };
          headers.forEach(function(h) {
            h.classList.remove('sort-asc', 'sort-desc');
          });
          header.classList.add('sort-' + newDirection);
          sortTable(table, column, newDirection);
        });
      });
    }
  }
}

async function addTransaction() {
  const type = document.getElementById('type').value;
  const portfolio = document.getElementById('portfolio').value;
  const symbol = document.getElementById('symbol').value.toUpperCase().trim();
  const shares = parseFloat(document.getElementById('shares').value);
  const priceInput = document.getElementById('price').value;
  const price = priceInput === '' ? 0 : parseFloat(priceInput);
  const dateInput = document.getElementById('date').value;
  
  if (!symbol || isNaN(shares) || !dateInput) {
    alert('Please fill in symbol, shares, and date');
    return;
  }
  
  if (type !== 'premium' && type !== 'dividend' && (isNaN(price) || price <= 0)) {
    alert('Please enter a valid price');
    return;
  }
  
  const date = dateInput + 'T00:00:00Z';
  const transaction = { 
    type: type, 
    portfolio: portfolio, 
    symbol: symbol, 
    shares: shares, 
    price: price, 
    date: date
  };
  
  if (type === 'premium') {
    transaction.premium_type = document.getElementById('premiumType').value;
  }
  
  if (isValidTransaction(transaction)) {
    const { error } = await supabase.from('transactions').insert([transaction]);
    
    if (error) {
      console.error('Error saving transaction:', error);
      alert('Error saving transaction: ' + error.message);
      return;
    }
    
    transactions.push(transaction);
    
    document.getElementById('symbol').value = '';
    document.getElementById('shares').value = '';
    document.getElementById('price').value = '';
    document.getElementById('date').value = '';
    
    if (!livePrices[symbol]) {
      await getLivePrice(symbol);
    } else {
      refreshPricesAndNames();
    }
  } else {
    alert('Invalid transaction data');
  }
}

async function confirmClearData() {
  if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
    const { error: txnError } = await supabase
      .from('transactions')
      .delete()
      .neq('id', 0);
    
    const { error: cashError } = await supabase
      .from('cash_flows')
      .delete()
      .neq('id', 0);
    
    const { error: priceError } = await supabase
      .from('price_cache')
      .delete()
      .neq('symbol', '');
    
    if (txnError || cashError || priceError) {
      console.error('Error clearing data:', { txnError, cashError, priceError });
      alert('Error clearing some data');
    }
    
    transactions = [];
    cashFlows = [];
    livePrices = {};
    
    refreshPricesAndNames();
    updateCashFlowTable();
  }
}

async function confirmDeleteSelected() {
  const activeTab = document.querySelector('.tab.active');
  const currentTab = activeTab ? activeTab.dataset.tab : 'total';
  
  let tableId;
  if (currentTab === 'total') tableId = 'totalTable';
  else if (currentTab === 'rm') tableId = 'rmTable';
  else if (currentTab === 'sa') tableId = 'saTable';
  else if (currentTab === 'pro') tableId = 'proTable';
  else if (currentTab === 'all') tableId = 'allTable';
  else if (currentTab === 'ticker') tableId = 'tickerTable';
  else if (currentTab === 'sold') tableId = 'soldTable';
  else return;
  
  const table = document.getElementById(tableId);
  if (!table) return;
  
  const checkboxes = table.querySelectorAll('tbody .select-row:checked');
  
  if (checkboxes.length === 0) {
    alert('Please select transactions to delete');
    return;
  }
  
  if (!confirm('Are you sure you want to delete ' + checkboxes.length + ' selected transaction(s)?')) {
    return;
  }
  
  const transactionsToDelete = [];
  checkboxes.forEach(function(checkbox) {
    const row = checkbox.closest('tr');
    const cells = row.cells;
    
    if (['totalTable', 'rmTable', 'saTable', 'proTable'].includes(tableId)) {
      const symbol = cells[1].textContent;
      transactionsToDelete.push({ symbol: symbol, type: 'portfolio' });
    }
    else if (tableId === 'allTable' || tableId === 'tickerTable') {
      const type = cells[1].textContent.toLowerCase();
      const portfolio = cells[2].textContent.toLowerCase();
      const symbol = cells[3].textContent;
      const shares = parseFloat(cells[4].textContent);
      const price = parseFloat(cells[5].textContent.replace('$', ''));
      const date = cells[6].textContent;
      
      transactionsToDelete.push({ type: type, portfolio: portfolio, symbol: symbol, shares: shares, price: price, date: date });
    }
    else if (tableId === 'soldTable') {
      const symbolText = cells[1].textContent;
      const symbol = symbolText.replace(' (Premium)', '').trim();
      const isPremium = symbolText.includes('(Premium)');
      
      if (isPremium) {
        transactionsToDelete.push({ symbol: symbol, type: 'premium_delete' });
      } else {
        transactionsToDelete.push({ symbol: symbol, type: 'portfolio' });
      }
    }
  });
  
  if (transactionsToDelete[0] && (transactionsToDelete[0].type === 'portfolio' || transactionsToDelete[0].type === 'premium_delete')) {
    for (const item of transactionsToDelete) {
      if (item.type === 'premium_delete') {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('symbol', item.symbol)
          .eq('type', 'premium');
        
        if (error) {
          console.error('Error deleting premium:', error);
        }
      } else {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('symbol', item.symbol);
        
        if (error) {
          console.error('Error deleting:', error);
        }
      }
    }
  } else {
    for (const item of transactionsToDelete) {
      const dateParts = item.date.split('/');
      const isoDate = dateParts[2] + '-' + dateParts[1] + '-' + dateParts[0] + 'T00:00:00Z';
      
      const { error } = await supabase
        .from('transactions')
        .delete()
        .match({
          type: item.type,
          portfolio: item.portfolio,
          symbol: item.symbol,
          shares: item.shares,
          price: item.price,
          date: isoDate
        });
      
      if (error) {
        console.error('Error deleting specific transaction:', error);
      }
    }
  }
  
  await loadDataFromSupabase();
  refreshPricesAndNames();
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
          console.warn('Invalid date format:', value, 'Using today');
          value = new Date().toISOString().split('T')[0] + 'T00:00:00Z';
        }
      } else if (header === 'shares' || header === 'price') {
        value = parseFloat(value) || 0;
      } else if (header === 'symbol') {
        value = value.toUpperCase();
      }
      transaction[header] = value;
    });
    
    if (isValidTransaction(transaction)) {
      newTransactions.push(transaction);
      transactions.push(transaction);
    }
  });
  
  if (newTransactions.length > 0) {
    const { error } = await supabase
      .from('transactions')
      .insert(newTransactions);
    
    if (error) {
      console.error('Error saving CSV transactions:', error);
      alert('Error importing CSV: ' + error.message);
      return;
    }
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
    console.log('Fetching prices for ' + newSymbols.length + ' new symbols from CSV');
    await fetchLivePrices(newSymbols);
    refreshPricesAndNames();
  } else {
    refreshPricesAndNames();
  }
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
  summaryRow.innerHTML = '<td><input type="checkbox" class="select-row"></td><td>SUMMARY</td><td>ALL</td><td>' + tickerInput + '</td><td>' + totalShares.toFixed(2) + '</td><td>' + priceDisplay + '</td><td>' + formatDateDDMMYYYY(Date.now()) + '</td><td>$' + totalDividends.toFixed(2) + '</td>';
  tbody.appendChild(summaryRow);

  tickerTxns.forEach(function(t) {
    const value = t.type === 'dividend' ? t.shares * t.price : t.type === 'buy' ? -t.shares * t.price : t.shares * t.price;
    const txRow = document.createElement('tr');
    txRow.innerHTML = '<td><input type="checkbox" class="select-row"></td><td>' + t.type.toUpperCase() + '</td><td>' + t.portfolio.toUpperCase() + '</td><td>' + t.symbol + '</td><td>' + t.shares.toFixed(2) + '</td><td>$' + t.price.toFixed(2) + '</td><td>' + formatDateDDMMYYYY(t.date) + '</td><td>' + (t.type === 'dividend' ? '$' + value.toFixed(2) : '') + '</td>';
    tbody.appendChild(txRow);
  });
}

function clearTickerSearch() {
  document.getElementById('tickerSearchInput').value = '';
  const tbody = document.getElementById('tickerTable').querySelector('tbody');
  tbody.innerHTML = '';
}

function sortTable(table, column, direction) {
  if (!table || !(table instanceof HTMLTableElement)) return;
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const headers = Array.from(table.querySelectorAll('th'));
  const columnIndex = headers.findIndex(function(th) {
    return th.dataset.sort === column;
  });
  if (columnIndex === -1) return;
  
  rows.sort(function(a, b) {
    if (!a.cells[columnIndex] || !b.cells[columnIndex]) return 0;
    
    let aValue = a.cells[columnIndex].textContent;
    let bValue = b.cells[columnIndex].textContent;
    aValue = aValue.replace(/\$/g, '').replace(/%/g, '').replace(/ days/g, '').trim();
    bValue = bValue.replace(/\$/g, '').replace(/%/g, '').replace(/ days/g, '').trim();
    
    if (aValue.match(/^\d{2}\/\d{2}\/\d{4}$/) && bValue.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const aParts = aValue.split('/');
      const bParts = bValue.split('/');
      aValue = new Date(aParts[2], aParts[1] - 1, aParts[0]).getTime();
      bValue = new Date(bParts[2], bParts[1] - 1, bParts[0]).getTime();
    } else if (!isNaN(aValue) && !isNaN(bValue)) {
      aValue = parseFloat(aValue);
      bValue = parseFloat(bValue);
    }
    
    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });
  rows.forEach(function(row) {
    tbody.appendChild(row);
  });
}

function refreshPricesAndNames() {
  const symbolData = {};
  const portfolioHoldings = { rm: {}, sa: {}, pro: {} };
  
  transactions.forEach(function(t) {
    if (!isValidTransaction(t)) return;
    if (!symbolData[t.symbol]) {
      symbolData[t.symbol] = { 
        buys: 0,
        paidShares: 0,
        sells: 0, 
        totalCost: 0, 
        firstDate: t.date, 
        lastDate: t.date,
        portfolio: t.portfolio
      };
    }
    
    if (t.type === 'buy' || t.type === 'dividend' || t.type === 'premium') {
      if (t.type === 'buy' || t.type === 'dividend') {
        symbolData[t.symbol].buys += t.shares;
      }
      
      if (t.type === 'buy') {
        symbolData[t.symbol].totalCost += t.shares * t.price;
      }
      
      symbolData[t.symbol].portfolio = t.portfolio;
    } else if (t.type === 'sell') {
      symbolData[t.symbol].sells += t.shares;
    }
    
    if (t.date < symbolData[t.symbol].firstDate) symbolData[t.symbol].firstDate = t.date;
    if (t.date > symbolData[t.symbol].lastDate) symbolData[t.symbol].lastDate = t.date;
  });

  const portfolioData = { rm: 0, sa: 0, pro: 0, totalValue: 0, totalCost: 0 };
  
  for (const symbol in symbolData) {
    const netShares = symbolData[symbol].buys - symbolData[symbol].sells;
    if (netShares > 0.001) {
      let baseCost = symbolData[symbol].totalCost;
      
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
      
      const avgCost = symbolData[symbol].buys > 0 ? adjustedTotalCost / symbolData[symbol].buys : 0;
      const currentPrice = livePrices[symbol] || 0;
      const currentValue = netShares * currentPrice;
      const totalCostForHolding = netShares * avgCost;
      
      symbolData[symbol].netShares = netShares;
      symbolData[symbol].avgCost = avgCost;
      symbolData[symbol].currentPrice = currentPrice;
      symbolData[symbol].currentValue = currentValue;
      symbolData[symbol].totalCost = totalCostForHolding;
      symbolData[symbol].gainLoss = currentValue - totalCostForHolding;
      symbolData[symbol].gainLossPercent = totalCostForHolding ? (symbolData[symbol].gainLoss / totalCostForHolding * 100).toFixed(2) : 0;
      symbolData[symbol].xirr = calculateXIRRForSymbol(symbol, transactions, livePrices);
      
      const buyTxns = transactions.filter(function(t) {
        return t.symbol === symbol && (t.type === 'buy' || t.type === 'dividend');
      });
      const totalBuyShares = buyTxns.reduce(function(sum, t) {
        return sum + t.shares;
      }, 0);
      symbolData[symbol].weightedDays = totalBuyShares > 0 ? buyTxns.reduce(function(sum, t) {
        var days = calculateDaysHeld(t.date);
        return sum + t.shares * days;
      }, 0) / totalBuyShares : 0;

      const portfolio = symbolData[symbol].portfolio;
      portfolioHoldings[portfolio][symbol] = true;
      portfolioData.totalValue += (currentValue || 0);
      portfolioData.totalCost += (totalCostForHolding || 0);
    }
  }

  portfolioData.rm = Object.keys(portfolioHoldings.rm).length;
  portfolioData.sa = Object.keys(portfolioHoldings.sa).length;
  portfolioData.pro = Object.keys(portfolioHoldings.pro).length;

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

  updateTables(symbolData, portfolioData, soldData);
  const activeTab = document.querySelector('.tab.active');
  const currentPortfolio = activeTab ? activeTab.dataset.tab : 'total';
  const portfolioFilter = ['total', 'rm', 'sa', 'pro'].includes(currentPortfolio) ? currentPortfolio : 'total';
 
  updateSummary(symbolData, portfolioData, portfolioFilter, soldData);
  updateCashFlowTable();
}

function updateTables(symbolData, portfolioData, soldData) {
  const tables = {
    total: document.getElementById('totalTable'),
    rm: document.getElementById('rmTable'),
    sa: document.getElementById('saTable'),
    pro: document.getElementById('proTable'),
    all: document.getElementById('allTable'),
    sold: document.getElementById('soldTable')
  };
  
  for (const portfolio in tables) {
    const table = tables[portfolio];
    if (!table) continue;
    const tbody = table.querySelector('tbody');
    if (!tbody) continue;
    tbody.innerHTML = '';
    
    if (portfolio === 'all') {
      transactions.forEach(function(t) {
        const row = document.createElement('tr');
        row.innerHTML = '<td><input type="checkbox" class="select-row"></td><td>' + t.type + '</td><td>' + t.portfolio + '</td><td>' + t.symbol + '</td><td>' + t.shares.toFixed(2) + '</td><td>$' + t.price.toFixed(2) + '</td><td>' + formatDateDDMMYYYY(t.date) + '</td>';
        tbody.appendChild(row);
      });
    } else if (portfolio === 'sold') {
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
        
        row.innerHTML = '<td><input type="checkbox" class="select-row"></td>' +
          '<td>' + symbol + (data.isPremium ? ' (Premium)' : '') + '</td>' +
          '<td>' + data.portfolio.toUpperCase() + '</td>' +
          '<td>' + data.sharesSold.toFixed(2) + '</td>' +
          '<td>$' + data.avgBuyPrice.toFixed(2) + '</td>' +
          '<td>$' + data.avgSellPrice.toFixed(2) + '</td>' +
          '<td>$' + (currentPrice || 0).toFixed(2) + '</td>' +
          '<td class="' + (data.realizedGain < 0 ? 'negative' : 'positive') + '">$' + data.realizedGain.toFixed(2) + '</td>' +
          '<td class="' + (data.gainPercent < 0 ? 'negative' : 'positive') + '">' + data.gainPercent + '%</td>' +
          '<td>' + daysHeld + '</td>' +
          '<td>' + (daysHeld < 90 ? 'N/A' : (xirr * 100).toFixed(2) + '%') + '</td>' +
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
        row.innerHTML = '<td><input type="checkbox" class="select-row"></td><td>' + symbol + '</td><td>' + (data.netShares || 0).toFixed(2) + '</td><td>$' + (data.avgCost || 0).toFixed(2) + '</td><td>$' + (data.currentPrice || 0).toFixed(2) + '</td><td>$' + (data.totalCost || 0).toFixed(2) + '</td><td>$' + (data.currentValue || 0).toFixed(2) + '</td><td>' + portfolioPercent + '%</td><td class="' + (data.gainLoss < 0 ? 'negative' : '') + '">$' + (data.gainLoss || 0).toFixed(2) + '</td><td class="' + ((data.gainLossPercent || 0) < 0 ? 'negative' : '') + '">' + (data.gainLossPercent || 0) + '%</td><td>' + (data.weightedDays < 90 ? 'N/A' : ((data.xirr || 0) * 100).toFixed(2) + '%') + '</td><td>' + Math.round(data.weightedDays || 0) + ' days</td><td>' + formatDateDDMMYYYY(data.firstDate) + '</td><td>' + formatDateDDMMYYYY(data.lastDate) + '</td>';
        tbody.appendChild(row);
      }
    }
  }

  for (const portfolio in sortState) {
    const state = sortState[portfolio];
    const table = tables[portfolio];
    if (table) sortTable(table, state.column, state.direction);
  }
}

function updateSummary(symbolData, portfolioData, currentPortfolio, soldData) {
  currentPortfolio = currentPortfolio || 'total';
  
  if (currentPortfolio === 'sold') {
    let totalRealizedGain = 0;
    let rmRealizedGain = 0;
    let saRealizedGain = 0;
    let proRealizedGain = 0;
    
    for (const key in soldData) {
      const data = soldData[key];
      totalRealizedGain += data.realizedGain;
      
      if (data.portfolio === 'rm') rmRealizedGain += data.realizedGain;
      else if (data.portfolio === 'sa') saRealizedGain += data.realizedGain;
      else if (data.portfolio === 'pro') proRealizedGain += data.realizedGain;
    }
    
    document.getElementById('totalValue').textContent = '$' + totalRealizedGain.toFixed(2);
    document.getElementById('totalCost').textContent = 'Total Realized Gain';
    
    document.getElementById('realizedGainLoss').textContent = '$' + rmRealizedGain.toFixed(2);
    document.getElementById('realizedGainPercent').textContent = 'RM Portfolio';
    
    document.getElementById('totalGainLoss').textContent = '$' + saRealizedGain.toFixed(2);
    document.getElementById('totalGainLossPercent').textContent = 'SA Portfolio';
    
    document.getElementById('stockCount').textContent = '$' + proRealizedGain.toFixed(2);
    document.getElementById('holdingsBreakdown').textContent = 'PRO Portfolio';
    
    document.getElementById('portfolioXIRR').closest('.summary-card').style.display = 'none';
    document.getElementById('weightedDaysHeld').closest('.summary-card').style.display = 'none';
    
    return;
  }
  
  document.getElementById('portfolioXIRR').closest('.summary-card').style.display = 'block';
  document.getElementById('weightedDaysHeld').closest('.summary-card').style.display = 'block';
  
  let filteredSymbolData = symbolData;
  let displayValue = portfolioData.totalValue;
  let displayCost = portfolioData.totalCost;
  let holdings = { rm: portfolioData.rm, sa: portfolioData.sa, pro: portfolioData.pro };
  
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
    document.getElementById('holdingsBreakdown').textContent = 'RM: ' + holdings.rm + ' | SA: ' + holdings.sa + ' | PRO: ' + holdings.pro;
  } else {
    document.getElementById('stockCount').textContent = totalHoldings + ' Holdings';
    document.getElementById('holdingsBreakdown').textContent = currentPortfolio.toUpperCase() + ' Portfolio';
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
  console.log('Saved prices to Supabase');
}

async function fetchLivePrices(symbols) {
  const apiKey = '7563c9356b204c13822aa6e22185302a';
  let processed = 0;
  console.log('Starting to fetch ' + symbols.length + ' prices...');
  
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    try {
      if (processed > 0 && processed % 8 === 0) {
        console.log('Rate limit pause after ' + processed + ' requests...');
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
        await new Promise(function(resolve) {
          setTimeout(resolve, 62000);
        });
        i--;
        continue;
      }
      
      livePrices[symbol] = data.price ? parseFloat(data.price) : 0;
      processed++;
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
  await savePricesCache();
  console.log('Cache saved, returning...');
}

async function getLivePrice(symbol) {
  if (livePrices[symbol]) return;
  
  try {
    const proxyUrl = 'https://corsproxy.io/?';
    const apiUrl = 'https://api.twelvedata.com/price?symbol=' + symbol + '&apikey=7563c9356b204c13822aa6e22185302a';
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
  }
}

async function addCashFlow() {
  const type = document.getElementById('cashFlowType').value;
  const amount = parseFloat(document.getElementById('cashAmount').value);
  const dateInput = document.getElementById('cashDate').value;
  
  if (!amount || amount <= 0 || !dateInput) {
    alert('Please fill in amount and date');
    return;
  }
  
  const yearMatch = dateInput.match(/^(\d{4})-/);
  if (!yearMatch || yearMatch[1].length !== 4) {
    alert('Please enter a valid 4-digit year');
    return;
  }
  
  const date = dateInput + 'T00:00:00Z';
  const cashFlow = { type: type, amount: amount, date: date };
  
  cashFlows.push(cashFlow);
  const { error } = await supabase.from('cash_flows').insert([cashFlow]);

  if (error) {
    console.error('Error saving cash flow:', error);
    alert('Error saving cash flow: ' + error.message);
    return;
  }  
  
  document.getElementById('cashAmount').value = '';
  document.getElementById('cashDate').value = '';
  
  updateCashFlowTable();
}

function calculateCashFlowXIRR(cashFlows, currentPortfolioValue) {
  if (cashFlows.length === 0) return 0;
  
  const dates = [];
  const values = [];
  
  cashFlows.forEach(function(cf) {
    const date = new Date(cf.date);
    const amount = cf.type === 'deposit' ? -cf.amount : cf.amount;
    dates.push(date);
    values.push(amount);
  });
  
  if (currentPortfolioValue > 0) {
    dates.push(new Date());
    values.push(currentPortfolioValue);
  }
  
  return calculateXIRR(dates, values);
}

function updateCashFlowTable() {
  const table = document.getElementById('cashFlowTable');
  if (!table) return;
  
  const activeTab = document.querySelector('.tab.active');
  const isCashFlowTab = activeTab && activeTab.dataset.tab === 'cashflow';
  
  const regularCards = [
    document.getElementById('totalValue'),
    document.getElementById('totalCost'),
    document.getElementById('realizedGainLoss'),
    document.getElementById('totalGainLoss'),
    document.getElementById('stockCount'),
    document.getElementById('portfolioXIRR'),
    document.getElementById('weightedDaysHeld')
  ];
  
  regularCards.forEach(function(el) {
    if (el && el.closest('.summary-card')) {
      el.closest('.summary-card').style.display = isCashFlowTab ? 'none' : 'block';
    }
  });
  
  for (let i = 1; i <= 5; i++) {
    const card = document.getElementById('cashFlowCard' + i);
    if (card) {
      card.style.display = isCashFlowTab ? 'block' : 'none';
    }
  }
  
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  let totalCashInput = 0;
  let totalWeightedDays = 0;
  
  cashFlows.forEach(function(cf) {
    const row = document.createElement('tr');
    const displayType = cf.type.toUpperCase();
    const daysHeld = calculateDaysHeld(cf.date);
    
    row.innerHTML = '<td><input type="checkbox" class="select-row"></td>' +
      '<td>' + displayType + '</td>' +
      '<td>$' + cf.amount.toFixed(2) + '</td>' +
      '<td>' + formatDateDDMMYYYY(cf.date) + '</td>' +
      '<td>' + daysHeld + ' days</td>';
    tbody.appendChild(row);
    
    if (cf.type === 'deposit') {
      totalCashInput += cf.amount;
      totalWeightedDays += cf.amount * daysHeld;
    } else {
      totalCashInput -= cf.amount;
    }
  });
  
  const portfolioValueText = document.getElementById('totalValue');
  if (!portfolioValueText) return;
  
  const currentPortfolioValue = parseFloat(portfolioValueText.textContent.replace('$', '').replace(/,/g, '')) || 0;
  
  const cashFlowXIRR = calculateCashFlowXIRR(cashFlows, currentPortfolioValue);
  const cashFlowGainLoss = currentPortfolioValue - totalCashInput;
  const cashFlowGainPercent = totalCashInput > 0 ? (cashFlowGainLoss / totalCashInput * 100) : 0;
  const weightedAvgDays = totalCashInput > 0 ? Math.round(totalWeightedDays / totalCashInput) : 0;
  
  const totalCashInputEl = document.getElementById('totalCashInput');
  const cashFlowPortfolioValueEl = document.getElementById('cashFlowPortfolioValue');
  const cashFlowXIRREl = document.getElementById('cashFlowXIRR');
  const cashFlowWeightedDaysEl = document.getElementById('cashFlowWeightedDays');
  const cashFlowGainLossEl = document.getElementById('cashFlowGainLoss');
  const cashFlowGainPercentEl = document.getElementById('cashFlowGainPercent');
  
  if (totalCashInputEl) totalCashInputEl.textContent = '$' + totalCashInput.toFixed(2);
  if (cashFlowPortfolioValueEl) cashFlowPortfolioValueEl.textContent = '$' + currentPortfolioValue.toFixed(2);
  if (cashFlowXIRREl) cashFlowXIRREl.textContent = (cashFlowXIRR * 100).toFixed(2) + '%';
  if (cashFlowWeightedDaysEl) cashFlowWeightedDaysEl.textContent = weightedAvgDays + ' days';
  
  if (cashFlowGainLossEl) {
    cashFlowGainLossEl.textContent = '$' + cashFlowGainLoss.toFixed(2);
    cashFlowGainLossEl.className = 'value ' + (cashFlowGainLoss < 0 ? 'negative' : 'positive');
  }
  
  if (cashFlowGainPercentEl) {
    cashFlowGainPercentEl.textContent = cashFlowGainPercent.toFixed(2) + '%';
  }
}

async function deleteCashFlowSelected() {
  const table = document.getElementById('cashFlowTable');
  if (!table) return;
  
  const checkboxes = table.querySelectorAll('tbody .select-row:checked');
  
  if (checkboxes.length === 0) {
    alert('Please select cash flows to delete');
    return;
  }
  
  if (!confirm('Are you sure you want to delete ' + checkboxes.length + ' selected cash flow(s)?')) {
    return;
  }
  
  const cashFlowsToDelete = [];
  checkboxes.forEach(function(checkbox) {
    const row = checkbox.closest('tr');
    const cells = row.cells;
    
    const type = cells[1].textContent.toLowerCase();
    const amount = parseFloat(cells[2].textContent.replace('$', '').replace(/,/g, ''));
    const date = cells[3].textContent;
    
    cashFlowsToDelete.push({ type, amount, date });
  });
  
  for (const cf of cashFlowsToDelete) {
    const dateParts = cf.date.split('/');
    const isoDate = dateParts[2] + '-' + dateParts[1] + '-' + dateParts[0] + 'T00:00:00Z';
    
    await supabase
      .from('cash_flows')
      .delete()
      .match({
        type: cf.type,
        amount: cf.amount,
        date: isoDate
      });
  }
  
  cashFlowsToDelete.forEach(function(cfToDelete) {
    const index = cashFlows.findIndex(function(cf) {
      return cf.type === cfToDelete.type && 
             cf.amount === cfToDelete.amount &&
             formatDateDDMMYYYY(cf.date) === cfToDelete.date;
    });
    if (index !== -1) {
      cashFlows.splice(index, 1);
    }
  });
  
  updateCashFlowTable();
}

async function loadDataFromSupabase() {
  try {
    const { data: txns, error: txnError } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: true });
    
    if (!txnError && txns) {
      transactions = txns.map(t => ({
        type: t.type,
        portfolio: t.portfolio,
        symbol: t.symbol,
        shares: parseFloat(t.shares),
        price: parseFloat(t.price),
        date: t.date,
        premium_type: t.premium_type || null
      }));
      console.log('Loaded ' + transactions.length + ' transactions from Supabase');
    }
    
    const { data: flows, error: flowError } = await supabase
      .from('cash_flows')
      .select('*')
      .order('date', { ascending: true });
    
    if (!flowError && flows) {
      cashFlows = flows.map(cf => ({
        type: cf.type,
        amount: parseFloat(cf.amount),
        date: cf.date
      }));
      console.log('Loaded ' + cashFlows.length + ' cash flows from Supabase');
    }
    
    const { data: prices, error: priceError } = await supabase
      .from('price_cache')
      .select('*');
    
    if (!priceError && prices) {
      prices.forEach(p => {
        livePrices[p.symbol] = parseFloat(p.price);
      });
      console.log('Loaded ' + Object.keys(livePrices).length + ' cached prices from Supabase');
    }
  } catch (error) {
    console.error('Error loading data from Supabase:', error);
  }
}

async function refreshAllPrices() {
  if (!confirm('This will fetch fresh prices for all stocks. It may take 7-8 minutes due to API rate limits. Continue?')) {
    return;
  }
  
  const symbols = [...new Set(transactions.map(t => t.symbol))];
  console.log('Refreshing prices for ' + symbols.length + ' symbols...');
  
  livePrices = {};
  
  await fetchLivePrices(symbols);
  
  refreshPricesAndNames();
  
  alert('Prices refreshed successfully!');
}

async function init() {
  initializeTabs();
  initializeSortListeners();
  
  await loadDataFromSupabase();
  
  document.getElementById('addCashFlowBtn').addEventListener('click', addCashFlow);
  document.getElementById('addTransactionBtn').addEventListener('click', addTransaction);
  document.getElementById('clearDataBtn').addEventListener('click', confirmClearData);
  document.getElementById('deleteSelected').addEventListener('click', confirmDeleteSelected);
  document.getElementById('importCsvBtn').addEventListener('click', function() {
    document.getElementById('csvFileInput').click();
  });
  document.getElementById('csvFileInput').addEventListener('change', handleCsvImport);
  document.getElementById('searchTickerBtn').addEventListener('click', searchTicker);
  document.getElementById('clearTickerBtn').addEventListener('click', clearTickerSearch);
  document.getElementById('deleteCashFlowSelected').addEventListener('click', deleteCashFlowSelected);
  document.getElementById('refreshPricesBtn').addEventListener('click', refreshAllPrices);
  
  document.getElementById('type').addEventListener('change', function() {
    const premiumTypeSelect = document.getElementById('premiumType');
    if (this.value === 'premium') {
      premiumTypeSelect.style.display = 'inline-block';
    } else {
      premiumTypeSelect.style.display = 'none';
    }
  });
  
  const symbols = [];
  const seen = {};
  transactions.forEach(function(t) {
    if (!seen[t.symbol]) {
      symbols.push(t.symbol);
      seen[t.symbol] = true;
    }
  });
  
  refreshPricesAndNames();
  
  if (symbols.length > 0 && Object.keys(livePrices).length === 0) {
    console.log('Fetching prices for ' + symbols.length + ' symbols');
    await fetchLivePrices(symbols);
    console.log('Price fetch complete, refreshing display');
    refreshPricesAndNames();
  }
  
  updateCashFlowTable();
}

init();