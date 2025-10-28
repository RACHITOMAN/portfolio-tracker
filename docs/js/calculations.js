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
function calculateDaysHeld(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate || Date.now());
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ============ VALIDATION ============

function isValidTransaction(t) {
  if (!t || !t.symbol || isNaN(new Date(t.date).getTime())) {
    return false;
  }
  
  // Allow 0 shares for cash dividends
  const isCashDividend = t.type === 'dividend' && t.shares === 0;
  
  if (!isCashDividend && (!t.shares || t.shares <= 0)) {
    return false;
  }
  
  // DRIP dividends have price = 0
  if (t.type === 'dividend' && t.shares > 0 && t.price === 0) {
    return true;
  }
  
  // Cash dividends need a positive price (dividend amount)
  if (isCashDividend && t.price > 0) {
    return true;
  }
  
  // Premiums are always valid (can have any price)
  if (t.type === 'premium') {
    return true;
  }
  
  // Buy/Sell need valid price
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