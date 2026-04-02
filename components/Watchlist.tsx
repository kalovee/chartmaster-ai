
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StockItem, AnalysisStatus, Timeframe } from '../types';
import { fetchMTFStockData, fetchQuote } from '../services/stockService';
import { analyzeStockByData } from '../services/geminiService';
import AnalysisView from './AnalysisView';
import TradingViewChart from './TradingViewChart';
import { useApp } from '../contexts/AppContext';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

const INDICATORS = [
  { id: 'rsi', name: 'RSI (14)' },
  { id: 'macd', name: 'MACD' },
  { id: 'bollinger', name: 'Bollinger Bands' }
];

const loadingSteps = [
  "INITIALIZING_NEURAL_CORE",
  "SCANNING_MARKET_STRUCTURE",
  "IDENTIFYING_LIQUIDITY_POOLS",
  "CALCULATING_EMA_CROSSOVERS",
  "DETECTING_ORDER_BLOCKS",
  "FINALIZING_STRATEGIC_REPORT"
];

const DynamicLoadingIndicator = () => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(prev => (prev + 1) % loadingSteps.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-6 animate-in fade-in duration-300">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <div className="absolute inset-0 border-4 border-dashed border-gray-200 dark:border-gray-700 rounded-full animate-[spin_3s_linear_infinite]"></div>
        <div className="absolute inset-2 border-4 border-t-trading-yellow border-r-transparent border-b-transparent border-l-transparent rounded-full animate-[spin_1s_linear_infinite]"></div>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-trading-yellow animate-pulse">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      </div>
      
      <div className="w-full max-w-xs flex flex-col items-center gap-3">
        <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
          <div 
            className="bg-trading-yellow h-1.5 rounded-full transition-all duration-500 ease-out" 
            style={{ width: `${((step + 1) / loadingSteps.length) * 100}%` }}
          ></div>
        </div>
        <p className="text-xs font-mono tracking-widest text-trading-yellow animate-pulse uppercase text-center">
          {loadingSteps[step]}...
        </p>
      </div>
    </div>
  );
};

