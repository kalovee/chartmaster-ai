
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { TRADER_PERSONA_PROMPT, SNIPER_AI_DATA_PROMPT } from "../constants";
import { Language, GroundingMetadata } from "../types";

interface AnalysisResponse {
  markdown: string;
  groundingMetadata?: GroundingMetadata;
}

// Helper to convert File to Base64
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("AI Protocol Offline: GEMINI_API_KEY missing. If you are using the published version, please go to 'Settings' (⚙️) and configure your Gemini API Key.");
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Exponential Backoff Retry Logic
 * Handles 429 (Quota), 503 (Service Unavailable), 500 (Internal Server Error), 408 (Timeout)
 */
export const callGeminiWithRetry = async (fn: () => Promise<any>, retries = 3, backoff = 2000): Promise<any> => {
    try {
        return await fn();
    } catch (error: any) {
        const errorMessage = error.message || "";
        const isRetryable = 
            errorMessage.includes('429') || 
            errorMessage.includes('503') || 
            errorMessage.includes('500') || 
            errorMessage.includes('408') ||
            errorMessage.includes('deadline') ||
            errorMessage.includes('timeout');
        
        if (retries > 0 && isRetryable) {
            console.warn(`Gemini API transient failure (${errorMessage}), retrying in ${backoff}ms... attempts left: ${retries}`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return callGeminiWithRetry(fn, retries - 1, backoff * 1.5);
        }
        
        // Map common errors to user-friendly messages
        if (errorMessage.includes('429')) {
             throw new Error("AI Quota Exceeded. The system is temporarily over capacity. Please wait a moment.");
        }
        if (errorMessage.includes('503') || errorMessage.includes('500') || errorMessage.includes('408')) {
             throw new Error("AI Signal Lost. The analysis server is having trouble responding. This usually happens during peak hours or when search grounding is slow. Please try again in 30 seconds.");
        }
        if (errorMessage.includes('403')) {
             throw new Error("Access Denied. Your request was blocked. Please check your credentials.");
        }
        
        throw new Error(`AI Link Malfunction: ${errorMessage.substring(0, 100)}...`);
    }
};

export const analyzeChartImage = async (imageFile: File, language: Language = 'zh'): Promise<AnalysisResponse> => {
  const ai = getClient();
  const langInstruction = language === 'en' ? "OUTPUT MUST BE IN ENGLISH." : "OUTPUT MUST BE IN TRADITIONAL CHINESE (繁體中文).";
  const systemInstruction = `${TRADER_PERSONA_PROMPT}\n\nIMPORTANT OVERRIDE: ${langInstruction}`;

  try {
    const imagePart = await fileToGenerativePart(imageFile);
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: {
        parts: [imagePart, { text: "Please perform a professional technical analysis on this chart image using your elite trader persona. Identify key patterns, support/resistance zones, and potential trade setups with high precision. Pay close attention to SMC elements (BOS, CHoCH, Order Blocks, FVG) and Wyckoff market phases to provide deeper technical insights." }]
      },
      config: { 
        systemInstruction,
        temperature: 0.2,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    }));

    if (response.text) {
      return {
        markdown: response.text,
        groundingMetadata: response.candidates?.[0]?.groundingMetadata as GroundingMetadata
      };
    } else {
      throw new Error("Analysis failed: The AI generated an empty response. This might be due to safety filters.");
    }
  } catch (error: any) {
    console.error("Gemini Image Analysis Error:", error);
    throw error;
  }
};

export const analyzeStockByData = async (
  symbol: string, 
  csvData: string, 
  language: Language = 'zh',
  timeframe: string = '1d'
): Promise<AnalysisResponse> => {
  const ai = getClient();
  const langInstruction = language === 'en' ? "OUTPUT MUST BE IN ENGLISH." : "OUTPUT MUST BE IN TRADITIONAL CHINESE (繁體中文).";

  try {
    const systemInstruction = `
      ${SNIPER_AI_DATA_PROMPT}
      IMPORTANT OVERRIDE: ${langInstruction}
    `;

    const prompt = `
      target_stock: ${symbol}
      primary_analysis_timeframe: ${timeframe}
      **INSTRUCTION:** Focus your technical analysis, market structure identification, and trading setup primarily on the ${timeframe} timeframe. Use the other provided timeframe data to confirm trends and identify higher-timeframe bias.
      **SEARCH GROUNDING:** Use Google Search for recent news and major catalysts for ${symbol}.
      Historical price data (Multi-Timeframe):
      ${csvData}
    `;

    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction,
        temperature: 0.1,
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    }));

    if (response.text) {
      return {
        markdown: response.text,
        groundingMetadata: response.candidates?.[0]?.groundingMetadata as GroundingMetadata
      };
    } else {
      throw new Error("Analysis failed: Empty response from AI. Please check the symbol and try again.");
    }
  } catch (error: any) {
    console.error("Gemini Data Analysis Error:", error);
    throw error;
  }
}
