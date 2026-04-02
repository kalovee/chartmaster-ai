
import React from 'react';
import { GroundingChunk } from '../types';
import { useApp } from '../contexts/AppContext';

interface NewsFeedProps {
  chunks: GroundingChunk[];
}

const NewsFeed: React.FC<NewsFeedProps> = ({ chunks }) => {
  const { language } = useApp();
  
  // Deduplicate chunks by URI and explicitly type validChunks to GroundingChunk[]
  const validChunks: GroundingChunk[] = Array.from(new Map<string, GroundingChunk>(
    chunks
      .filter((c): c is GroundingChunk & { web: { uri: string; title: string } } => 
        !!(c.web && c.web.uri && c.web.title)
      )
      .map(item => [item.web.uri, item])
  ).values());

  if (validChunks.length === 0) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-gray-800/50 pb-6">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.4em] flex items-center gap-3">
          <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span>
          {language === 'en' ? 'Neural Search Grounding' : '神經網路搜尋驗證'}
        </h3>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest font-bold">
            {validChunks.length} Sources Verified
          </span>
          <div className="flex gap-1">
            {[1,2,3].map(i => <div key={i} className="w-1 h-3 bg-blue-500/30 rounded-full"></div>)}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {validChunks.map((chunk, idx) => {
          if (!chunk.web) return null;
          return (
            <a
              key={idx}
              href={chunk.web.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="group block p-6 bg-gray-900/30 hover:bg-gray-800/50 border border-gray-800 hover:border-blue-500/40 rounded-2xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-1"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-blue-400 font-black uppercase tracking-tighter">
                      REF_{String(idx + 1).padStart(3, '0')}
                    </span>
                    <div className="w-1 h-1 rounded-full bg-gray-700"></div>
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-bold">
                      {new URL(chunk.web.uri).hostname.replace('www.', '')}
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center group-hover:bg-blue-500 transition-colors duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-colors">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </div>
                </div>
                <h4 className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors line-clamp-2 leading-relaxed font-sans">
                  {chunk.web.title}
                </h4>
                <div className="flex items-center gap-3">
                  <div className="h-[1px] flex-grow bg-gradient-to-r from-gray-800 to-transparent group-hover:from-blue-500/30 transition-colors"></div>
                  <div className="flex gap-0.5">
                    {[1,2,3,4].map(i => <div key={i} className="w-1 h-1 rounded-full bg-gray-800 group-hover:bg-blue-500/50 transition-colors"></div>)}
                  </div>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
};

export default NewsFeed;
