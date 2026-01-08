
import { BRAND_DICTIONARY, GENRE_NORMALIZER, CATEGORY_SYNONYMS } from '../../constants';

// Регулярное выражение для поиска тональностей (C, A#m, Gmaj и т.д.)
const KEY_REGEX = /\b([A-G][#b]?(?:min|maj|m|M)?)\b/i;

export const normalizeTags = (path: string, fileName: string): { 
  tags: string[], 
  confidence: number, 
  isMasterTag: boolean,
  musicalKey?: string 
} => {
  const fullPath = `${path}/${fileName}`.toUpperCase();
  const parts = [...path.split(/[\/\\_-]/), ...fileName.split(/[\s\._-]/)];
  const tags = new Set<string>();
  let confidence = 0;
  let isMasterTag = false;

  // 1. Извлечение тональности
  const keyMatch = fileName.match(KEY_REGEX);
  const musicalKey = keyMatch ? keyMatch[1].toUpperCase() : undefined;

  // 2. Приоритетная проверка КАТЕГОРИЙ (MASTER TAG)
  for (const [key, value] of Object.entries(CATEGORY_SYNONYMS)) {
    if (fullPath.includes(key.toUpperCase())) {
      tags.add(`#${value}`);
      confidence = 100;
      isMasterTag = true;
    }
  }

  // 3. Бренды и Жанры
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
  });

  return {
    tags: Array.from(tags),
    confidence: Math.min(confidence, 100),
    isMasterTag,
    musicalKey
  };
};
