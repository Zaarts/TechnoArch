
import { AudioSample } from '../../types';

const NOTE_FREQ_MAP: Record<string, number> = {
  'C': 32.70, 'C#': 34.65, 'D': 36.71, 'D#': 38.89, 'E': 41.20, 'F': 43.65,
  'F#': 46.25, 'G': 49.00, 'G#': 51.91, 'A': 55.00, 'A#': 58.27, 'B': 61.74
};

export const localSearch = (samples: AudioSample[] | null | undefined, query: string, limit = 50): AudioSample[] => {
  if (!samples || samples.length === 0) return [];
  
  const cleanQuery = query.toLowerCase().trim();
  if (!cleanQuery) return samples.filter(s => !s.acousticTags.includes('#Silent')).slice(0, limit);
  
  const tokens = cleanQuery.split(/\s+/).filter(t => t.length > 0);
  const tagTokens = tokens.filter(t => t.startsWith('#'));
  const textTokens = tokens.filter(t => !t.startsWith('#'));

  const scored = samples.map(s => {
    let score = 0;
    const name = s.name.toLowerCase();
    const tags = [...s.sourceTags, ...s.acousticTags].map(t => t.toLowerCase());

    // Игнорируем тишину
    if (s.acousticTags.includes('#Silent') && !cleanQuery.includes('silent')) return { sample: s, score: -1 };

    // 1. Теги (Вес: 100)
    if (tagTokens.length > 0) {
      const matchCount = tagTokens.filter(tt => tags.some(t => t === tt || t.includes(tt))).length;
      if (matchCount === 0) return { sample: s, score: -1 };
      score += matchCount * 100;
    }

    // 2. Числовые ключевые слова (Вес: 150)
    textTokens.forEach(token => {
      // Частота
      if (token === 'sub' && s.dna.peakFrequency < 65 && s.dna.peakFrequency > 20) score += 150;
      if (token === 'high' && s.dna.peakFrequency > 200) score += 100;
      
      // Динамика
      if (token === 'short' && s.dna.attackMs < 12) score += 150;
      if (token === 'tight' && s.dna.attackMs < 8) score += 200;
      if (token === 'long' && s.dna.decayMs > 600) score += 150;
      
      // Текстура
      if (token === 'crunch' && s.dna.zeroCrossingRate > 0.35) score += 150;
      if (token === 'clean' && s.dna.zeroCrossingRate < 0.1) score += 100;

      // Имя (Вес: 50)
      if (name.includes(token)) score += 50;
    });

    // 3. Поиск по Нотам (Вес: 300)
    const noteToken = textTokens.find(t => NOTE_FREQ_MAP[t.toUpperCase()]);
    if (noteToken) {
      const targetHz = NOTE_FREQ_MAP[noteToken.toUpperCase()];
      const freq = s.dna.peakFrequency;
      const tolerance = 2.0;

      // Проверяем 3 октавы
      const match = [1, 2, 4].some(oct => Math.abs(freq - targetHz * oct) <= tolerance);
      if (match) score += 300;
    }

    return { sample: s, score };
  });

  return scored
    .filter(item => item.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.sample);
};
