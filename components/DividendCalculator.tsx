
import React, { useState, useEffect, useMemo } from 'react';
import { ETFHolding, DividendFrequency } from '../types';
import { fetchDividendData } from '../services/stockService';
import { useApp } from '../contexts/AppContext';
import DividendSimulation from './DividendSimulation';

// Order of display
const FREQUENCY_ORDER: DividendFrequency[] = [
  'Monthly',
  'Quarterly (1,4,7,10)',
  'Quarterly (2,5,8,11)',
  'Quarterly (3,6,9,12)',
  'Annual',
  'Others'
];

const FREQUENCY_LABELS: Record<DividendFrequency, string> = {
  'Monthly': 'Monthly (月配息)',
  'Quarterly (1,4,7,10)': 'Quarterly (1, 4, 7, 10月配)',
  'Quarterly (2,5,8,11)': 'Quarterly (2, 5, 8, 11月配)',
  'Quarterly (3,6,9,12)': 'Quarterly (3, 6, 9, 12月配)',
  'Annual': 'Annual (年配息)',
  'Others': 'Others (不定期/其他)'
};

const DividendCalculator: React.FC = () => {
  const [holdings, setHoldings] = useState<ETFHolding[]>([]);
  const { t } = useApp();
  
  // Form State
  const [symbol, setSymbol] = useState('');
  const [shares, setShares] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSimulation, setShowSimulation] = useState(false);
  const [isManual, setIsManual] = useState(false);

  // Manual Form State
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualDiv, setManualDiv] = useState('');
  const [manualFreq, setManualFreq] = useState<DividendFrequency>('Quarterly (3,6,9,12)');

  // Load
  useEffect(() => {
    const saved = localStorage.getItem('chartmaster_etf_holdings');
    if (saved) {
      try {
        setHoldings(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse ETF holdings", e);
      }
    }
  }, []);

  // Save
  useEffect(() => {
    localStorage.setItem('chartmaster_etf_holdings', JSON.stringify(holdings));
  }, [holdings]);

  const handleAutoCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !shares) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch Automated Data
      const data = await fetchDividendData(symbol);

      if (data.annualDividendRate === 0) {
        if(!window.confirm(`Warning: No dividend data found for ${data.symbol} in the last 12 months. Add anyway?`)) {
            setIsLoading(false);
            return;
        }
      }

      // 2. Create New Item
      const newItem: ETFHolding = {
        id: Date.now().toString(),
        symbol: data.symbol,
        name: data.name,
        shares: parseFloat(shares),
        annualDividendRate: data.annualDividendRate,
        currentPrice: data.currentPrice,
        yieldPercent: data.yieldPercent,
        dividendFrequency: data.frequency,
        marketCap: data.marketCap,
        payoutMonths: data.payoutMonths
      };

      setHoldings([...holdings, newItem]);
      setSymbol('');
      setShares('');
    } catch (err: any) {
      setErrorMsg(err.message || "查無配息資料，請確認代號或嘗試手動輸入");
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !shares || !manualDiv || !manualPrice) return;

    const div = parseFloat(manualDiv);
    const price = parseFloat(manualPrice);
    
    // Determine payout months based on frequency
    let payoutMonths: number[] = [];
    if (manualFreq === 'Monthly') payoutMonths = [1,2,3,4,5,6,7,8,9,10,11,12];
    else if (manualFreq === 'Quarterly (1,4,7,10)') payoutMonths = [1,4,7,10];
    else if (manualFreq === 'Quarterly (2,5,8,11)') payoutMonths = [2,5,8,11];
    else if (manualFreq === 'Quarterly (3,6,9,12)') payoutMonths = [3,6,9,12];
    else if (manualFreq === 'Annual') payoutMonths = [1]; // Default to Jan for annual if manual

    const newItem: ETFHolding = {
      id: Date.now().toString(),
      symbol: symbol.toUpperCase(),
      name: manualName || symbol.toUpperCase(),
      shares: parseFloat(shares),
      annualDividendRate: div,
      currentPrice: price,
      yieldPercent: (div / price) * 100,
      dividendFrequency: manualFreq,
      payoutMonths
    };

    setHoldings([...holdings, newItem]);
    setSymbol('');
    setShares('');
    setManualName('');
    setManualDiv('');
    setManualPrice('');
    setIsManual(false);
  };

  const removeHolding = (id: string) => {
    setHoldings(holdings.filter(h => h.id !== id));
  };

  const refreshHolding = async (id: string) => {
    const holding = holdings.find(h => h.id === id);
    if (!holding) return;

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchDividendData(holding.symbol);
      setHoldings(prev => prev.map(h => h.id === id ? {
        ...h,
        name: data.name,
        annualDividendRate: data.annualDividendRate,
        currentPrice: data.currentPrice,
        yieldPercent: data.yieldPercent,
        dividendFrequency: data.frequency,
        marketCap: data.marketCap,
        payoutMonths: data.payoutMonths
      } : h));
    } catch (err: any) {
      setErrorMsg(`Failed to refresh ${holding.symbol}: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAll = async () => {
    if (holdings.length === 0) return;
    setIsLoading(true);
    setErrorMsg(null);
    
    let successCount = 0;
    const newHoldings = [...holdings];
    
    for (let i = 0; i < newHoldings.length; i++) {
      const h = newHoldings[i];
      try {
        const data = await fetchDividendData(h.symbol);
        newHoldings[i] = {
          ...h,
          name: data.name,
          annualDividendRate: data.annualDividendRate,
          currentPrice: data.currentPrice,
          yieldPercent: data.yieldPercent,
          dividendFrequency: data.frequency,
          marketCap: data.marketCap,
          payoutMonths: data.payoutMonths
        };
        successCount++;
      } catch (e) {
        console.warn(`Failed to refresh ${h.symbol}`, e);
      }
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 300));
    }
    
    setHoldings(newHoldings);
    setIsLoading(false);
    alert(`Refresh complete. Updated ${successCount}/${holdings.length} assets.`);
  };

  const clearAll = () => {
    if (window.confirm('Are you sure you want to clear all holdings?')) {
      setHoldings([]);
    }
  };

  // Calculations
  const calculateTotalAnnualIncome = (holding: ETFHolding) => {
    return holding.shares * holding.annualDividendRate;
  };

  const totalAnnualIncome = holdings.reduce((acc, curr) => acc + calculateTotalAnnualIncome(curr), 0);
  const totalMonthlyAvg = totalAnnualIncome / 12;
  
  // Portfolio Weighted Yield
  const totalPortfolioValue = holdings.reduce((acc, curr) => acc + (curr.shares * curr.currentPrice), 0);
  const portfolioYield = totalPortfolioValue > 0 ? (totalAnnualIncome / totalPortfolioValue) * 100 : 0;

  const formatMarketCap = (val?: number) => {
    if (!val) return '-';
    if (val >= 1e12) return (val / 1e12).toFixed(2) + 'T';
    if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
    if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
    return val.toLocaleString();
  };

  // Group holdings by frequency
  const groupedHoldings = FREQUENCY_ORDER.reduce((acc, freq) => {
    acc[freq] = holdings.filter(h => h.dividendFrequency === freq);
    return acc;
  }, {} as Record<DividendFrequency, ETFHolding[]>);

  // Matrix Data: Month -> { symbol, amount }[]
  const matrixData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    return months.map(m => {
      const monthHoldings = holdings.filter(h => h.payoutMonths.includes(m));
      const total = monthHoldings.reduce((sum, h) => {
        // Estimate payout per event
        const eventsPerYear = h.dividendFrequency === 'Monthly' ? 12 : 
                             h.dividendFrequency.startsWith('Quarterly') ? 4 : 1;
        const payoutPerEvent = (h.annualDividendRate / eventsPerYear) * h.shares;
        return sum + payoutPerEvent;
      }, 0);
      return { month: m, holdings: monthHoldings, total };
    });
  }, [holdings]);

  return (
    <div className="glass-panel border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden h-full flex flex-col relative transition-colors duration-300">
      <div className="absolute top-0 right-0 p-32 bg-trading-green/5 blur-3xl rounded-full pointer-events-none"></div>

      <div className="p-5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center shrink-0 relative z-10">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-3 tracking-wide">
          <div className="bg-gray-200 dark:bg-trading-green/10 p-2 rounded-lg border border-gray-300 dark:border-trading-green/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-green-600 dark:text-trading-green">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          {t('calc.title')}
        </h2>
          {holdings.length > 0 && (
            <div className="flex items-center gap-3">
              <button 
                onClick={refreshAll}
                disabled={isLoading}
                className="text-xs font-mono text-blue-500 border border-blue-500/30 hover:bg-blue-500 hover:text-white px-4 py-1.5 rounded-full transition-all duration-300 flex items-center gap-2 disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                {t('btn.refresh_all') || 'Refresh All'}
              </button>
              <button 
                onClick={() => setShowSimulation(true)}
                className="text-xs font-mono text-trading-green border border-trading-green/30 hover:bg-trading-green hover:text-black px-4 py-1.5 rounded-full transition-all duration-300 flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                </svg>
                {t('btn.simulate')}
              </button>
              <button 
                onClick={clearAll}
                className="text-xs font-mono text-red-500 dark:text-red-400 hover:text-white border border-red-500/30 hover:bg-red-500 hover:border-red-500 px-3 py-1.5 rounded transition-all duration-300"
              >
                {t('btn.purge')}
              </button>
            </div>
          )}
        </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-y-auto custom-scrollbar relative z-10">
        
        {/* Input Form */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-gray-50/80 dark:bg-gray-800/40 backdrop-blur-sm p-6 rounded-xl border border-gray-200 dark:border-gray-700/50 space-y-5 shadow-lg relative overflow-hidden group">
             {/* Gradient glow effect on hover */}
             <div className="absolute inset-0 bg-gradient-to-br from-trading-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

             <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 font-mono uppercase tracking-wide text-sm">
                  <span className="w-2 h-2 bg-green-500 dark:bg-trading-green rounded-full animate-pulse"></span>
                  {isManual ? t('calc.manual') : t('calc.auto')}
                </h3>
                <button 
                  onClick={() => {
                    setIsManual(!isManual);
                    setErrorMsg(null);
                  }}
                  className="text-[10px] font-bold text-trading-green hover:underline uppercase tracking-tighter"
                >
                  {isManual ? t('calc.auto') : t('calc.manual')}
                </button>
             </div>
             
             <form onSubmit={isManual ? handleManualAdd : handleAutoCalculate} className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-[10px] uppercase text-gray-500 mb-1.5 font-bold tracking-wider">{t('label.symbol')}</label>
                   <div className="relative">
                      <input 
                          className="w-full bg-white dark:bg-gray-900/80 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 pl-9 text-sm text-gray-900 dark:text-white font-mono uppercase focus:border-green-500 dark:focus:border-trading-green focus:ring-1 focus:ring-green-500 dark:focus:ring-trading-green focus:outline-none transition-all"
                          value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="00878" required
                          disabled={isLoading}
                      />
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-400 absolute left-2.5 top-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                   </div>
                 </div>

                 <div>
                   <label className="block text-[10px] uppercase text-gray-500 mb-1.5 font-bold tracking-wider">{t('label.shares')}</label>
                   <div className="relative">
                      <input 
                          type="number" step="any" min="0"
                          className="w-full bg-white dark:bg-gray-900/80 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 pl-9 text-sm text-gray-900 dark:text-white font-mono focus:border-green-500 dark:focus:border-trading-green focus:ring-1 focus:ring-green-500 dark:focus:ring-trading-green focus:outline-none transition-all"
                          value={shares} onChange={e => setShares(e.target.value)} placeholder="1000" required
                          disabled={isLoading}
                      />
                      <span className="absolute left-3 top-3 text-gray-400 text-xs font-mono">#</span>
                   </div>
                 </div>
               </div>

               {isManual && (
                 <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div>
                      <label className="block text-[10px] uppercase text-gray-500 mb-1.5 font-bold tracking-wider">{t('label.name')}</label>
                      <input 
                          className="w-full bg-white dark:bg-gray-900/80 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white focus:border-green-500 dark:focus:border-trading-green focus:outline-none transition-all"
                          value={manualName} onChange={e => setManualName(e.target.value)} placeholder="e.g. 00918 High Div"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase text-gray-500 mb-1.5 font-bold tracking-wider">{t('label.price')}</label>
                        <input 
                            type="number" step="any"
                            className="w-full bg-white dark:bg-gray-900/80 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white font-mono focus:border-green-500 dark:focus:border-trading-green focus:outline-none transition-all"
                            value={manualPrice} onChange={e => setManualPrice(e.target.value)} placeholder="25.4" required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase text-gray-500 mb-1.5 font-bold tracking-wider">{t('label.div')}</label>
                        <input 
                            type="number" step="any"
                            className="w-full bg-white dark:bg-gray-900/80 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white font-mono focus:border-green-500 dark:focus:border-trading-green focus:outline-none transition-all"
                            value={manualDiv} onChange={e => setManualDiv(e.target.value)} placeholder="2.1" required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-gray-500 mb-1.5 font-bold tracking-wider">{t('label.freq')}</label>
                      <select 
                        className="w-full bg-white dark:bg-gray-900/80 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white focus:border-green-500 dark:focus:border-trading-green focus:outline-none transition-all"
                        value={manualFreq} onChange={e => setManualFreq(e.target.value as DividendFrequency)}
                      >
                        {FREQUENCY_ORDER.map(f => <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>)}
                      </select>
                    </div>
                 </div>
               )}

               {errorMsg && (
                 <div className="text-xs text-red-600 dark:text-red-300 bg-red-100 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-500/30 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                   <div className="flex items-start gap-2">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0 mt-0.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                     </svg>
                     <span className="leading-relaxed">{errorMsg}</span>
                   </div>
                   {!isManual && (
                     <button 
                       type="button"
                       onClick={(e) => {
                         e.preventDefault();
                         handleAutoCalculate(e);
                       }}
                       className="text-[10px] font-bold text-red-700 dark:text-red-300 underline uppercase tracking-widest text-left hover:text-red-500 transition-colors"
                     >
                       Retry Connection Sequence
                     </button>
                   )}
                 </div>
               )}

               <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-green-600 dark:bg-trading-green hover:bg-green-500 dark:hover:bg-cyan-400 text-white dark:text-black font-bold py-3 rounded-lg transition-all shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2 uppercase tracking-wide text-sm"
               >
                 {isLoading ? (
                   <>
                     <div className="w-4 h-4 border-2 border-white/50 dark:border-black border-t-transparent rounded-full animate-spin"></div>
                     Fetching Protocol...
                   </>
                 ) : (
                   isManual ? 'Add Manually' : t('btn.execute_add')
                 )}
               </button>
             </form>
             <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center font-mono">
               {isManual ? ':: MANUAL OVERRIDE ACTIVE ::' : ':: AUTO-DETECT DIVIDEND CYCLE ::'}
             </p>
          </div>

          {/* Metric Cards */}
          <div className="space-y-4">
             {/* Main Card */}
             <div className="bg-gradient-to-br from-gray-700 to-gray-800 dark:from-gray-800 dark:to-gray-900 p-6 rounded-xl border border-gray-600 dark:border-gray-700 relative overflow-hidden group hover:border-gray-500 dark:hover:border-gray-600 transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-10 dark:opacity-5 group-hover:opacity-10 transition-opacity">
                   <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-20 h-20 text-white">
                      <path d="M10.464 8.746c.227-.18.497-.311.786-.394v2.795a2.252 2.252 0 01-.786-.393c-.394-.313-.546-.681-.546-1.004 0-.324.152-.691.546-1.004zM12.75 15.662v-2.824c.347.085.664.228.921.421.427.32.579.686.579.991 0 .305-.152.671-.579.991a2.534 2.534 0 01-.921.42z" />
                      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v.816a3.836 3.836 0 00-1.72.756c-.712.566-1.112 1.35-1.112 2.178 0 .829.4 1.612 1.113 2.178.502.4 1.102.647 1.719.756v2.978a2.536 2.536 0 01-.921-.421l-.879-.66a.75.75 0 00-.9 1.2l.879.66c.533.4 1.169.645 1.821.75V18a.75.75 0 001.5 0v-.81a4.124 4.124 0 001.821-.749c.745-.559 1.179-1.344 1.179-2.191 0-.847-.434-1.632-1.179-2.191a4.122 4.122 0 00-1.821-.75V8.354c.29.082.559.213.786.393l.415.33a.75.75 0 00.933-1.175l-.415-.33a3.836 3.836 0 00-1.719-.755V6z" clipRule="evenodd" />
                   </svg>
                </div>
                <p className="text-xs font-bold text-gray-300 dark:text-gray-400 uppercase tracking-widest mb-2">{t('calc.est_income')}</p>
                <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-200 dark:to-gray-400 font-mono">
                  ${totalAnnualIncome.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-green-400 dark:hover:border-trading-green/30 transition-colors">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('calc.monthly')}</p>
                  <p className="text-xl font-bold text-green-600 dark:text-trading-green font-mono">
                    ${totalMonthlyAvg.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
               </div>
               <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-yellow-400 dark:hover:border-trading-yellow/30 transition-colors">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('calc.yield')}</p>
                  <p className="text-xl font-bold text-yellow-600 dark:text-trading-yellow font-mono">
                    {portfolioYield.toFixed(2)}%
                  </p>
               </div>
             </div>
          </div>
        </div>

        {/* List Table with Groups */}
        <div className="lg:col-span-8 space-y-6">
          {/* Dividend Matrix Section */}
          <div className="bg-white dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700/50 overflow-hidden shadow-xl">
             <div className="px-4 py-3 bg-gray-50 dark:bg-gray-950/80 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                <h3 className="text-xs font-black text-gray-500 dark:text-trading-green uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-trading-green rounded-full"></span>
                  {t('calc.matrix')}
                </h3>
                <span className="text-[10px] font-mono text-gray-400">UNIT: TWD/USD</span>
             </div>
             <div className="p-4 overflow-x-auto">
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 min-w-[600px]">
                   {matrixData.map((m) => (
                     <div key={m.month} className={`flex flex-col border rounded-lg p-2 transition-all ${m.total > 0 ? 'bg-trading-green/5 border-trading-green/20' : 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800'}`}>
                        <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1 border-b border-gray-100 dark:border-gray-800 pb-1 flex justify-between">
                           <span>{m.month}M</span>
                           {m.holdings.length > 0 && <span className="text-trading-green">●</span>}
                        </div>
                        <div className="flex-grow flex flex-col justify-center">
                           <div className={`text-xs font-mono font-bold ${m.total > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-300 dark:text-gray-700'}`}>
                              ${Math.round(m.total).toLocaleString()}
                           </div>
                           <div className="flex flex-wrap gap-0.5 mt-1">
                              {m.holdings.slice(0, 3).map(h => (
                                <div key={h.id} className="w-1 h-1 rounded-full bg-trading-yellow" title={h.symbol}></div>
                              ))}
                              {m.holdings.length > 3 && <div className="text-[8px] text-gray-400">+</div>}
                           </div>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>

          {/* Holdings Table */}
          <div className="bg-gray-50/50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700/50 overflow-hidden flex flex-col max-h-[500px] shadow-inner backdrop-blur-sm">
             <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-grow">
            <table className="w-full text-left border-collapse relative">
                <thead>
                <tr className="bg-gray-100 dark:bg-gray-950/80 border-b border-gray-200 dark:border-gray-800 text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest font-mono sticky top-0 z-10 backdrop-blur-md">
                    <th className="py-4 px-4 font-bold">Asset</th>
                    <th className="py-4 px-4 font-bold">Volume</th>
                    <th className="py-4 px-4 font-bold">Price</th>
                    <th className="py-4 px-4 font-bold">Market Cap</th>
                    <th className="py-4 px-4 font-bold">TTM Div</th>
                    <th className="py-4 px-4 font-bold">Yield</th>
                    <th className="py-4 px-4 font-bold text-right">Proj. Income</th>
                    <th className="py-4 px-4 sticky right-0 bg-gray-100/90 dark:bg-gray-950/80 backdrop-blur-md"></th>
                </tr>
                </thead>
                <tbody className="text-sm divide-y divide-gray-200 dark:divide-gray-800/50">
                {holdings.length === 0 ? (
                    <tr>
                    <td colSpan={8} className="py-20 text-center text-gray-500 dark:text-gray-600">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center border border-gray-300 dark:border-gray-700">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-8 h-8 opacity-40">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m13.5 2.625v-1.5c0-.621.504-1.125 1.125-1.125m-12.375 2.625h9.75a2.25 2.25 0 002.25-2.25V5.625m-9 6h3.75m-3.75 4.5h3.75m3-10.5h2.25A2.25 2.25 0 0121 7.875v11.25c0 .621-.504 1.125-1.125 1.125h-2.25M13.5 6.375v2.25A2.25 2.25 0 0015.75 10.875h2.25" />
                                </svg>
                            </div>
                            <span className="font-mono text-xs uppercase tracking-widest opacity-60">{t('msg.no_holdings')}</span>
                        </div>
                    </td>
                    </tr>
                ) : (
                    FREQUENCY_ORDER.map(freq => {
                        const groupHoldings = groupedHoldings[freq] || [];
                        if (groupHoldings.length === 0) return null;

                        const groupTotal = groupHoldings.reduce((sum, h) => sum + calculateTotalAnnualIncome(h), 0);

                        return (
                            <React.Fragment key={freq}>
                                {/* Group Header */}
                                <tr className="bg-gray-100 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-700/50">
                                    <td colSpan={8} className="py-2 px-4 text-[10px] font-bold text-gray-700 dark:text-trading-yellow uppercase tracking-widest backdrop-blur-sm border-l-2 border-yellow-500 dark:border-trading-yellow">
                                        {FREQUENCY_LABELS[freq]}
                                    </td>
                                </tr>

                                {/* Items */}
                                {groupHoldings.map((holding) => (
                                    <tr key={holding.id} className="group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="py-3 px-4 transition-colors">
                                            <div className="font-mono font-bold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-trading-green transition-colors">{holding.symbol}</div>
                                            {holding.name && <div className="text-[10px] text-gray-500 truncate max-w-[120px] font-sans group-hover:text-gray-400" title={holding.name}>{holding.name}</div>}
                                        </td>
                                        <td className="py-3 px-4 font-mono text-gray-600 dark:text-gray-300">
                                            {holding.shares.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-4 font-mono text-gray-500 dark:text-gray-400">
                                            {holding.currentPrice.toFixed(2)}
                                        </td>
                                        <td className="py-3 px-4 font-mono text-gray-500 dark:text-gray-400">
                                            {formatMarketCap(holding.marketCap)}
                                        </td>
                                        <td className="py-3 px-4 font-mono text-gray-500 dark:text-gray-400">
                                            {holding.annualDividendRate.toFixed(2)}
                                        </td>
                                        <td className="py-3 px-4 font-mono font-bold text-yellow-600 dark:text-trading-yellow">
                                            {holding.yieldPercent.toFixed(2)}%
                                        </td>
                                        <td className="py-3 px-4 font-mono font-bold text-right text-gray-900 dark:text-white">
                                            ${Math.round(calculateTotalAnnualIncome(holding)).toLocaleString()}
                                        </td>
                                        <td className="py-3 px-4 text-right sticky right-0 bg-transparent backdrop-blur-none">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => refreshHolding(holding.id)}
                                                    className="text-gray-400 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-400/10"
                                                    title="Refresh Data"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                                    </svg>
                                                </button>
                                                <button 
                                                    onClick={() => removeHolding(holding.id)}
                                                    className="text-gray-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-400/10"
                                                    title="Remove"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                
                                {/* Group Subtotal */}
                                <tr className="border-b border-gray-200 dark:border-gray-700/30 bg-gray-50/50 dark:bg-gray-800/10">
                                    <td colSpan={6} className="py-2 px-4 text-right text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                        Subtotal
                                    </td>
                                    <td className="py-2 px-4 font-mono font-bold text-gray-700 dark:text-gray-400 text-right text-sm border-t border-gray-200 dark:border-gray-700">
                                        ${groupTotal.toLocaleString()}
                                    </td>
                                    <td></td>
                                </tr>
                            </React.Fragment>
                        );
                    })
                )}
                </tbody>
            </table>
           </div>
           
           <div className="bg-gray-100 dark:bg-gray-900/80 border-t border-gray-200 dark:border-gray-800 p-3 flex justify-between items-center text-[10px] text-gray-500 font-mono">
               <span className="flex items-center gap-2">
                 <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                 DATA FEED: YAHOO FINANCE API
               </span>
               <span>LOCAL_STORAGE_SYNC: ACTIVE</span>
           </div>
          </div>
        </div>
      </div>

      {showSimulation && (
        <DividendSimulation 
          holdings={holdings}
          totalValue={totalPortfolioValue}
          totalIncome={totalAnnualIncome}
          onClose={() => setShowSimulation(false)}
        />
      )}
    </div>
  );
};

export default DividendCalculator;
