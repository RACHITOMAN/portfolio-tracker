function populatePortfolioFilter() {
  const filterPortfolio = document.getElementById('filterPortfolio');
  if (!filterPortfolio) return;
  
  const userPortfolios = portfolios.filter(p => p.id !== 'total');
  
  filterPortfolio.innerHTML = '<option value="">All Portfolios</option>' +
    userPortfolios.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}
function checkFirstVisit() {
  const hasVisited = localStorage.getItem('hasVisitedPortfolio');
  if (!hasVisited) {
    document.getElementById('welcomeModal').classList.add('active');
    localStorage.setItem('hasVisitedPortfolio', 'true');
  } else {
    checkApiKey();
  }
}

function checkApiKey() {
  const apiKey = localStorage.getItem('apiKey');
  if (!apiKey) {
    document.getElementById('settingsModal').classList.add('active');
    alert('Please enter your Twelve Data API key to use the portfolio tracker.');
  }
}

function saveApiKey() {
  const apiKey = document.getElementById('apiKeyInput').value.trim();
  const statusEl = document.getElementById('apiKeyStatus');
  
  if (!apiKey) {
    statusEl.textContent = 'Please enter a valid API key';
    statusEl.className = 'error';
    return;
  }
  
  localStorage.setItem('apiKey', apiKey);
  statusEl.textContent = '✓ API key saved successfully!';
  statusEl.className = 'success';
  
  setTimeout(() => {
    document.getElementById('settingsModal').classList.remove('active');
  }, 1500);
}

function loadApiKey() {
  const apiKey = localStorage.getItem('apiKey');
  if (apiKey) {
    document.getElementById('apiKeyInput').value = apiKey;
  }
}

// ============ PORTFOLIO MANAGEMENT ============

function initializePortfolios() {
  updatePortfolioDropdown();
  updatePortfolioTabs();
  updatePortfolioList();
}

function updatePortfolioDropdown() {
  const dropdown = document.getElementById('portfolio');
  dropdown.innerHTML = '<option value="">Select Portfolio</option>';
  
  portfolios.filter(p => p.id !== 'total').forEach(portfolio => {
    const option = document.createElement('option');
    option.value = portfolio.id;
    option.textContent = portfolio.name;
    dropdown.appendChild(option);
  });
}

function updatePortfolioTabs() {
  const tabsContainer = document.getElementById('mainTabs');
  
  // Remove existing custom portfolio tabs
  const existingCustomTabs = tabsContainer.querySelectorAll('.tab.custom-portfolio');
  existingCustomTabs.forEach(tab => tab.remove());
  
  // Remove existing custom tab content
  const existingCustomContent = document.querySelectorAll('.tab-content.custom-portfolio');
  existingCustomContent.forEach(content => content.remove());
  
  // Add custom portfolio tabs before "Sold Positions"
  const soldTab = tabsContainer.querySelector('[data-tab="sold"]');
  
  portfolios.filter(p => p.id !== 'total').forEach((portfolio, index) => {
    // Create tab button
    const tab = document.createElement('button');
    tab.className = `tab custom-portfolio ${PORTFOLIO_COLORS[portfolio.color]}`;
    tab.dataset.tab = portfolio.id;
    tab.textContent = portfolio.name;
    tabsContainer.insertBefore(tab, soldTab);
    
    // Create tab content
    const content = document.createElement('div');
    content.id = portfolio.id;
    content.className = 'tab-content custom-portfolio';
    content.innerHTML = `
      <div class="table-responsive">
        <table id="${portfolio.id}Table">
      <thead>
  <tr>
    <th data-sort="select" style="width: 40px;"><input type="checkbox" class="select-all"></th>
    <th data-sort="symbol">Symbol</th>
    <th data-sort="shares">Shares</th>
    <th data-sort="avgCost">Avg Cost</th>
    <th data-sort="currentPrice">Current Price</th>
    <th data-sort="totalCost">Cost Basis</th>
    <th data-sort="currentValue">Current Value</th>
    <th data-sort="gainLoss">Unrealized Gain/Loss</th>
    <th data-sort="gainLossPercent">Gain/Loss %</th>
    <th data-sort="xirr">XIRR</th>
    <th data-sort="weightedDays" class="weighted-days-held">Weighted Avg Days Held</th>
    <th data-sort="percentPortfolio">Portfolio %</th>
  </tr>
</thead>
          <tbody></tbody>
        </table>
      </div>
    `;
    
    document.querySelector('.main-content').appendChild(content);
    
    // Add sort state for this portfolio
    sortState[portfolio.id] = { column: 'symbol', direction: 'asc' };
  });
  
  // Reattach tab listeners
  initializeTabs();
  initializeSortListeners();
}

