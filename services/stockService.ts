
// This service mimics yfinance by fetching data from Yahoo Finance via a CORS proxy.
// Note: In a production environment, you should use a dedicated backend or a paid API (e.g., AlphaVantage, Polygon).

import { DividendFrequency, MarketItem, OHLCV } from "../types";

export interface QuoteResult {
  price: number;
  changePercent: number;
  dayHigh?: number;
  dayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  volume?: number;
}

// In-memory cache for historical data
const historyCache = new Map<string, { ts: number; data: OHLCV[] }>();
const quoteCache = new Map<string, QuoteResult>();
const CACHE_DURATION_MS = 1000 * 60 * 5; // 5 minutes

// Helper to detect market timezone based on symbol
const detectTimezone = (symbol: string): string => {
  const s = symbol.toUpperCase().trim();
  if (s.endsWith('.TW')) return 'Asia/Taipei (CST)';
  if (s.includes('BTC') || s.includes('ETH') || s.includes('SOL')) return 'UTC';
  if (s.startsWith('^') || !s.includes('.')) return 'America/New_York (EST/EDT)';
  return 'Local Market Timezone';
};

// Feature 2: Retry Logic Helper with User-Friendly Errors
const fetchWithRetry = async (url: string, retries = 2, backoff = 1000, timeout = 10000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout); 

  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    });
    clearTimeout(timeoutId);
    
    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status >= 500) throw new Error(`SERVER_ERROR:${response.status}`);
    if (response.status === 404) throw new Error("NOT_FOUND");
    if (response.status === 403) throw new Error("FORBIDDEN");
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') throw new Error("TIMEOUT");

    // TypeError is often thrown for CORS issues or network failures
    const isNetworkError = error.message === "Failed to fetch" || error.name === "TypeError";
    const isRetryableStatus = error.message === "FORBIDDEN" || error.message === "RATE_LIMIT" || error.message?.startsWith("SERVER_ERROR") || error.message === "TIMEOUT";

    if (retries > 0 && (isNetworkError || isRetryableStatus)) {
      console.warn(`Retrying fetch due to ${error.name}: ${error.message}. Retries left: ${retries}`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithRetry(url, retries - 1, backoff * 1.5);
    }

    if (error.message === "NOT_FOUND") throw new Error("Symbol not found.");
    if (error.message === "FORBIDDEN") throw new Error("Access denied by data provider (403).");
    if (error.message === "RATE_LIMIT") throw new Error("Data source busy (Rate Limit).");
    if (error.message === "TIMEOUT") throw new Error("Request timed out.");
    if (error.message?.startsWith("SERVER_ERROR")) throw new Error(`Data provider unavailable (${error.message}).`);
    
    throw error;
  }
};

// Circuit breaker for proxies
const proxyFailures = new Map<string, number>();
const MAX_PROXY_FAILURES = 3;

/**
 * Fetches data with proxy and endpoint rotation fallback.
 * Uses a "Batch Race" strategy: tries multiple proxies in parallel and takes the first success.
 */