const Watchlist: React.FC = () => {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [newNote, setNewNote] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>(['rsi', 'macd']);
  const { t, language, showToast } = useApp();
  
  const symbolInputRef = useRef<HTMLInputElement>(null);

  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeepRefreshing, setIsDeepRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Viewport visibility tracking for performance optimization
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const visibleIdsRef = useRef<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    visibleIdsRef.current = visibleIds;
  }, [visibleIds]);

  useEffect(() => {
    // Initialize IntersectionObserver to track visible items
    observerRef.current = new IntersectionObserver(
      (entries) => {
        setVisibleIds((prev) => {
          const next = new Set(prev);
          entries.forEach((entry) => {
            const id = entry.target.getAttribute('data-id');
            if (id) {
              if (entry.isIntersecting) {
                next.add(id);
              } else {
                next.delete(id);
              }
            }
          });
          return next;
        });
      },
      { threshold: 0.1, rootMargin: '50px' } // Add some margin for smoother experience
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // Ref callback to register elements with the observer
  const itemRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      observerRef.current?.observe(node);
    }
  }, []);
  
  // Track expanded state for each stock to show/hide full analysis
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Listen for shortcuts events from App.tsx
  useEffect(() => {
    const handleFocusInput = () => {
      symbolInputRef.current?.focus();
    };
    const handleDeepRefresh = () => {
      refreshAllAnalysis();
    };

    window.addEventListener('watchlist-focus-input', handleFocusInput);
    window.addEventListener('watchlist-deep-refresh', handleDeepRefresh);
    return () => {
      window.removeEventListener('watchlist-focus-input', handleFocusInput);
      window.removeEventListener('watchlist-deep-refresh', handleDeepRefresh);
    };
  }, [stocks]); // Refresh listener depends on current stock list

  // Load from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('chartmaster_watchlist');
    if (saved) {
      try {
        setStocks(JSON.parse(saved));
        setLastUpdated(new Date()); 
      } catch (e) {
        console.error("Failed to parse watchlist", e);
      }
    }
  }, []);

  // Save to LocalStorage whenever stocks change
  useEffect(() => {
    localStorage.setItem('chartmaster_watchlist', JSON.stringify(stocks));
  }, [stocks]);

  // Optimized function: Updates prices and basic stats (Fast)
  const refreshPricesOnly = useCallback(async (manual = false) => {
    if (stocks.length === 0 || isRefreshing) return;
    
    // Performance Optimization: Only refresh visible stocks unless it's a manual trigger
    const stocksToUpdate = manual ? stocks : stocks.filter(s => visibleIdsRef.current.has(s.id));
    
    if (stocksToUpdate.length === 0) return;

    setIsRefreshing(true);

    try {
      const updates = await Promise.all(stocksToUpdate.map(async (stock) => {
        try {
          const stats = await fetchQuote(stock.symbol);
          return { id: stock.id, ...stats };
        } catch (e) {
          return null; 
        }
      }));

      setStocks(prev => prev.map(stock => {
        const update = updates.find(u => u?.id === stock.id);
        if (update) {
          return { 
            ...stock, 
            lastPrice: update.price, 
            changePercent: update.changePercent,
            dayHigh: update.dayHigh,
            dayLow: update.dayLow,
            fiftyTwoWeekHigh: update.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: update.fiftyTwoWeekLow,
            volume: update.volume,
            lastUpdated: new Date().toISOString()
          };
        }
        return stock;
      }));
      
      setLastUpdated(new Date());
      if (manual) showToast("Market prices updated.", "success");
    } catch (err: any) {
      console.error("Price refresh failed", err);
      showToast(err.message || "Failed to sync market prices.", "error");
    } finally {
      setIsRefreshing(false);
    }
  }, [stocks, isRefreshing, showToast]);

  // Deep refresh function: Updates prices AND re-runs full AI analysis (Slow)
  const refreshAllAnalysis = async () => {
    if (stocks.length === 0 || isDeepRefreshing) return;
    
    // Performance Optimization: Only deep refresh visible stocks
    const visibleStocks = stocks.filter(s => visibleIdsRef.current.has(s.id));
    
    if (visibleStocks.length === 0) {
        showToast("No stocks currently visible to refresh.", "info");
        return;
    }

    if (!window.confirm(`Perform Deep Refresh for ${visibleStocks.length} visible stocks? This will re-run full AI technical analysis.`)) return;

    setIsDeepRefreshing(true);
    
    // Set visible ones to analyzing state for feedback
    setStocks(prev => prev.map(s => visibleIdsRef.current.has(s.id) ? { ...s, analysisStatus: AnalysisStatus.ANALYZING } : s));

    try {
        const updates = await Promise.all(visibleStocks.map(async (stock) => {
            try {
                // Fetch Multi-Timeframe Data (Weekly, Daily, Hourly)
                const res = await fetchMTFStockData(stock.symbol);
                // Run AI Analysis
                const timeframe = stock.selectedTimeframe || '1d';
                const { markdown, groundingMetadata } = await analyzeStockByData(stock.symbol, res.mtfDataString, language, timeframe);
                
                return {
                    id: stock.id,
                    success: true,
                    data: { markdown, groundingMetadata, ...res }
                };
            } catch (error: any) {
                return {
                    id: stock.id,
                    success: false,
                    error: error.message || "Deep Refresh failed"
                };
            }
        }));

        setStocks(prev => prev.map(stock => {
            const res = updates.find(u => u.id === stock.id);
            if (res) {
                if (res.success && res.data) {
                    return {
                        ...stock,
                        analysisStatus: AnalysisStatus.SUCCESS,
                        analysis: res.data.markdown,
                        groundingMetadata: res.data.groundingMetadata,
                        lastPrice: res.data.lastPrice,
                        changePercent: res.data.changePercent,
                        dayHigh: res.data.dayHigh,
                        dayLow: res.data.dayLow,
                        fiftyTwoWeekHigh: res.data.fiftyTwoWeekHigh,
                        fiftyTwoWeekLow: res.data.fiftyTwoWeekLow,
                        volume: res.data.volume,
                        ohlcvData: res.data.ohlcvData,
                        addedAt: new Date().toISOString(),
                        lastUpdated: new Date().toISOString()
                    };
                } else {
                    return {
                        ...stock,
                        analysisStatus: AnalysisStatus.ERROR,
                        analysis: res.error
                    };
                }
            }
            return stock;
        }));

        setLastUpdated(new Date());
        showToast("Deep AI analysis cycle complete.", "success");
    } catch (error) {
        console.error("Deep refresh sequence failed", error);
        showToast("Deep refresh sequence encountered errors.", "error");
    } finally {
      setIsDeepRefreshing(false);
    }
  };

  // Auto-refresh interval (every 120 seconds for prices only)
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (stocks.length > 0 && !isRefreshing && !isDeepRefreshing) {
        refreshPricesOnly();
      }
    }, 120000); 

    return () => clearInterval(intervalId);
  }, [stocks, isRefreshing, isDeepRefreshing, refreshPricesOnly]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol.trim()) return;

    const symbol = newSymbol.toUpperCase().trim();
    setIsAdding(true);

    const tempId = Date.now().toString();
    
    // Create optimistic item with LOADING status
    const newItem: StockItem = {
      id: tempId,
      symbol: symbol,
      note: newNote,
      addedAt: new Date().toISOString(),
      analysisStatus: AnalysisStatus.ANALYZING,
      analysis: null
    };

    setStocks(prev => [newItem, ...prev]);
    setNewSymbol('');
    setNewNote('');

    try {
      const res = await fetchMTFStockData(symbol);
      const { markdown, groundingMetadata } = await analyzeStockByData(symbol, res.mtfDataString, language, '1d');

      setStocks(prev => prev.map(item => {
        if (item.id === tempId) {
          return {
            ...item,
            analysisStatus: AnalysisStatus.SUCCESS,
            analysis: markdown,
            groundingMetadata,
            selectedTimeframe: '1d',
            lastPrice: res.lastPrice,
            changePercent: res.changePercent,
            sparklineData: res.sparklineData,
            indicators: res.indicators,
            ohlcvData: res.ohlcvData,
            dayHigh: res.dayHigh,
            dayLow: res.dayLow,
            fiftyTwoWeekHigh: res.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: res.fiftyTwoWeekLow,
            volume: res.volume,
            addedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          };
        }
        return item;
      }));
      
      setExpandedId(tempId);
      setLastUpdated(new Date());
      showToast(`Added ${symbol} to monitoring list.`, "success");

    } catch (error: any) {
      console.error("Analysis Failed:", error);
      showToast(`Failed to analyze ${symbol}: ${error.message}`, "error");
      setStocks(prev => prev.map(item => {
        if (item.id === tempId) {
          return {
            ...item,
            analysisStatus: AnalysisStatus.ERROR,
            analysis: `Failed: ${error.message || 'Unknown error'}.`
          };
        }
        return item;
      }));
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = (id: string) => {
    const symbol = stocks.find(s => s.id === id)?.symbol;
    setStocks(stocks.filter(s => s.id !== id));
    if (expandedId === id) setExpandedId(null);
    showToast(`Removed ${symbol} from watchlist.`, "info");
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear your entire watchlist?')) {
      setStocks([]);
      showToast("Watchlist cleared.", "info");
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleReAnalyze = async (item: StockItem, timeframe: Timeframe = '1d') => {
    setStocks(prev => prev.map(s => s.id === item.id ? { ...s, analysisStatus: AnalysisStatus.ANALYZING, selectedTimeframe: timeframe } : s));
    showToast(`Re-analyzing ${item.symbol} (${timeframe})...`, "info");

    try {
        const res = await fetchMTFStockData(item.symbol);
        const { markdown, groundingMetadata } = await analyzeStockByData(item.symbol, res.mtfDataString, language, timeframe);
        
        setStocks(prev => prev.map(s => {
          if (s.id === item.id) {
            return {
              ...s,
              analysisStatus: AnalysisStatus.SUCCESS,
              analysis: markdown,
              groundingMetadata,
              selectedTimeframe: timeframe,
              lastPrice: res.lastPrice,
              changePercent: res.changePercent,
              sparklineData: res.sparklineData,
              indicators: res.indicators,
              dayHigh: res.dayHigh,
              dayLow: res.dayLow,
              fiftyTwoWeekHigh: res.fiftyTwoWeekHigh,
              fiftyTwoWeekLow: res.fiftyTwoWeekLow,
              volume: res.volume,
              ohlcvData: res.ohlcvData,
              addedAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString()
            };
          }
          return s;
        }));
        setExpandedId(item.id);
        setLastUpdated(new Date());
        showToast(`AI Report updated for ${item.symbol}.`, "success");
    } catch (error: any) {
        showToast(error.message, "error");
        setStocks(prev => prev.map(s => s.id === item.id ? { ...s, analysisStatus: AnalysisStatus.ERROR, analysis: error.message } : s));
    }
  };

  const handleRefreshIndividual = async (stock: StockItem) => {
    if (isRefreshing || isDeepRefreshing) return;
    
    setStocks(prev => prev.map(s => s.id === stock.id ? { ...s, analysisStatus: AnalysisStatus.ANALYZING } : s));
    
    try {
      const stats = await fetchQuote(stock.symbol);
      setStocks(prev => prev.map(s => {
        if (s.id === stock.id) {
          return {
            ...s,
            analysisStatus: AnalysisStatus.SUCCESS,
            lastPrice: stats.price,
            changePercent: stats.changePercent,
            dayHigh: stats.dayHigh,
            dayLow: stats.dayLow,
            fiftyTwoWeekHigh: stats.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: stats.fiftyTwoWeekLow,
            volume: stats.volume,
            lastUpdated: new Date().toISOString()
          };
        }
        return s;
      }));
      showToast(`${stock.symbol} price updated.`, "success");
    } catch (err: any) {
      console.error("Individual refresh failed", err);
      showToast(err.message || "Failed to update price.", "error");
      setStocks(prev => prev.map(s => s.id === stock.id ? { ...s, analysisStatus: AnalysisStatus.ERROR } : s));
    }
  };

  const getReportAge = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('msg.just_now');
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const formatVolume = (vol?: number) => {
    if (!vol) return 'N/A';
    if (vol >= 1000000000) return (vol / 1000000000).toFixed(2) + 'B';
    if (vol >= 1000000) return (vol / 1000000).toFixed(2) + 'M';
    if (vol >= 1000) return (vol / 1000).toFixed(2) + 'K';
    return vol.toString();
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden h-full flex flex-col transition-all duration-300">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shrink-0">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-yellow-600 dark:text-trading-yellow">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
          </svg>
          {t('tab.watchlist')}
        </h2>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
            {INDICATORS.map(ind => (
              <button
                key={ind.id}
                onClick={() => {
                  setSelectedIndicators(prev => 
                    prev.includes(ind.id) ? prev.filter(i => i !== ind.id) : [...prev, ind.id]
                  );
                }}
                className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${
                  selectedIndicators.includes(ind.id)
                    ? 'bg-trading-green text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {ind.name}
              </button>
            ))}
          </div>

          <button 
            onClick={() => {
              symbolInputRef.current?.focus();
              symbolInputRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-trading-green text-gray-900 font-bold shadow-[0_0_15px_rgba(0,240,255,0.3)] hover:shadow-[0_0_20px_rgba(0,240,255,0.5)] transition-all active:scale-95 text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add New Stock
          </button>

          {stocks.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
               <button 
                  onClick={() => refreshPricesOnly(true)}
                  disabled={isRefreshing || isDeepRefreshing}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-trading-green transition-all shadow-sm active:scale-95 ${isRefreshing ? 'opacity-70 cursor-wait' : 'hover:text-trading-green text-gray-700 dark:text-gray-300'}`}
                  title="Update prices only"
               >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  {isRefreshing ? '...' : t('btn.refresh_prices')}
               </button>

               <button 
                  onClick={refreshAllAnalysis}
                  disabled={isRefreshing || isDeepRefreshing}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-trading-yellow/20 hover:border-yellow-500 transition-all shadow-sm active:scale-95 ${isDeepRefreshing ? 'opacity-70 cursor-wait' : 'text-yellow-700 dark:text-trading-yellow hover:bg-yellow-100 dark:hover:bg-trading-yellow/20'}`}
                  title="Re-run AI analysis for all (Ctrl+Shift+A)"
               >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-3.5 h-3.5 ${isDeepRefreshing ? 'animate-spin' : ''}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  {isDeepRefreshing ? t('btn.analyzing') : t('btn.deep_refresh')}
               </button>
            </div>
          )}
          
          <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 hidden lg:block"></div>
          
          <div className="flex items-center gap-3 ml-auto lg:ml-0 font-mono">
             <span className="text-xs text-gray-500">{stocks.length} ITEMS</span>
             {stocks.length > 0 && (
               <button 
                 onClick={handleClearAll}
                 className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors flex items-center gap-1 active:scale-95"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                 </svg>
                 Clear
               </button>
             )}
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden flex-grow animate-in fade-in duration-500">
        <div className="lg:col-span-4 h-fit">
          <form onSubmit={handleAdd} className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4 shadow-sm focus-within:ring-1 focus-within:ring-trading-green/20 transition-all">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-yellow-500 dark:bg-trading-yellow rounded-full"></span>
              Add New Monitor (Ctrl+N)
            </h3>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('label.symbol')}</label>
              <input
                ref={symbolInputRef}
                type="text"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                placeholder="E.G. TSLA, 2330..."
                disabled={isAdding}
                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-yellow-500 dark:focus:border-trading-yellow focus:ring-1 focus:ring-yellow-500/20 placeholder-gray-400 dark:placeholder-gray-600 font-mono uppercase transition-all disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('label.note')}</label>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="..."
                rows={2}
                disabled={isAdding}
                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-yellow-500 dark:focus:border-trading-yellow placeholder-gray-400 dark:placeholder-gray-600 text-sm transition-all disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={!newSymbol.trim() || isAdding}
              className="w-full bg-yellow-500 dark:bg-trading-yellow hover:bg-yellow-400 text-white dark:text-gray-900 font-bold py-3 px-4 rounded-lg transition-all shadow-[0_0_15px_rgba(250,204,21,0.3)] dark:shadow-[0_0_15px_rgba(0,240,255,0.2)] hover:shadow-[0_0_25px_rgba(250,204,21,0.5)] dark:hover:shadow-[0_0_25px_rgba(0,240,255,0.4)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 uppercase text-sm tracking-wide"
            >
              {isAdding ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-200 dark:border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                  {t('btn.analyzing')}
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  {t('btn.add_analysis')}
                </>
              )}
            </button>
          </form>
        </div>

        <div className="lg:col-span-8 overflow-y-auto custom-scrollbar h-full pr-2">
          {stocks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 opacity-50 min-h-[200px] border-2 border-dashed border-gray-300 dark:border-gray-800 rounded-xl animate-pulse">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 mb-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
               </svg>
               <p className="text-sm font-mono uppercase tracking-widest">{t('msg.no_watchlist')}</p>
            </div>
          ) : (
            <div className="space-y-4 pb-20">
              {stocks.map((stock, index) => (
                <div 
                  key={stock.id} 
                  data-id={stock.id}
                  ref={itemRef}
                  className={`group bg-gray-50 dark:bg-gray-800/30 border ${expandedId === stock.id ? 'border-yellow-500/50 dark:border-trading-yellow/50 bg-white dark:bg-gray-800/50 shadow-lg' : 'border-gray-200 dark:border-gray-700/50'} rounded-xl transition-all overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-all" onClick={() => toggleExpand(stock.id)}>
                    <div className="flex items-center gap-4 flex-grow">
                       <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-white dark:text-gray-900 shadow-lg transition-all ${stock.analysisStatus === AnalysisStatus.ANALYZING ? 'bg-gray-400 dark:bg-gray-600 animate-pulse' : stock.analysisStatus === AnalysisStatus.ERROR ? 'bg-red-500' : 'bg-yellow-500 dark:bg-trading-yellow group-hover:scale-105'}`}>
                          {stock.analysisStatus === AnalysisStatus.ANALYZING ? (
                             <div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                             stock.symbol.substring(0, 1)
                          )}
                       </div>
                       <div className="flex flex-col">
                          <h3 className="text-2xl font-black text-gray-900 dark:text-white font-mono tracking-tighter leading-none group-hover:text-yellow-600 dark:group-hover:text-trading-yellow transition-colors">{stock.symbol}</h3>
                          <div className="text-[10px] text-gray-500 mt-1.5 flex items-center gap-2 font-mono uppercase tracking-tight">
                             <span className="bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded transition-colors group-hover:bg-gray-300 dark:group-hover:bg-gray-700" title="Last Data Sync">
                                {getReportAge(stock.lastUpdated || stock.addedAt)}
                             </span>
                             {stock.analysisStatus === AnalysisStatus.SUCCESS && <span className="text-green-600 dark:text-trading-green font-bold animate-pulse">● ONLINE</span>}
                             {stock.analysisStatus === AnalysisStatus.ERROR && (
                               <button 
                                  onClick={(e) => { e.stopPropagation(); handleReAnalyze(stock); }} 
                                  className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/30 text-[9px] font-black uppercase tracking-wider"
                               >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-2.5 h-2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                  </svg>
                                  Retry
                               </button>
                             )}
                          </div>
                       </div>

                       {/* Subtle Sparkline Integration */}
                       {stock.sparklineData && (
                         <div className="hidden lg:block flex-grow max-w-[120px] h-10 opacity-10 group-hover:opacity-40 transition-opacity mx-8">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={stock.sparklineData}>
                                <Line 
                                  type="monotone" 
                                  dataKey="close" 
                                  stroke={stock.changePercent && stock.changePercent >= 0 ? '#10b981' : '#ef4444'} 
                                  strokeWidth={1} 
                                  dot={false} 
                                />
                              </LineChart>
                            </ResponsiveContainer>
                         </div>
                       )}
                    </div>
                    
                    <div className="flex items-center gap-6">
                       {stock.lastPrice && (
                         <div className="flex flex-col items-end">
                            <span className="text-xl font-black text-gray-900 dark:text-white font-mono leading-none tracking-tight">
                              ${stock.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className={`text-xs font-black mt-2 px-2.5 py-1 rounded-md shadow-sm transition-transform group-hover:scale-105 ${stock.changePercent && stock.changePercent >= 0 ? 'bg-green-500 text-white dark:bg-trading-green dark:text-gray-900' : 'bg-red-500 text-white dark:bg-trading-red dark:text-white'}`}>
                              {stock.changePercent && stock.changePercent > 0 ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                            </span>
                            <button 
                               onClick={(e) => { e.stopPropagation(); handleReAnalyze(stock); }} 
                               disabled={stock.analysisStatus === AnalysisStatus.ANALYZING}
                               className="mt-2 flex items-center gap-1 px-2 py-1 rounded bg-trading-yellow/10 text-trading-yellow hover:bg-trading-yellow/20 transition-all border border-trading-yellow/30 text-[9px] font-bold uppercase tracking-wider disabled:opacity-50"
                            >
                               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                 <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                               </svg>
                               AI Analysis
                            </button>
                         </div>
                       )}
                    
                       <div className="flex items-center gap-1">
                        <button 
                           onClick={(e) => { e.stopPropagation(); handleRefreshIndividual(stock); }} 
                           disabled={stock.analysisStatus === AnalysisStatus.ANALYZING}
                           className="p-2 text-gray-400 hover:text-trading-green dark:text-gray-500 dark:hover:text-trading-green transition-all rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-90 disabled:opacity-50" 
                           title="Refresh Price"
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${stock.analysisStatus === AnalysisStatus.ANALYZING ? 'animate-spin' : ''}`}>
                             <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                           </svg>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleReAnalyze(stock); }} className="p-2 text-gray-400 hover:text-yellow-600 dark:text-gray-500 dark:hover:text-trading-yellow transition-all rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-90" title="Full Re-Analysis">
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                             <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                           </svg>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(stock.id); }} className="p-2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-all rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-90" title="Delete Monitor">
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                           </svg>
                        </button>
                        <div className={`p-2 transform transition-transform duration-500 ${expandedId === stock.id ? 'rotate-180' : ''}`}>
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-400">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                           </svg>
                        </div>
                       </div>
                    </div>
                  </div>

                  {expandedId === stock.id && (
                    <div className="border-t border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-900/50 p-6 animate-in fade-in slide-in-from-top-4 duration-500">
                       
                       {stock.ohlcvData && (
                         <div className="mb-8 animate-in fade-in zoom-in-95 duration-1000">
                           <TradingViewChart 
                             data={
                               stock.selectedTimeframe === '1w' ? stock.ohlcvData['1w'] || [] :
                               stock.selectedTimeframe === '1h' ? stock.ohlcvData['1h'] || [] :
                               stock.selectedTimeframe === '4h' ? stock.ohlcvData['1h'] || [] : // Fallback 4h to 1h
                               stock.ohlcvData['1d'] || []
                             }
                             symbol={stock.symbol}
                             timeframe={stock.selectedTimeframe || '1d'}
                           />
                         </div>
                       )}

                       {/* Expanded Market Metrics Grid */}
                       {stock.lastPrice && (
                         <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4 animate-in fade-in zoom-in-95 duration-700">
                            <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                               <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-1">Day Range</span>
                               <div className="flex items-center justify-between font-mono text-xs">
                                  <span className="text-red-500">${stock.dayLow?.toFixed(2) || '-'}</span>
                                  <div className="flex-grow h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-2 overflow-hidden">
                                     <div className="h-full bg-trading-green w-1/3 mx-auto"></div>
                                  </div>
                                  <span className="text-green-500">${stock.dayHigh?.toFixed(2) || '-'}</span>
                               </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                               <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-1">52W Range</span>
                               <div className="flex items-center justify-between font-mono text-xs">
                                  <span className="text-red-500 text-[10px]">${stock.fiftyTwoWeekLow?.toFixed(2) || '-'}</span>
                                  <div className="flex-grow h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-2"></div>
                                  <span className="text-green-500 text-[10px]">${stock.fiftyTwoWeekHigh?.toFixed(2) || '-'}</span>
                               </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                               <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-1">Volume</span>
                               <span className="text-sm font-mono font-bold text-gray-800 dark:text-gray-200">{formatVolume(stock.volume)}</span>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                               <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-1">Last Sync</span>
                               <span className="text-xs font-mono text-gray-400 uppercase">{new Date(stock.lastUpdated || stock.addedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                         </div>
                       )}

                       {stock.note && (
                         <div className="mb-6 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border-l-4 border-yellow-500 dark:border-trading-yellow shadow-md animate-in slide-in-from-left-4 duration-500">
                           <span className="text-[10px] text-yellow-600 dark:text-trading-yellow font-bold uppercase block mb-2 tracking-widest">PERSONAL INTEL</span>
                           <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed italic">"{stock.note}"</p>
                         </div>
                       )}

                       {stock.indicators && selectedIndicators.length > 0 && (
                          <div className="mb-8 grid grid-cols-2 sm:grid-cols-3 gap-4 animate-in fade-in zoom-in-95 duration-700">
                             {selectedIndicators.includes('rsi') && stock.indicators.rsi !== undefined && (
                               <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                                  <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-1">RSI (14)</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-mono font-bold ${stock.indicators.rsi > 70 ? 'text-red-500' : stock.indicators.rsi < 30 ? 'text-green-500' : 'text-gray-800 dark:text-gray-200'}`}>
                                      {stock.indicators.rsi.toFixed(2)}
                                    </span>
                                    <div className="flex-grow h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full ${stock.indicators.rsi > 70 ? 'bg-red-500' : stock.indicators.rsi < 30 ? 'bg-green-500' : 'bg-trading-green'}`} 
                                        style={{ width: `${stock.indicators.rsi}%` }}
                                      ></div>
                                    </div>
                                  </div>
                               </div>
                             )}
                             {selectedIndicators.includes('macd') && stock.indicators.macd && (
                               <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                                  <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-1">MACD</span>
                                  <span className={`text-sm font-mono font-bold ${stock.indicators.macd.value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {stock.indicators.macd.value.toFixed(4)}
                                  </span>
                               </div>
                             )}
                             {selectedIndicators.includes('bollinger') && stock.indicators.bollinger && (
                               <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                                  <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-1">Bollinger Bands</span>
                                  <div className="text-[10px] font-mono space-y-0.5">
                                    <div className="flex justify-between text-gray-400"><span>Upper:</span> <span className="text-gray-200">${stock.indicators.bollinger.upper.toFixed(2)}</span></div>
                                    <div className="flex justify-between text-gray-400"><span>Middle:</span> <span className="text-gray-200">${stock.indicators.bollinger.middle.toFixed(2)}</span></div>
                                    <div className="flex justify-between text-gray-400"><span>Lower:</span> <span className="text-gray-200">${stock.indicators.bollinger.lower.toFixed(2)}</span></div>
                                  </div>
                               </div>
                             )}
                          </div>
                        )}

                       {stock.analysisStatus === AnalysisStatus.ANALYZING && (
                          <DynamicLoadingIndicator />
                       )}

                       {stock.analysisStatus === AnalysisStatus.ERROR && (
                          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 p-4 rounded-lg text-sm border border-red-200 dark:border-red-500/30 flex items-center gap-3 shadow-sm animate-in shake-in duration-300">
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 shrink-0">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                             </svg>
                             {stock.analysis}
                          </div>
                       )}

                       {(stock.analysisStatus === AnalysisStatus.SUCCESS || (stock.analysisStatus === AnalysisStatus.ANALYZING && stock.analysis)) && stock.analysis && (
                          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-1000">
                             <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500 dark:bg-trading-green animate-pulse"></span>
                                    <h4 className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] font-mono">Quantum Intelligence Report</h4>
                                </div>
                                <span className="text-[9px] font-mono text-gray-400 uppercase">{t('msg.last_report')} {new Date(stock.addedAt).toLocaleString()}</span>
                             </div>
                             <AnalysisView 
                                markdown={stock.analysis} 
                                groundingMetadata={stock.groundingMetadata}
                                symbol={stock.symbol}
                                selectedTimeframe={stock.selectedTimeframe}
                                onTimeframeChange={(tf) => handleReAnalyze(stock, tf)}
                                isAnalyzing={stock.analysisStatus === AnalysisStatus.ANALYZING}
                             />
                          </div>
                       )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button for Mobile */}
      <button
        onClick={() => {
          symbolInputRef.current?.focus();
          symbolInputRef.current?.scrollIntoView({ behavior: 'smooth' });
        }}
        className="fixed bottom-8 right-8 z-50 lg:hidden w-14 h-14 bg-trading-green text-gray-900 rounded-full shadow-[0_0_20px_rgba(0,240,255,0.6)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all animate-bounce"
        title="Add New Stock"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
    </div>
  );
};

export default Watchlist;
