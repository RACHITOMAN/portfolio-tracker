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
  
  // Get pre-calculated data from globalSymbolData
  const holdingData = globalSymbolData[symbol] || {};
  
  const totalShares = holdingData.netShares || 0;
  const avgCost = holdingData.avgCost || 0;
  const currentPrice = getCurrentPrice(symbol) || 0;
  const totalCost = holdingData.totalCost || 0;
  const currentValue = holdingData.currentValue || 0;
  const gainLoss = holdingData.gainLoss || 0;
  const gainLossPercent = parseFloat(holdingData.gainLossPercent) || 0;
  const xirrValue = ((holdingData.xirr || 0) * 100);
  const weightedDays = holdingData.weightedDays || 0;
  
  // Get first and last dates
  let firstDate = null;
  let lastDate = null;
  symbolTransactions.forEach(t => {
    const transDate = new Date(t.date);
    if (!firstDate || transDate < firstDate) firstDate = transDate;
    if (!lastDate || transDate > lastDate) lastDate = transDate;
  });
  
  const modalHTML = `
    <div id="tickerModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;">
      <div style="background: white; border-radius: 10px; padding: 20px; max-width: 90%; max-height: 90%; overflow: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
          <h2 style="margin: 0; color: #667eea;">${symbol} - Transaction Details</h2>
          <button onclick="closeTickerModal()" style="background: #dc3545; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 16px; font-weight: bold;">✕ Close</button>
        </div>
        
        <!-- Summary Stats -->
        <div style="background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border-radius: 8px; padding: 15px; margin-bottom: 20px; border-left: 4px solid #667eea;">
          <h3 style="margin: 0 0 12px 0; color: #2c3e50; font-size: 1.05em;">📊 Summary</h3>
          
          <div style="display: grid; grid-template-columns: repeat(11, 1fr); gap: 8px;">
            <div style="background: white; padding: 8px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="color: #6c757d; font-size: 0.75em; margin-bottom: 3px; white-space: nowrap;">Total Shares</div>
              <div style="font-size: 1em; font-weight: 600; color: #2c3e50;">${totalShares.toFixed(2)}</div>
            </div>
            <div style="background: white; padding: 8px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="color: #6c757d; font-size: 0.75em; margin-bottom: 3px; white-space: nowrap;">Avg Cost</div>
              <div style="font-size: 1em; font-weight: 600; color: #2c3e50;">$${avgCost.toFixed(2)}</div>
            </div>
            <div style="background: white; padding: 8px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="color: #6c757d; font-size: 0.75em; margin-bottom: 3px; white-space: nowrap;">Current Price</div>
              <div style="font-size: 1em; font-weight: 600; color: #667eea;">$${currentPrice.toFixed(2)}</div>
            </div>
            <div style="background: white; padding: 8px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="color: #6c757d; font-size: 0.75em; margin-bottom: 3px; white-space: nowrap;">Cost Basis</div>
              <div style="font-size: 1em; font-weight: 600; color: #2c3e50;">$${totalCost.toFixed(2)}</div>
            </div>
            <div style="background: white; padding: 8px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="color: #6c757d; font-size: 0.75em; margin-bottom: 3px; white-space: nowrap;">Current Value</div>
              <div style="font-size: 1em; font-weight: 600; color: #2c3e50;">$${currentValue.toFixed(2)}</div>
            </div>
            <div style="background: white; padding: 8px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="color: #6c757d; font-size: 0.75em; margin-bottom: 3px; white-space: nowrap;">Gain/Loss</div>
              <div style="font-size: 1em; font-weight: 600; color: ${gainLoss >= 0 ? '#28a745' : '#dc3545'};">$${gainLoss.toFixed(2)}</div>
              <div style="font-size: 0.8em; font-weight: 600; color: ${gainLoss >= 0 ? '#28a745' : '#dc3545'};">(${gainLossPercent.toFixed(2)}%)</div>
            </div>
            <div style="background: white; padding: 8px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="color: #6c757d; font-size: 0.75em; margin-bottom: 3px; white-space: nowrap;">XIRR</div>
              <div style="font-size: 1em; font-weight: 600; color: #667eea;">${weightedDays < 90 ? 'N/A' : xirrValue.toFixed(2) + '%'}</div>
            </div>
            <div style="background: white; padding: 8px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="color: #6c757d; font-size: 0.75em; margin-bottom: 3px; white-space: nowrap;">Days Held</div>
              <div style="font-size: 1em; font-weight: 600; color: #2c3e50;">${Math.round(weightedDays)}</div>
            </div>
            <div style="background: white; padding: 8px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="color: #6c757d; font-size: 0.75em; margin-bottom: 3px; white-space: nowrap;">First Buy</div>
              <div style="font-size: 1em; font-weight: 600; color: #2c3e50;">${firstDate ? formatDateDDMMYYYY(firstDate) : 'N/A'}</div>
            </div>
            <div style="background: white; padding: 8px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="color: #6c757d; font-size: 0.75em; margin-bottom: 3px; white-space: nowrap;">Last Entry</div>
              <div style="font-size: 1em; font-weight: 600; color: #2c3e50;">${lastDate ? formatDateDDMMYYYY(lastDate) : 'N/A'}</div>
            </div>
            <div style="background: white; padding: 8px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="color: #6c757d; font-size: 0.75em; margin-bottom: 3px; white-space: nowrap;">Transactions</div>
              <div style="font-size: 1em; font-weight: 600; color: #667eea;">${symbolTransactions.length}</div>
            </div>
          </div>
        </div>
        
        <!-- Transaction Table -->
        <h3 style="margin: 20px 0 10px 0; color: #2c3e50;">📝 All Transactions</h3>
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
              <tr style="border-bottom: 1px solid #dee2e6; cursor: pointer;" ondblclick="editTransactionFromModal(${t.id})" title="Double-click to edit">
                <td style="padding: 10px;">${formatDateDDMMYYYY(t.date)}</td>
                <td style="padding: 10px;"><span style="background: ${t.type === 'buy' ? '#28a745' : t.type === 'sell' ? '#dc3545' : '#ffc107'}; color: white; padding: 3px 8px; border-radius: 3px; font-size: 12px;">${t.type.toUpperCase()}</span></td>
                <td style="padding: 10px;">${portfolios.find(p => p.id === t.portfolio)?.name || t.portfolio}</td>
                <td style="padding: 10px; text-align: right;">${Math.abs(t.shares).toFixed(2)}</td>
                <td style="padding: 10px; text-align: right;">$${t.price.toFixed(2)}</td>
<td style="padding: 10px; text-align: right; font-weight: bold; color: ${t.type === 'dividend' && t.shares === 0 ? '#dc3545' : 'inherit'};">
  ${t.type === 'dividend' && t.shares === 0 ? '-$' + t.price.toFixed(2) : '$' + (Math.abs(t.shares) * t.price).toFixed(2)}
</td>        
   </tr>
`).join('')}
          </tbody>
