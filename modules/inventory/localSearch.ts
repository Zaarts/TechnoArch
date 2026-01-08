
import { AudioSample } from '../../types';

export const localSearch = (samples: AudioSample[], query: string, limit = 50): AudioSample[] => {
  const q = query.toLowerCase();
  
  // Оцениваем релевантность
  const scored = samples.map(s => {
    let score = 0;
    if (s.name.toLowerCase().includes(q)) score += 50;
    if (s.sourceTags.some(t => t.toLowerCase().includes(q))) score += 30;
    if (s.acousticTags.some(t => t.toLowerCase().includes(q))) score += 30;
    
    // Поиск по числовым характеристикам через ключевые слова
    if (q.includes('fast') || q.includes('short') || q.includes('tight')) {
      if (s.dna.attackMs < 5) score += 20;
    }
    if (q.includes('heavy') || q.includes('deep') || q.includes('low')) {
      if (s.dna.peakFrequency < 100) score += 20;
    }
    
    return { sample: s, score };
  });

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.sample);
};
