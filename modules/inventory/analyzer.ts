
import { DNAProfile } from '../../types';

const findStartIdx = (data: Float32Array, threshold = 0.02): number => {
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > threshold) return i;
  }
  return 0;
};

const estimateFundamental = (data: Float32Array, startIdx: number, sampleRate: number): number => {
  const windowSize = 4096; // Увеличено для точности низких частот
  const searchRangeMin = Math.floor(sampleRate / 400); // До 400Hz
  const searchRangeMax = Math.floor(sampleRate / 30);  // От 30Hz

  if (data.length - startIdx < windowSize + searchRangeMax) return 0;
  
  const segment = data.slice(startIdx, startIdx + windowSize);
  let bestOffset = 0;
  let maxCorrelation = -Infinity;

  // Автокорреляция с фокусом на суб-диапазон
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
  
  // 1. Тримминг тишины (Silence Trimming)
  const startIdx = findStartIdx(data, 0.05); 
  const trimmedData = data.slice(startIdx);
  
  if (trimmedData.length < 512) {
    return { peakFrequency: 0, spectralCentroid: 0, attackMs: 0, decayMs: 0, zeroCrossingRate: 0, brightness: 0 };
  }

  // 2. Точная Атака (Первые 150мс)
  const attackWindowSize = Math.floor(sampleRate * 0.15); 
  let maxAmp = 0;
  let peakIdx = 0;
  for (let i = 0; i < Math.min(trimmedData.length, attackWindowSize); i++) {
    const amp = Math.abs(trimmedData[i]);
    if (amp > maxAmp) { maxAmp = amp; peakIdx = i; }
  }
  const attackMs = (peakIdx / sampleRate) * 1000;

  // 3. Спад (Decay)
  let decayEndIdx = peakIdx;
  const decayThreshold = maxAmp * 0.05;
  for (let i = peakIdx; i < trimmedData.length; i++) {
    if (Math.abs(trimmedData[i]) < decayThreshold) {
      decayEndIdx = i;
      break;
    }
  }
  const decayMs = ((decayEndIdx - peakIdx) / sampleRate) * 1000;

  // 4. Фундаментал (Sub-Bass Priority)
  const peakFreq = estimateFundamental(data, startIdx, sampleRate);
  
  // 5. Текстура
  let crossings = 0;
  const analysisLimit = Math.min(trimmedData.length, sampleRate * 0.1);
  for (let i = 1; i < analysisLimit; i++) {
    if ((trimmedData[i] > 0 && trimmedData[i-1] <= 0) || (trimmedData[i] < 0 && trimmedData[i-1] >= 0)) crossings++;
  }

  return {
    peakFrequency: peakFreq,
    spectralCentroid: 0, // Placeholder
    attackMs: Math.max(0.1, attackMs),
    decayMs: Math.max(1, decayMs),
    zeroCrossingRate: crossings / analysisLimit,
    brightness: Math.min((crossings / analysisLimit) * 5, 1)
  };
};

export const getAcousticValidation = (dna: DNAProfile, existingTags: string[]): string[] => {
  const tags: string[] = [];
  
  // Tight vs Soft Logic
  if (dna.attackMs < 15) tags.push('#Tight');
  else tags.push('#Soft');

  // Sub Priority
  if (dna.peakFrequency > 30 && dna.peakFrequency < 65) tags.push('#Deep_Sub');
  if (dna.zeroCrossingRate > 0.4) tags.push('#Distorted');

  return tags;
};
