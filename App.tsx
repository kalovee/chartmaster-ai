
import React, { useState, useRef, useEffect } from 'react';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import AnalysisView from './components/AnalysisView';
import Watchlist from './components/Watchlist';
import DividendCalculator from './components/DividendCalculator';
import NewsSummaryView from './components/NewsSummaryView';
import { analyzeChartImage } from './services/geminiService';
import { AnalysisState, AnalysisStatus } from './types';
import { useApp } from './contexts/AppContext';

type Tab = 'analysis' | 'watchlist' | 'dividend' | 'news';

const App: React.FC = () => {
  const { t, language, theme, toggleTheme, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('analysis');
  
  const [state, setState] = useState<AnalysisState>({
    status: AnalysisStatus.IDLE,
    result: null,
    error: null,
    imagePreview: null,
  });

  const [loadingStep, setLoadingStep] = useState(0);
  const loadingSteps = [
    "SCANNING_MARKET_STRUCTURE",
    "ANALYZING_INDICATORS",
    "GENERATING_REPORT"
  ];

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Theme: Ctrl + T
      if (e.ctrlKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        toggleTheme();
      }

      // Add New Stock: Ctrl + N
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setActiveTab('watchlist');
        showToast(t('toast.add_stock'), 'info');
        // Dispatch custom event to focus the input in Watchlist
        window.dispatchEvent(new CustomEvent('watchlist-focus-input'));
      }

      // Deep Refresh: Ctrl + Shift + A
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (activeTab !== 'watchlist') setActiveTab('watchlist');
        showToast(t('toast.deep_refresh_start'), 'warning');
        window.dispatchEvent(new CustomEvent('watchlist-deep-refresh'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleTheme, activeTab, t, showToast]);

  useEffect(() => {
    let interval: any;
    if (state.status === AnalysisStatus.ANALYZING) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % loadingSteps.length);
      }, 1500);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [state.status]);

  const scrollRef = useRef<HTMLDivElement>(null);

  const handleImageSelected = async (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    
    setState({
      status: AnalysisStatus.ANALYZING,
      result: null,
      error: null,
      imagePreview: previewUrl,
    });

    try {
      const { markdown, groundingMetadata } = await analyzeChartImage(file, language);
      
      setState(prev => ({
        ...prev,
        status: AnalysisStatus.SUCCESS,
        result: {
          markdown,
          timestamp: new Date().toISOString(),
          groundingMetadata
        }
      }));

      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (err: any) {
      setState(prev => ({
        ...prev,
        status: AnalysisStatus.ERROR,
        error: err.message || "An unexpected error occurred during analysis.",
      }));
      showToast(err.message || "Analysis sequence aborted.", 'error');
    }
  };

  const handleReset = () => {
    if (state.imagePreview) {
      URL.revokeObjectURL(state.imagePreview);
    }
    setState({
      status: AnalysisStatus.IDLE,
      result: null,
      error: null,
      imagePreview: null,
    });
  };

  const TabButton = ({ id, label, icon }: { id: Tab, label: string, icon: React.ReactNode }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={`
          relative px-5 py-2.5 text-sm font-bold transition-all duration-500 ease-out flex items-center gap-2 rounded-lg group whitespace-nowrap overflow-hidden
          ${isActive 
            ? 'text-gray-900 shadow-[0_0_20px_rgba(0,240,255,0.4)] scale-105 z-10' 
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/5'}
        `}
      >
        <div className={`absolute inset-0 bg-trading-green transition-all duration-500 ${isActive ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}></div>
        <span className="relative z-10 flex items-center gap-2 transition-transform duration-500">
          <span className={`transition-all duration-300 ${isActive ? 'scale-110 drop-shadow-sm' : 'group-hover:scale-110'}`}>
            {icon}
          </span>
          {label}
        </span>
      </button>
    );
  };

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 flex flex-col font-sans selection:bg-trading-green selection:text-gray-900 transition-colors duration-300 overflow-x-hidden">
      <Header />

      <main className="flex-grow max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8 relative z-10">
        
        <div className="flex self-center sm:self-start bg-white/50 dark:bg-gray-900/80 backdrop-blur-md p-1.5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-x-auto max-w-full gap-1 animate-in fade-in slide-in-from-top-4 duration-700">
          <TabButton 
            id="analysis" 
            label={t('tab.decoder')}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            } 
          />
          <TabButton 
            id="watchlist" 
            label={t('tab.watchlist')}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            } 
          />
          <TabButton 
            id="dividend" 
            label={t('tab.dividend')}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            } 
          />
          <TabButton 
            id="news" 
            label={t('tab.news')}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
              </svg>
            } 
          />
        </div>

        <div className="flex-grow relative">
          <div className={`${activeTab === 'analysis' ? 'block animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-500 ease-out' : 'hidden'}`}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start h-full">
              <div className="lg:col-span-5 flex flex-col gap-6 sticky top-24">
                <div className="glass-panel rounded-2xl p-1 shadow-2xl transition-all duration-300 hover:shadow-trading-green/10">
                   <div className="bg-white dark:bg-gray-900/80 rounded-xl overflow-hidden transition-colors duration-300">
                      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700/50 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                          </div>
                          <span className="text-xs font-mono text-gray-500 dark:text-gray-400 ml-2">{t('input.source')}</span>
                        </div>
                        {state.status !== AnalysisStatus.IDLE && (
                          <button 
                            onClick={handleReset}
                            className="text-[10px] uppercase tracking-wider text-red-500 dark:text-trading-red hover:text-red-700 dark:hover:text-white border border-red-500/30 dark:border-trading-red/30 hover:bg-red-50 dark:hover:bg-trading-red/20 px-2 py-1 rounded transition-all active:scale-95"
                          >
                            {t('btn.reset')}
                          </button>
                        )}
                      </div>
                      
                      <div className="p-2">
                        {state.imagePreview ? (
                          <div className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-black transition-all">
                            <img 
                              src={state.imagePreview} 
                              alt="Chart Preview" 
                              className="w-full h-auto max-h-[50vh] object-contain opacity-90 group-hover:opacity-100 transition-all duration-500"
                            />
                            {/* Scanning Overlays */}
                            {state.status === AnalysisStatus.ANALYZING && (
                              <div className="absolute inset-0 pointer-events-none z-10">
                                <div className="absolute top-0 left-0 w-full h-1 bg-trading-green/60 shadow-[0_0_20px_rgba(0,240,255,1)] animate-scan"></div>
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-trading-green/5 to-transparent animate-pulse"></div>
                                <div className="absolute inset-0 border-[20px] border-black/20"></div>
                              </div>
                            )}

                            <div className="absolute inset-0 bg-gradient-to-b from-trading-green/10 to-transparent opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500"></div>
                            
                            {state.status === AnalysisStatus.ANALYZING && (
                              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-20 animate-in fade-in duration-300">
                                  <div className="flex flex-col items-center gap-6 px-4">
                                    <div className="relative w-28 h-28 flex items-center justify-center">
                                        <div className="absolute inset-0 border-2 border-gray-700 rounded-full"></div>
                                        <div className="absolute inset-0 border-2 border-t-trading-green border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                                        <div className="absolute inset-2 border border-gray-800 rounded-full"></div>
                                        <div className="absolute inset-2 border-t-yellow-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin [animation-duration:3s]"></div>
                                        <div className="w-16 h-16 bg-trading-green/20 rounded-full animate-pulse-glow flex items-center justify-center shadow-[0_0_30px_rgba(0,240,255,0.3)]">
                                           <svg className="w-8 h-8 text-trading-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.501 4.501 0 017.75 8a4.501 4.501 0 012.312 5.683l-.705 2.015M13 13V5.882c0-.966.784-1.75 1.75-1.75s1.75.784 1.75 1.75V13" />
                                           </svg>
                                        </div>
                                    </div>
                                    <div className="text-center space-y-2">
                                      <span className="text-trading-green font-mono text-sm font-bold tracking-[0.3em] block animate-pulse uppercase">
                                        {t('status.analyzing')}
                                      </span>
                                      <div className="bg-black/80 border border-trading-green/30 px-4 py-2 rounded font-mono text-[10px] text-gray-400 min-w-[240px] shadow-2xl">
                                         <div className="flex justify-between items-center mb-1">
                                            <span>PROTCL: {loadingSteps[loadingStep]}</span>
                                            <span className="text-trading-green animate-pulse">_</span>
                                         </div>
                                         <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                                            <div className="h-full bg-trading-green transition-all duration-500" style={{ width: `${((loadingStep + 1) / loadingSteps.length) * 100}%` }}></div>
                                         </div>
                                      </div>
                                    </div>
                                  </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <ImageUploader onImageSelected={handleImageSelected} />
                        )}
                      </div>
                   </div>
                </div>
              </div>
              <div className="lg:col-span-7 flex flex-col" ref={scrollRef}>
                <div className="tech-border rounded-2xl shadow-2xl flex flex-col h-full min-h-[600px] overflow-hidden transition-all duration-500">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700/50 flex justify-between items-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
                      <h2 className="text-sm font-bold text-gray-800 dark:text-trading-green uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 bg-trading-green rounded-sm animate-pulse"></span>
                        {t('report.title')}
                      </h2>
                      {state.result && (
                        <span className="text-[10px] text-gray-500 font-mono border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded animate-in fade-in duration-1000">
                          TS: {new Date(state.result.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    <div className="flex-grow p-6 sm:p-8 bg-gray-50/50 dark:bg-gray-950/40 relative">
                      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
                      <div className="relative z-10">
                        {state.status === AnalysisStatus.SUCCESS && state.result ? (
                          <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
                            <AnalysisView 
                              markdown={state.result.markdown} 
                              groundingMetadata={state.result.groundingMetadata}
                            />
                          </div>
                        ) : state.status === AnalysisStatus.ANALYZING ? (
                          <div className="h-[500px] flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500">
                            <div className="w-full max-w-md space-y-6">
                              <div className="space-y-4">
                                <div className="flex justify-between items-end">
                                  <div className="text-xs font-mono text-trading-green uppercase tracking-widest animate-pulse">Decoding Market Data...</div>
                                  <div className="text-xs font-mono text-gray-500">{Math.round(((loadingStep + 1) / loadingSteps.length) * 100)}%</div>
                                </div>
                                <div className="h-1 bg-gray-200 dark:bg-gray-800 rounded-full w-full overflow-hidden">
                                  <div className="h-full bg-trading-green transition-all duration-700" style={{ width: `${((loadingStep + 1) / loadingSteps.length) * 100}%` }}></div>
                                </div>
                              </div>
                              
                              <div className="text-center">
                                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-tighter">
                                  Current Protocol: <span className="text-gray-900 dark:text-white font-bold">{loadingSteps[loadingStep]}</span>
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : state.status === AnalysisStatus.IDLE ? (
                          <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 min-h-[400px] animate-in fade-in zoom-in-95 duration-700">
                            <div className="relative mb-6">
                              <div className="absolute inset-0 bg-trading-green/20 blur-xl rounded-full"></div>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={0.5} stroke="currentColor" className="w-24 h-24 text-gray-300 dark:text-gray-700 relative z-10 hover:scale-110 transition-transform duration-500">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                              </svg>
                            </div>
                            <p className="text-sm text-center max-w-xs font-mono tracking-wide text-gray-500 uppercase">
                              {t('waiting.title')}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`${activeTab === 'watchlist' ? 'block animate-in fade-in slide-in-from-right-4 duration-500 ease-out h-full' : 'hidden'}`}>
            <Watchlist />
          </div>

          <div className={`${activeTab === 'dividend' ? 'block animate-in fade-in slide-in-from-right-4 duration-500 ease-out h-full' : 'hidden'}`}>
            <DividendCalculator />
          </div>

          <div className={`${activeTab === 'news' ? 'block animate-in fade-in slide-in-from-right-4 duration-500 ease-out h-full' : 'hidden'}`}>
            <NewsSummaryView />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
