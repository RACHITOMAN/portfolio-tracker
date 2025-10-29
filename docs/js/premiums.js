// ============================================
// PREMIUMS.JS - Premium Income Tracking
// ============================================

function updatePremiumsTable(filterPeriod = 'lifetime') {
  console.log('📊 Updating Premiums Table for period:', filterPeriod);
  
  const tbody = document.getElementById('premiumsTable').querySelector('tbody');
  tbody.innerHTML = '';
  
  // Get all premium transactions
  const premiumTransactions = transactions.filter(t => t.type === 'premium');
  console.log('Found premium transactions:', premiumTransactions.length);
  
  if (premiumTransactions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #6c757d;">No premium transactions found</td></tr>';
    updatePremiumsSidebar({}, 'lifetime');
    return;
  }
  
  // Filter by date range
  const now = new Date();
  const filteredPremiums = premiumTransactions.filter(t => {
    const txDate = new Date(t.date);
    
    switch(filterPeriod) {
      case '1week':
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(now.getDate() - 7);
        return txDate >= oneWeekAgo;
      
      case '1month':
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(now.getMonth() - 1);
        return txDate >= oneMonthAgo;
      
      case 'quarter':
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        return txDate >= threeMonthsAgo;
      
      case 'ytd':
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return txDate >= startOfYear;
      
      case 'lifetime':
      default:
        return true;
    }
  });
  
  console.log(`Filtered to ${filteredPremiums.length} premiums for period: ${filterPeriod}`);
  
  // Group by symbol
  const premiumsBySymbol = {};
  
  filteredPremiums.forEach(t => {
    if (!premiumsBySymbol[t.symbol]) {
      premiumsBySymbol[t.symbol] = {
        symbol: t.symbol,
        portfolio: t.portfolio,
        transactions: [],
        totalPremium: 0,
        coveredCalls: 0,
        cspExpired: 0,
        cspAssigned: 0,
        count: 0
      };
    }
    
    const premiumAmount = t.shares * t.price;
    premiumsBySymbol[t.symbol].transactions.push(t);
    premiumsBySymbol[t.symbol].totalPremium += premiumAmount;
    premiumsBySymbol[t.symbol].count++;
    
    // Categorize by premium type
    if (t.premium_type === 'covered_call') {
      premiumsBySymbol[t.symbol].coveredCalls += premiumAmount;
    } else if (t.premium_type === 'csp_expired') {
      premiumsBySymbol[t.symbol].cspExpired += premiumAmount;
    } else if (t.premium_type === 'csp_assigned') {
      premiumsBySymbol[t.symbol].cspAssigned += premiumAmount;
    }
  });
  
  // Sort by total premium (highest first)
  const sortedSymbols = Object.keys(premiumsBySymbol).sort((a, b) => {
    return premiumsBySymbol[b].totalPremium - premiumsBySymbol[a].totalPremium;
  });
  
  // Render table rows
  sortedSymbols.forEach(symbol => {
    const data = premiumsBySymbol[symbol];
    const row = document.createElement('tr');
    
    const portfolioName = getPortfolioName(data.portfolio);
    const portfolioColor = getPortfolioColorDot(data.portfolio);
    
    // Get latest transaction date
    const latestDate = data.transactions.reduce((latest, t) => {
      const tDate = new Date(t.date);
      return tDate > latest ? tDate : latest;
    }, new Date(data.transactions[0].date));
    
    row.innerHTML = 
      '<td>' + makeTickerClickable(symbol) + '</td>' +
      '<td>' + portfolioColor + portfolioName + '</td>' +
      '<td>' + data.count + '</td>' +
      '<td class="positive">$' + data.totalPremium.toFixed(2) + '</td>' +
      '<td>$' + data.coveredCalls.toFixed(2) + '</td>' +
      '<td>$' + data.cspExpired.toFixed(2) + '</td>' +
      '<td>$' + data.cspAssigned.toFixed(2) + '</td>' +
      '<td>' + formatDateDDMMYYYY(latestDate) + '</td>';
    
    tbody.appendChild(row);
  });
  
  // Update sidebar
  updatePremiumsSidebar(premiumsBySymbol, filterPeriod);
}

function updatePremiumsSidebar(premiumsBySymbol, filterPeriod) {
const sidebar = document.getElementById('premiumsSidebar');
  if (!sidebar) return;
  
  // Calculate totals
  let totalPremium = 0;
  let totalCoveredCalls = 0;
  let totalCspExpired = 0;
  let totalCspAssigned = 0;
  let totalTransactions = 0;
  
  const portfolioTotals = {};
  portfolios.filter(p => p.id !== 'total').forEach(p => {
    portfolioTotals[p.id] = 0;
  });
  
  for (const symbol in premiumsBySymbol) {
    const data = premiumsBySymbol[symbol];
    totalPremium += data.totalPremium;
    totalCoveredCalls += data.coveredCalls;
    totalCspExpired += data.cspExpired;
    totalCspAssigned += data.cspAssigned;
    totalTransactions += data.count;
    
    if (portfolioTotals[data.portfolio] !== undefined) {
      portfolioTotals[data.portfolio] += data.totalPremium;
    }
  }
  
  // Get period label
  const periodLabels = {
    '1week': 'Last 7 Days',
    '1month': 'Last 30 Days',
    'quarter': 'Last 3 Months',
    'ytd': 'Year to Date',
    'lifetime': 'All Time'
  };
  
  // Use the same structure as other sidebars
  sidebar.innerHTML = `
    <h3>💰 Premium Income</h3>
    <div style="font-size: 0.85em; color: #6c757d; margin-bottom: 15px;">${periodLabels[filterPeriod]}</div>
    
    <div class="summary-card" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%);">
      <div class="summary-label">Total Premium Income</div>
      <div class="summary-value">$${totalPremium.toFixed(2)}</div>
      <div style="font-size: 0.85em; opacity: 0.9; margin-top: 5px;">${totalTransactions} transactions</div>
    </div>
    
    <div class="summary-card">
      <div class="summary-label">Covered Calls</div>
      <div class="summary-value positive">$${totalCoveredCalls.toFixed(2)}</div>
    </div>
    
    <div class="summary-card">
      <div class="summary-label">CSP Expired</div>
      <div class="summary-value positive">$${totalCspExpired.toFixed(2)}</div>
    </div>
    
    <div class="summary-card">
      <div class="summary-label">CSP Assigned</div>
      <div class="summary-value" style="color: #20c997;">$${totalCspAssigned.toFixed(2)}</div>
    </div>
    
    <div class="summary-card">
      <div class="summary-label">Premium by Portfolio</div>
      ${portfolios.filter(p => p.id !== 'total').map(p => {
        const amount = portfolioTotals[p.id] || 0;
        const percentage = totalPremium > 0 ? ((amount / totalPremium) * 100).toFixed(1) : '0.0';
        return `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9em;">
            <span>${getPortfolioColorDot(p.id)} ${p.name}</span>
            <span style="font-weight: 600;">$${amount.toFixed(2)}</span>
          </div>
          <div style="background: #e9ecef; height: 6px; border-radius: 3px; margin-bottom: 8px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #28a745, #20c997); height: 100%; width: ${percentage}%; transition: width 0.3s;"></div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Initialize premium filters
function initializePremiumFilters() {
  const filterButtons = document.querySelectorAll('.premium-filter-btn');
  
  filterButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      // Remove active class from all buttons
      filterButtons.forEach(b => b.classList.remove('active'));
      
      // Add active class to clicked button
      this.classList.add('active');
      
      // Update table with selected filter
      const period = this.dataset.period;
      updatePremiumsTable(period);
    });
  });
}