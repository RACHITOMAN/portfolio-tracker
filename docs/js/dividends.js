function updateDividendsTable(portfolioFilter = 'total') {
  console.log('📊 Updating Dividends Table for portfolio:', portfolioFilter);
  
  let dividendTransactions = transactions.filter(t => t.type === 'dividend');
  
  // Filter by portfolio if not 'total'
  if (portfolioFilter !== 'total') {
    dividendTransactions = dividendTransactions.filter(t => t.portfolio === portfolioFilter);
  }
  
  console.log('Found dividend transactions:', dividendTransactions);
  
  if (dividendTransactions.length === 0) {
    document.getElementById('totalDripIncome').textContent = '$0.00';
    document.getElementById('totalCashDividends').textContent = '$0.00';
    document.getElementById('totalDividendIncome').textContent = '$0.00';
    document.getElementById('dividendStocksCount').textContent = '0';
    
    const tbody = document.querySelector('#dividendsTable tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #6c757d;">No dividend transactions found</td></tr>';
    return;
  }
  
  // Group dividends by symbol
  const dividendsBySymbol = {};
  
  dividendTransactions.forEach(t => {
    if (!dividendsBySymbol[t.symbol]) {
      dividendsBySymbol[t.symbol] = {
        symbol: t.symbol,
        portfolio: t.portfolio,
        dripShares: 0,
        dripValue: 0,
        cashAmount: 0,
        totalAmount: 0,
        count: 0,
        firstDate: t.date,
        lastDate: t.date
      };
    }
    
    const data = dividendsBySymbol[t.symbol];
    data.count++;
    
    if (t.shares > 0) {
      // DRIP dividend
      data.dripShares += t.shares;
      const currentPrice = livePrices[t.symbol] || 0;
      data.dripValue += t.shares * currentPrice;
    } else {
      // Cash dividend
      data.cashAmount += t.price;
    }
    
    // Track date range
    if (new Date(t.date) < new Date(data.firstDate)) data.firstDate = t.date;
    if (new Date(t.date) > new Date(data.lastDate)) data.lastDate = t.date;
  });
  
  // Calculate grand totals
  let totalDrip = 0;
  let totalCash = 0;
  
  Object.values(dividendsBySymbol).forEach(data => {
    data.totalAmount = data.dripValue + data.cashAmount;
    totalDrip += data.dripValue;
    totalCash += data.cashAmount;
  });
  
  const totalIncome = totalDrip + totalCash;
  
  // Update summary cards
  document.getElementById('totalDripIncome').textContent = '$' + totalDrip.toFixed(2);
  document.getElementById('totalCashDividends').textContent = '$' + totalCash.toFixed(2);
  document.getElementById('totalDividendIncome').textContent = '$' + totalIncome.toFixed(2);
  document.getElementById('dividendStocksCount').textContent = Object.keys(dividendsBySymbol).length;
  
  // Populate table
  const tbody = document.querySelector('#dividendsTable tbody');
  tbody.innerHTML = '';
  
  // Sort by symbol alphabetically
  const sortedData = Object.values(dividendsBySymbol).sort((a, b) => a.symbol.localeCompare(b.symbol));
  
  sortedData.forEach(data => {
    const row = document.createElement('tr');
    const portfolioName = getPortfolioName(data.portfolio);
    const portfolioColor = getPortfolioColorDot(data.portfolio);
    
    // Calculate yield on cost
    const holding = globalSymbolData[data.symbol];
    const yieldOnCost = holding && holding.totalCost > 0 ? ((data.totalAmount / holding.totalCost) * 100) : 0;
    
    // Type badges
    let typeBadges = '';
    if (data.dripShares > 0) {
      typeBadges += '<span style="background: #28a745; color: white; padding: 3px 8px; border-radius: 3px; font-size: 12px; margin-right: 5px;">DRIP</span>';
    }
    if (data.cashAmount > 0) {
      typeBadges += '<span style="background: #667eea; color: white; padding: 3px 8px; border-radius: 3px; font-size: 12px;">CASH</span>';
    }
    
    row.innerHTML = `
      <td>${makeTickerClickable(data.symbol)}</td>
      <td>${portfolioColor}${portfolioName}</td>
      <td>${typeBadges}</td>
      <td>${data.dripShares > 0 ? data.dripShares.toFixed(4) : '-'}</td>
      <td style="font-weight: 600; color: #667eea;">$${data.totalAmount.toFixed(2)}</td>
      <td>${formatDateDDMMYYYY(data.firstDate)} - ${formatDateDDMMYYYY(data.lastDate)}</td>
      <td>${yieldOnCost.toFixed(2)}%</td>
    `;
    
    tbody.appendChild(row);
  });
}
function updateDividendsSidebar() {
const sidebar = document.getElementById('dividendsSidebar');
  if (!sidebar) return;
  
  // Get all dividend transactions
  const dividendTransactions = transactions.filter(t => t.type === 'dividend');
  
  // Group by portfolio
  const dividendsByPortfolio = {};
  
  portfolios.filter(p => p.id !== 'total').forEach(p => {
    dividendsByPortfolio[p.id] = {
      name: p.name,
      dripValue: 0,
      cashAmount: 0,
      total: 0,
      count: 0
    };
  });
  
  dividendTransactions.forEach(t => {
    if (!dividendsByPortfolio[t.portfolio]) return;
    
    const data = dividendsByPortfolio[t.portfolio];
    data.count++;
    
    if (t.shares > 0) {
      // DRIP
      const currentPrice = livePrices[t.symbol] || 0;
      data.dripValue += t.shares * currentPrice;
    } else {
      // Cash
      data.cashAmount += t.price;
    }
    
    data.total = data.dripValue + data.cashAmount;
  });
  
  // Calculate totals
  const totalDividends = Object.values(dividendsByPortfolio).reduce((sum, p) => sum + p.total, 0);
  
  // Build sidebar HTML with proper card structure
  let sidebarHTML = '';
  
  // Total Dividends Card
  sidebarHTML += `
    <div class="summary-card">
      <h3>Total Dividends</h3>
      <div class="value">$${totalDividends.toFixed(2)}</div>
    </div>
  `;
  
  // Per portfolio cards
  Object.entries(dividendsByPortfolio).forEach(([id, data]) => {
    if (data.total === 0) return; // Skip portfolios with no dividends
    
    const percentage = totalDividends > 0 ? ((data.total / totalDividends) * 100).toFixed(1) : 0;
    
    sidebarHTML += `
      <div class="summary-card">
        <h3>${data.name}</h3>
        <div class="value">$${data.total.toFixed(2)}</div>
        <div class="change">${percentage}% of total</div>
        <div style="font-size: 0.8em; color: #6c757d; margin-top: 8px; line-height: 1.5;">
          💚 DRIP: $${data.dripValue.toFixed(2)}<br>
          💵 Cash: $${data.cashAmount.toFixed(2)}
        </div>
      </div>
    `;
  });
  
  sidebar.innerHTML = sidebarHTML;
}
function handleDividendTypeChange() {
  const dividendType = document.getElementById('dividendType').value;
  const sharesInput = document.getElementById('shares');
  const priceInput = document.getElementById('price');
  
  if (dividendType === 'drip') {
    // DRIP: Enter shares, price locked at $0
    sharesInput.value = '';
    sharesInput.placeholder = '📊 Shares Received (e.g., 0.5)';
    sharesInput.disabled = false;
    sharesInput.style.background = 'white';  // CHANGE: white for enabled
    sharesInput.style.color = 'black';        // CHANGE: black for enabled
    priceInput.value = '0.00';
    priceInput.disabled = true;
    priceInput.placeholder = '💵 $0.00 (DRIP shares)';
    priceInput.style.background = '#f0f0f0';
    priceInput.style.color = '#999';
  } else if (dividendType === 'cash') {
    // Cash: Shares locked at 0, enter amount
    sharesInput.value = '0';
    sharesInput.disabled = true;
    sharesInput.placeholder = '📊 0 shares (Cash dividend)';
    sharesInput.style.background = '#f0f0f0';
    sharesInput.style.color = '#999';
    priceInput.value = '';
    priceInput.disabled = false;
    priceInput.placeholder = '💰 Dividend Amount (e.g., 50.00)';
    priceInput.style.background = 'white';
    priceInput.style.color = 'black';
  }
}
// Smart date input formatting
const dateInput = document.getElementById('date');
if (dateInput) {
  dateInput.addEventListener('input', function() {
    formatDateInput(this);
  });
}

