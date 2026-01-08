
import { CATEGORY_SYNONYMS, BRAND_DICTIONARY, GENRE_NORMALIZER } from '../../constants';

const LOCKED_KEYWORDS = ['KICK', 'BD', 'BASS', 'BS', 'VOCAL', 'VOX', 'VOICE', 'SNRE', 'SNARE'];

export const normalizeTags = (path: string, fileName: string): { 
  tags: string[], 
  confidence: number, 
  isLocked: boolean,
  masterCategory?: string,
  musicalKey?: string 
} => {
  const fullPath = `${path}/${fileName}`.toUpperCase();
  const tags = new Set<string>();
  let isLocked = false;
  let masterCategory: string | undefined;

  // 1. Поиск "Абсолютной Истины" (Locked Keywords)
  for (const [key, value] of Object.entries(CATEGORY_SYNONYMS)) {
    const k = key.toUpperCase();
    if (fullPath.includes(k)) {
      tags.add(`#${value}`);
      masterCategory = value;
      if (LOCKED_KEYWORDS.includes(k)) isLocked = true;
    }
  }

  // 2. Бренды и Жанры (Вспомогательные теги)
  const parts = fullPath.split(/[\/\\_\-\s\.]/);
  parts.forEach(p => {
    if (BRAND_DICTIONARY[p]) tags.add(`#${BRAND_DICTIONARY[p].replace(/\s/g, '_')}`);
    if (GENRE_NORMALIZER[p]) tags.add(`#${GENRE_NORMALIZER[p].replace(/\s/g, '_')}`);
  });

  return {
    tags: Array.from(tags),
    confidence: isLocked ? 60 : 20, // Базовый вес семантики
    isLocked,
    masterCategory
  };
};
