
export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface ChartAnalysisRequest {
  image: File;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface GroundingMetadata {
  groundingChunks: GroundingChunk[];
  groundingSupports?: any[];
  webSearchQueries?: string[];
}

export interface AnalysisResult {
  markdown: string;
  timestamp: string;
  groundingMetadata?: GroundingMetadata | null;
}

export interface AnalysisState {
  status: AnalysisStatus;
  result: AnalysisResult | null;
  error: string | null;
  imagePreview: string | null;
}

export type Timeframe = '1h' | '4h' | '1d' | '1w';

export interface StockItem {
  id: string;
  symbol: string;
  note: string;
  addedAt: string;
  selectedTimeframe?: Timeframe;
  // New fields for AI Analysis
  analysis?: string | null;
  analysisStatus?: AnalysisStatus;
  groundingMetadata?: GroundingMetadata | null;
  lastPrice?: number;
  changePercent?: number;
  sparklineData?: { date: string; close: number }[];
  indicators?: {
    rsi?: number;
    macd?: { value: number; signal: number; histogram: number };
    bollinger?: { upper: number; middle: number; lower: number };
  };
  // Expanded Market Stats
  dayHigh?: number;
  dayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  volume?: number;
  lastUpdated?: string;
  ohlcvData?: {
    '1w'?: OHLCV[];
    '1d'?: OHLCV[];
    '1h'?: OHLCV[];
  };
}

export type DividendFrequency = 
  | 'Monthly' 
  | 'Quarterly (1,4,7,10)' 
  | 'Quarterly (2,5,8,11)' 
  | 'Quarterly (3,6,9,12)' 
  | 'Annual' 
  | 'Others';

export interface ETFHolding {
  id: string;
  symbol: string;
  shares: number;
  annualDividendRate: number; // Trailing 12 Months sum
  currentPrice: number;
  yieldPercent: number;
  dividendFrequency: DividendFrequency;
  payoutMonths: number[]; // 1-12
  name?: string; 
  marketCap?: number;
}

export interface MarketItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

// NEW TYPES
export type Theme = 'dark' | 'light';
export type Language = 'en' | 'zh';

export interface NewsSummary {
  id: string;
  date: string;
  market: string;
  timeframe: string;
  content: string;
  groundingMetadata?: GroundingMetadata;
  status: AnalysisStatus;
}

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface NewsPreferences {
  markets: string;
  topics: string;
  sources: string;
}

export interface AppContextType {
  theme: Theme;
  toggleTheme: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  showToast: (message: string, type?: ToastType) => void;
  newsPreferences: NewsPreferences;
  updateNewsPreferences: (prefs: Partial<NewsPreferences>) => void;
  newsSummary: NewsSummary | null;
  setNewsSummary: (summary: NewsSummary | null) => void;
  isGeneratingNews: boolean;
  setIsGeneratingNews: (val: boolean) => void;
}
