
import { DNAProfile } from '../../types';

const findStartIdx = (data: Float32Array, threshold = 0.02): number => {
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > threshold) return i;
  }
  return 0;
};

const estimateFundamental = (data: Float32Array, startIdx: number, sampleRate: number, isKick: boolean): number => {
  const windowSize = 8192; // Увеличено для сверхточного анализа низких частот
  const searchRangeMin = Math.floor(sampleRate / 500); // До 500Hz
  const searchRangeMax = Math.floor(sampleRate / 20);  // От 20Hz

  if (data.length - startIdx < windowSize + searchRangeMax) return 0;
  
  const segment = data.slice(startIdx, startIdx + windowSize);
  let bestOffset = 0;
  let maxCorrelation = -Infinity;

  // Если это кик, сначала ищем в диапазоне 30-100Hz с повышенным весом
  const subRangeMin = Math.floor(sampleRate / 100);
  const subRangeMax = Math.floor(sampleRate / 30);

  for (let offset = searchRangeMin; offset < searchRangeMax; offset++) {
    let correlation = 0;
    for (let i = 0; i < windowSize; i++) {
      correlation += segment[i] * data[startIdx + i + offset];
    }
    
    // Low-Frequency Biasing: Усиливаем корреляцию в суб-диапазоне для киков
    if (isKick && offset >= subRangeMin && offset <= subRangeMax) {
      correlation *= 1.5; 
    }

    if (correlation > maxCorrelation) {
      maxCorrelation = correlation;
      bestOffset = offset;
    }
  }

  const freq = bestOffset > 0 ? sampleRate / bestOffset : 0;
  return freq < 20 ? 0 : freq; // Игнорируем шум ниже 20Hz
};

export const analyzeAudioBuffer = async (buffer: AudioBuffer, sourceTags: string[]): Promise<DNAProfile> => {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const isKick = sourceTags.some(t => t.toUpperCase().includes('KICK'));
  
  const startIdx = findStartIdx(data, 0.03); 
  const trimmedData = data.slice(startIdx);
  
  if (trimmedData.length < 512 || Math.max(...trimmedData.slice(0, 1000).map(Math.abs)) < 0.01) {
    return { peakFrequency: 0, spectralCentroid: 0, attackMs: 0, decayMs: 0, zeroCrossingRate: 0, brightness: 0 };
  }

  const attackWindowSize = Math.floor(sampleRate * 0.15); 
  let maxAmp = 0;
  let peakIdx = 0;
  for (let i = 0; i < Math.min(trimmedData.length, attackWindowSize); i++) {
    const amp = Math.abs(trimmedData[i]);
    if (amp > maxAmp) { maxAmp = amp; peakIdx = i; }
  }
  const attackMs = (peakIdx / sampleRate) * 1000;

  let decayEndIdx = peakIdx;
  const decayThreshold = maxAmp * 0.05;
  for (let i = peakIdx; i < trimmedData.length; i++) {
    if (Math.abs(trimmedData[i]) < decayThreshold) {
      decayEndIdx = i;
      break;
    }
  }
  const decayMs = ((decayEndIdx - peakIdx) / sampleRate) * 1000;

  const peakFreq = estimateFundamental(data, startIdx, sampleRate, isKick);
  
  let crossings = 0;
  const analysisLimit = Math.min(trimmedData.length, sampleRate * 0.1);
  for (let i = 1; i < analysisLimit; i++) {
    if ((trimmedData[i] > 0 && trimmedData[i-1] <= 0) || (trimmedData[i] < 0 && trimmedData[i-1] >= 0)) crossings++;
  }

  return {
    peakFrequency: peakFreq,
    spectralCentroid: 0,
    attackMs: Math.max(0.1, attackMs),
    decayMs: Math.max(1, decayMs),
    zeroCrossingRate: crossings / analysisLimit,
    brightness: Math.min((crossings / analysisLimit) * 5, 1)
  };
};

export const getAcousticValidation = (dna: DNAProfile): string[] => {
  const tags: string[] = [];
  
  if (dna.peakFrequency === 0 || dna.decayMs < 5) {
    tags.push('#Silent');
    return tags;
  }

  if (dna.attackMs < 15) tags.push('#Tight');
  else tags.push('#Soft');

  if (dna.peakFrequency > 30 && dna.peakFrequency < 65) tags.push('#Deep_Sub');
  if (dna.zeroCrossingRate > 0.4) tags.push('#Distorted');

  return tags;
};
