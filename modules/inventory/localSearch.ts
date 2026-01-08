
import { AudioSample } from '../../types';

export const localSearch = (samples: AudioSample[], query: string, limit = 50): AudioSample[] => {
  if (!query.trim()) return samples.slice(0, limit);
  
  const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  const tagTokens = tokens.filter(t => t.startsWith('#'));
  const textTokens = tokens.filter(t => !t.startsWith('#'));

  const scored = samples.map(s => {
    let score = 0;
    const sampleName = s.name.toLowerCase();
    const allTags = [...s.sourceTags, ...s.acousticTags].map(t => t.toLowerCase());

    // 1. Фильтр по тегам (обязательное совпадение всех тегов из запроса)
    if (tagTokens.length > 0) {
      const matchedAll = tagTokens.every(tt => allTags.some(at => at === tt || at.includes(tt)));
      if (!matchedAll) return { sample: s, score: -1 };
      score += 100;
    }

    // 2. Поиск по тексту и ДНК-семантике
    textTokens.forEach(token => {
      if (sampleName.includes(token)) score += 50;
      if (allTags.some(at => at.includes(token))) score += 30;
      
      // Смарт-фильтры по характеристикам
      if (token === 'fast' && s.dna.attackMs < 6) score += 40;
      if (token === 'short' && s.dna.decayMs < 100) score += 40;
      if (token === 'heavy' && s.dna.peakFrequency < 90) score += 40;
      if (token === 'dark' && s.dna.brightness < 0.2) score += 40;
      if (token === 'bright' && s.dna.brightness > 0.7) score += 40;
    });

    return { sample: s, score };
  });

  return scored
    .filter(item => item.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.sample);
};
