
import { GoogleGenAI, Type } from "@google/genai";
import { Trade } from '../types';

export const verifyGeminiConnection = async (apiKey: string): Promise<{ success: boolean; message: string }> => {
  const cleanKey = apiKey.replace(/\s/g, '');

  if (!cleanKey) {
      return { success: false, message: "API Key cannot be empty." };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: cleanKey });
    
    // Attempt to generate a simple response to verify the key and model access
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [{ text: "Hello" }]
        }
    });

    // If we get here without error, and have text, the key is valid
    if (response && response.text) {
         return { success: true, message: "Success! Gemini API Key verified." };
    }
    
    return { success: false, message: "API Key accepted, but returned no content." };

  } catch (error: any) {
    console.error("Gemini Verification Error:", error);
    
    let errorMessage = error.message || error.toString();
    
    // Handle specific Google API error patterns
    if (errorMessage.includes("400") || errorMessage.includes("API key not valid")) {
        return { success: false, message: "Invalid API Key. Please check your key." };
    }
    
    if (errorMessage.includes("403")) {
        return { success: false, message: "Permission denied (403). Check API Key restrictions." };
    }

    return { success: false, message: `Verification failed: ${errorMessage}` };
  }
};

export const analyzeTradeWithGemini = async (trade: Trade, apiKey: string): Promise<{ feedback: string; score: number; tags: string[] }> => {
  const cleanKey = apiKey ? apiKey.replace(/\s/g, '') : '';
  
  if (!cleanKey) {
    throw new Error("No Gemini API Key provided.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: cleanKey });
    
    const prompt = `
      Analyze the following trading journal entry and provide constructive feedback.
      
      Trade Details:
      Symbol: ${trade.symbol}
      Type: ${trade.type}
      Status: ${trade.status}
      Entry: ${trade.entryPrice}
      Exit: ${trade.exitPrice || 'N/A'}
      Stop Loss: ${trade.stopLoss}
      Take Profit: ${trade.takeProfit}
      P&L: ${trade.pnl || 0}
      Notes: "${trade.notes}"
      Setup: ${trade.setup || 'Not specified'}
      Mistake: ${trade.mistake || 'None'}
      Emotion: ${trade.emotion || 'None'}
      
      Please provide:
      1. A short paragraph of feedback focusing on psychological and technical execution.
      2. A score from 0-100 based on execution quality (not just outcome).
      3. A list of 3-5 short tags describing the trade (e.g., "FOMO", " disciplined", "early exit").
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            feedback: { type: Type.STRING },
            score: { type: Type.INTEGER },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Error analyzing trade:", error);
    throw new Error(error.message || "Error connecting to Gemini.");
  }
};
