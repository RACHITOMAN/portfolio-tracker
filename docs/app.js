// Global Variables
let transactions = [];
let cashFlows = [];
let livePrices = {};
let companyCache = JSON.parse(localStorage.getItem('companyCache')) || {};
let portfolios = JSON.parse(localStorage.getItem('portfolios')) || [{ id: 'total', name: 'Total Portfolio', color: 1 }];
let sortConfig = { column: null, direction: 'asc' };

const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours

// Portfolio Colors
const PORTFOLIO_COLORS = {
  1: '#667eea',
  2: '#f093fb',
  3: '#4facfe',
  4: '#43e97b',
  5: '#fa709a'
};

// ============ INITIALIZATION ============

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
  const soldTab = tabsContainer.querySelector('[data-tab="sold-positions"]');
  
  portfolios.filter(p => p.id !== 'total').forEach((portfolio, index) => {
    // Create tab button
    const tab = document.createElement('button');
    tab.className = `tab custom-portfolio portfolio-${portfolio.color}`;
    tab.dataset.tab = portfolio.id;
    tab.textContent = portfolio.name;
    tabsContainer.insertBefore(tab, soldTab);
    
    // Create tab content
    const content = document.createElement('div');
    content.id = portfolio.id;
    content.className = 'tab-content custom-portfolio';
    content.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Shares</th>
              <th>Avg Cost</th>
              <th>Current Price</th>
              <th>Total Cost</th>
              <th>Market Value</th>
              <th>Gain/Loss</th>
              <th>Gain/Loss %</th>
            </tr>
          </thead>
          <tbody id="${portfolio.id}Body"></tbody>
        </table>
      </div>
    `;
    
    document.querySelector('.main-panel').appendChild(content);
  });
  
  // Reattach tab listeners
  initializeTabs();
}

function updatePortfolioList() {
  const listEl = document.getElementById('portfolioList');
  listEl.innerHTML = '';
  
  portfolios.filter(p => p.id !== 'total').forEach((portfolio, index) => {
    const item = document.createElement('div');
    item.className = `portfolio-item portfolio-${portfolio.color}`;
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

function savePortfolios() {
  localStorage.setItem('portfolios', JSON.stringify(portfolios));
}

// ============ SUPABASE FUNCTIONS ============

// Helper: Convert date DD/MM/YYYY → YYYY-MM-DD for Supabase
function convertDateForSupabase(dateValue) {
  if (!dateValue) return null;
  
  // If it's a Date object
  if (dateValue instanceof Date) {
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // If it's DD/MM/YYYY format
  if (typeof dateValue === 'string' && dateValue.includes('/')) {
    const [day, month, year] = dateValue.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // If already in YYYY-MM-DD format
  if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateValue;
  }
  
  // Fallback: convert to Date and format
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Convert date YYYY-MM-DD → DD/MM/YYYY for display
function convertDateFromSupabase(dateStr) {
  if (!dateStr) return '';
  
  if (typeof dateStr === 'string' && dateStr.includes('-')) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }
  
  return dateStr;
}

async function loadDataFromSupabase() {
  try {
    const [transactionsData, cashFlowsData] = await Promise.all([
      supabase.from('transactions').select('*').order('date', { ascending: false }),
      supabase.from('cash_flows').select('*').order('date', { ascending: false })
    ]);

    if (transactionsData.data) {
      // Convert Supabase format (shares, YYYY-MM-DD) to app format (quantity, DD/MM/YYYY)
      transactions = transactionsData.data.map(t => ({
        id: t.id,
        date: convertDateFromSupabase(t.date),
        symbol: t.symbol,
        portfolio: t.portfolio,
        type: t.type,
        quantity: t.shares, // shares → quantity
        price: t.price,
        premium_type: t.premium_type
      }));
    }
    
    if (cashFlowsData.data) {
      // Convert dates for cash flows
      cashFlows = cashFlowsData.data.map(cf => ({
        id: cf.id,
        date: convertDateFromSupabase(cf.date),
        type: cf.type,
        amount: cf.amount
      }));
    }

    console.log('✅ Loaded from Supabase:', transactions.length, 'transactions,', cashFlows.length, 'cash flows');
  } catch (error) {
    console.error('❌ Error loading from Supabase:', error);
  }
}

async function saveDataToSupabase() {
  try {
    // Convert and save transactions
    await supabase.from('transactions').delete().neq('id', 0);
    
    if (transactions.length > 0) {
      // Convert app format (quantity, DD/MM/YYYY) to Supabase format (shares, YYYY-MM-DD)
      const transactionsForSupabase = transactions.map(t => ({
        id: Math.floor(t.id), // Ensure integer ID
        date: convertDateForSupabase(t.date),
        symbol: t.symbol,
        portfolio: t.portfolio || 'default-portfolio',
        type: t.type,
        shares: t.quantity, // quantity → shares
        price: t.price,
        premium_type: t.premium_type || null
      }));
      
      await supabase.from('transactions').insert(transactionsForSupabase);
    }

    // Convert and save cash flows
    await supabase.from('cash_flows').delete().neq('id', 0);
    
    if (cashFlows.length > 0) {
      const cashFlowsForSupabase = cashFlows.map(cf => ({
        id: Math.floor(cf.id),
        date: convertDateForSupabase(cf.date),
        type: cf.type,
        amount: cf.amount
      }));
      
      await supabase.from('cash_flows').insert(cashFlowsForSupabase);
    }

    console.log('✅ Saved to Supabase');
  } catch (error) {
    console.error('❌ Error saving to Supabase:', error);
  }
}

// ============ TABS ============

function initializeTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function() {
      const targetTab = this.dataset.tab;
      
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      this.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
      
      // Show/hide cash flow summary cards (with safety check)
      if (targetTab === 'cash-flows') {
        ['cashFlowCard1', 'cashFlowCard2', 'cashFlowCard3'].forEach(id => {
          const card = document.getElementById(id);
          if (card) card.style.display = 'block';
        });
      } else {
        ['cashFlowCard1', 'cashFlowCard2', 'cashFlowCard3'].forEach(id => {
          const card = document.getElementById(id);
          if (card) card.style.display = 'none';
        });
      }
    });
  });
}

// ============ TRANSACTIONS ============

async function addTransaction() {
  const date = document.getElementById('date').value;
  const symbol = document.getElementById('symbol').value.toUpperCase().trim();
  const portfolio = document.getElementById('portfolio').value;
  const type = document.getElementById('type').value;
  const quantity = parseFloat(document.getElementById('quantity').value) || 0;
  const price = parseFloat(document.getElementById('price').value);
  const premiumType = document.getElementById('premiumType').value;

  if (!date || !symbol || !portfolio || !type || isNaN(price)) {
    alert('Please fill in all required fields');
    return;
  }

  if ((type === 'buy' || type === 'sell') && quantity === 0) {
    alert('Quantity is required for buy/sell transactions');
    return;
  }

  if (type === 'premium' && !premiumType) {
    alert('Please select premium type');
    return;
  }

  const transaction = {
    id: Date.now(),
    date,
    symbol,
    portfolio,
    type,
    quantity: type === 'sell' ? -Math.abs(quantity) : quantity,
    price,
    premium_type: type === 'premium' ? premiumType : null
  };

  transactions.push(transaction);
  await saveDataToSupabase();
  
  document.getElementById('date').value = '';
  document.getElementById('symbol').value = '';
  document.getElementById('portfolio').value = '';
  document.getElementById('type').value = '';
  document.getElementById('quantity').value = '';
  document.getElementById('price').value = '';
  document.getElementById('premiumType').value = '';
  document.getElementById('premiumType').style.display = 'none';

  await refreshPricesAndNames();
}

async function confirmDeleteSelected() {
  const checkboxes = document.querySelectorAll('#transactionsBody input[type="checkbox"]:checked');
  if (checkboxes.length === 0) {
    alert('Please select transactions to delete');
    return;
  }

  if (!confirm(`Delete ${checkboxes.length} selected transaction(s)?`)) {
    return;
  }

  const idsToDelete = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));
  transactions = transactions.filter(t => !idsToDelete.includes(t.id));
  
  await saveDataToSupabase();
  refreshPricesAndNames();
}

// ============ IMPROVED CLEAR ALL WITH WARNING ============

async function confirmClearData() {
  const warning = '⚠️ DANGER: This will permanently delete ALL transactions and cash flows from Supabase!\n\n' +
                  '❌ This action CANNOT be undone.\n' +
                  '💾 RECOMMENDATION: Export to CSV first (click Export CSV button)\n\n' +
                  'To confirm, type exactly: DELETE ALL';
  
  const confirmation = prompt(warning);
  
  if (confirmation === 'DELETE ALL') {
    // Double check
    if (confirm('Are you absolutely sure? This is your last chance to cancel.')) {
      transactions = [];
      cashFlows = [];
      await saveDataToSupabase();
      refreshPricesAndNames();
      alert('✅ All data cleared from Supabase');
    } else {
      alert('❌ Cancelled - no data was deleted');
    }
  } else {
    alert('❌ Incorrect confirmation - no data was deleted\n\nYou must type exactly: DELETE ALL');
  }
}

// ============ DISPLAY FUNCTIONS ============

function updateTransactionsTable() {
  const tbody = document.getElementById('transactionsBody');
  tbody.innerHTML = '';

  const sortedTransactions = [...transactions].sort((a, b) => {
    if (!sortConfig.column) return new Date(b.date) - new Date(a.date);
    
    let aVal = a[sortConfig.column];
    let bVal = b[sortConfig.column];
    
    if (sortConfig.column === 'date') {
      aVal = new Date(aVal);
      bVal = new Date(bVal);
    } else if (['quantity', 'price'].includes(sortConfig.column)) {
      aVal = parseFloat(aVal) || 0;
      bVal = parseFloat(bVal) || 0;
    }
    
    if (sortConfig.direction === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  sortedTransactions.forEach(transaction => {
    const row = tbody.insertRow();
    const currentPrice = livePrices[transaction.symbol] || 0;
    const portfolioObj = portfolios.find(p => p.id === transaction.portfolio);
    const portfolioName = portfolioObj ? portfolioObj.name : 'Unknown';

    row.innerHTML = `
      <td><input type="checkbox" data-id="${transaction.id}"></td>
      <td>${transaction.date}</td>
      <td><strong>${transaction.symbol}</strong></td>
      <td>${portfolioName}</td>
      <td>${transaction.type}${transaction.premium_type ? ` (${transaction.premium_type})` : ''}</td>
      <td>${transaction.quantity}</td>
      <td>$${transaction.price.toFixed(2)}</td>
      <td>$${(transaction.quantity * transaction.price).toFixed(2)}</td>
      <td>$${currentPrice.toFixed(2)}</td>
    `;
  });

  updateSelectAllCheckbox();
}

function updatePortfolioTable(portfolioId, tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  
  tbody.innerHTML = '';

  const holdings = calculateHoldings(portfolioId);
  
  Object.entries(holdings).forEach(([symbol, data]) => {
    if (data.shares === 0) return;

    const currentPrice = livePrices[symbol] || 0;
    const marketValue = data.shares * currentPrice;
    const gainLoss = marketValue - data.totalCost;
    const gainLossPercent = data.totalCost > 0 ? (gainLoss / data.totalCost) * 100 : 0;

    const row = tbody.insertRow();
    row.innerHTML = `
      <td><strong>${symbol}</strong></td>
      <td>${data.shares.toFixed(2)}</td>
      <td>$${data.avgCost.toFixed(2)}</td>
      <td>$${currentPrice.toFixed(2)}</td>
      <td>$${data.totalCost.toFixed(2)}</td>
      <td>$${marketValue.toFixed(2)}</td>
      <td class="${gainLoss >= 0 ? 'positive' : 'negative'}">$${gainLoss.toFixed(2)}</td>
      <td class="${gainLossPercent >= 0 ? 'positive' : 'negative'}">${gainLossPercent.toFixed(2)}%</td>
    `;
  });
}

function calculateHoldings(portfolioId) {
  const holdings = {};
  
  const filteredTransactions = portfolioId === 'total' 
    ? transactions 
    : transactions.filter(t => t.portfolio === portfolioId);

  filteredTransactions.forEach(t => {
    if (!holdings[t.symbol]) {
      holdings[t.symbol] = { shares: 0, totalCost: 0, avgCost: 0 };
    }

    if (t.type === 'buy') {
      const costBasisReduction = getPremiumCostBasisReduction(t.symbol, t.date);
      const effectiveCost = Math.max(0, t.price - costBasisReduction);
      
      holdings[t.symbol].shares += t.quantity;
      holdings[t.symbol].totalCost += t.quantity * effectiveCost;
    } else if (t.type === 'sell') {
      holdings[t.symbol].shares += t.quantity;
      holdings[t.symbol].totalCost += t.quantity * t.price;
    } else if (t.type === 'dividend') {
      holdings[t.symbol].totalCost -= t.price;
    } else if (t.type === 'premium') {
      if (t.premium_type === 'covered_call') {
        holdings[t.symbol].totalCost -= t.price;
      }
    }

    if (holdings[t.symbol].shares !== 0) {
      holdings[t.symbol].avgCost = holdings[t.symbol].totalCost / holdings[t.symbol].shares;
    }
  });

  return holdings;
}

function getPremiumCostBasisReduction(symbol, buyDate) {
  let reduction = 0;
  
  transactions.forEach(t => {
    if (t.symbol === symbol && t.type === 'premium' && t.premium_type === 'csp_assigned' && t.date <= buyDate) {
      reduction += t.price;
    }
  });
  
  return reduction;
}

function updateSoldPositions() {
  const tbody = document.getElementById('soldPositionsBody');
  tbody.innerHTML = '';

  const sold = {};

  transactions.forEach(t => {
    const key = `${t.symbol}_${t.portfolio}`;
    
    if (!sold[key]) {
      sold[key] = { 
        symbol: t.symbol, 
        portfolio: t.portfolio,
        buys: [], 
        sells: [], 
        premiums: [] 
      };
    }

    if (t.type === 'buy') {
      sold[key].buys.push(t);
    } else if (t.type === 'sell') {
      sold[key].sells.push(t);
    } else if (t.type === 'premium' && t.premium_type === 'csp_expired') {
      sold[key].premiums.push(t);
    }
  });

  Object.values(sold).forEach(data => {
    data.sells.forEach(sell => {
      const portfolioObj = portfolios.find(p => p.id === data.portfolio);
      const portfolioName = portfolioObj ? portfolioObj.name : 'Unknown';
      
      const relevantBuys = data.buys.filter(b => b.date <= sell.date);
      
      if (relevantBuys.length > 0) {
        const totalBuyQty = relevantBuys.reduce((sum, b) => sum + b.quantity, 0);
        const totalBuyCost = relevantBuys.reduce((sum, b) => sum + (b.quantity * b.price), 0);
        const avgBuyPrice = totalBuyCost / totalBuyQty;
        
        const sellQty = Math.abs(sell.quantity);
        const sellProceeds = sellQty * sell.price;
        const sellCost = sellQty * avgBuyPrice;
        const gainLoss = sellProceeds - sellCost;
        const gainLossPercent = (gainLoss / sellCost) * 100;
        
        const buyDate = relevantBuys[0].date;
        const daysHeld = Math.floor((new Date(sell.date) - new Date(buyDate)) / (1000 * 60 * 60 * 24));

        const row = tbody.insertRow();
        row.innerHTML = `
          <td><strong>${data.symbol}</strong></td>
          <td>${portfolioName}</td>
          <td>${buyDate}</td>
          <td>${sell.date}</td>
          <td>${sellQty.toFixed(2)}</td>
          <td>$${avgBuyPrice.toFixed(2)}</td>
          <td>$${sell.price.toFixed(2)}</td>
          <td>$${sellCost.toFixed(2)}</td>
          <td>$${sellProceeds.toFixed(2)}</td>
          <td class="${gainLoss >= 0 ? 'positive' : 'negative'}">$${gainLoss.toFixed(2)}</td>
          <td class="${gainLossPercent >= 0 ? 'positive' : 'negative'}">${gainLossPercent.toFixed(2)}%</td>
          <td>${daysHeld}</td>
        `;
      }
    });

    // CSP Expired
    data.premiums.forEach(premium => {
      const portfolioObj = portfolios.find(p => p.id === data.portfolio);
      const portfolioName = portfolioObj ? portfolioObj.name : 'Unknown';

      const row = tbody.insertRow();
      row.innerHTML = `
        <td><strong>${data.symbol}</strong></td>
        <td>${portfolioName}</td>
        <td>N/A</td>
        <td>${premium.date}</td>
        <td>CSP</td>
        <td>N/A</td>
        <td>N/A</td>
        <td>$0.00</td>
        <td>$${premium.price.toFixed(2)}</td>
        <td class="positive">$${premium.price.toFixed(2)}</td>
        <td class="positive">100.00%</td>
        <td>N/A</td>
      `;
    });
  });
}

function updateSummary() {
  const holdings = calculateHoldings('total');
  
  let totalValue = 0;
  let totalCost = 0;
  let unrealizedGain = 0;
  
  Object.entries(holdings).forEach(([symbol, data]) => {
    if (data.shares > 0) {
      const currentPrice = livePrices[symbol] || 0;
      totalValue += data.shares * currentPrice;
      totalCost += data.totalCost;
    }
  });
  
  unrealizedGain = totalValue - totalCost;
  const unrealizedPercent = totalCost > 0 ? (unrealizedGain / totalCost) * 100 : 0;
  
  let realizedGain = 0;
  transactions.forEach(t => {
    if (t.type === 'dividend') realizedGain += t.price;
    if (t.type === 'premium' && t.premium_type === 'csp_expired') realizedGain += t.price;
  });
  
  // Calculate realized from sells
  const sold = {};
  transactions.forEach(t => {
    const key = t.symbol;
    if (!sold[key]) sold[key] = { buys: [], sells: [] };
    if (t.type === 'buy') sold[key].buys.push(t);
    if (t.type === 'sell') sold[key].sells.push(t);
  });
  
  Object.values(sold).forEach(data => {
    data.sells.forEach(sell => {
      const relevantBuys = data.buys.filter(b => b.date <= sell.date);
      if (relevantBuys.length > 0) {
        const totalBuyCost = relevantBuys.reduce((sum, b) => sum + (b.quantity * b.price), 0);
        const totalBuyQty = relevantBuys.reduce((sum, b) => sum + b.quantity, 0);
        const avgBuyPrice = totalBuyCost / totalBuyQty;
        const sellQty = Math.abs(sell.quantity);
        realizedGain += (sell.price - avgBuyPrice) * sellQty;
      }
    });
  });
  
  const realizedPercent = totalCost > 0 ? (realizedGain / totalCost) * 100 : 0;
  
  // Count holdings by portfolio
  const holdingsByPortfolio = {};
  portfolios.forEach(p => {
    if (p.id !== 'total') {
      const pHoldings = calculateHoldings(p.id);
      holdingsByPortfolio[p.name] = Object.values(pHoldings).filter(h => h.shares > 0).length;
    }
  });
  
  const totalStocks = Object.values(holdings).filter(h => h.shares > 0).length;
  const breakdownText = Object.entries(holdingsByPortfolio)
    .map(([name, count]) => `${name}: ${count}`)
    .join(' | ');
  
  document.getElementById('totalValue').textContent = `$${totalValue.toFixed(2)}`;
  document.getElementById('totalCost').textContent = `$${totalCost.toFixed(2)}`;
  document.getElementById('totalGainLoss').textContent = `$${unrealizedGain.toFixed(2)}`;
  document.getElementById('totalGainLossPercent').textContent = `${unrealizedPercent.toFixed(2)}%`;
  document.getElementById('totalGainLossPercent').className = unrealizedPercent >= 0 ? 'change positive' : 'change negative';
  document.getElementById('realizedGainLoss').textContent = `$${realizedGain.toFixed(2)}`;
  document.getElementById('realizedGainPercent').textContent = `${realizedPercent.toFixed(2)}%`;
  document.getElementById('realizedGainPercent').className = realizedPercent >= 0 ? 'change positive' : 'change negative';
  document.getElementById('stockCount').textContent = `${totalStocks} Total`;
  document.getElementById('holdingsBreakdown').textContent = breakdownText;
  
  // XIRR and Days Held
  const xirr = calculateXIRR();
  document.getElementById('portfolioXIRR').textContent = `${xirr.toFixed(2)}%`;
  
  const daysHeld = calculateWeightedAvgDaysHeld();
  document.getElementById('weightedDaysHeld').textContent = `${daysHeld} days`;
}

function calculateXIRR() {
  // Simplified XIRR calculation
  return 0; // Placeholder
}

function calculateWeightedAvgDaysHeld() {
  let totalWeightedDays = 0;
  let totalValue = 0;
  
  const holdings = calculateHoldings('total');
  const today = new Date();
  
  Object.entries(holdings).forEach(([symbol, data]) => {
    if (data.shares > 0) {
      const buys = transactions.filter(t => t.symbol === symbol && t.type === 'buy');
      if (buys.length > 0) {
        const avgBuyDate = new Date(buys.reduce((sum, b) => sum + new Date(b.date).getTime(), 0) / buys.length);
        const daysHeld = Math.floor((today - avgBuyDate) / (1000 * 60 * 60 * 24));
        const currentPrice = livePrices[symbol] || 0;
        const value = data.shares * currentPrice;
        
        totalWeightedDays += daysHeld * value;
        totalValue += value;
      }
    }
  });
  
  return totalValue > 0 ? Math.floor(totalWeightedDays / totalValue) : 0;
}

// ============ CASH FLOWS ============

async function addCashFlow() {
  const date = document.getElementById('cashFlowDate').value;
  const type = document.getElementById('cashFlowType').value;
  const amount = parseFloat(document.getElementById('cashFlowAmount').value);
  const notes = document.getElementById('cashFlowNotes') ? document.getElementById('cashFlowNotes').value.trim() : '';

  if (!date || !type || isNaN(amount)) {
    alert('Please fill in all required fields');
    return;
  }

  const cashFlow = {
    id: Date.now(),
    date,
    type,
    amount: type === 'withdrawal' ? -Math.abs(amount) : Math.abs(amount)
  };

  cashFlows.push(cashFlow);
  await saveDataToSupabase();
  
  document.getElementById('cashFlowDate').value = '';
  document.getElementById('cashFlowType').value = '';
  document.getElementById('cashFlowAmount').value = '';
  if (document.getElementById('cashFlowNotes')) {
    document.getElementById('cashFlowNotes').value = '';
  }
  
  updateCashFlowTable();
}

function updateCashFlowTable() {
  const tbody = document.getElementById('cashFlowsBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';

  const sortedFlows = [...cashFlows].sort((a, b) => new Date(b.date) - new Date(a.date));

  sortedFlows.forEach(flow => {
    const row = tbody.insertRow();
    row.innerHTML = `
      <td><input type="checkbox" data-id="${flow.id}"></td>
      <td>${flow.date}</td>
      <td>${flow.type}</td>
      <td class="${flow.amount >= 0 ? 'positive' : 'negative'}">$${flow.amount.toFixed(2)}</td>
    `;
  });

  // Update summary
  const totalInput = cashFlows.reduce((sum, f) => sum + (f.amount > 0 ? f.amount : 0), 0);
  const totalWithdrawal = cashFlows.reduce((sum, f) => sum + (f.amount < 0 ? Math.abs(f.amount) : 0), 0);
  const netCash = totalInput - totalWithdrawal;
  
  const holdings = calculateHoldings('total');
  let portfolioValue = 0;
  Object.entries(holdings).forEach(([symbol, data]) => {
    if (data.shares > 0) {
      portfolioValue += data.shares * (livePrices[symbol] || 0);
    }
  });
  
  const cashGain = portfolioValue - netCash;
  const cashGainPercent = netCash > 0 ? (cashGain / netCash) * 100 : 0;
  
  if (document.getElementById('totalCashInput')) {
    document.getElementById('totalCashInput').textContent = `$${netCash.toFixed(2)}`;
  }
  if (document.getElementById('cashFlowPortfolioValue')) {
    document.getElementById('cashFlowPortfolioValue').textContent = `$${portfolioValue.toFixed(2)}`;
  }
  if (document.getElementById('cashFlowGainLoss')) {
    document.getElementById('cashFlowGainLoss').textContent = `$${cashGain.toFixed(2)}`;
  }
  if (document.getElementById('cashFlowGainPercent')) {
    document.getElementById('cashFlowGainPercent').textContent = `${cashGainPercent.toFixed(2)}%`;
    document.getElementById('cashFlowGainPercent').className = cashGainPercent >= 0 ? 'change positive' : 'change negative';
  }
}

async function deleteCashFlowSelected() {
  const checkboxes = document.querySelectorAll('#cashFlowsBody input[type="checkbox"]:checked');
  if (checkboxes.length === 0) {
    alert('Please select cash flows to delete');
    return;
  }

  if (!confirm(`Delete ${checkboxes.length} selected cash flow(s)?`)) {
    return;
  }

  const idsToDelete = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));
  cashFlows = cashFlows.filter(f => !idsToDelete.includes(f.id));
  
  await saveDataToSupabase();
  updateCashFlowTable();
}

// ============ PRICE FETCHING WITH PROGRESS ============

function shouldFetchNewPrices() {
  const lastFetch = localStorage.getItem('lastPriceFetch');
  const cachedPrices = localStorage.getItem('cachedLivePrices');
  
  if (!lastFetch || !cachedPrices) return true;
  
  const timeSinceLastFetch = Date.now() - parseInt(lastFetch);
  return timeSinceLastFetch > CACHE_DURATION;
}

function loadCachedPrices() {
  const cached = localStorage.getItem('cachedLivePrices');
  if (cached) {
    livePrices = JSON.parse(cached);
    return true;
  }
  return false;
}

function savePricesCache() {
  localStorage.setItem('cachedLivePrices', JSON.stringify(livePrices));
  localStorage.setItem('lastPriceFetch', Date.now().toString());
}

function updatePriceLoadingProgress(currentBatch, totalBatches, totalSymbols, fetchedCount, minutesLeft = 0) {
  const btn = document.getElementById('refreshPricesBtn');
  if (!btn) return;
  
  const percentage = Math.round((fetchedCount / totalSymbols) * 100);
  
  if (minutesLeft > 0) {
    btn.textContent = `⏳ ${percentage}% - Waiting (${minutesLeft}m left)`;
  } else {
    btn.textContent = `⏳ Fetching ${percentage}% (${fetchedCount}/${totalSymbols})`;
  }
}

async function fetchLivePrices(symbols) {
  const apiKey = localStorage.getItem('apiKey');
  if (!apiKey) {
    console.error('No API key found');
    alert('Please set your API key in Settings first!');
    return;
  }

  console.log(`Starting to fetch ${symbols.length} prices...`);
  
  const RATE_LIMIT = 8;
  const RATE_WINDOW = 60000;
  const totalBatches = Math.ceil(symbols.length / RATE_LIMIT);

  for (let i = 0; i < symbols.length; i += RATE_LIMIT) {
    const batch = symbols.slice(i, i + RATE_LIMIT);
    const currentBatch = Math.floor(i / RATE_LIMIT) + 1;
    
    // Update progress display
    updatePriceLoadingProgress(currentBatch, totalBatches, symbols.length, i + batch.length);
    
    await Promise.all(batch.map(async symbol => {
      try {
        const response = await fetch(`https://api.twelvedata.com/price?symbol=${symbol}&apikey=${apiKey}`);
        const data = await response.json();
        
        if (data.price) {
          livePrices[symbol] = parseFloat(data.price);
        }
      } catch (error) {
        console.error(`Error fetching ${symbol}:`, error);
      }
    }));
    
    if (i + RATE_LIMIT < symbols.length) {
      const remaining = symbols.length - (i + RATE_LIMIT);
      const minutesLeft = Math.ceil(remaining / RATE_LIMIT);
      console.log(`Fetched ${Math.min(i + RATE_LIMIT, symbols.length)}/${symbols.length}, waiting 60s... (${minutesLeft} min remaining)`);
      
      // Update waiting message
      updatePriceLoadingProgress(currentBatch, totalBatches, symbols.length, i + batch.length, minutesLeft);
      
      await new Promise(resolve => setTimeout(resolve, RATE_WINDOW));
    }
  }
  
  console.log('All prices fetched, saving cache...');
  savePricesCache();
  console.log('Cache saved, returning...');
}