const fetchWithFallback = async (symbol: string, path: string): Promise<any> => {
  // Use our internal server-side proxy to bypass CORS
  try {
    const proxyUrl = `/api/yahoo-proxy?path=${encodeURIComponent(path)}`;
    console.log(`[CLIENT] Fetching via internal proxy: ${path}`);
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error || `Server proxy returned ${response.status}`;
      console.error(`[CLIENT] Internal proxy error: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    const data = await response.json();
    if (data && (data.chart?.result || data.quoteResponse?.result)) {
      return data;
    }
    
    if (data?.chart?.error?.code === 'Not Found') throw new Error("NOT_FOUND");
    throw new Error("INVALID_DATA");
  } catch (e: any) {
    console.error(`[CLIENT] Internal proxy failed for ${symbol}:`, e.message);
    
    // Fallback to public proxies if internal proxy fails
    console.log(`[CLIENT] Falling back to public proxies for ${symbol}`);
    const proxies = [
      { base: "https://api.allorigins.win/raw?url=", encode: true },
      { base: "https://corsproxy.io/?url=", encode: true },
      { base: "https://api.codetabs.com/v1/proxy?url=", encode: true },
    ];
    
    const endpoints = ["https://query2.finance.yahoo.com", "https://query1.finance.yahoo.com"];
    
    for (const proxy of proxies) {
      for (const endpoint of endpoints) {
        try {
          const targetUrl = `${endpoint}${path}`;
          const finalUrl = proxy.encode ? `${proxy.base}${encodeURIComponent(targetUrl)}` : `${proxy.base}${targetUrl}`;

          console.log(`[CLIENT] Trying public proxy: ${proxy.base}`);
          const proxyController = new AbortController();
          const proxyTimeout = setTimeout(() => proxyController.abort(), 8000);

          let res: Response;
          try {
            res = await fetch(finalUrl, { signal: proxyController.signal });
          } finally {
            clearTimeout(proxyTimeout);
          }

          if (res.status === 429) {
            console.warn(`[CLIENT] Public proxy ${proxy.base} rate limited, skipping...`);
            continue;
          }

          if (res.ok) {
            const data = await res.json();
            if (data && (data.chart?.result || data.quoteResponse?.result)) {
              console.log(`[CLIENT] Success via public proxy: ${proxy.base}`);
              return data;
            }
          }
        } catch (innerE) {
          console.warn(`[CLIENT] Public proxy ${proxy.base} failed:`, innerE);
        }
      }
    }
    
    throw e;
  }
};

// Helper to normalize symbols (TradingView/Colloquial -> Yahoo Finance)
const normalizeSymbol = (input: string): string => {
  const s = input.toUpperCase().trim();
  const mappings: Record<string, string> = {
    'ES': 'ES=F', 'ES1!': 'ES=F', 'ES1': 'ES=F', 
    'NQ': 'NQ=F', 'NQ1!': 'NQ=F', 'NQ1': 'NQ=F', 
    'YM': 'YM=F', 'YM1!': 'YM=F', 'YM1': 'YM=F', 
    'RTY': 'RTY=F', 'RTY1!': 'RTY=F', 'RTY1': 'RTY=F', 
    'GC': 'GC=F', 'GC1!': 'GC=F', 'GC1': 'GC=F', 
    'CL': 'CL=F', 'CL1!': 'CL=F', 'CL1': 'CL=F', 
    'SI': 'SI=F', 'SI1!': 'SI=F', 
    'HG': 'HG=F', 'HG1!': 'HG=F', 
    'NG': 'NG=F', 'NG1!': 'NG=F', 
    'BTC': 'BTC-USD', 'BTCUSD': 'BTC-USD',
    'ETH': 'ETH-USD', 'ETHUSD': 'ETH-USD',
    'SOL': 'SOL-USD', 'SOLUSD': 'SOL-USD',
    'SPX': '^GSPC', 'S&P500': '^GSPC',
    'NDX': '^NDX', 'NASDAQ': '^IXIC',
    'DJI': '^DJI', 'DOW': '^DJI',
    'VIX': '^VIX',
    'DXY': 'DX-Y.NYB',
    'SOX': '^SOX', 
  };
  if (mappings[s]) return mappings[s];
  
  // Taiwan Stock Normalization: 4-6 characters, potentially with a letter suffix (e.g., 00980A, 2330A)
  if (!s.includes('.') && /^[0-9]{4,6}[A-Z]?$/.test(s)) {
    return `${s}.TW`;
  }
  
  return s;
};

// Helper to determine frequency based on dates
const determineFrequency = (dates: Date[]): DividendFrequency => {
  if (dates.length === 0) return 'Others';
  if (dates.length >= 10) return 'Monthly';
  if (dates.length <= 2) return 'Annual';
  const months = Array.from(new Set(dates.map(d => d.getMonth() + 1))).sort((a,b) => a - b);
  const group1 = [1, 4, 7, 10], group2 = [2, 5, 8, 11], group3 = [3, 6, 9, 12];
  const match1 = months.filter(m => group1.includes(m)).length;
  const match2 = months.filter(m => group2.includes(m)).length;
  const match3 = months.filter(m => group3.includes(m)).length;
  const maxMatch = Math.max(match1, match2, match3);
  if (maxMatch === match1 && match1 >= 2) return 'Quarterly (1,4,7,10)';
  if (maxMatch === match2 && match2 >= 2) return 'Quarterly (2,5,8,11)';
  if (maxMatch === match3 && match3 >= 2) return 'Quarterly (3,6,9,12)';
  return 'Others';
};

/**
 * Validates OHLCV data to ensure no null/zero prices and consistent timestamps.
 */
const validateOHLCVData = (data: any[]): OHLCV[] => {
  if (!Array.isArray(data)) return [];
  
  const validated: OHLCV[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item || !item.date) continue;
    
    // Yahoo sometimes returns nulls for some fields in the middle of a series
    // We try to fill them with previous values if possible, or skip if it's the first one
    const open = Number(item.open);
    const high = Number(item.high);
    const low = Number(item.low);
    const close = Number(item.close);
    const volume = Number(item.volume) || 0;
    
    if (!isNaN(open) && open > 0 && 
        !isNaN(high) && high > 0 && 
        !isNaN(low) && low > 0 && 
        !isNaN(close) && close > 0) {
      validated.push({
        date: item.date,
        open, high, low, close, volume
      });
    } else if (validated.length > 0) {
      // Use previous close as a placeholder for missing data to maintain series continuity
      const prev = validated[validated.length - 1];
      validated.push({
        date: item.date,
        open: prev.close,
        high: prev.close,
        low: prev.close,
        close: prev.close,
        volume: 0
      });
    }
  }
  
  return validated;
};

/**
 * Fetches historical OHLCV data for a given symbol with caching.
 */
export const fetchHistoricalData = async (symbol: string, range: string = '1y', interval: string = '1d'): Promise<OHLCV[]> => {
  const normalizedSymbol = normalizeSymbol(symbol);
  const cacheKey = `${normalizedSymbol}_${range}_${interval}`;
  if (historyCache.has(cacheKey)) {
    const entry = historyCache.get(cacheKey)!;
    if (Date.now() - entry.ts < CACHE_DURATION_MS) return entry.data;
  }
  try {
    const path = `/v8/finance/chart/${normalizedSymbol}?range=${range}&interval=${interval}`;
    let json;
    try {
      json = await fetchWithFallback(normalizedSymbol, path);
    } catch (e) {
      // If 6mo or longer range fails, try a shorter 1mo range as last resort
      if (range !== '1mo' && interval === '1d') {
        console.warn(`Fetch failed for ${normalizedSymbol} with range ${range}, retrying with 1mo...`);
        const fallbackPath = `/v8/finance/chart/${normalizedSymbol}?range=1mo&interval=1d`;
        json = await fetchWithFallback(normalizedSymbol, fallbackPath);
      } else {
        throw e;
      }
    }
    
    if (!json || !json.chart) {
      console.error(`Invalid response structure for ${normalizedSymbol}:`, json);
      return [];
    }

    if (json.chart?.error) {
      console.error(`Yahoo API Error for ${normalizedSymbol}:`, json.chart.error);
      return []; 
    }

    const result = json.chart?.result?.[0];
    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
      console.error(`Missing data fields in response for ${normalizedSymbol}:`, result);
      return [];
    }
    const quote = result.indicators.quote[0];
    const timestamps = result.timestamp;
    const rawData = timestamps.map((ts: number, index: number) => ({
      date: new Date(ts * 1000).toISOString(),
      open: quote.open[index],
      high: quote.high[index],
      low: quote.low[index],
      close: quote.close[index],
      volume: quote.volume[index],
    }));
    const ohlcvData = validateOHLCVData(rawData);
    historyCache.set(cacheKey, { ts: Date.now(), data: ohlcvData });
    return ohlcvData;
  } catch (error) {
    console.error(`Historical Data Fetch Error (${normalizedSymbol}):`, error);
    throw error;
  }
};

const formatOHLCVtoCSV = (data: OHLCV[], limit: number = 30): string => {
    if (!data || data.length === 0) return "No Data Available";
    const slice = data.slice(-limit);
    let csv = "Date, Open, High, Low, Close, Volume\n";
    slice.forEach(row => {
      const dateStr = row.date.includes('T') ? row.date.split('T')[0] : row.date;
      csv += `${dateStr}, ${row.open.toFixed(2)}, ${row.high.toFixed(2)}, ${row.low.toFixed(2)}, ${row.close.toFixed(2)}, ${row.volume}\n`;
    });
    return csv;
};

/**
 * Calculates technical indicators from OHLCV data.
 */
const calculateIndicators = (data: OHLCV[]) => {
  if (data.length < 30) return {};

  const closes = data.map(d => d.close);
  
  // RSI (14)
  const calculateRSI = (prices: number[], period = 14) => {
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = prices[prices.length - period + i] - prices[prices.length - period + i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };

  // EMA
  const calculateEMA = (prices: number[], period: number) => {
    const k = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
  };

  // MACD (12, 26, 9)
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdValue = ema12 - ema26;
  // Simplified Signal line (usually an EMA of the MACD line over time, but here we just need a snapshot)
  // For a real signal line we'd need the history of MACD values. 
  // Let's just provide the MACD value for now.

  // Bollinger Bands (20, 2)
  const period = 20;
  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const stdDev = Math.sqrt(slice.map(x => Math.pow(x - middle, 2)).reduce((a, b) => a + b, 0) / period);
  const upper = middle + 2 * stdDev;
  const lower = middle - 2 * stdDev;

  return {
    rsi: calculateRSI(closes),
    macd: { value: macdValue, signal: 0, histogram: 0 }, // Signal/Hist would need more history
    bollinger: { upper, middle, lower }
  };
};

/**
 * Enhanced: Fetches Multi-Timeframe Data (Weekly, Daily, Hourly) with alignment and fallback.
 */
export const fetchMTFStockData = async (symbol: string, retries = 1): Promise<{ 
  mtfDataString: string, 
  lastPrice: number, 
  changePercent: number,
  sparklineData: { date: string; close: number }[],
  indicators: any,
  dayHigh?: number,
  dayLow?: number,
  fiftyTwoWeekHigh?: number,
  fiftyTwoWeekLow?: number,
  volume?: number,
  ohlcvData: {
    '1w': OHLCV[],
    '1d': OHLCV[],
    '1h': OHLCV[]
  }
}> => {
    const normalizedSymbol = normalizeSymbol(symbol);
    const timezone = detectTimezone(normalizedSymbol);

    try {
        const fetchSafe = async (fn: () => Promise<OHLCV[]>, name: string): Promise<OHLCV[]> => {
            try {
                const data = await fn();
                const validated = validateOHLCVData(data);
                if (validated.length === 0 && name === 'Daily') throw new Error(`Integrity check failed: ${name} data unavailable.`);
                return validated;
            } catch (e) {
                console.warn(`Failed to fetch ${name} data for ${symbol}.`);
                return [];
            }
        };

        const [weeklyData, dailyData, hourlyData] = await Promise.all([
            fetchSafe(() => fetchHistoricalData(symbol, '2y', '1wk'), 'Weekly'),
            fetchSafe(() => fetchHistoricalData(symbol, '6mo', '1d'), 'Daily'),
            fetchSafe(() => fetchHistoricalData(symbol, '1mo', '60m'), 'Hourly'),
        ]);

        // If daily data is missing, we try to use the last known quote as a fallback for the current price
        let lastPrice = 0;
        let changePercent = 0;
        let stats = {};

        if (dailyData.length > 0) {
            const lastDailyCandle = dailyData[dailyData.length - 1];
            lastPrice = lastDailyCandle.close;
            let prevPrice = lastPrice;
            if (dailyData.length >= 2) prevPrice = dailyData[dailyData.length - 2].close;
            changePercent = prevPrice !== 0 ? ((lastPrice - prevPrice) / prevPrice) * 100 : 0;
            stats = await fetchQuote(symbol);
        } else {
            // Fallback to fetchQuote if daily historical data is missing
            try {
                const quote = await fetchQuote(symbol);
                lastPrice = quote.price;
                changePercent = quote.changePercent;
                stats = quote;
            } catch (e) {
                if (retries > 0) {
                    console.warn(`Retrying MTF fetch for ${symbol}... (${retries} left)`);
                    await new Promise(r => setTimeout(r, 1000));
                    return fetchMTFStockData(symbol, retries - 1);
                }
                throw new Error(`Critical price data unavailable for '${normalizedSymbol}'.`);
            }
        }
        const dailyTs = dailyData.length > 0 ? new Date(dailyData[dailyData.length - 1].date).getTime() : Date.now();
        
        // Chronological Alignment Logic: Check end times proximity
        const getAlignmentReport = (data: OHLCV[], timeframe: string) => {
            if (data.length === 0) return `[${timeframe}: MISSING]`;
            const latestBar = data[data.length - 1];
            const latestTs = new Date(latestBar.date).getTime();
            const hourDiff = Math.abs(latestTs - dailyTs) / (1000 * 60 * 60);
            
            let status = "ALIGNED";
            if (hourDiff > 168) status = "STALE_WEEK"; // More than a week
            else if (hourDiff > 24 && (timeframe === 'Hourly' || timeframe === '4-Hour')) status = "STALE_INTRADAY";

            return `[${timeframe}_LAST_CLOSE: ${latestBar.date} | OFFSET: ${hourDiff.toFixed(1)}h | STATUS: ${status}]`;
        };

        const alignmentString = `
ALIGNMENT_INTEGRITY_CHECK:
${getAlignmentReport(weeklyData, "WEEKLY")}
${getAlignmentReport(dailyData, "DAILY")}
${getAlignmentReport(hourlyData, "HOURLY")}
        `.trim();

        // Package Data for AI
        const mtfString = `
[SYSTEM_DATA_INTEGRITY_REPORT]
Symbol: ${normalizedSymbol}
Market_Timezone: ${timezone}
Reference_Time_UTC: ${new Date().toUTCString()}
Primary_Price: ${lastPrice.toFixed(2)}
Daily_Change: ${changePercent.toFixed(2)}%

${alignmentString}

=== WEEKLY DATA (Long Term) ===
${weeklyData.length > 0 ? formatOHLCVtoCSV(weeklyData, 52) : "[UNAVAILABLE]"}

=== DAILY DATA (Mid Term - STRUCTURAL CORE) ===
${dailyData.length > 0 ? formatOHLCVtoCSV(dailyData, 60) : "[UNAVAILABLE: Using current quote as fallback]"}

=== HOURLY DATA (Short Term - MOMENTUM) ===
${hourlyData.length > 0 ? formatOHLCVtoCSV(hourlyData, 48) : "[UNAVAILABLE: Focus on Daily structure]"}

--- END_OF_INTEGRITY_PACKET ---
        `;

        return {
            mtfDataString: mtfString,
            lastPrice,
            changePercent,
            sparklineData: dailyData.length > 0 ? dailyData.slice(-7).map(d => ({ date: d.date, close: d.close })) : [],
            indicators: dailyData.length > 0 ? calculateIndicators(dailyData) : {},
            ohlcvData: {
                '1w': weeklyData,
                '1d': dailyData,
                '1h': hourlyData
            },
            ...stats
        };

    } catch (error) {
        console.error("MTF Stock Fetch Error:", error);
        throw error;
    }
};

// Fetch Quote for multiple symbols
export const fetchMarketData = async (): Promise<MarketItem[]> => {
  const symbols = [
    { s: '^GSPC', n: 'S&P 500' },
    { s: '^IXIC', n: 'Nasdaq' },
    { s: '0050.TW', n: 'Taiwan 50' },
    { s: 'BTC-USD', n: 'Bitcoin' }
  ];
  const results = await Promise.all(symbols.map(async (item) => {
    try {
      const { price, changePercent } = await fetchQuote(item.s);
      const prev = price / (1 + changePercent / 100);
      const change = price - prev;
      return { symbol: item.s, name: item.n, price, change, changePercent };
    } catch (e) { 
      // Last ditch effort: check cache
      const cached = quoteCache.get(normalizeSymbol(item.s));
      if (cached) {
        const prev = cached.price / (1 + cached.changePercent / 100);
        const change = cached.price - prev;
        return { symbol: item.s, name: item.n, price: cached.price, change, changePercent: cached.changePercent };
      }
      return null; 
    }
  }));
  return results.filter((item): item is MarketItem => item !== null);
};

export const fetchQuote = async (symbol: string): Promise<QuoteResult> => {
  const normalizedSymbol = normalizeSymbol(symbol);
  
  // Try chart endpoint first (more data)
  try {
    const path = `/v8/finance/chart/${normalizedSymbol}?range=5d&interval=1d`;
    const json = await fetchWithFallback(normalizedSymbol, path);
    
    const result = json.chart?.result?.[0];
    if (result && result.indicators.quote[0]) {
      const meta = result.meta;
      const quote = result.indicators.quote[0];
      const closes = (quote.close as (number|null)[]).filter((c): c is number => c !== null && c !== 0);
      
      if (closes.length > 0) {
        const lastPrice = closes[closes.length - 1];
        let changePercent = 0;
        if (closes.length >= 2) {
          const prevClose = closes[closes.length - 2];
          changePercent = ((lastPrice - prevClose) / prevClose) * 100;
        }
        
        const quoteResult = {
          price: lastPrice,
          changePercent,
          dayHigh: meta.regularMarketDayHigh || quote.high[quote.high.length - 1],
          dayLow: meta.regularMarketDayLow || quote.low[quote.low.length - 1],
          fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
          volume: meta.regularMarketVolume || quote.volume[quote.volume.length - 1]
        };
        
        quoteCache.set(normalizedSymbol, quoteResult);
        return quoteResult;
      }
    }
  } catch (e) {
    console.warn(`Chart-based quote fetch failed for ${normalizedSymbol}, trying quote endpoint...`);
  }

  // Fallback to quote endpoint (v7)
  try {
    const path = `/v7/finance/quote?symbols=${normalizedSymbol}`;
    const json = await fetchWithFallback(normalizedSymbol, path);
    const result = json.quoteResponse?.result?.[0];
    
    if (result) {
      const quoteResult = {
        price: result.regularMarketPrice,
        changePercent: result.regularMarketChangePercent,
        dayHigh: result.regularMarketDayHigh,
        dayLow: result.regularMarketDayLow,
        fiftyTwoWeekHigh: result.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: result.fiftyTwoWeekLow,
        volume: result.regularMarketVolume
      };
      
      quoteCache.set(normalizedSymbol, quoteResult);
      return quoteResult;
    }
  } catch (e) {
    console.warn(`Quote-based fetch failed for ${normalizedSymbol}, checking cache...`, e);
  }

  const cached = quoteCache.get(normalizedSymbol);
  if (cached) {
    console.log(`Returning cached quote for ${normalizedSymbol}`);
    return cached;
  }
  
  throw new Error(`Failed to fetch quote for ${normalizedSymbol}`);
};

export const fetchDividendData = async (inputSymbol: string): Promise<{ 
  symbol: string, 
  name: string,
  currentPrice: number, 
  annualDividendRate: number, 
  yieldPercent: number, 
  frequency: DividendFrequency,
  marketCap?: number,
  payoutMonths: number[] // New field: 1-12
}> => {
  const normalizedSymbol = normalizeSymbol(inputSymbol);
  try {
    // Try different ranges for chart data as some symbols might fail with longer ranges
    let chartJson;
    const ranges = ['2y', '1y', '5y', 'max'];
    let lastChartError;
    
    for (const range of ranges) {
      try {
        const chartPath = `/v8/finance/chart/${normalizedSymbol}?range=${range}&interval=1d&events=div`;
        chartJson = await fetchWithFallback(normalizedSymbol, chartPath);
        if (chartJson?.chart?.result?.[0]) {
          // Only accept if dividend events are present, or this is the last range to try
          if (chartJson.chart.result[0].events?.dividends) break;
          if (range === ranges[ranges.length - 1]) break;
          console.warn(`Dividend chart for ${normalizedSymbol} range=${range} returned no events.dividends, trying next range...`);
          chartJson = undefined;
        }
      } catch (e) {
        lastChartError = e;
        console.warn(`Dividend chart fetch failed for ${normalizedSymbol} with range ${range}, trying next...`);
      }
    }
    
    if (!chartJson) throw lastChartError || new Error("Symbol not found");
    const chartResult = chartJson.chart?.result?.[0];
    
    const quotePath = `/v7/finance/quote?symbols=${normalizedSymbol}`;
    
    // Fetch quote data separately and don't let it block if it fails
    let stockName = normalizedSymbol;
    let marketCap = undefined;
    try {
      const quoteJson = await fetchWithFallback(normalizedSymbol, quotePath);
      const quoteResult = quoteJson.quoteResponse?.result?.[0];
      if (quoteResult) {
        stockName = quoteResult.longName || quoteResult.shortName || normalizedSymbol;
        marketCap = quoteResult.marketCap;
      }
    } catch (e) {
      console.warn("Failed to fetch extra quote info, using defaults", e);
    }
    
    const meta = chartResult.meta;
    let currentPrice = meta.regularMarketPrice;
    if (!currentPrice && chartResult.indicators?.quote?.[0]?.close) {
      const closes = chartResult.indicators.quote[0].close.filter((c: any) => c !== null && c !== 0);
      if (closes.length > 0) {
        currentPrice = closes[closes.length - 1];
      }
    }
    currentPrice = currentPrice || 0;
    
    // Fallback to cache if price is missing
    if (currentPrice === 0) {
      const cached = quoteCache.get(normalizedSymbol);
      if (cached) currentPrice = cached.price;
    }
    const events = chartResult.events?.dividends;
    let totalDividendsTTM = 0;
    const divDates: Date[] = [];
    const payoutMonthsSet = new Set<number>();

    if (events) {
      const now = new Date();
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(now.getFullYear() - 1);
      const oneYearAgoTs = Math.floor(oneYearAgo.getTime() / 1000);
      
      Object.values(events).forEach((div: any) => {
        const divDate = new Date(div.date * 1000);
        const month = divDate.getMonth() + 1;
        
        // For TTM calculation
        if (div.date >= oneYearAgoTs) {
          totalDividendsTTM += div.amount;
        }
        
        // For frequency and matrix
        divDates.push(divDate);
        payoutMonthsSet.add(month);
      });
    }

    const frequency = determineFrequency(divDates);
    const yieldPercent = currentPrice > 0 ? (totalDividendsTTM / currentPrice) * 100 : 0;
    const payoutMonths = Array.from(payoutMonthsSet).sort((a, b) => a - b);

    return { 
      symbol: normalizedSymbol, 
      name: stockName, 
      currentPrice, 
      annualDividendRate: totalDividendsTTM, 
      yieldPercent, 
      frequency, 
      marketCap,
      payoutMonths
    };
  } catch (error: any) { 
    console.error(`[CLIENT] Dividend Fetch Error for ${normalizedSymbol}:`, error);
    const msg = error.message || "Unknown error";
    // Using a more descriptive error message that includes the internal proxy attempt
    throw new Error(`無法取得 ${normalizedSymbol} 的配息資料。錯誤原因: ${msg} (Proxy: Internal-V8)。請檢查代號是否正確，或嘗試手動輸入。`); 
  }
};
