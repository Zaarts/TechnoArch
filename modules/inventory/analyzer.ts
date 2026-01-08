
import { DNAProfile } from '../../types';

/**
 * Находит индекс начала звука по порогу -20dB (0.1 амплитуда)
 */
const findStartIdx = (data: Float32Array, threshold = 0.05): number => {
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > threshold) return i;
  }
  return 0;
};

/**
 * Улучшенное определение фундаментальной частоты (Sub-Bass Priority).
 * Использует метод автокорреляции для поиска самого длинного периода (низкой частоты),
 * игнорируя высокочастотные гармоники дисторшна.
 */
const estimateFundamental = (data: Float32Array, startIdx: number, sampleRate: number): number => {
  const windowSize = 2048; // Достаточно для частот от 20Hz
  const searchRangeMin = Math.floor(sampleRate / 300); // ~300Hz макс для саб-анализа
  const searchRangeMax = Math.floor(sampleRate / 30);  // ~30Hz мин

  if (data.length - startIdx < windowSize + searchRangeMax) return 0;
  
  const segment = data.slice(startIdx, startIdx + windowSize);
  let bestOffset = 0;
  let maxCorrelation = -Infinity;

  // Ищем корреляцию в диапазоне саб-баса (30Hz - 300Hz)
  for (let offset = searchRangeMin; offset < searchRangeMax; offset++) {
    let correlation = 0;
    for (let i = 0; i < windowSize; i++) {
      correlation += segment[i] * data[startIdx + i + offset];
    }
    
    if (correlation > maxCorrelation) {
      maxCorrelation = correlation;
      bestOffset = offset;
    }
  }

  return bestOffset > 0 ? sampleRate / bestOffset : 0;
};

export const analyzeAudioBuffer = async (buffer: AudioBuffer): Promise<DNAProfile> => {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  
  // 1. Порог начала -20dB для точности транзиента
  const startIdx = findStartIdx(data, 0.08); 
  const trimmedData = data.slice(startIdx);
  
  if (trimmedData.length < 512) {
    return { peakFrequency: 0, spectralCentroid: 0, attackMs: 0, decayMs: 0, zeroCrossingRate: 0, brightness: 0 };
  }

  // 2. Определение Атаки (Attack Detection)
  // Для киков мы смотрим только на первые 100мс, чтобы не "схватить" хвост как часть атаки
  const attackWindowSize = Math.floor(sampleRate * 0.1); 
  let maxAmp = 0;
  let peakIdx = 0;

  for (let i = 0; i < Math.min(trimmedData.length, attackWindowSize); i++) {
    const amp = Math.abs(trimmedData[i]);
    if (amp > maxAmp) {
      maxAmp = amp;
      peakIdx = i;
    }
  }

  // Если пик не найден в окне 100мс, расширяем поиск (для атмосфер/пэдов)
  if (maxAmp < 0.1) {
    for (let i = 0; i < Math.min(trimmedData.length, sampleRate * 0.5); i++) {
      const amp = Math.abs(trimmedData[i]);
      if (amp > maxAmp) {
        maxAmp = amp;
        peakIdx = i;
      }
    }
  }

  const attackMs = (peakIdx / sampleRate) * 1000;

  // 3. Определение Спада (Decay Detection)
  let decayEndIdx = peakIdx;
  const decayThreshold = maxAmp * 0.1; // -20dB от пика
  for (let i = peakIdx; i < trimmedData.length; i++) {
    if (Math.abs(trimmedData[i]) < decayThreshold) {
      decayEndIdx = i;
      break;
    }
    if (i - peakIdx > sampleRate * 2) break; // Лимит 2 секунды
  }
  const decayMs = ((decayEndIdx - peakIdx) / sampleRate) * 1000;

  // 4. Фундаментальная частота (с фокусом на SUB)
  const peakFreq = estimateFundamental(data, startIdx, sampleRate);
  
  // 5. Яркость (Spectral Centroid) и Текстура
  let weightedSum = 0;
  let totalSum = 0;
  const centroidWindow = Math.min(trimmedData.length, Math.floor(sampleRate * 0.2));
  for (let i = 0; i < centroidWindow; i += 10) {
    const mag = Math.abs(trimmedData[i]);
    weightedSum += i * mag;
    totalSum += mag;
  }
  const centroid = totalSum > 0 ? (weightedSum / totalSum) * (sampleRate / centroidWindow) : 0;

  let crossings = 0;
  const zcrWindow = Math.min(trimmedData.length, Math.floor(sampleRate * 0.1));
  for (let i = 1; i < zcrWindow; i++) {
    if ((trimmedData[i] > 0 && trimmedData[i-1] <= 0) || (trimmedData[i] < 0 && trimmedData[i-1] >= 0)) {
      crossings++;
    }
  }
  const zcr = crossings / zcrWindow;

  return {
    peakFrequency: peakFreq,
    spectralCentroid: centroid,
    attackMs: Math.max(0.1, attackMs), // Минимум 0.1мс для исключения 0
    decayMs: Math.max(1, decayMs),
    zeroCrossingRate: zcr,
    brightness: Math.min(centroid / 8000, 1) // Нормализация яркости
  };
};

export const getAcousticValidation = (dna: DNAProfile, existingTags: string[]): string[] => {
  const tags: string[] = [];
  
  const isKick = existingTags.includes('#Kick');
  const isBass = existingTags.includes('#Bass');

  // Уточнение категории на основе новых точных данных
  if (!isKick && !isBass) {
    if (dna.peakFrequency > 35 && dna.peakFrequency < 90 && dna.attackMs < 15) tags.push('#Kick');
    else if (dna.peakFrequency > 30 && dna.peakFrequency < 150 && dna.attackMs >= 15) tags.push('#Bass');
    else if (dna.brightness > 0.6) tags.push('#Hat');
    else tags.push('#Percussion');
  }

  // Дескрипторы для фильтрации
  if (dna.attackMs < 5) tags.push('#Punchy');
  if (dna.peakFrequency < 50) tags.push('#Subby');
  if (dna.zeroCrossingRate > 0.35) tags.push('#Gritty');
  if (dna.decayMs > 1000) tags.push('#Long');
  if (dna.decayMs < 150) tags.push('#Tight');

  return tags;
};