<tfoot>
  <tr style="background: #f8f9fa; font-weight: bold; border-top: 3px solid #667eea;">
    <td colspan="3" style="padding: 12px; text-align: right;">NET INVESTMENT:</td>
    <td style="padding: 12px; text-align: right;">${symbolTransactions.filter(t => t.type !== 'dividend' || t.shares > 0).reduce((sum, t) => sum + Math.abs(t.shares), 0).toFixed(2)}</td>
    <td style="padding: 12px;"></td>
    <td style="padding: 12px; text-align: right; color: #667eea;">$${totalCost.toFixed(2)}</td>
  </tr>
</tfoot>
        </table>
        <p style="margin-top: 15px; color: #6c757d; font-size: 0.9em; text-align: center;">💡 Tip: Double-click any transaction to edit it</p>
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
function editTransactionFromModal(transactionId) {
  // Close the modal first
  closeTickerModal();
  
  // Switch to "All Transactions" tab
  const allTransactionsTab = document.querySelector('[data-tab="all"]');
  
  if (allTransactionsTab) {
    allTransactionsTab.click();
  }
  
  // Find the actual index in transactions array
  const transactionIndex = transactions.findIndex(t => t.id === transactionId);
  
  if (transactionIndex === -1) {
    alert('Transaction not found');
    return;
  }
  
  // Wait for tab to switch, then trigger edit
  setTimeout(() => {
    showEditModal(transactionIndex);
  }, 300);
}
function convertToDateInputFormat(dateValue) {
  if (!dateValue) return '';
  
  let dateObj;
  
  // Handle DD/MM/YYYY format
  if (typeof dateValue === 'string' && dateValue.includes('/')) {
    const parts = dateValue.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`; // Return yyyy-MM-dd
    }
  }
  
  // Handle ISO format (2023-05-22T00:00:00+00:00)
  if (typeof dateValue === 'string' && dateValue.includes('T')) {
    dateObj = new Date(dateValue);
  }
  // Handle Date object
  else if (dateValue instanceof Date) {
    dateObj = dateValue;
  }
  // Try generic parsing
  else {
    dateObj = new Date(dateValue);
  }
  
  // Return yyyy-MM-dd format
  if (dateObj && !isNaN(dateObj.getTime())) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return '';
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
<input type="date" id="editDate" value="${convertToDateInputFormat(t.date)}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
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
          mainControls.querySelectorAll('select, input, button').forEach(el => el.style.display = '');
        } else if (tabsWithDelete.includes(tab.dataset.tab)) {
          mainControls.style.display = 'flex';
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
      
      // Sidebar management
      const portfolioSidebar = document.getElementById('portfolioSidebar');
      const dividendsSidebar = document.getElementById('dividendsSidebar');
      const premiumsSidebar = document.getElementById('premiumsSidebar');
      const cashFlowSidebar = document.getElementById('cashFlowSidebar');
      const soldSidebar = document.getElementById('soldSidebar');
      const sidebarContainer = document.querySelector('.sidebar');


      // Hide all sidebars first
      [portfolioSidebar, dividendsSidebar, premiumsSidebar, cashFlowSidebar, soldSidebar].forEach(sb => {
        if (sb) sb.style.display = 'none';
      });
      
      // Determine which sidebar to show
      const portfolioTabsList = ['total', ...portfolios.filter(p => p.id !== 'total').map(p => p.id)];
      
      if (portfolioTabsList.includes(tab.dataset.tab)) {
        // Portfolio tabs use portfolio sidebar
        if (portfolioSidebar) portfolioSidebar.style.display = 'block';
        
      } else if (tab.dataset.tab === 'dividends') {
        if (dividendsSidebar) dividendsSidebar.style.display = 'block';
        updateDividendsTable('total');
        updateDividendsSidebar();
        
      } else if (tab.dataset.tab === 'premiums') {
        if (premiumsSidebar) premiumsSidebar.style.display = 'block';
        updatePremiumsTable('lifetime');
        
      } else if (tab.dataset.tab === 'cashflow') {
        if (cashFlowSidebar) cashFlowSidebar.style.display = 'block';
        
      } else if (tab.dataset.tab === 'sold') {
        if (soldSidebar) soldSidebar.style.display = 'block';
        
      } else if (tab.dataset.tab === 'all') {
        updateAllTransactionsTable();
        populatePortfolioFilter();
      }
      // 'ticker' and 'all' tabs show no sidebar
      
      // Hide entire sidebar container for tabs that don't need it
      if (tab.dataset.tab === 'ticker' || tab.dataset.tab === 'all') {
        if (sidebarContainer) sidebarContainer.style.display = 'none';
      } else {
        if (sidebarContainer) sidebarContainer.style.display = 'block';
      }
      refreshPricesAndNames();
    });  // Close tab.addEventListener
  });    // Close tabs.forEach
}          // Close initializeTabs function
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
  // Generate price cell with checkbox for manual editing
function generatePriceCell(symbol, currentPrice) {
  const price = getCurrentPrice(symbol) || currentPrice || 0;
  
  if (priceMode === 'manual') {
    return `
      <div class="price-cell">
        <span>$${price.toFixed(2)}</span>
        <input type="checkbox" class="price-edit-checkbox" data-symbol="${symbol}" onchange="handlePriceCheckbox(this, '${symbol}', ${price})">
      </div>
    `;
  } else {
    return `$${price.toFixed(2)}`;
  }
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