async function refreshPricesAndNames() {
  const symbolData = {};
  
  transactions.forEach(t => {
    if (!symbolData[t.symbol]) {
      symbolData[t.symbol] = { symbol: t.symbol };
    }
  });

  const symbols = Object.keys(symbolData);

  if (symbols.length === 0) {
    updateTransactionsTable();
    updatePortfolioTable('total', 'totalPortfolioBody');
    portfolios.filter(p => p.id !== 'total').forEach(p => {
      updatePortfolioTable(p.id, `${p.id}Body`);
    });
    updateSoldPositions();
    updateSummary();
    updateCashFlowTable();
    return;
  }

  console.log('Checking price cache...');

  if (shouldFetchNewPrices()) {
    console.log('Cache expired, fetching fresh prices for', symbols.length, 'symbols');
    await fetchLivePrices(symbols);
  } else {
    console.log('Using cached prices');
    loadCachedPrices();
  }

  console.log('Price fetch complete, refreshing display');
  
  updateTransactionsTable();
  updatePortfolioTable('total', 'totalPortfolioBody');
  portfolios.filter(p => p.id !== 'total').forEach(p => {
    updatePortfolioTable(p.id, `${p.id}Body`);
  });
  updateSoldPositions();
  updateSummary();
  updateCashFlowTable();
}

