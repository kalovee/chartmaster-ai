
import React from 'react';
import { APP_NAME } from '../constants';
import { useApp } from '../contexts/AppContext';

const Header: React.FC = () => {
  const { theme, toggleTheme, language, setLanguage, t } = useApp();

  return (
    <header className="border-b border-gray-200 dark:border-gray-800/60 bg-white/70 dark:bg-gray-950/70 backdrop-blur-xl sticky top-0 z-50 supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-950/60 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Logo Section */}
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-trading-green to-blue-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-white dark:bg-gray-900 ring-1 ring-black/5 dark:ring-white/10 w-9 h-9 rounded-lg flex items-center justify-center shadow-2xl">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-trading-green">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
              </svg>
            </div>
          </div>
          
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-white dark:via-gray-200 dark:to-gray-400 font-sans">
              {t('app.title')} 
            </h1>
            <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-trading-green/80 font-mono leading-none flex items-center gap-2">
              {t('app.subtitle')}
              <span className="opacity-30 text-[8px]">v1.0.8-FS</span>
            </span>
          </div>
        </div>

        {/* Controls Section */}
        <div className="flex items-center gap-3 sm:gap-4">
            {/* Language Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
                <button 
                  onClick={() => setLanguage('en')}
                  className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${language === 'en' ? 'bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                >
                  EN
                </button>
                <button 
                  onClick={() => setLanguage('zh')}
                  className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${language === 'zh' ? 'bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                >
                  中
                </button>
            </div>

            {/* Theme Toggle */}
            <button 
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-trading-green hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                title="Toggle Theme"
            >
                {theme === 'dark' ? (
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                   </svg>
                ) : (
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                   </svg>
                )}
            </button>

            {/* System Status (Hidden on Mobile) */}
            <div className="hidden md:flex items-center gap-4 border-l border-gray-200 dark:border-gray-800 pl-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800/50 shadow-inner">
                    <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 dark:bg-trading-green opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500 dark:bg-trading-green"></span>
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{t('status.online')}</span>
                </div>
            </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