function updatePortfolioList() {
  const listEl = document.getElementById('portfolioList');
  listEl.innerHTML = '';
  
  portfolios.filter(p => p.id !== 'total').forEach((portfolio, index) => {
    const item = document.createElement('div');
    item.className = `portfolio-item ${PORTFOLIO_COLORS[portfolio.color]}`;
    item.innerHTML = `
      <input type="text" value="${portfolio.name}" data-id="${portfolio.id}" class="portfolio-name-input">
      <button class="btn-delete" onclick="deletePortfolio('${portfolio.id}')">Delete</button>
    `;
    listEl.appendChild(item);
  });
  
  // Add listeners for name changes
  document.querySelectorAll('.portfolio-name-input').forEach(input => {
    input.addEventListener('change', function() {
      updatePortfolioName(this.dataset.id, this.value);
    });
  });
}

function addPortfolio() {
  if (portfolios.length >= 6) { // 1 total + 5 custom
    alert('Maximum 5 custom portfolios allowed');
    return;
  }
  
  const portfolioNumber = portfolios.length;
  const newPortfolio = {
    id: `portfolio-${Date.now()}`,
    name: `Portfolio ${portfolioNumber}`,
    color: portfolioNumber
  };
  
  portfolios.push(newPortfolio);
  savePortfolios();
  initializePortfolios();
}

function updatePortfolioName(id, newName) {
  const portfolio = portfolios.find(p => p.id === id);
  if (portfolio) {
    portfolio.name = newName;
    savePortfolios();
    updatePortfolioTabs();
  }
}
function savePortfolios() {
  localStorage.setItem('portfolios', JSON.stringify(portfolios));
}

// ============ DATE CONVERSION ============

function convertDateForSupabase(dateValue) {
  if (!dateValue) return null;
  
  // If already a proper ISO string, return as-is
  if (typeof dateValue === 'string' && dateValue.includes('T') && dateValue.includes('Z')) {
    return dateValue;
  }
  
  let dateObj;
  
  // Handle Date object
  if (dateValue instanceof Date) {
    dateObj = dateValue;
  }
  // Handle DD/MM/YYYY format
  else if (typeof dateValue === 'string' && dateValue.includes('/')) {
    const parts = dateValue.split('/');
    if (parts.length === 3) {
      const day = parts[0];
      const month = parts[1];
      const year = parts[2];
      dateObj = new Date(year, month - 1, day);
    }
  }
  // Handle YYYY-MM-DD format (from date picker)
  else if (typeof dateValue === 'string' && dateValue.length === 10 && dateValue.charAt(4) === '-') {
    dateObj = new Date(dateValue + 'T00:00:00Z');
  }
  // Handle timestamp
  else if (typeof dateValue === 'number') {
    dateObj = new Date(dateValue);
  }
  // Try generic Date parsing
  else {
    dateObj = new Date(dateValue);
  }
  
  // Validate date
  if (!dateObj || isNaN(dateObj.getTime())) {
    console.error('Invalid date conversion:', dateValue);
    return new Date().toISOString(); // Fallback to today
  }
  
  return dateObj.toISOString();
}
function getPortfolioName(portfolioId) {
  const portfolio = portfolios.find(p => p.id === portfolioId);
  return portfolio ? portfolio.name : portfolioId;
}