async function refreshAllPrices() {
  const symbols = [...new Set(transactions.map(t => t.symbol))];
  
  if (symbols.length === 0) {
    alert('No transactions to refresh prices for');
    return;
  }
  
  const estimatedMinutes = Math.ceil(symbols.length / 8);
  if (!confirm(`This will fetch ${symbols.length} prices and may take ${estimatedMinutes} minutes due to API rate limits. Continue?`)) {
    return;
  }
  
  const btn = document.getElementById('refreshPricesBtn');
  if (!btn) return;
  
  const originalText = btn.textContent;
  
  // Disable button during fetch
  btn.disabled = true;
  btn.style.opacity = '0.6';
  btn.style.cursor = 'not-allowed';
  
  try {
    console.log('Refreshing prices for', symbols.length, 'symbols...');
    
    livePrices = {};
    await fetchLivePrices(symbols);
    refreshPricesAndNames();
    
    alert('✅ Prices refreshed successfully!');
  } catch (error) {
    console.error('Error refreshing prices:', error);
    alert('❌ Error refreshing prices. Check console for details.');
  } finally {
    // Reset button
    btn.textContent = originalText;
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
  }
}

// ============ CSV EXPORT ============

function exportTransactionsToCSV() {
  if (transactions.length === 0) {
    alert('No transactions to export');
    return;
  }

  const headers = ['Date', 'Symbol', 'Portfolio', 'Type', 'Quantity', 'Price', 'PremiumType'];
  
  const rows = transactions.map(t => {
    const portfolioObj = portfolios.find(p => p.id === t.portfolio);
    const portfolioName = portfolioObj ? portfolioObj.name : 'Unknown';
    
    return [
      t.date,
      t.symbol,
      portfolioName,
      t.type,
      t.quantity,
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
  
  alert(`Exported ${transactions.length} transactions to CSV`);
}

// ============ CSV IMPORT ============

async function handleCsvImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet);

    let importedCount = 0;
    
    jsonData.forEach(row => {
      const transaction = {
        id: Date.now() + Math.random(),
        date: row.Date || row.date,
        symbol: (row.Symbol || row.symbol || '').toUpperCase().trim(),
        portfolio: row.Portfolio || row.portfolio || '',
        type: (row.Type || row.type || '').toLowerCase(),
        quantity: parseFloat(row.Quantity || row.quantity || 0),
        price: parseFloat(row.Price || row.price || 0),
        premium_type: row.PremiumType || row.premium_type || null
      };

      // Match portfolio name to ID
      const portfolioObj = portfolios.find(p => p.name === transaction.portfolio);
      if (portfolioObj) {
        transaction.portfolio = portfolioObj.id;
      }

      if (transaction.symbol && transaction.date && transaction.type) {
        transactions.push(transaction);
        importedCount++;
      }
    });

    await saveDataToSupabase();
    refreshPricesAndNames();
    alert(`✅ Imported ${importedCount} transactions successfully!`);
  };
  
  reader.readAsArrayBuffer(file);
  event.target.value = '';
}

