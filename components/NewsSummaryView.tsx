
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../contexts/AppContext';
import { NewsSummary, AnalysisStatus } from '../types';
import { generateNewsSummary } from '../services/newsService';
import NewsFeed from './NewsFeed';

const getRawText = (children: React.ReactNode): string => {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(getRawText).join('');
  if (React.isValidElement(children)) {
    return getRawText((children.props as any).children);
  }
  return '';
};

const NewsSummaryView: React.FC = () => {
  const { 
    t, 
    language, 
    showToast, 
    newsPreferences, 
    updateNewsPreferences,
    newsSummary: summary,
    setNewsSummary: setSummary,
    isGeneratingNews: isGenerating,
    setIsGeneratingNews: setIsGenerating
  } = useApp();
  
  const [showSettings, setShowSettings] = useState(false);
  const [tempPrefs, setTempPrefs] = useState(newsPreferences);

  useEffect(() => {
    setTempPrefs(newsPreferences);
  }, [newsPreferences]);

  const SUGGESTED_TOPICS = [
    { id: 'ai', label: 'AI', labelZh: 'AI' },
    { id: 'semi', label: 'Semiconductors', labelZh: '半導體' },
    { id: 'macro', label: 'Macroeconomics', labelZh: '總體經濟' },
    { id: 'crypto', label: 'Crypto', labelZh: '加密貨幣' },
    { id: 'ev', label: 'EV', labelZh: '電動車' }
  ];

  const handleTopicClick = (topic: string) => {
    const currentTopics = tempPrefs.topics.split(',').map(t => t.trim()).filter(t => t !== "");
    if (currentTopics.includes(topic)) {
      setTempPrefs({ ...tempPrefs, topics: currentTopics.filter(t => t !== topic).join(', ') });
    } else {
      setTempPrefs({ ...tempPrefs, topics: [...currentTopics, topic].join(', ') });
    }
  };

  const fetchSummary = async () => {
    setIsGenerating(true);
    try {
      const res = await generateNewsSummary(newsPreferences, "Full Day", language);
      setSummary(res);
      showToast(language === 'en' ? "Daily News Summary Updated" : "每日新聞摘要已更新", "success");
    } catch (error: any) {
      showToast(error.message || "Failed to generate news summary", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveSettings = () => {
    updateNewsPreferences(tempPrefs);
    setShowSettings(false);
  };

  const copyToClipboard = () => {
    if (summary) {
      navigator.clipboard.writeText(summary.content);
      showToast(language === 'en' ? "Copied to clipboard" : "已複製到剪貼簿", "success");
    }
  };

  useEffect(() => {
    // Initial fetch if not present
    if (!summary) {
      fetchSummary();
    }
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 15
      }
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-trading-yellow/20 to-trading-yellow/5 flex items-center justify-center border border-trading-yellow/20 shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-trading-yellow">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white leading-none tracking-normal uppercase">
              {language === 'en' ? 'Daily Intel' : '每日情報'}
            </h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="flex h-2 w-2 rounded-full bg-trading-green animate-pulse"></span>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono uppercase tracking-[0.2em] font-bold">
                {summary?.date || new Date().toLocaleDateString()} • {summary?.market || 'Global Markets'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md p-1 rounded-xl border border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2.5 rounded-lg transition-all ${showSettings ? 'bg-trading-yellow text-black shadow-lg shadow-trading-yellow/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}
            title="Intelligence Preferences"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 18H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 12h9.75" />
            </svg>
          </button>

          <button
            onClick={copyToClipboard}
            disabled={!summary || isGenerating}
            className="p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-all disabled:opacity-30"
            title="Copy Summary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
            </svg>
          </button>

          <button
            onClick={fetchSummary}
            disabled={isGenerating}
            className="p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-all disabled:opacity-30"
            title="Refresh Summary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-5 h-5 ${isGenerating ? 'animate-spin' : ''}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-trading-yellow/30 p-6 shadow-2xl">
              <h3 className="text-sm font-black text-gray-900 dark:text-white mb-6 flex items-center gap-2 uppercase tracking-wider">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-trading-yellow">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.128l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.795l.75-1.3m7.5-12.99l.75-1.3m-6.063 16.658l.26-1.477m2.605-14.772l.26-1.477m-1.524 16.233l-.26-1.477m-2.605-14.772l-.26-1.477m3.308 15.203l-.75-1.3m-7.5-12.99l-.75-1.3m4.847 14.391l-1.149-.964m-11.49-9.642l-1.15-.964m6.953 11.64l-1.41-.513m-14.095-5.128l-1.41-.513" />
                </svg>
                {t('news.settings.title')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest block">{t('news.settings.markets')}</label>
                  <input 
                    type="text" 
                    value={tempPrefs.markets}
                    onChange={(e) => setTempPrefs({ ...tempPrefs, markets: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm focus:border-trading-yellow outline-none transition-all focus:ring-2 focus:ring-trading-yellow/20"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest block">{t('news.settings.topics')}</label>
                  <div className="space-y-4">
                    <input 
                      type="text" 
                      value={tempPrefs.topics}
                      onChange={(e) => setTempPrefs({ ...tempPrefs, topics: e.target.value })}
                      placeholder="e.g. AI, Semiconductors, Macro"
                      className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm focus:border-trading-yellow outline-none transition-all focus:ring-2 focus:ring-trading-yellow/20"
                    />
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTED_TOPICS.map(topic => {
                        const isActive = tempPrefs.topics.split(',').map(t => t.trim().toLowerCase()).includes((language === 'en' ? topic.label : topic.labelZh).toLowerCase());
                        return (
                          <button
                            key={topic.id}
                            onClick={() => handleTopicClick(language === 'en' ? topic.label : topic.labelZh)}
                            className={`text-[10px] px-3 py-1.5 rounded-full border font-bold transition-all ${isActive 
                              ? 'bg-trading-yellow border-trading-yellow text-black' 
                              : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-400'}`}
                          >
                            {language === 'en' ? topic.label : topic.labelZh}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest block">{t('news.settings.sources')}</label>
                  <input 
                    type="text" 
                    value={tempPrefs.sources}
                    onChange={(e) => setTempPrefs({ ...tempPrefs, sources: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm focus:border-trading-yellow outline-none transition-all focus:ring-2 focus:ring-trading-yellow/20"
                  />
                </div>
              </div>
              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleSaveSettings}
                  className="bg-trading-yellow hover:bg-yellow-500 text-black font-black text-xs px-8 py-3 rounded-xl transition-all active:scale-95 shadow-xl shadow-trading-yellow/30 uppercase tracking-widest"
                >
                  {t('news.settings.save')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isGenerating ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-trading-yellow/20 border-t-trading-yellow rounded-full animate-spin"></div>
          <p className="text-sm font-mono text-gray-500 animate-pulse">
            {language === 'en' ? 'SCANNING_GLOBAL_FEEDS...' : '正在掃描全球資訊...'}
          </p>
        </div>
      ) : summary ? (
        <div className="flex flex-col gap-8">
          {/* Top Level Bento Insights */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Core Market Themes - Glassy White/Dark */}
            <div className="md:col-span-8 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-[2rem] border border-gray-200/50 dark:border-gray-800/50 p-8 shadow-2xl hover:shadow-trading-yellow/10 transition-all duration-700 group relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-trading-yellow/10 rounded-full blur-[80px] group-hover:bg-trading-yellow/20 transition-colors duration-1000"></div>
              
              <div className="relative z-10">
                <h3 className="text-[10px] font-black text-trading-yellow uppercase tracking-[0.4em] mb-6 flex items-center gap-4">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-trading-yellow opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-trading-yellow shadow-[0_0_15px_rgba(255,215,0,0.8)]"></span>
                  </span>
                  {language === 'en' ? 'Core Market Themes' : '核心市場主線'}
                </h3>
                
                <div className="prose prose-sm dark:prose-invert max-w-none news-content-area">
                  <ReactMarkdown components={{ 
                    p: ({node, ...props}) => <p className="m-0 text-gray-800 dark:text-gray-200 leading-loose font-bold text-base tracking-normal" {...props} />, 
                    ul: ({node, ...props}) => <ul className="mt-10 space-y-6 list-none p-0 grid grid-cols-1 sm:grid-cols-2 gap-x-12" {...props} />, 
                    li: ({node, ...props}) => (
                      <li className="flex items-start gap-5 group/item" {...props}>
                        <div className="mt-2.5 w-2 h-2 rounded-full bg-trading-yellow shrink-0 shadow-[0_0_10px_rgba(255,215,0,0.5)] group-hover/item:scale-125 transition-all duration-300"></div>
                        <span className="text-gray-900 dark:text-gray-100 text-sm font-black leading-relaxed tracking-normal group-hover/item:text-trading-yellow transition-colors">{props.children}</span>
                      </li>
                    ),
                    hr: () => null
                  }}>
                    {summary.content.match(/##\s*💡\s*今日\s*3\s*大主線[\s\S]*?\n([\s\S]*?)(?=\n\n##|$)/i)?.[1] || 
                     summary.content.match(/今日\s*3\s*大主線[\s\S]*?\n([\s\S]*?)(?=\n\n|$)/i)?.[1] || ''}
                  </ReactMarkdown>
                </div>
              </div>
            </div>

            {/* Executive Brief - Warm / Organic / Premium */}
            <div className="md:col-span-4 bg-gradient-to-br from-trading-green/10 to-trading-green/5 dark:from-trading-green/20 dark:to-transparent rounded-[2rem] border border-trading-green/20 p-8 shadow-2xl flex flex-col justify-between group hover:bg-trading-green/[0.12] transition-all duration-700 relative overflow-hidden">
              <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-trading-green/10 rounded-full blur-[80px]"></div>
              
              <div className="relative z-10">
                <h3 className="text-[10px] font-black text-trading-green uppercase tracking-[0.4em] mb-6 flex items-center gap-4">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-trading-green shadow-[0_0_15px_rgba(0,255,127,0.8)]"></span>
                  </span>
                  {language === 'en' ? 'Executive Brief' : '核心摘要'}
                </h3>
                
                <div className="prose prose-sm dark:prose-invert max-w-none news-content-area">
                  <ReactMarkdown components={{ 
                    p: ({node, ...props}) => <p className="text-lg leading-loose font-serif italic text-gray-900 dark:text-gray-100 font-medium tracking-normal" {...props} />, 
                    blockquote: ({node, children}) => (
                      <div className="relative pl-8 py-4">
                        <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-b from-trading-green to-transparent rounded-full"></div>
                        {children}
                      </div>
                    ),
                    hr: () => null
                  }}>
                    {summary.content.match(/##\s*⚡\s*一句話總結[\s\S]*?\n>\s*([\s\S]*?)(?=\n\n##|$)/i)?.[1] || 
                     summary.content.match(/一句話總結[\s\S]*?\n>\s*([\s\S]*?)(?=\n\n|$)/i)?.[1] || ''}
                  </ReactMarkdown>
                </div>
              </div>
              
              <div className="mt-6 pt-6 flex flex-col gap-3 relative z-10 border-t border-trading-green/10">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-trading-green/60 uppercase tracking-[0.3em]">Signal Strength</span>
                  <span className="text-[9px] font-mono text-trading-green font-bold">88% CONFIDENCE</span>
                </div>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="flex-grow h-1 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800">
                      <div 
                        className={`h-full transition-all duration-1000 delay-${i * 100} ${i <= 4 ? 'bg-trading-green shadow-[0_0_10px_rgba(0,255,127,0.5)]' : 'bg-transparent'}`}
                        style={{ width: i <= 4 ? '100%' : '0%' }}
                      ></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Critical Timeline - Deep Dark / Cyber */}
            <div className="md:col-span-6 bg-black rounded-[2rem] border border-gray-800/50 p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.1),transparent)] group-hover:bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.15),transparent)] transition-colors duration-1000"></div>
              
              <div className="relative z-10 h-full flex flex-col">
                <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mb-6 flex items-center gap-4">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-40"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)]"></span>
                  </span>
                  {language === 'en' ? 'Critical Timeline' : '關鍵事件時間軸'}
                </h3>
                
                <div className="prose prose-xs dark:prose-invert max-w-none overflow-y-auto flex-grow max-h-[300px] custom-scrollbar pr-6 news-content-area">
                  <ReactMarkdown components={{ 
                    p: ({node, ...props}) => <p className="m-0 text-[11px] leading-loose text-gray-500 font-mono tracking-normal" {...props} />, 
                    ul: ({node, ...props}) => <ul className="m-0 p-0 list-none space-y-8 border-l border-gray-800/50 ml-2 pl-8" {...props} />, 
                    li: ({node, ...props}) => {
                      const rawText = getRawText(props.children);
                      const timeMatch = rawText.match(/^(\d{2}:\d{2})/);
                      const time = timeMatch ? timeMatch[1] : '';
                      const content = timeMatch ? rawText.replace(timeMatch[0], '').trim() : rawText;
                      
                      return (
                        <li className="relative group/item" {...props}>
                          <div className="absolute -left-[33px] top-1.5 w-3.5 h-3.5 rounded-full bg-black border border-gray-700 group-hover/item:border-blue-500 transition-all duration-500 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-800 group-hover/item:bg-blue-400 transition-colors"></div>
                          </div>
                          <div className="flex flex-col gap-3">
                            {time && <span className="text-[10px] font-black font-mono text-blue-400/80 tracking-[0.2em]">{time}</span>}
                            <span className="text-[13px] text-gray-400 group-hover/item:text-gray-100 transition-colors leading-loose font-medium tracking-normal">{content}</span>
                          </div>
                        </li>
                      );
                    } 
                  }}>
                    {summary.content.match(/##\s*📅\s*10\s*個關鍵追蹤[\s\S]*?\n([\s\S]*?)(?=\n\n##|$)/i)?.[1] || 
                     summary.content.match(/10\s*個關鍵追蹤[\s\S]*?\n([\s\S]*?)(?=\n\n|$)/i)?.[1] || ''}
                  </ReactMarkdown>
                </div>
              </div>
            </div>

            {/* Trending Sectors & Commodities - Dark / Gold */}
            <div className="md:col-span-6 bg-[#0a0a0a] rounded-[2rem] border border-trading-yellow/20 p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(255,215,0,0.05),transparent)] group-hover:bg-[radial-gradient(circle_at_50%_100%,rgba(255,215,0,0.1),transparent)] transition-colors duration-1000"></div>
              
              <div className="relative z-10 h-full flex flex-col">
                <h3 className="text-[10px] font-black text-trading-yellow uppercase tracking-[0.4em] mb-6 flex items-center gap-4">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-trading-yellow shadow-[0_0_15px_rgba(255,215,0,0.8)]"></span>
                  </span>
                  {language === 'en' ? 'Sectors & Commodities' : '產業族群與商品'}
                </h3>
                
                <div className="prose prose-xs dark:prose-invert max-w-none overflow-y-auto flex-grow max-h-[300px] custom-scrollbar pr-6 news-content-area">
                  <ReactMarkdown components={{ 
                    p: ({node, ...props}) => <p className="m-0 text-[13px] leading-loose text-gray-400 font-medium mb-8 tracking-normal" {...props} />, 
                    ul: ({node, ...props}) => <ul className="m-0 p-0 list-none space-y-6" {...props} />, 
                    li: ({node, ...props}) => (
                      <li className="flex items-start gap-4 group/item border-b border-gray-800/50 pb-4 last:border-0" {...props}>
                        <div className="mt-2 w-1.5 h-1.5 rounded-full bg-trading-yellow/40 group-hover/item:bg-trading-yellow shrink-0 transition-colors"></div>
                        <span className="text-[13px] text-gray-400 group-hover/item:text-gray-100 transition-colors leading-loose tracking-normal">{props.children}</span>
                      </li>
                    )
                  }}>
                    {summary.content.match(/##\s*🔍\s*近期關注族群與商品[\s\S]*?\n([\s\S]*?)(?=\n\n##|$)/i)?.[1] || 
                     summary.content.match(/近期關注族群與商品[\s\S]*?\n([\s\S]*?)(?=\n\n|$)/i)?.[1] || ''}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Main News Column */}
            <div className="lg:col-span-8 space-y-10">
              <div className="bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-trading-yellow via-blue-500 to-trading-green"></div>
                <div className="p-8 sm:p-12">
                  <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none news-content-area">
                    <ReactMarkdown
                      components={{
                        h1: () => null,
                        h2: ({ node, ...props }) => (
                          <h2 
                            className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-16 mb-10 pb-6 border-b-2 border-gray-100 dark:border-gray-800 flex items-center gap-5 uppercase tracking-tighter" 
                            {...props} 
                          />
                        ),
                        h3: ({ node, ...props }) => (
                          <h3 
                            className="text-xl font-bold text-trading-yellow mt-12 mb-6 flex items-center gap-4 before:content-[''] before:w-1.5 before:h-8 before:bg-trading-yellow before:rounded-full tracking-tight" 
                            {...props} 
                          />
                        ),
                        p: ({ node, ...props }) => (
                          <p className="text-gray-700 dark:text-gray-300 leading-loose mb-10 text-base sm:text-lg font-medium tracking-normal" {...props} />
                        ),
                        ol: ({ node, ...props }) => (
                          <ol className="grid grid-cols-1 gap-10 mb-16 list-none pl-0" {...props} />
                        ),
                        li: ({ node, ...props }) => (
                          <li className="bg-gray-50/50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 p-10 rounded-3xl hover:border-trading-yellow/40 transition-all hover:shadow-2xl hover:-translate-y-2 duration-500 group/card" {...props} />
                        ),
                        ul: ({ node, ...props }) => (
                          <ul className="space-y-4 mt-8 text-[14px] sm:text-base opacity-95 list-none p-0 border-t border-gray-100 dark:border-gray-700/50 pt-8 leading-loose" {...props} />
                        ),
                        strong: ({ node, ...props }) => (
                          <strong className="text-gray-900 dark:text-white font-black" {...props} />
                        ),
                        hr: ({ node, ...props }) => (
                          <hr className="my-12 border-gray-100 dark:border-gray-800" {...props} />
                        ),
                        blockquote: ({node, children}) => (
                          <blockquote className="border-l-8 border-trading-yellow pl-8 italic text-gray-700 dark:text-gray-200 my-12 bg-gray-50 dark:bg-gray-800/40 py-10 pr-10 rounded-r-3xl shadow-inner text-lg sm:text-xl leading-loose tracking-wide">
                            {children}
                          </blockquote>
                        )
                      }}
                    >
                      {/* Filter out the sections already shown in the top bar if they exist, otherwise show full content */}
                      {(() => {
                        const sections = summary.content.split(/##\s*(?:💡|📅|⚡|🔍|🛢️)/);
                        const mainContent = sections[0] || summary.content;
                        if (mainContent.length < 150 && summary.content.length > 300) {
                          return summary.content;
                        }
                        return mainContent;
                      })()}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>

              {summary.groundingMetadata && (
                <div className="bg-gray-950 rounded-3xl p-8 border border-gray-800 shadow-2xl">
                  <NewsFeed chunks={summary.groundingMetadata.groundingChunks} />
                </div>
              )}
            </div>

            {/* Sidebar Stats Column */}
            <div className="lg:col-span-4 space-y-8 sticky top-24">
              <motion.div 
                variants={itemVariants}
                className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm hover:shadow-md transition-all group"
              >
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-trading-green animate-pulse"></span>
                  Market Context
                </h4>
                <div className="space-y-6">
                  <div className="p-5 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 group-hover:border-trading-green/30 transition-all duration-300">
                    <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-2">Active Markets</span>
                    <span className="text-base font-black text-gray-900 dark:text-white font-mono tracking-tight">{summary.market}</span>
                  </div>
                  <div className="p-5 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 group-hover:border-blue-500/30 transition-all duration-300">
                    <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-2">Analysis Window</span>
                    <span className="text-base font-black text-gray-900 dark:text-white font-mono tracking-tight">{summary.timeframe}</span>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                variants={itemVariants}
                className="bg-gray-950 rounded-3xl border border-gray-800 p-8 shadow-2xl relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16"></div>
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
                  Intelligence Meta
                </h4>
                <div className="space-y-5 relative z-10">
                  <div className="flex justify-between items-center pb-4 border-b border-gray-800/50">
                    <span className="text-[11px] text-gray-500 font-black uppercase tracking-wider">AI Engine</span>
                    <span className="text-[11px] font-mono text-trading-yellow font-black">GEMINI_3_FLASH</span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-gray-800/50">
                    <span className="text-[11px] text-gray-500 font-black uppercase tracking-wider">Neural Search</span>
                    <span className="text-[11px] font-mono text-trading-green font-black">ENABLED</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-gray-500 font-black uppercase tracking-wider">Sync Latency</span>
                    <span className="text-[11px] font-mono text-gray-400 font-bold">2.44ms</span>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                variants={itemVariants}
                className="p-8 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 border border-dashed border-gray-200 dark:border-gray-800 rounded-3xl relative group overflow-hidden"
              >
                <div className="absolute inset-0 bg-trading-yellow/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed text-center italic font-serif relative z-10">
                  {language === 'en' 
                    ? '"Information is the resolution of uncertainty. This report serves as your tactical lens into the global liquidity flow."' 
                    : '"資訊是不確定性的消除。本報告是您洞察全球流動性的戰術透鏡。"'}
                </p>
                <div className="mt-6 flex justify-center relative z-10">
                  <div className="w-12 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent"></div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="py-32 text-center flex flex-col items-center gap-8 bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm rounded-[3rem] border border-dashed border-gray-200 dark:border-gray-800"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-trading-yellow/20 blur-3xl rounded-full"></div>
            <div className="w-24 h-24 rounded-[2rem] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center text-gray-400 shadow-2xl relative z-10">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
              </svg>
            </div>
          </div>
          <div className="max-w-xs">
            <p className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{language === 'en' ? 'No Intelligence Report' : '尚無市場情報'}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">{language === 'en' ? 'Your tactical market overview is ready to be generated. Click below to begin the neural scan.' : '您的戰術市場概覽已準備就緒。點擊下方按鈕開始神經網路掃描。'}</p>
          </div>
          <button
            onClick={fetchSummary}
            className="group relative flex items-center gap-3 px-10 py-4 bg-trading-yellow text-black font-black rounded-2xl hover:bg-yellow-500 transition-all active:scale-95 shadow-2xl shadow-trading-yellow/40 overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12"></div>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 relative z-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <span className="relative z-10 uppercase tracking-widest text-xs">{language === 'en' ? 'Initiate Neural Scan' : '啟動神經掃描'}</span>
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default NewsSummaryView;
