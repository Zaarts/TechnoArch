
import { GoogleGenAI } from "@google/genai";
import { AudioSample, Plugin } from "../types";

const ai = new GoogleGenAI({ apiKey: (process.env.API_KEY as string) });

export const getAIRecommendation = async (
  query: string,
  relevantSamples: AudioSample[],
  plugins: Plugin[]
): Promise<string> => {
  // Формируем текстовый паспорт для контекста
  const samplesContext = relevantSamples.map(s => ({
    name: s.name,
    tags: [...s.sourceTags, ...s.acousticTags],
    dna: {
      freq: `${s.dna.peakFrequency.toFixed(0)}Hz`,
      atk: `${s.dna.attackMs.toFixed(0)}ms`,
      brightness: s.dna.brightness.toFixed(2)
    }
  }));

  const pluginsContext = plugins.map(p => `${p.name} (${p.type})`).join(", ");

  const prompt = `
Ты — Techno Architect OS AI. Помогаешь продюсеру в FL Studio.
Твоя задача: проанализировать запрос и предложить лучшие звуки из списка ниже.

ЗАПРОС ПОЛЬЗОВАТЕЛЯ: "${query}"
ДОСТУПНЫЕ ПЛАГИНЫ: ${pluginsContext}
КАНДИДАТЫ ИЗ БАЗЫ (ТОП-50):
${JSON.stringify(samplesContext, null, 2)}

ОТВЕТЬ КРАТКО (стиль терминала):
1. Выбери 2-3 конкретных файла.
2. Объясни ПОЧЕМУ (опираясь на их DNA: частоту, атаку).
3. Дай совет по обработке (например: "Накинь на этот кик Distortion, у тебя есть FabFilter").
Используй русский язык. Не используй Markdown-заголовки, только текст.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Ошибка нейронной связи.";
  } catch (err) {
    console.error("AI Error:", err);
    return "СИСТЕМА: КРИТИЧЕСКИЙ СБОЙ ГЕНЕРАЦИИ ОТВЕТА.";
  }
};