async function handleCashFlowCsvImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet);

    let importedCount = 0;
    
    jsonData.forEach(row => {
      const cashFlow = {
        id: Date.now() + Math.random(),
        date: row.Date || row.date,
        type: (row.Type || row.type || '').toLowerCase(),
        amount: parseFloat(row.Amount || row.amount || 0)
      };

      // Ensure withdrawal amounts are negative
      if (cashFlow.type === 'withdrawal' && cashFlow.amount > 0) {
        cashFlow.amount = -Math.abs(cashFlow.amount);
      }
      
      // Ensure deposit amounts are positive
      if (cashFlow.type === 'deposit' && cashFlow.amount < 0) {
        cashFlow.amount = Math.abs(cashFlow.amount);
      }

      if (cashFlow.date && cashFlow.type && !isNaN(cashFlow.amount)) {
        cashFlows.push(cashFlow);
        importedCount++;
      }
    });

    await saveDataToSupabase();
    updateCashFlowTable();
    alert(`✅ Imported ${importedCount} cash flows successfully!`);
  };
  
  reader.readAsArrayBuffer(file);
  event.target.value = '';
}

// ============ SEARCH & SORT ============

function searchTicker() {
  const query = document.getElementById('tickerSearch');
  if (!query) return;
  
  const searchValue = query.value.toUpperCase().trim();
  if (!searchValue) return;

  const rows = document.querySelectorAll('#transactionsBody tr');
  rows.forEach(row => {
    const symbol = row.cells[2] ? row.cells[2].textContent.trim() : '';
    row.style.display = symbol.includes(searchValue) ? '' : 'none';
  });
}

