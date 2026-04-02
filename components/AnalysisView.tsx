
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useApp } from '../contexts/AppContext';
import { GroundingMetadata, Timeframe } from '../types';
import NewsFeed from './NewsFeed';

interface AnalysisViewProps {
  markdown: string;
  symbol?: string; // Optional: used for filename
  groundingMetadata?: GroundingMetadata | null;
  selectedTimeframe?: Timeframe;
  onTimeframeChange?: (tf: Timeframe) => void;
  isAnalyzing?: boolean;
}

const TIMEFRAMES: { id: Timeframe; label: string }[] = [
  { id: '1h', label: '1H' },
  { id: '4h', label: '4H' },
  { id: '1d', label: 'Daily' },
  { id: '1w', label: 'Weekly' }
];

const AnalysisView: React.FC<AnalysisViewProps> = ({ 
  markdown, 
  symbol, 
  groundingMetadata, 
  selectedTimeframe = '1d', 
  onTimeframeChange,
  isAnalyzing 
}) => {
  const { t } = useApp();

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${symbol ? symbol : 'ChartMaster'}_${dateStr}_Analysis.md`;
    
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none relative">
      
      <div className="absolute top-0 right-0 z-10 flex items-center gap-3">
        {/* Timeframe Selector */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.id}
              disabled={isAnalyzing}
              onClick={() => onTimeframeChange?.(tf.id)}
              className={`px-3 py-1 text-[10px] font-black rounded transition-all ${
                selectedTimeframe === tf.id
                  ? 'bg-yellow-500 dark:bg-trading-yellow text-white dark:text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <button 
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={t('btn.save')}
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {t('btn.save')}
        </button>
      </div>

      <div className="space-y-6 text-gray-700 dark:text-gray-300 font-sans leading-relaxed pt-8">
        <ReactMarkdown
          components={{
            h1: ({node, ...props}) => (
              <div className="relative mt-8 mb-6 pb-2 border-b border-gray-200 dark:border-gray-700">
                 <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight" {...props}>{props.children}</h1>
                 <div className="absolute bottom-0 left-0 w-16 h-[2px] bg-green-500 dark:bg-trading-green shadow-sm dark:shadow-[0_0_10px_#00F0FF]"></div>
              </div>
            ),
            h2: ({node, ...props}) => (
               <div className="flex items-center gap-3 mt-10 mb-4">
                  <div className="w-1.5 h-6 bg-yellow-500 dark:bg-trading-yellow rounded-sm"></div>
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide font-mono" {...props}>{props.children}</h2>
               </div>
            ),
            h3: ({node, ...props}) => <h3 className="text-lg font-bold text-green-600 dark:text-trading-green mt-6 mb-2 font-mono" {...props}>{props.children}</h3>,
            ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-2 marker:text-green-500 dark:marker:text-trading-green" {...props} />,
            li: ({node, ...props}) => <li className="text-gray-700 dark:text-gray-300 pl-2" {...props}>{props.children}</li>,
            strong: ({node, ...props}) => <strong className="font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800/80 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700" {...props}>{props.children}</strong>,
            blockquote: ({node, ...props}) => (
               <blockquote className="border-l-4 border-green-500 dark:border-trading-green bg-gradient-to-r from-gray-50 to-transparent dark:from-gray-900 p-4 italic text-gray-600 dark:text-gray-400 my-6 rounded-r-lg" {...props}>
                 {props.children}
               </blockquote>
            ),
            code: ({node, ...props}) => <code className="bg-gray-100 dark:bg-black/50 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded text-sm font-mono text-yellow-700 dark:text-trading-yellow" {...props} />,
            p: ({node, ...props}) => <p className="mb-4 leading-7" {...props}>{props.children}</p>
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>

      {/* Real-time Intel Integration: NewsFeed for Grounding chunks */}
      {groundingMetadata && groundingMetadata.groundingChunks && groundingMetadata.groundingChunks.length > 0 && (
         <NewsFeed chunks={groundingMetadata.groundingChunks} />
      )}
    </div>
  );
};

export default AnalysisView;
