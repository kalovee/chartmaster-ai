
import { getClient, callGeminiWithRetry } from "./geminiService";
import { Language, GroundingMetadata, NewsSummary, AnalysisStatus, NewsPreferences } from "../types";
import { ThinkingLevel } from "@google/genai";

export const generateNewsSummary = async (
  preferences: NewsPreferences,
  timeframe: string,
  language: Language = 'zh'
): Promise<NewsSummary> => {
  const ai = await getClient();
  const today = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });
  
  const prompt = `
    ## Task
    As an elite financial analyst, generate a comprehensive stock market and crypto news summary for today (${today}).
    
    ## User Preferences
    - Market Scope: ${preferences.markets}
    - Timeframe: ${timeframe} (Full day coverage)
    - Content Focus Topics: ${preferences.topics}, 石油 (Oil), 貴金屬 (Precious Metals), 熱門產業族群 (Trending Sectors)
    - Preferred Sources: ${preferences.sources}
    - Categories: US Stocks (美股), Taiwan Stocks (台股), Crypto (加密貨幣), Commodities (大宗商品).
    
    ## Requirements
    - Use Google Search to find the latest news for today based on the user's preferred markets, topics, and sources.
    - Remove duplicates and merge related events.
    - Use clear, bold headings for each news item.
    - Add double line breaks between sections for better readability.
    - For each news item, provide:
      - **[Title]** (Use bold)
      - 摘要：...
      - 重要性：...
      - 情緒：...
      - 關鍵名詞/代號：...
      - 來源：...
    - Include:
      - Today's 3 main themes (Use a distinct section)
      - 10 key events/dates to track with specific times (e.g., 21:30 CPI Data)
      - Trending Sectors & Commodities (Oil, Gold, etc.) to watch (Use a distinct section)
      - One-sentence summary for busy people (Use a distinct section)
    - Language: ${language === 'en' ? 'English' : 'Traditional Chinese (繁體中文)'}
    - Tone: Professional, clear, non-advisory.
    - Footer: Add "Non-investment advice" (非投資建議).
    
    ## Output Template (STRICT)
    # 每日股市新聞摘要
    > ${today} | 時段：${timeframe} | 市場：${preferences.markets}
    
    ---
    
    ## 🇺🇸 美股動態
    ...
    
    ## 🇹🇼 台股動態
    ...
    
    ## ₿ 加密貨幣
    ...
    
    ## 🛢️ 大宗商品與產業族群
    ### [Category Name]
    1. **[News/Trend Title]**
       - **摘要**：...
       - **重要性**：...
       - **關鍵名詞**：...
    
    ---
    
    ## 💡 今日 3 大主線
    1. ...
    
    ## 📅 10 個關鍵追蹤 (含時間)
    1. [Time] [Event Name]
    2. ...
    
    ## 🔍 近期關注族群與商品
    - **股票族群**：...
    - **石油/能源**：...
    - **貴金屬**：...
    
    ## ⚡ 一句話總結
    > **核心摘要**：...
    
    ---
    
    ### 🔗 資料來源
    - ...
    
    *非投資建議*
  `;

  try {
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: { parts: [{ text: prompt }] },
      config: {
        temperature: 0.2,
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    }));

    if (response.text) {
      return {
        id: Date.now().toString(),
        date: today,
        market: preferences.markets,
        timeframe,
        content: response.text,
        groundingMetadata: response.candidates?.[0]?.groundingMetadata as GroundingMetadata,
        status: AnalysisStatus.SUCCESS
      };
    } else {
      throw new Error("News summary generation failed: Empty response.");
    }
  } catch (error: any) {
    console.error("News Summary Error:", error);
    throw error;
  }
};