function clearTickerSearch() {
  const query = document.getElementById('tickerSearch');
  if (query) query.value = '';
  
  document.querySelectorAll('#transactionsBody tr').forEach(row => {
    row.style.display = '';
  });
}

function initializeSortListeners() {
  document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', function() {
      const column = this.dataset.sort;
      
      if (sortConfig.column === column) {
        sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
      } else {
        sortConfig.column = column;
        sortConfig.direction = 'asc';
      }
      
      document.querySelectorAll('.sortable').forEach(t => {
        t.classList.remove('sort-asc', 'sort-desc');
      });
      
      this.classList.add(`sort-${sortConfig.direction}`);
      updateTransactionsTable();
    });
  });
}

function updateSelectAllCheckbox() {
  const selectAll = document.getElementById('selectAll');
  if (!selectAll) return;
  
  const checkboxes = document.querySelectorAll('#transactionsBody input[type="checkbox"]');
  const checked = document.querySelectorAll('#transactionsBody input[type="checkbox"]:checked');
  
  selectAll.checked = checkboxes.length > 0 && checkboxes.length === checked.length;
}

// ============ MODAL HANDLERS ============

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

// Close modals on outside click
window.addEventListener('click', function(event) {
  if (event.target.classList.contains('modal')) {
    event.target.classList.remove('active');
  }
});

