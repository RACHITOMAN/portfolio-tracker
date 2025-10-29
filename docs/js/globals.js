// Global Variables
const CACHE_DURATION = 4 * 60 * 60 * 1000;
let transactions = [];
let originalSidebarHTML = '';
let globalSymbolData = {};  
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
let priceMode = localStorage.getItem('priceMode') || 'api';
