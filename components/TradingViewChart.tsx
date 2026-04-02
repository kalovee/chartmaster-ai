
import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, UTCTimestamp, CandlestickSeries } from 'lightweight-charts';
import { OHLCV } from '../types';
import { useApp } from '../contexts/AppContext';

interface TradingViewChartProps {
  data: OHLCV[];
  symbol: string;
  timeframe: string;
}

const TradingViewChart: React.FC<TradingViewChartProps> = ({ data, symbol, timeframe }) => {
  const { theme } = useApp();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const isDark = theme === 'dark';
    
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#d1d5db' : '#374151',
      },
      grid: {
        vertLines: { color: isDark ? '#1f2937' : '#f3f4f6' },
        horzLines: { color: isDark ? '#1f2937' : '#f3f4f6' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        borderColor: isDark ? '#374151' : '#d1d5db',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: isDark ? '#374151' : '#d1d5db',
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [theme]);

  useEffect(() => {
    if (!seriesRef.current || !data || data.length === 0) return;

    const formattedData = data.map(item => ({
      time: (new Date(item.date).getTime() / 1000) as UTCTimestamp,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
    })).sort((a, b) => a.time - b.time);

    // Remove duplicates if any
    const uniqueData = formattedData.filter((item, index, self) =>
      index === self.findIndex((t) => t.time === item.time)
    );

    seriesRef.current.setData(uniqueData);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest font-mono">
            {symbol} / {timeframe.toUpperCase()}
          </span>
          <span className="w-2 h-2 rounded-full bg-trading-green animate-pulse"></span>
        </div>
        <div className="text-[10px] font-mono text-gray-400 uppercase">
          Live Interactive Chart
        </div>
      </div>
      <div 
        ref={chartContainerRef} 
        className="w-full h-[400px] rounded-xl border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-950/50 backdrop-blur-sm overflow-hidden"
      />
    </div>
  );
};

export default TradingViewChart;