// ============ EVENT LISTENERS ============

document.getElementById('addTransactionBtn').addEventListener('click', addTransaction);
document.getElementById('addCashFlowBtn').addEventListener('click', addCashFlow);
document.getElementById('deleteSelected').addEventListener('click', confirmDeleteSelected);
if (document.getElementById('deleteCashFlowSelected')) {
  document.getElementById('deleteCashFlowSelected').addEventListener('click', deleteCashFlowSelected);
}
document.getElementById('importCsvBtn').addEventListener('click', () => document.getElementById('csvFileInput').click());
document.getElementById('exportCsvBtn').addEventListener('click', exportTransactionsToCSV);
document.getElementById('csvFileInput').addEventListener('change', handleCsvImport);

// Cash Flow CSV Import
if (document.getElementById('importCashFlowCsvBtn')) {
  document.getElementById('importCashFlowCsvBtn').addEventListener('click', () => document.getElementById('cashFlowCsvFileInput').click());
}
if (document.getElementById('cashFlowCsvFileInput')) {
  document.getElementById('cashFlowCsvFileInput').addEventListener('change', handleCashFlowCsvImport);
}

if (document.getElementById('searchTickerBtn')) {
  document.getElementById('searchTickerBtn').addEventListener('click', searchTicker);
}
if (document.getElementById('clearTickerBtn')) {
  document.getElementById('clearTickerBtn').addEventListener('click', clearTickerSearch);
}
if (document.getElementById('refreshPricesBtn')) {
  document.getElementById('refreshPricesBtn').addEventListener('click', refreshAllPrices);
}

document.getElementById('type').addEventListener('change', function() {
  const premiumTypeSelect = document.getElementById('premiumType');
  premiumTypeSelect.style.display = this.value === 'premium' ? 'inline-block' : 'none';
});

document.getElementById('selectAll').addEventListener('change', function() {
  document.querySelectorAll('#transactionsBody input[type="checkbox"]').forEach(cb => {
    cb.checked = this.checked;
  });
});

if (document.getElementById('selectAllCashFlows')) {
  document.getElementById('selectAllCashFlows').addEventListener('change', function() {
    document.querySelectorAll('#cashFlowsBody input[type="checkbox"]').forEach(cb => {
      cb.checked = this.checked;
    });
  });
}

// ============ INITIALIZATION ============

async function init() {
  checkFirstVisit();
  initializePortfolios();
  initializeTabs();
  initializeSortListeners();
  
  await loadDataFromSupabase();
  
  const symbols = [...new Set(transactions.map(t => t.symbol))];
  
  if (symbols.length > 0) {
    if (shouldFetchNewPrices()) {
      console.log('Fetching prices for', symbols.length, 'symbols');
      await fetchLivePrices(symbols);
    } else {
      loadCachedPrices();
    }
  }
  
  refreshPricesAndNames();
}

init();