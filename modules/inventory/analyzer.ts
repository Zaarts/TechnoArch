
import { DNAProfile } from '../../types';

/**
 * Игнорирует тишину в начале файла (Silence Trimming)
 */
const findStartIdx = (data: Float32Array, threshold = 0.001): number => {
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > threshold) return i;
  }
  return 0;
};

/**
 * Оценка фундаментальной частоты (FRQ) через спектральный анализ транзиента
 */
const estimateFundamental = (data: Float32Array, startIdx: number, sampleRate: number): number => {
  const windowSize = 2048;
  if (data.length - startIdx < windowSize) return 0;

  const segment = data.slice(startIdx, startIdx + windowSize);
  
  // Метод Zero-Crossing для быстрого определения низких частот (Kicks/Bass)
  let crossings = 0;
  for (let i = 1; i < segment.length; i++) {
    if ((segment[i] > 0 && segment[i-1] <= 0) || (segment[i] < 0 && segment[i-1] >= 0)) {
      crossings++;
    }
  }
  
  const frequency = (crossings / 2) * (sampleRate / segment.length);
  // Техно-кики обычно живут в диапазоне 30-150Hz
  return Math.min(22050, Math.max(0, frequency));
};

export const analyzeAudioBuffer = async (buffer: AudioBuffer): Promise<DNAProfile> => {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  
  const startIdx = findStartIdx(data);
  const trimmedData = data.slice(startIdx);
  
  if (trimmedData.length < 128) {
    return { peakFrequency: 0, spectralCentroid: 0, attackMs: 0, decayMs: 0, zeroCrossingRate: 0, brightness: 0 };
  }

  // 1. Поиск пиковой амплитуды (Транзиент)
  let maxAmp = 0;
  let peakIdx = 0;
  const searchLimit = Math.min(trimmedData.length, Math.floor(sampleRate * 0.3)); // Первые 300мс
  for (let i = 0; i < searchLimit; i++) {
    const amp = Math.abs(trimmedData[i]);
    if (amp > maxAmp) {
      maxAmp = amp;
      peakIdx = i;
    }
  }

  // 2. Zero Crossing Rate (Текстура хруста)
  let crossings = 0;
  const analysisLen = Math.min(trimmedData.length, sampleRate);
  for (let i = 1; i < analysisLen; i++) {
    if ((trimmedData[i] > 0 && trimmedData[i-1] <= 0) || (trimmedData[i] < 0 && trimmedData[i-1] >= 0)) {
      crossings++;
    }
  }
  const zcr = crossings / analysisLen;

  // 3. Частотный анализ
  const peakFreq = estimateFundamental(data, startIdx, sampleRate);
  
  // Spectral Centroid (Яркость)
  let weightedSum = 0;
  let totalSum = 0;
  const step = Math.max(1, Math.floor(analysisLen / 1024));
  for (let i = 0; i < analysisLen; i += step) {
      const mag = Math.abs(trimmedData[i]);
      weightedSum += i * mag;
      totalSum += mag;
  }
  const centroid = totalSum > 0 ? (weightedSum / totalSum) * (sampleRate / analysisLen) : 0;

  // 4. ADSR (Precision Attack)
  // Время нарастания от 10% до 90% пиковой амплитуды
  let attackStartIdx = 0;
  for (let i = 0; i < peakIdx; i++) {
    if (Math.abs(trimmedData[i]) >= maxAmp * 0.1) {
      attackStartIdx = i;
      break;
    }
  }
  const attackMs = ((peakIdx - attackStartIdx) / sampleRate) * 1000;

  // Decay: от пика до 10% уровня
  let decayEndIdx = trimmedData.length;
  for (let i = peakIdx; i < trimmedData.length; i++) {
    if (Math.abs(trimmedData[i]) < maxAmp * 0.1) {
      decayEndIdx = i;
      break;
    }
  }
  const decayMs = ((decayEndIdx - peakIdx) / sampleRate) * 1000;

  return {
    peakFrequency: peakFreq,
    spectralCentroid: centroid,
    attackMs: Math.max(0.1, attackMs),
    decayMs: Math.max(1, decayMs),
    zeroCrossingRate: zcr,
    brightness: Math.min(centroid / 12000, 1)
  };
};

export const getAcousticValidation = (dna: DNAProfile): string[] => {
  const tags: string[] = [];
  
  if (dna.peakFrequency > 20 && dna.peakFrequency < 110 && dna.brightness < 0.25) tags.push('#Kick');
  else if (dna.brightness > 0.6 || dna.zeroCrossingRate > 0.3) tags.push('#Hat');
  else if (dna.peakFrequency > 30 && dna.peakFrequency < 200 && dna.attackMs > 20) tags.push('#Bass');
  else tags.push('#Percussion');
  
  if (dna.attackMs < 10) tags.push('#Hard_Punch');
  if (dna.decayMs > 1200) tags.push('#Deep_Atmosphere');
  if (dna.zeroCrossingRate > 0.4) tags.push('#Aggressive_Dist');

  return tags;
};
