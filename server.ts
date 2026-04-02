import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple in-memory cache for proxy requests
const proxyCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check and version info
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      version: "1.0.8", 
      env: process.env.NODE_ENV,
      time: new Date().toISOString()
    });
  });

  // Proxy endpoint for Yahoo Finance
  app.get("/api/yahoo-proxy", async (req, res) => {
    let { path: yahooPath } = req.query;
    
    if (!yahooPath || typeof yahooPath !== 'string') {
      return res.status(400).json({ error: "Missing path parameter" });
    }

    const tryFetch = async (targetPath: string, retryCount = 0): Promise<any> => {
      const endpoints = [
        "https://query2.finance.yahoo.com",
        "https://query1.finance.yahoo.com"
      ];

      // Check cache first
      const cached = proxyCache.get(targetPath);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return cached.data;
      }

      for (const endpoint of endpoints) {
        try {
          const targetUrl = `${endpoint}${targetPath}`;
          const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
          
          // Extract symbol for Referer if possible
          const symbolMatch = targetPath.match(/\/chart\/([^?]+)/) || targetPath.match(/symbols=([^&]+)/);
          const symbol = symbolMatch ? symbolMatch[1] : 'AAPL';

          const response = await axios.get(targetUrl, {
            headers: {
              'User-Agent': userAgent,
              'Accept': 'application/json',
              'Referer': symbol.includes('.TW') || symbol.includes('.TWO') 
                ? `https://tw.stock.yahoo.com/quote/${symbol}`
                : `https://finance.yahoo.com/quote/${symbol}`,
              'Origin': 'https://finance.yahoo.com'
            },
            timeout: 15000,
            validateStatus: (status) => status < 500
          });

          if (response.status === 429) {
            if (retryCount < 2) {
              const delay = (retryCount + 1) * 2000 + Math.random() * 1000;
              await new Promise(resolve => setTimeout(resolve, delay));
              return tryFetch(targetPath, retryCount + 1);
            }
            continue;
          }

          // Yahoo sometimes returns 200 but with an error object
          if (response.data?.chart?.error || response.data?.quoteResponse?.error) {
            const error = response.data?.chart?.error || response.data?.quoteResponse?.error;
            console.warn(`[YAHOO_API_ERROR] ${endpoint} for ${targetPath} returned:`, JSON.stringify(error));
            continue; // Try next endpoint
          }

          if (response.data && (response.data.chart?.result || response.data.quoteResponse?.result)) {
            proxyCache.set(targetPath, { data: response.data, ts: Date.now() });
            return response.data;
          }
        } catch (error: any) {
          console.error(`Proxy error for ${endpoint}:`, error.message);
        }
      }
      return null;
    };

    try {
      let data = await tryFetch(yahooPath);
      
      // Fallback 1: Try shorter range if chart data fails
      if (!data && yahooPath.includes('range=')) {
        const currentRange = yahooPath.match(/range=([^&]+)/)?.[1];
        const ranges = ['1mo', '1d']; // Try these in order
        for (const r of ranges) {
          if (r === currentRange) continue;
          const fallbackPath = yahooPath.replace(`range=${currentRange}`, `range=${r}`);
          console.log(`[FALLBACK] Trying ${r} range instead of ${currentRange}: ${fallbackPath}`);
          data = await tryFetch(fallbackPath);
          if (data) break;
        }
      }

      // Fallback 2: Taiwan stocks (.TW <-> .TWO <-> No suffix)
      if (!data && (yahooPath.includes('.TW') || yahooPath.includes('.TWO') || /^[0-9]{4,6}/.test(yahooPath))) {
        const symbolMatch = yahooPath.match(/\/chart\/([^?]+)/) || yahooPath.match(/symbols=([^&]+)/);
        if (symbolMatch) {
          const fullSymbol = symbolMatch[1];
          const baseSymbol = fullSymbol.split('.')[0];
          
          const suffixes = ['.TW', '.TWO', ''];
          for (const suffix of suffixes) {
            const newSymbol = `${baseSymbol}${suffix}`;
            if (newSymbol === fullSymbol) continue;
            
            // Use a regex to replace the symbol to ensure we catch it even if encoded or repeated
            const fallbackPath = yahooPath.split(fullSymbol).join(newSymbol);
            console.log(`[FALLBACK] Trying Taiwan symbol variation: ${newSymbol}`);
            data = await tryFetch(fallbackPath);
            if (data) break;
          }
        }
      }

      if (data) {
        return res.json(data);
      }

      // Fallback 4: Quote-to-Chart Mock (If chart fails, try to get at least the current price)
      if (yahooPath.includes('/v8/finance/chart/')) {
        const symbolMatch = yahooPath.match(/\/chart\/([^?]+)/);
        if (symbolMatch) {
          const symbol = symbolMatch[1];
          console.log(`[FALLBACK] Chart failed for ${symbol}, attempting Quote-to-Chart mock...`);
          const quotePath = `/v7/finance/quote?symbols=${symbol}`;
          const quoteData = await tryFetch(quotePath);
          const quote = quoteData?.quoteResponse?.result?.[0];
          
          if (quote) {
            // Construct a minimal chart response so the client doesn't break
            const mockChart = {
              chart: {
                result: [{
                  meta: {
                    symbol: symbol,
                    regularMarketPrice: quote.regularMarketPrice,
                    chartPreviousClose: quote.regularMarketPreviousClose,
                    regularMarketDayHigh: quote.regularMarketDayHigh,
                    regularMarketDayLow: quote.regularMarketDayLow,
                    regularMarketVolume: quote.regularMarketVolume
                  },
                  timestamp: [Math.floor(Date.now() / 1000)],
                  indicators: {
                    quote: [{
                      open: [quote.regularMarketOpen || quote.regularMarketPrice],
                      high: [quote.regularMarketDayHigh || quote.regularMarketPrice],
                      low: [quote.regularMarketDayLow || quote.regularMarketPrice],
                      close: [quote.regularMarketPrice],
                      volume: [quote.regularMarketVolume || 0]
                    }]
                  }
                }],
                error: null
              }
            };
            return res.json(mockChart);
          }
        }
      }
      
      res.status(404).json({ error: "Data not found from any Yahoo Finance endpoint. The symbol might be invalid or temporarily unavailable." });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
