
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
  updateDividendsTable();
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
