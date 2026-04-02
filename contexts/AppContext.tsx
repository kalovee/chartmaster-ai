
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Theme, Language, AppContextType, ToastType, NewsPreferences, NewsSummary } from '../types';

const AppContext = createContext<AppContextType | undefined>(undefined);

interface ToastState {
  id: number;
  message: string;
  type: ToastType;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    "app.title": "ChartMaster AI",
    "app.subtitle": "Quantum Analytics",
    "status.online": "SYSTEM ONLINE",
    "tab.decoder": "CHART DECODER",
    "tab.watchlist": "WATCHLIST",
    "tab.dividend": "DIVIDEND MATRIX",
    "tab.news": "DAILY INTEL",
    "input.source": "INPUT_SOURCE.img",
    "btn.reset": "Reset Sequence",
    "upload.title": "INITIATE CHART SCAN",
    "upload.desc": "Drop K-line image or click to browse.",
    "upload.sub": "Supports PNG, JPG, WEBP",
    "status.analyzing": "ANALYZING",
    "status.decoding": "DECODING PRICE ACTION...",
    "report.title": "Strategic Analysis Report",
    "waiting.title": "Waiting for Signal Input...",
    "btn.refresh_prices": "Update Quotes",
    "btn.deep_refresh": "Deep AI Refresh",
    "btn.analyzing": "Analyzing...",
    "btn.add_analysis": "Scan & Analyze",
    "btn.execute_add": "Execute Add",
    "btn.purge": "PURGE DATA",
    "btn.save": "DOWNLOAD REPORT",
    "label.symbol": "Symbol",
    "label.note": "Personal Note",
    "label.shares": "Quantity",
    "calc.title": "CASH FLOW MATRIX",
    "calc.est_income": "Est. Annual Income",
    "calc.monthly": "Monthly Avg",
    "calc.yield": "Portfolio Yield",
    "msg.no_holdings": "Database Empty",
    "msg.no_watchlist": "No analysis reports yet.",
    "msg.last_report": "Last Analysis:",
    "msg.just_now": "Just now",
    "toast.theme_toggle": "Theme toggled to ",
    "toast.deep_refresh_start": "Initiating Deep Watchlist Refresh...",
    "toast.add_stock": "Watchlist entry mode activated.",
    "news.settings.title": "Intelligence Preferences",
    "news.settings.markets": "Markets (e.g. US, Taiwan, Crypto)",
    "news.settings.topics": "Topics (e.g. AI, Semi, Macro)",
    "news.settings.sources": "Preferred Sources (e.g. Bloomberg, WSJ)",
    "news.settings.save": "Save Preferences",
    "btn.simulate": "Simulate Reinvestment",
    "calc.matrix": "Dividend Matrix (Est. Monthly)",
    "calc.manual": "Manual Entry",
    "calc.auto": "Auto Fetch",
    "label.price": "Current Price",
    "label.div": "Annual Div ($)",
    "label.freq": "Frequency",
    "label.name": "Asset Name",
    "btn.refresh_all": "Refresh All Data"
  },
  zh: {
    "app.title": "ChartMaster AI",
    "app.subtitle": "量子運算分析",
    "status.online": "系統連線正常",
    "tab.decoder": "K線解碼器",
    "tab.watchlist": "AI 觀察名單",
    "tab.dividend": "配息矩陣",
    "tab.news": "每日情報",
    "input.source": "訊號來源.img",
    "btn.reset": "重置序列",
    "upload.title": "啟動圖表掃描",
    "upload.desc": "拖放 K 線圖或點擊上傳",
    "upload.sub": "支援 PNG, JPG, WEBP",
    "status.analyzing": "分析運算中",
    "status.decoding": "解讀價格行為...",
    "report.title": "戰略分析報告",
    "waiting.title": "等待訊號輸入...",
    "btn.refresh_prices": "更新報價",
    "btn.deep_refresh": "深度 AI 刷新",
    "btn.analyzing": "分析中...",
    "btn.add_analysis": "掃描並分析",
    "btn.execute_add": "執行新增",
    "btn.purge": "清除數據",
    "btn.save": "下載報告",
    "label.symbol": "代號 (Symbol)",
    "label.note": "筆記 (選填)",
    "label.shares": "持有股數",
    "calc.title": "現金流矩陣",
    "calc.est_income": "預估年領股息",
    "calc.monthly": "月平均",
    "calc.yield": "投資組合殖利率",
    "msg.no_holdings": "資料庫為空",
    "msg.no_watchlist": "尚無分析報告",
    "msg.last_report": "上次分析時間:",
    "msg.just_now": "剛剛",
    "toast.theme_toggle": "主題切換至 ",
    "toast.deep_refresh_start": "正在啟動深度觀察名單分析...",
    "toast.add_stock": "已開啟觀察名單輸入模式",
    "news.settings.title": "情報偏好設定",
    "news.settings.markets": "關注市場 (如：美股, 台股, 加密貨幣)",
    "news.settings.topics": "關注主題 (如：AI, 半導體, 總經)",
    "news.settings.sources": "偏好來源 (如：彭博, 經濟日報)",
    "news.settings.save": "儲存設定",
    "btn.simulate": "模擬股息再投資",
    "calc.matrix": "配息矩陣 (預估月領)",
    "calc.manual": "手動輸入",
    "calc.auto": "自動抓取",
    "label.price": "目前股價",
    "label.div": "預估年配息 ($)",
    "label.freq": "配息頻率",
    "label.name": "資產名稱",
    "btn.refresh_all": "全部重新整理"
  }
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('dark');
  const [language, setLanguage] = useState<Language>('zh');
  const [newsPreferences, setNewsPreferences] = useState<NewsPreferences>({
    markets: "Crypto, US, Taiwan",
    topics: "Macro, Stocks, Industry, Earnings",
    sources: "Mainstream financial media (Reuters, Bloomberg, WSJ), Taiwan financial media (Commercial Times, Economic Daily)"
  });
  const [newsSummary, setNewsSummary] = useState<NewsSummary | null>(null);
  const [isGeneratingNews, setIsGeneratingNews] = useState(false);
  const [toasts, setToasts] = useState<ToastState[]>([]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('cm_theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
    }
    
    const savedLang = localStorage.getItem('cm_lang') as Language;
    if (savedLang) {
      setLanguage(savedLang);
    }

    const savedNewsPrefs = localStorage.getItem('cm_news_prefs');
    if (savedNewsPrefs) {
      try {
        setNewsPreferences(JSON.parse(savedNewsPrefs));
      } catch (e) {
        console.error("Failed to parse news preferences", e);
      }
    }

    const savedNewsSummary = localStorage.getItem('cm_news_summary');
    if (savedNewsSummary) {
      try {
        setNewsSummary(JSON.parse(savedNewsSummary));
      } catch (e) {
        console.error("Failed to parse news summary", e);
      }
    }
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('cm_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('cm_lang', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('cm_news_prefs', JSON.stringify(newsPreferences));
  }, [newsPreferences]);

  useEffect(() => {
    if (newsSummary) {
      localStorage.setItem('cm_news_summary', JSON.stringify(newsSummary));
    }
  }, [newsSummary]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    showToast(`${t('toast.theme_toggle')}${newTheme.toUpperCase()}`, 'info');
  };

  const showToast = (message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  const updateNewsPreferences = (prefs: Partial<NewsPreferences>) => {
    setNewsPreferences(prev => ({ ...prev, ...prefs }));
    showToast(language === 'en' ? "Preferences Updated" : "偏好設定已更新", 'success');
  };

  return (
    <AppContext.Provider value={{ 
      theme, 
      toggleTheme, 
      language, 
      setLanguage, 
      t, 
      showToast,
      newsPreferences,
      updateNewsPreferences,
      newsSummary,
      setNewsSummary,
      isGeneratingNews,
      setIsGeneratingNews
    }}>
      {children}
      {/* Toast Portal */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`
              pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-2xl animate-in slide-in-from-right-full fade-in duration-300 font-mono text-xs font-bold uppercase tracking-wider
              ${toast.type === 'success' ? 'bg-green-500/90 border-green-400 text-black' : 
                toast.type === 'error' ? 'bg-red-500/90 border-red-400 text-white' : 
                toast.type === 'warning' ? 'bg-yellow-500/90 border-yellow-400 text-black' :
                'bg-gray-900/90 dark:bg-gray-800/90 border-gray-700 dark:border-trading-green/30 text-trading-green'}
            `}
          >
            {toast.type === 'error' && (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            )}
            {toast.message}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
