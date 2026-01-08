
import { BRAND_DICTIONARY, GENRE_NORMALIZER, CATEGORY_SYNONYMS } from '../../constants';

export const normalizeTags = (path: string, fileName: string): { tags: string[], confidence: number } => {
  const parts = [...path.split('/'), ...fileName.split(/[\s_-]/)];
  const tags = new Set<string>();
  let confidence = 0;

  parts.forEach(part => {
    const p = part.toUpperCase();
    
    // Check Brands
    if (BRAND_DICTIONARY[p]) {
      tags.add(`#${BRAND_DICTIONARY[p].replace(/\s/g, '_')}`);
      confidence += 20;
    }

    // Check Genres
    if (GENRE_NORMALIZER[p]) {
      tags.add(`#${GENRE_NORMALIZER[p].replace(/\s/g, '_')}`);
      confidence += 15;
    }

    // Check Categories
    if (CATEGORY_SYNONYMS[p]) {
      tags.add(`#${CATEGORY_SYNONYMS[p]}`);
      confidence += 25;
    }

    // Catch raw words
    if (p.length > 2 && !BRAND_DICTIONARY[p] && !GENRE_NORMALIZER[p]) {
        // Simple heuristic for other possible tags
        if (['RAW', 'DRY', 'WET', 'ANALOG', 'DIGITAL', 'MODULAR'].includes(p)) {
            tags.add(`#${p}`);
            confidence += 5;
        }
    }
  });

  return {
    tags: Array.from(tags),
    confidence: Math.min(confidence, 100)
  };
};