function getPortfolioColorDot(portfolioId) {
  const portfolio = portfolios.find(p => p.id === portfolioId);
  if (!portfolio || portfolio.id === 'total') return '';
  
  const colorClass = `portfolio-color-${portfolio.color}`;
  return `<span class="portfolio-indicator ${colorClass}"></span>`;
}
async function deletePortfolio(id) {
  if (!confirm('Delete this portfolio? Transactions will remain but lose portfolio assignment.')) {
    return;
  }
  
  portfolios = portfolios.filter(p => p.id !== id);
  savePortfolios();
  
  // Update transactions to remove this portfolio
  transactions.forEach(t => {
    if (t.portfolio === id) {
      t.portfolio = '';
    }
  });
  
  await saveDataToSupabase();
  initializePortfolios();
  refreshPricesAndNames();
}
async function loadDataFromSupabase() {
  try {
    const { data: txns, error: txnError } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: true });
    
    if (!txnError && txns) {
      transactions = txns.map(t => {
        // Ensure date is properly formatted
        let formattedDate = t.date;
        
        if (!formattedDate) {
          // If no date, use current date
          formattedDate = new Date().toISOString();
        } else if (typeof formattedDate === 'string') {
          // Ensure it's in ISO format with timezone
          if (!formattedDate.includes('T')) {
            // If it's just YYYY-MM-DD, add time
            formattedDate = formattedDate + 'T00:00:00Z';
          } else if (!formattedDate.includes('Z') && !formattedDate.includes('+')) {
            // If it has time but no timezone, add Z
            if (!formattedDate.endsWith('Z')) {
              formattedDate = formattedDate + 'Z';
            }
          }
        }
        
        return {
  id: t.id,  // <-- ADD THIS LINE
  type: t.type,
  portfolio: t.portfolio,
  symbol: t.symbol,
  shares: parseFloat(t.shares),
  price: parseFloat(t.price),
  date: formattedDate,
  premium_type: t.premium_type || null
};
      });
      
      // DEBUG: Check for problematic dates
      transactions.forEach((t, index) => {
        const testDate = new Date(t.date);
        if (isNaN(testDate.getTime()) || testDate.getFullYear() < 2000) {
          console.error('❌ Bad date at index', index, ':', {
            symbol: t.symbol,
            date: t.date,
            type: t.type
          });
        }
      });
      
      console.log('✅ Loaded ' + transactions.length + ' transactions from Supabase');
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
      console.log('✅ Loaded ' + cashFlows.length + ' cash flows from Supabase');
    }
    
    const { data: prices, error: priceError } = await supabase
      .from('price_cache')
      .select('*');
    
    if (!priceError && prices) {
      prices.forEach(p => {
        livePrices[p.symbol] = parseFloat(p.price);
      });
      console.log('✅ Loaded ' + Object.keys(livePrices).length + ' cached prices from Supabase');
    }
  } catch (error) {
    console.error('❌ Error loading data from Supabase:', error);
  }
}
async function fixBadDates() {
  console.log('🔧 Checking for bad dates...');
  
  const badTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    return isNaN(d.getTime()) || d.getFullYear() < 2000;
  });
  
  if (badTransactions.length > 0) {
    console.warn('Found', badTransactions.length, 'transactions with bad dates');
    
    // Set default date to today
    badTransactions.forEach(t => {
      console.log('Fixing date for:', t.symbol, t.type, 'Old date:', t.date);
      t.date = new Date().toISOString();
    });
    
    // Save back to Supabase
    await saveDataToSupabase();
    console.log('✅ Fixed bad dates');
  }
}
async function saveDataToSupabase() {
  try {
    // Save transactions
    await supabase.from('transactions').delete().neq('id', 0);
    
    if (transactions.length > 0) {
      const transactionsForSupabase = transactions.map(t => ({
        type: t.type,
        portfolio: t.portfolio || '',
        symbol: t.symbol,
        shares: t.shares,
        price: t.price,
        date: convertDateForSupabase(t.date),
        premium_type: t.premium_type || null
      }));
      
      const { error } = await supabase.from('transactions').insert(transactionsForSupabase);
      if (error) console.error('Error saving transactions:', error);
    }

    // Save cash flows
    await supabase.from('cash_flows').delete().neq('id', 0);
    
    if (cashFlows.length > 0) {
      const cashFlowsForSupabase = cashFlows.map(cf => ({
        type: cf.type,
        amount: cf.amount,
        date: convertDateForSupabase(cf.date)
      }));
      
      const { error } = await supabase.from('cash_flows').insert(cashFlowsForSupabase);
      if (error) console.error('Error saving cash flows:', error);
    }

    console.log('✅ Saved to Supabase');
  } catch (error) {
    console.error('❌ Error saving to Supabase:', error);
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
  
  // Special handling for cash dividends
  const isCashDividend = type === 'dividend' && shares === 0;
  
  if (!symbol || !dateInput || !portfolio) {
    alert('Please fill in symbol, portfolio, and date');
    return;
  }
  
  // Validate shares (allow 0 for cash dividends)
  if (!isCashDividend && (isNaN(shares) || shares <= 0)) {
    alert('Please enter valid shares');
    return;
  }
  
  // Validate price (different rules for different types)
  if (type === 'dividend') {
    // DRIP or Cash dividend
    if (isCashDividend && (isNaN(price) || price <= 0)) {
      alert('Please enter dividend amount');
      return;
    }
    // DRIP dividends have price = 0, which is OK
  } else if (type !== 'premium') {
    // Buy/Sell require valid price
    if (isNaN(price) || price <= 0) {
      alert('Please enter a valid price');
      return;
    }
  }
  
  const date = convertDDMMYYYYtoYYYYMMDD(dateInput) + 'T00:00:00Z';
  
  // Check for duplicates
  const duplicates = checkDuplicateTransaction(symbol, shares, date, type);
  if (duplicates.length > 0) {
    const dup = duplicates[0];
    const dupDate = new Date(dup.date).toLocaleDateString();
    const message = `⚠️ Similar transaction found:\n\n${dup.symbol} - ${Math.abs(dup.shares)} shares @ $${dup.price}\nDate: ${dupDate}\nType: ${dup.type}\n\nAdd this transaction anyway?`;
    
    if (!confirm(message)) {
      return;
    }
  }
  
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
    transactions.push(transaction);
    await saveDataToSupabase();
    
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
    await supabase.from('transactions').delete().neq('id', 0);
    await supabase.from('cash_flows').delete().neq('id', 0);
    await supabase.from('price_cache').delete().neq('symbol', '');
    
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
  
  let tableId = currentTab + 'Table';
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
  
  const portfolioTabs = ['total', ...portfolios.filter(p => p.id !== 'total').map(p => p.id)];
  
  // Handle portfolio view tabs (delete all transactions for selected symbols)
  if (portfolioTabs.includes(currentTab)) {
    const symbolsToDelete = [];
    checkboxes.forEach(function(checkbox) {
      const row = checkbox.closest('tr');
      const cells = row.cells;
      const symbol = cells[1].textContent;
      symbolsToDelete.push(symbol);
    });
    
    // Delete from Supabase
    for (const symbol of symbolsToDelete) {
      await supabase.from('transactions').delete().eq('symbol', symbol);
    }
    
    // Remove from local array
    transactions = transactions.filter(t => !symbolsToDelete.includes(t.symbol));
  }
  // Handle "All Transactions" tab (delete specific transactions by index)
  else if (currentTab === 'all') {
    const indicesToDelete = [];
    checkboxes.forEach(function(checkbox) {
      const index = parseInt(checkbox.dataset.index);
      if (!isNaN(index)) {
        indicesToDelete.push(index);
      }
    });
    
    // Sort indices in descending order to delete from end to start
    indicesToDelete.sort((a, b) => b - a);
    
    // Remove from local array
    indicesToDelete.forEach(index => {
      if (index >= 0 && index < transactions.length) {
        transactions.splice(index, 1);
      }
    });
    
    // Save updated data
    await saveDataToSupabase();
  }
  // Handle ticker search and sold positions
  else if (currentTab === 'ticker') {
  const transactionsToDelete = [];
  
  checkboxes.forEach(function(checkbox) {
    // Skip summary row
    if (checkbox.dataset.type === 'summary') return;
    
    // Get data from checkbox attributes
    const type = checkbox.dataset.type;
    const portfolio = checkbox.dataset.portfolio;
    const symbol = checkbox.dataset.symbol;
    const shares = parseFloat(checkbox.dataset.shares);
    const price = parseFloat(checkbox.dataset.price);
    const date = checkbox.dataset.date;
    
    transactionsToDelete.push({ type, portfolio, symbol, shares, price, date });
  });
  
  console.log('Deleting from ticker search:', transactionsToDelete);
  
  if (transactionsToDelete.length === 0) {
    alert('No transactions selected (summary row cannot be deleted)');
    return;
  }
  
  for (const item of transactionsToDelete) {
    const isoDate = convertDateForSupabase(item.date);
    
    await supabase.from('transactions').delete().match({
      type: item.type,
      portfolio: item.portfolio,
      symbol: item.symbol,
      shares: item.shares,
      price: item.price,
      date: isoDate
    });
  }
  
  // Reload from Supabase
  await loadDataFromSupabase();
  
  // Refresh the search to update the display
  searchTicker();
}
  else if (currentTab === 'sold') {
    const symbolsToDelete = [];
    checkboxes.forEach(function(checkbox) {
      const row = checkbox.closest('tr');
      const cells = row.cells;
      const symbolText = cells[1].textContent;
      const symbol = symbolText.replace(' (Premium)', '').trim();
      const isPremium = symbolText.includes('(Premium)');
      
      if (isPremium) {
        symbolsToDelete.push({ symbol: symbol, type: 'premium' });
      } else {
        symbolsToDelete.push({ symbol: symbol, type: 'all' });
      }
    });
    
    for (const item of symbolsToDelete) {
      if (item.type === 'premium') {
        await supabase.from('transactions').delete().eq('symbol', item.symbol).eq('type', 'premium');
      } else {
        await supabase.from('transactions').delete().eq('symbol', item.symbol);
      }
    }
    
    await loadDataFromSupabase();
  }
  
  refreshPricesAndNames();
}