
import { AudioSample } from '../../types';

// Карта частот для техно (суб и первая октава)
const NOTE_FREQ_MAP: Record<string, { min: number, max: number }> = {
  'C': { min: 30, max: 35 },
  'C#': { min: 33, max: 37 },
  'D': { min: 35, max: 39 },
  'D#': { min: 37, max: 41 },
  'E': { min: 40, max: 43 },
  'F': { min: 42, max: 45 },
  'F#': { min: 44, max: 48 },
  'G': { min: 47, max: 51 },
  'G#': { min: 50, max: 54 },
  'A': { min: 53, max: 57 },
  'A#': { min: 56, max: 60 },
  'B': { min: 59, max: 63 },
};

export const localSearch = (samples: AudioSample[] | null | undefined, query: string, limit = 50): AudioSample[] => {
  if (!samples || samples.length === 0) return [];
  if (!query.trim()) return samples.filter(s => !s.acousticTags.includes('#Silent')).slice(0, limit);
  
  const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  const tagTokens = tokens.filter(t => t.startsWith('#'));
  const textTokens = tokens.filter(t => !t.startsWith('#'));

  // Проверка на поиск ноты (напр. "note f" или "f note")
  let targetFreqRange: { min: number, max: number } | null = null;
  if (textTokens.includes('note')) {
    const noteToken = textTokens.find(t => NOTE_FREQ_MAP[t.toUpperCase()]);
    if (noteToken) {
      targetFreqRange = NOTE_FREQ_MAP[noteToken.toUpperCase()];
    }
  }

  const scored = samples.map(s => {
    let score = 0;
    const sampleName = s.name.toLowerCase();
    const allTags = [...(s.sourceTags || []), ...(s.acousticTags || [])].map(t => t.toLowerCase());

    // Игнорируем тишину, если не запрашивали специально
    if (s.acousticTags.includes('#Silent') && !query.includes('silent')) return { sample: s, score: -1 };

    // 1. Фильтр по тегам
    if (tagTokens.length > 0) {
      const matchedAll = tagTokens.every(tt => allTags.some(at => at === tt || at.includes(tt)));
      if (!matchedAll) return { sample: s, score: -1 };
      score += 100;
    }

    // 2. Поиск по частоте ноты
    if (targetFreqRange) {
      const freq = s.dna.peakFrequency;
      // Проверяем фундаментальную частоту (и октавы 2x, 4x)
      if ((freq >= targetFreqRange.min && freq <= targetFreqRange.max) ||
          (freq >= targetFreqRange.min * 2 && freq <= targetFreqRange.max * 2) ||
          (s.musicalKey?.toUpperCase() === tokens.find(t => NOTE_FREQ_MAP[t.toUpperCase()])?.toUpperCase())) {
        score += 200;
      }
    }

    // 3. Поиск по тексту
    textTokens.forEach(token => {
      if (sampleName.includes(token)) score += 50;
      if (allTags.some(at => at.includes(token))) score += 30;
      
      if (token === 'fast' && s.dna.attackMs < 6) score += 40;
      if (token === 'short' && s.dna.decayMs < 100) score += 40;
      if (token === 'heavy' && s.dna.peakFrequency < 90) score += 40;
      if (token === 'tight' && s.dna.attackMs < 15) score += 50;
    });

    return { sample: s, score };
  });

  return scored
    .filter(item => item.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.sample);
};
