
import { BRAND_DICTIONARY, GENRE_NORMALIZER, CATEGORY_SYNONYMS } from '../../constants';

export const normalizeTags = (path: string, fileName: string): { tags: string[], confidence: number, isMasterTag: boolean } => {
  const fullPath = `${path}/${fileName}`.toUpperCase();
  const parts = [...path.split(/[\/\\_-]/), ...fileName.split(/[\s\._-]/)];
  const tags = new Set<string>();
  let confidence = 0;
  let isMasterTag = false;

  // 1. Приоритетная проверка КАТЕГОРИЙ (KICK, BASS, VOCAL) - MASTER TAG
  for (const [key, value] of Object.entries(CATEGORY_SYNONYMS)) {
    if (fullPath.includes(key.toUpperCase())) {
      tags.add(`#${value}`);
      confidence = 100; // Максимальная уверенность для явных имен
      isMasterTag = true;
    }
  }

  // 2. Бренды и Жанры
  parts.forEach(part => {
    const p = part.toUpperCase();
    if (BRAND_DICTIONARY[p]) {
      tags.add(`#${BRAND_DICTIONARY[p].replace(/\s/g, '_')}`);
      confidence = Math.max(confidence, 50);
    }
    if (GENRE_NORMALIZER[p]) {
      tags.add(`#${GENRE_NORMALIZER[p].replace(/\s/g, '_')}`);
      confidence = Math.max(confidence, 40);
    }
    if (['RAW', 'DRY', 'WET', 'ANALOG', 'DIGITAL', 'MODULAR', 'LOFI'].includes(p)) {
      tags.add(`#${p}`);
    }
  });

  return {
    tags: Array.from(tags),
    confidence: Math.min(confidence, 100),
    isMasterTag
  };
};
