import { GoogleGenAI } from "@google/genai";
import { KPIRecord } from "../types";

export const generateInterpretation = async (records: KPIRecord[], kpiName: string, section: string) => {
  if (!process.env.API_KEY) {
    console.warn("API Key not found for Gemini.");
    return "API Key missing. Cannot generate interpretation.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Sort records chronologically
    const sortedRecords = [...records].sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
    
    // Prepare data summary
    const dataSummary = sortedRecords.map(r => 
      `${r.month}: Actual ${r.actualPct}% (Target ${r.targetPct}%), Census: ${r.census}`
    ).join('\n');

    const prompt = `
      You are a data analyst for Ospital ng Makati.
      Analyze the following KPI data for Section: "${section}", KPI: "${kpiName}".
      
      Data:
      ${dataSummary}
      
      Please provide a concise interpretation (max 3 sentences). 
      1. Identify the general trend (improving, declining, stable).
      2. Point out any significant failures or successes relative to the target.
      3. Correlate with census if there's an obvious pattern (e.g., high census led to low performance).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Unable to generate interpretation at this time.";
  }
};