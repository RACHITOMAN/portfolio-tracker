// Global Variables
const CACHE_DURATION = 4 * 60 * 60 * 1000;
let transactions = [];
let activeTickerFilter = null;
let livePrices = {};
let cashFlows = [];
let portfolios = JSON.parse(localStorage.getItem('portfolios')) || [{ id: 'total', name: 'Total Portfolio', color: 0 }];
let sortState = {
  total: { column: 'symbol', direction: 'asc' },
  sold: { column: 'symbol', direction: 'asc' },
  cashflow: { column: 'date', direction: 'desc' },
  ticker: { column: 'symbol', direction: 'asc' },
  all: { column: 'symbol', direction: 'asc' }
};
let transactionFilters = {
  type: '',
  portfolio: '',
  symbol: ''
};
// Portfolio Colors
const PORTFOLIO_COLORS = {
  1: 'portfolio-1',
  2: 'portfolio-2',
  3: 'portfolio-3',
  4: 'portfolio-4',
  5: 'portfolio-5'
};
// ============ UTILITY FUNCTIONS ============

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
function makeTickerClickable(symbol) {
  return `<span class="clickable-ticker" onclick="filterByTicker('${symbol}')" style="cursor: pointer; color: #007BFF; text-decoration: underline; font-weight: bold;" title="Click to view all ${symbol} transactions">${symbol}</span>`;
}
function filterByTicker(symbol) {
  activeTickerFilter = symbol;
  showTickerModal(symbol);
}
function showTickerModal(symbol) {
  const symbolTransactions = transactions.filter(t => t.symbol === symbol);
  
  if (symbolTransactions.length === 0) {
    alert('No transactions found for ' + symbol);
    return;
  }
  
  const modalHTML = `
    <div id="tickerModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;">
      <div style="background: white; border-radius: 10px; padding: 20px; max-width: 90%; max-height: 90%; overflow: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 2px solid #007BFF; padding-bottom: 10px;">
          <h2 style="margin: 0; color: #007BFF;">${symbol} Transactions (${symbolTransactions.length})</h2>
          <button onclick="closeTickerModal()" style="background: #dc3545; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 16px; font-weight: bold;">✕ Close</button>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f8f9fa;">
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Date</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Type</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Portfolio</th>
              <th style="padding: 10px; text-align: right; border-bottom: 2px solid #dee2e6;">Shares</th>
              <th style="padding: 10px; text-align: right; border-bottom: 2px solid #dee2e6;">Price</th>
              <th style="padding: 10px; text-align: right; border-bottom: 2px solid #dee2e6;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${symbolTransactions.map(t => `
              <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 10px;">${formatDateDDMMYYYY(t.date)}</td>
                <td style="padding: 10px;"><span style="background: ${t.type === 'buy' ? '#28a745' : t.type === 'sell' ? '#dc3545' : '#ffc107'}; color: white; padding: 3px 8px; border-radius: 3px; font-size: 12px;">${t.type.toUpperCase()}</span></td>
                <td style="padding: 10px;">${portfolios.find(p => p.id === t.portfolio)?.name || t.portfolio}</td>
                <td style="padding: 10px; text-align: right;">${Math.abs(t.shares).toFixed(2)}</td>
                <td style="padding: 10px; text-align: right;">$${t.price.toFixed(2)}</td>
                <td style="padding: 10px; text-align: right; font-weight: bold;">$${(Math.abs(t.shares) * t.price).toFixed(2)}</td>
              </tr>
`).join('')}
          </tbody>
          <tfoot>
            <tr style="background: #f8f9fa; font-weight: bold; border-top: 3px solid #007BFF;">
              <td colspan="3" style="padding: 12px; text-align: right;">TOTALS:</td>
              <td style="padding: 12px; text-align: right;">${symbolTransactions.reduce((sum, t) => sum + Math.abs(t.shares), 0).toFixed(2)}</td>
              <td style="padding: 12px;"></td>
              <td style="padding: 12px; text-align: right; color: #007BFF;">$${symbolTransactions.reduce((sum, t) => sum + (Math.abs(t.shares) * t.price), 0).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}
function closeTickerModal() {
  const modal = document.getElementById('tickerModal');
  if (modal) {
    modal.remove();
  }
  activeTickerFilter = null;
}
function showEditModal(transactionIndex) {
  const t = transactions[transactionIndex];
  if (!t) return;
  
  const modalHTML = `
    <div id="editModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;">
      <div style="background: white; border-radius: 10px; padding: 30px; max-width: 500px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #007BFF; padding-bottom: 10px;">
          <h2 style="margin: 0; color: #007BFF;">Edit Transaction</h2>
          <button onclick="closeEditModal()" style="background: #dc3545; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 16px; font-weight: bold;">✕</button>
        </div>
        <form id="editForm" style="display: flex; flex-direction: column; gap: 15px;">
          <div>
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Type:</label>
            <select id="editType" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
              <option value="buy" ${t.type === 'buy' ? 'selected' : ''}>Buy</option>
              <option value="sell" ${t.type === 'sell' ? 'selected' : ''}>Sell</option>
              <option value="dividend" ${t.type === 'dividend' ? 'selected' : ''}>Dividend</option>
              <option value="premium" ${t.type === 'premium' ? 'selected' : ''}>Premium</option>
            </select>
          </div>
          <div>
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Portfolio:</label>
            <select id="editPortfolio" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
              ${portfolios.filter(p => p.id !== 'total').map(p => `<option value="${p.id}" ${t.portfolio === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Symbol:</label>
            <input type="text" id="editSymbol" value="${t.symbol}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px; text-transform: uppercase;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Shares:</label>
            <input type="number" id="editShares" value="${Math.abs(t.shares)}" step="0.01" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Price:</label>
            <input type="number" id="editPrice" value="${t.price}" step="0.01" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Date:</label>
            <input type="date" id="editDate" value="${t.date}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
          </div>
          <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button type="button" onclick="saveEditedTransaction(${transactionIndex})" style="flex: 1; background: #28a745; color: white; border: none; padding: 12px; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 16px;">💾 Save Changes</button>
            <button type="button" onclick="closeEditModal()" style="flex: 1; background: #6c757d; color: white; border: none; padding: 12px; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 16px;">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}
function closeEditModal() {
  const modal = document.getElementById('editModal');
  if (modal) {
    modal.remove();
  }
}
function formatDateInput(input) {
  let value = input.value.replace(/\D/g, ''); // Remove non-digits
  
  if (value.length >= 2) {
    value = value.slice(0, 2) + '/' + value.slice(2);
  }
  if (value.length >= 5) {
    value = value.slice(0, 5) + '/' + value.slice(5, 9);
  }
  
  input.value = value;
  
  // Validate complete date
  if (value.length === 10) {
    const parts = value.split('/');
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = parseInt(parts[2]);
    
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
      input.style.borderColor = 'red';
    } else {
      input.style.borderColor = '#ddd';
    }
  }
}
function applyTransactionFilters() {
  transactionFilters.type = document.getElementById('filterType').value;
  transactionFilters.portfolio = document.getElementById('filterPortfolio').value;
  transactionFilters.symbol = document.getElementById('filterSymbol').value;
  
  refreshPricesAndNames();
}

function clearTransactionFilters() {
  transactionFilters = {
    type: '',
    portfolio: '',
    symbol: ''
  };
  
  document.getElementById('filterType').value = '';
  document.getElementById('filterPortfolio').value = '';
  document.getElementById('filterSymbol').value = '';
  
  refreshPricesAndNames();
}

function populatePortfolioFilter() {
  const filterPortfolio = document.getElementById('filterPortfolio');
  if (!filterPortfolio) return;
  
  const userPortfolios = portfolios.filter(p => p.id !== 'total');
  
  filterPortfolio.innerHTML = '<option value="">All Portfolios</option>' +
    userPortfolios.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}
async function saveEditedTransaction(transactionIndex) {
  const type = document.getElementById('editType').value;
  const portfolio = document.getElementById('editPortfolio').value;
  const symbol = document.getElementById('editSymbol').value.trim().toUpperCase();
  const shares = parseFloat(document.getElementById('editShares').value);
  const price = parseFloat(document.getElementById('editPrice').value);
  const date = document.getElementById('editDate').value;
  
  if (!symbol || isNaN(shares) || isNaN(price) || !date) {
    alert('Please fill in all required fields');
    return;
  }
  
  transactions[transactionIndex] = {
    id: transactions[transactionIndex].id,
    type,
    portfolio,
    symbol,
    shares: type === 'sell' ? -Math.abs(shares) : Math.abs(shares),
    price,
    date,
    premium_type: transactions[transactionIndex].premium_type
  };
  
  await saveDataToSupabase();
refreshPricesAndNames();
closeEditModal();
  alert('Transaction updated successfully!');
}
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
              <th data-sort="totalCost">Total Cost</th>
              <th data-sort="currentValue">Current Value</th>
              <th data-sort="percentPortfolio">Portfolio %</th>
              <th data-sort="gainLoss">Unrealized Gain/Loss</th>
              <th data-sort="gainLossPercent">Gain/Loss %</th>
              <th data-sort="xirr">XIRR</th>
              <th data-sort="weightedDays" class="weighted-days-held">Weighted Avg Days Held</th>
              <th data-sort="firstDate">First Purchase</th>
              <th data-sort="lastDate">Last Entry</th>
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

function formatDateDDMMYYYY(date) {
  if (!date) return 'N/A';
  
  // Handle various date formats
  let d;
  
  if (typeof date === 'string') {
    // If string, try to parse it
    d = new Date(date);
  } else if (typeof date === 'number') {
    // If number (timestamp), use it directly
    d = new Date(date);
  } else if (date instanceof Date) {
    // Already a Date object
    d = date;
  } else {
    return 'Invalid Date';
  }
  
  // Check if date is valid
  if (isNaN(d.getTime())) {
    console.warn('Invalid date value:', date);
    return 'Invalid Date';
  }
  
  // Check if date is unreasonably old (before 2000)
  if (d.getFullYear() < 2000) {
    console.warn('Suspicious date detected:', date, 'parsed as:', d);
    return 'Invalid Date';
  }
  
  return d.toLocaleDateString('en-GB');
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

function calculateDaysHeld(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate || Date.now());
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ============ VALIDATION ============

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

// ============ XIRR CALCULATION ============

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

// ============ SUPABASE FUNCTIONS ============

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

// ============ TABS ============

function initializeTabs() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      if (tab.id === 'importCsvBtn' || tab.id === 'refreshPricesBtn') {
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
      
      if (mainControls) {
        mainControls.querySelectorAll('select, input, button').forEach(el => el.style.display = '');
        
        const portfolioTabs = ['total', ...portfolios.filter(p => p.id !== 'total').map(p => p.id)];
        const tabsWithDelete = ['total', ...portfolios.filter(p => p.id !== 'total').map(p => p.id), 'all', 'ticker', 'sold'];

        if (portfolioTabs.includes(tab.dataset.tab)) {
  mainControls.style.display = 'flex';
  // Show all controls
  mainControls.querySelectorAll('select, input, button').forEach(el => el.style.display = '');
} else if (tabsWithDelete.includes(tab.dataset.tab)) {
  mainControls.style.display = 'flex';
  // Hide add transaction controls, show delete
  mainControls.querySelectorAll('select, input:not([type="checkbox"]), #addTransactionBtn, #clearDataBtn').forEach(el => el.style.display = 'none');
  const deleteBtn = document.getElementById('deleteSelected');
  if (deleteBtn) deleteBtn.style.display = 'inline-block';
} else {
  mainControls.style.display = 'none';
}
      }
      if (tab.dataset.tab === 'ticker') {
  console.log('Ticker tab clicked - showing delete button');
  const deleteBtn = document.getElementById('deleteSelected');
  console.log('Delete button:', deleteBtn);
  if (deleteBtn) {
    deleteBtn.style.display = 'inline-block';
    console.log('Delete button display:', deleteBtn.style.display);
  }
}
      
      // Show/hide cash flow summary cards
      if (tab.dataset.tab === 'cashflow') {
        ['cashFlowCard1', 'cashFlowCard2', 'cashFlowCard3', 'cashFlowCard4', 'cashFlowCard5'].forEach(id => {
          const card = document.getElementById(id);
          if (card) card.style.display = 'block';
        });
      } else {
        ['cashFlowCard1', 'cashFlowCard2', 'cashFlowCard3', 'cashFlowCard4', 'cashFlowCard5'].forEach(id => {
          const card = document.getElementById(id);
          if (card) card.style.display = 'none';
        });
      }
      
      refreshPricesAndNames();
    });
  });
}

// ============ SORT LISTENERS ============

function initializeSortListeners() {
  const tables = {
    total: document.getElementById('totalTable'),
    sold: document.getElementById('soldTable'),
    ticker: document.getElementById('tickerTable'),
    all: document.getElementById('allTable')
  };
  
  // Add custom portfolio tables
  portfolios.filter(p => p.id !== 'total').forEach(p => {
    tables[p.id] = document.getElementById(p.id + 'Table');
  });
  
  for (const portfolio in tables) {
    const table = tables[portfolio];
    if (!table) continue;
    
    // Skip if already initialized
    if (table.dataset.sortInitialized === 'true') continue;
    table.dataset.sortInitialized = 'true';
    
    const headers = table.querySelectorAll('th');
    headers.forEach(function(header) {
      // Skip if no sort attribute or is select column
      const column = header.dataset.sort;
      if (!column || column === 'select') return;
      
      header.style.cursor = 'pointer';
      
      header.addEventListener('click', function handleSort() {
        // Initialize sort state if needed
        if (!sortState[portfolio]) {
          sortState[portfolio] = { column: column, direction: 'asc' };
        }
        
        // Determine new direction
        let newDirection;
        if (sortState[portfolio].column === column) {
          // Same column - toggle direction
          newDirection = sortState[portfolio].direction === 'asc' ? 'desc' : 'asc';
        } else {
          // Different column - start with asc
          newDirection = 'asc';
        }
        
        // Update state
        sortState[portfolio] = { column: column, direction: newDirection };
        
        // Remove all sort indicators
        headers.forEach(function(h) {
          h.classList.remove('sort-asc', 'sort-desc');
        });
        
        // Add indicator to clicked header
        this.classList.add('sort-' + newDirection);
        
        // Perform sort
        sortTable(table, column, newDirection);
        
        console.log('Sorted', portfolio, 'by', column, newDirection);
      });
    });
  }
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
    
    let aValue = a.cells[columnIndex].textContent.trim();
    let bValue = b.cells[columnIndex].textContent.trim();
    
    // Remove currency symbols, percentage signs, etc.
    aValue = aValue.replace(/\$/g, '').replace(/%/g, '').replace(/ days/g, '').trim();
    bValue = bValue.replace(/\$/g, '').replace(/%/g, '').replace(/ days/g, '').trim();
    
    // Handle "N/A" values
    if (aValue === 'N/A' || aValue === 'Invalid Date') aValue = direction === 'asc' ? 'zzz' : '';
    if (bValue === 'N/A' || bValue === 'Invalid Date') bValue = direction === 'asc' ? 'zzz' : '';
    
    // Check if values are dates in DD/MM/YYYY format
    if (aValue.match(/^\d{2}\/\d{2}\/\d{4}$/) && bValue.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const aParts = aValue.split('/');
      const bParts = bValue.split('/');
      aValue = new Date(aParts[2], aParts[1] - 1, aParts[0]).getTime();
      bValue = new Date(bParts[2], bParts[1] - 1, bParts[0]).getTime();
    }
    // Check if values are numbers
    else if (!isNaN(aValue) && !isNaN(bValue) && aValue !== '' && bValue !== '') {
      aValue = parseFloat(aValue);
      bValue = parseFloat(bValue);
    }
    
    // Compare values
    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });
  
  // Clear tbody and append sorted rows
  tbody.innerHTML = '';
  rows.forEach(function(row) {
    tbody.appendChild(row);
  });
}

// ============ TRANSACTIONS ============
function convertDDMMYYYYtoYYYYMMDD(dateStr) {
  // If already in YYYY-MM-DD format, return as is
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }
  
  // Convert DD/MM/YYYY to YYYY-MM-DD
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  
  return dateStr;
}
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
async function addTransaction() {
  const type = document.getElementById('type').value;
  const portfolio = document.getElementById('portfolio').value;
  const symbol = document.getElementById('symbol').value.toUpperCase().trim();
  const shares = parseFloat(document.getElementById('shares').value);
  const priceInput = document.getElementById('price').value;
  const price = priceInput === '' ? 0 : parseFloat(priceInput);
  const dateInput = document.getElementById('date').value;
  
  if (!symbol || isNaN(shares) || !dateInput || !portfolio) {
    alert('Please fill in symbol, shares, portfolio, and date');
    return;
  }
  
  if (type !== 'premium' && type !== 'dividend' && (isNaN(price) || price <= 0)) {
    alert('Please enter a valid price');
    return;
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

// ============ CSV IMPORT ============

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
          value = new Date().toISOString().split('T')[0] + 'T00:00:00Z';
        }
      } else if (header === 'shares' || header === 'price') {
        value = parseFloat(value) || 0;
      } else if (header === 'symbol') {
  value = value.toUpperCase();
}
else if (header === 'portfolio') {
  // Map portfolio name to portfolio ID
  const portfolioObj = portfolios.find(p => p.name.toUpperCase() === value.toUpperCase());
  if (portfolioObj) {
    value = portfolioObj.id;
  } else {
    console.warn('Portfolio not found:', value);
  }
}
transaction[header] = value;
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

async function handleCashFlowCsvImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    const data = new Uint8Array(e.target.result);
    let csvData;
    
    if (file.name.endsWith('.xlsx')) {
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      csvData = XLSX.utils.sheet_to_csv(firstSheet);
    } else {
      csvData = new TextDecoder().decode(data);
    }
    
    const lines = csvData.split('\n').filter(line => line.trim());
    if (lines.length <= 1) return;
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const dataLines = lines.slice(1);
    
    dataLines.forEach(line => {
      const values = line.split(',').map(v => v.trim());
      if (values.length !== headers.length) return;
      
      const cashFlow = {};
      headers.forEach((header, index) => {
        let value = values[index];
        if (header === 'date') {
          const dateObj = value.includes('/') 
            ? new Date(value.split('/').reverse().join('-'))
            : new Date(value);
          value = dateObj.toISOString().split('T')[0] + 'T00:00:00Z';
        } else if (header === 'amount') {
          value = parseFloat(value) || 0;
        } else if (header === 'type') {
          value = value.toLowerCase();
        }
        cashFlow[header] = value;
      });
      
      if (cashFlow.date && cashFlow.type && !isNaN(cashFlow.amount)) {
        cashFlows.push(cashFlow);
      }
    });
    
    await saveDataToSupabase();
    updateCashFlowTable();
    alert(`✅ Imported ${dataLines.length} cash flows successfully!`);
  };
  
  reader.readAsArrayBuffer(file);
  event.target.value = '';
}
// ============ CSV EXPORT ============

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

// ============ REFRESH AND UPDATE ============

function refreshPricesAndNames() {
  const symbolData = {};
  const portfolioHoldings = {};
  
  // Initialize portfolio holdings counters
  portfolios.filter(p => p.id !== 'total').forEach(p => {
    portfolioHoldings[p.id] = {};
  });
  
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
    
    if (t.date < symbolData[t.symbol].firstDate) symbolData[t.symbol].firstDate = t.date;
    if (t.date > symbolData[t.symbol].lastDate) symbolData[t.symbol].lastDate = t.date;
  });

  const portfolioData = { totalValue: 0, totalCost: 0 };
  
  portfolios.filter(p => p.id !== 'total').forEach(p => {
    portfolioData[p.id] = 0;
  });
  
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

  updateTables(symbolData, portfolioData, soldData);
  const activeTab = document.querySelector('.tab.active');
  const currentPortfolio = activeTab ? activeTab.dataset.tab : 'total';
  const portfolioFilter = ['total', ...portfolios.filter(p => p.id !== 'total').map(p => p.id)].includes(currentPortfolio) ? currentPortfolio : 'total';
 
  updateSummary(symbolData, portfolioData, portfolioFilter, soldData);
  updateCashFlowTable();
  }

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
    const row = document.createElement('tr');
    row.ondblclick = function() { showEditModal(index); };
row.style.cursor = 'pointer';
row.title = 'Double-click to edit';
    const portfolioName = getPortfolioName(t.portfolio);
const portfolioColor = getPortfolioColorDot(t.portfolio);
row.innerHTML = '<td><input type="checkbox" class="select-row" data-index="' + index + '"></td><td>' + t.type.toUpperCase() + '</td><td>' + portfolioColor + portfolioName + '</td><td>' + makeTickerClickable(t.symbol) + '</td><td>' + t.shares.toFixed(2) + '</td><td>$' + t.price.toFixed(2) + '</td><td>' + formatDateDDMMYYYY(t.date) + '</td>';    tbody.appendChild(row);
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
row.innerHTML = '<td><input type="checkbox" class="select-row"></td><td>' + makeTickerClickable(symbol) + '</td><td>' + (data.netShares || 0).toFixed(2) + '</td><td>$' + (data.avgCost || 0).toFixed(2) + '</td><td>$' + (data.currentPrice || 0).toFixed(2) + '</td><td>$' + (data.totalCost || 0).toFixed(2) + '</td><td>$' + (data.currentValue || 0).toFixed(2) + '</td><td>' + portfolioPercent + '%</td><td class="' + (data.gainLoss < 0 ? 'negative' : '') + '">$' + (data.gainLoss || 0).toFixed(2) + '</td><td class="' + ((data.gainLossPercent || 0) < 0 ? 'negative' : '') + '">' + (data.gainLossPercent || 0) + '%</td><td>' + (data.weightedDays < 90 ? 'N/A' : ((data.xirr || 0) * 100).toFixed(2) + '%') + '</td><td>' + Math.round(data.weightedDays || 0) + ' days</td><td>' + formatDateDDMMYYYY(data.firstDate) + '</td><td>' + formatDateDDMMYYYY(data.lastDate) + '</td>';
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

// ============ PRICE FETCHING ============

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

// ============ CASH FLOWS ============

async function addCashFlow() {
  const type = document.getElementById('cashFlowType').value;
  const amount = parseFloat(document.getElementById('cashAmount').value);
  const dateInput = document.getElementById('cashDate').value;
  
  if (!amount || amount <= 0 || !dateInput) {
    alert('Please fill in amount and date');
    return;
  }
  
  const date = dateInput + 'T00:00:00Z';
  const cashFlow = { type: type, amount: amount, date: date };
  
  cashFlows.push(cashFlow);
  await saveDataToSupabase();
  
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
    const isoDate = convertDateForSupabase(cf.date);
    await supabase.from('cash_flows').delete().match({
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
function updateCsvHelpModal() {
  const portfolioNamesList = document.getElementById('portfolioNamesList');
  const portfolioExamples = document.getElementById('portfolioExamples');
  
  if (!portfolioNamesList) return;
  
  const names = portfolios
    .filter(p => p.id !== 'total')
    .map(p => p.name);
  
  if (names.length > 0) {
    portfolioNamesList.textContent = names.join(', ');
    portfolioExamples.textContent = names.join(', ');
  } else {
    portfolioNamesList.innerHTML = '<em style="color: #dc3545;">No portfolios created yet. Go to Settings → Add Portfolio first!</em>';
    portfolioExamples.textContent = 'Create portfolios in Settings first';
  }
}

// Call this when opening the help modal
document.getElementById('csvHelpBtn').addEventListener('click', function() {
  updateCsvHelpModal();
  document.getElementById('csvHelpModal').classList.add('active');
});
// ============ EVENT LISTENERS & INITIALIZATION ============

async function init() {
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
  document.getElementById('type').addEventListener('click', function() {
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
// Smart date input formatting
const dateInput = document.getElementById('date');
if (dateInput) {
  dateInput.addEventListener('input', function() {
    formatDateInput(this);
  });
}
// Transaction filters
const filterType = document.getElementById('filterType');
const filterPortfolio = document.getElementById('filterPortfolio');
const filterSymbol = document.getElementById('filterSymbol');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');

if (filterType) {
  filterType.addEventListener('change', applyTransactionFilters);
}
if (filterPortfolio) {
  filterPortfolio.addEventListener('change', applyTransactionFilters);
}
if (filterSymbol) {
  filterSymbol.addEventListener('input', debounce(applyTransactionFilters, 300));
}
if (clearFiltersBtn) {
  clearFiltersBtn.addEventListener('click', clearTransactionFilters);
}

// Populate portfolio filter dropdown
populatePortfolioFilter();

init();