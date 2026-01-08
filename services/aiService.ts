
import { GoogleGenAI, Type } from "@google/genai";
import { AudioSample, Plugin } from "../types";

const ai = new GoogleGenAI({ apiKey: (process.env.API_KEY as string) });

interface AIRecommendationResponse {
  text: string;
  recommendedIds: string[];
}

export const getAIRecommendation = async (
  query: string,
  relevantSamples: AudioSample[],
  plugins: Plugin[]
): Promise<AIRecommendationResponse> => {
  const samplesContext = relevantSamples.map(s => ({
    id: s.id,
    name: s.name,
    tags: [...s.sourceTags, ...s.acousticTags],
    confidence: s.confidenceScore,
    dna: { freq: `${s.dna.peakFrequency.toFixed(0)}Hz`, atk: `${s.dna.attackMs.toFixed(0)}ms`, bri: s.dna.brightness.toFixed(2) }
  }));

  const pluginsContext = plugins.map(p => `${p.name} (${p.type})`).join(", ");

  const prompt = `
Ты — Techno Architect OS AI. Помогаешь продюсеру в FL Studio.
ЗАПРОС: "${query}"
ПЛАГИНЫ В ПРОЕКТЕ: ${pluginsContext}
ДОСТУПНЫЕ СЕМПЛЫ: ${JSON.stringify(samplesContext)}

ЗАДАЧА:
1. Выбери из БАЗЫ только те семплы (ID), которые лучше всего подходят под запрос.
2. ПРАВИЛО: Для запросов "Tight", "Плотный", "Резкий" выбирай строго семплы, где "confidence" > 70.
3. Дай краткий технический комментарий (стиль терминала, русский язык).
4. Верни строго JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "Технический комментарий" },
            recommendedIds: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Список ID из базы"
            }
          },
          required: ["text", "recommendedIds"]
        }
      }
    });
    
    return JSON.parse(response.text.trim());
  } catch (err) {
    console.error("AI Assistant Error:", err);
    return { 
      text: "СИСТЕМА: ОШИБКА НЕЙРОННОЙ СВЯЗИ. ВЫПОЛНЕН ЛОКАЛЬНЫЙ ПОИСК.", 
      recommendedIds: relevantSamples.slice(0, 5).map(s => s.id) 
    };
  }
};

export const categorizePlugins = async (rawList: string): Promise<Omit<Plugin, 'id'>[]> => {
  const prompt = `Категоризируй список музыкальных плагинов. Типы: Synth, EQ, Dynamics, Distortion, Reverb, Delay, Other.
Список: ${rawList}
Верни строго JSON массив объектов { "name": string, "type": string }.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              type: { type: Type.STRING }
            },
            required: ["name", "type"]
          }
        }
      }
    });
    return JSON.parse(response.text.trim());
  } catch (err) {
    return rawList.split(/[\n,]/).filter(s => s.trim()).map(s => ({ name: s.trim(), type: 'Other' }));
  }
};
