
import { DNAProfile } from '../../types';

const findStartIdx = (data: Float32Array, threshold = 0.02): number => {
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > threshold) return i;
  }
  return 0;
};

const estimateFundamental = (data: Float32Array, startIdx: number, sampleRate: number, isKick: boolean): { freq: number, confidence: number } => {
  // Transient Focus: Анализируем только первые 150мс для определения высоты тона (фундамента)
  const analysisDurationMs = 150;
  const maxSamples = Math.floor(sampleRate * (analysisDurationMs / 1000));
  const windowSize = Math.min(4096, maxSamples); 
  
  const searchRangeMin = Math.floor(sampleRate / 500); // 500Hz
  const searchRangeMax = Math.floor(sampleRate / 25);  // 25Hz

  if (data.length - startIdx < windowSize + searchRangeMax) return { freq: 0, confidence: 0 };
  
  // Берем сегмент из самого начала (транзиент)
  const segment = data.slice(startIdx, startIdx + windowSize);
  let bestOffset = 0;
  let maxCorrelation = -Infinity;
  let secondMaxCorrelation = -Infinity;

  // Суб-басовый диапазон (30-90Hz) для Harmonic Masking
  const subRangeMin = Math.floor(sampleRate / 90);
  const subRangeMax = Math.floor(sampleRate / 30);

  for (let offset = searchRangeMin; offset < searchRangeMax; offset++) {
    let correlation = 0;
    for (let i = 0; i < windowSize; i++) {
      correlation += segment[i] * data[startIdx + i + offset];
    }
    
    // Harmonic Masking: Суб-бас — король. Приоритет 30-90Hz с множителем 3.0
    if (offset >= subRangeMin && offset <= subRangeMax) {
      correlation *= 3.0; 
    }

    if (correlation > maxCorrelation) {
      secondMaxCorrelation = maxCorrelation;
      maxCorrelation = correlation;
      bestOffset = offset;
    } else if (correlation > secondMaxCorrelation) {
      secondMaxCorrelation = correlation;
    }
  }

  const freq = bestOffset > 0 ? sampleRate / bestOffset : 0;
  
  // Расчет уверенности: отношение лучшего пика ко второму лучшему
  const ratio = maxCorrelation / (secondMaxCorrelation || 1);
  const confidence = maxCorrelation > 0 ? Math.min(100, Math.round(ratio * 35)) : 0;

  return { 
    freq: freq < 20 || freq > 1200 ? 0 : freq, 
    confidence: isNaN(confidence) ? 0 : confidence 
  };
};

export const analyzeAudioBuffer = async (buffer: AudioBuffer, sourceTags: string[]): Promise<{ dna: DNAProfile, confidence: number }> => {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const isKick = sourceTags.some(t => t.toUpperCase().includes('KICK'));
  
  const startIdx = findStartIdx(data, 0.03); 
  const trimmedData = data.slice(startIdx);
  
  if (trimmedData.length < 512 || Math.max(...trimmedData.slice(0, 1000).map(Math.abs)) < 0.01) {
    return { 
      dna: { peakFrequency: 0, spectralCentroid: 0, attackMs: 0, decayMs: 0, zeroCrossingRate: 0, brightness: 0 },
      confidence: 0
    };
  }

  // ADSR Analysis (Focus on transient for attack)
  const attackWindowSize = Math.floor(sampleRate * 0.1); 
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

  const { freq, confidence } = estimateFundamental(data, startIdx, sampleRate, isKick);
  
  let crossings = 0;
  const zcrLimit = Math.min(trimmedData.length, Math.floor(sampleRate * 0.05));
  for (let i = 1; i < zcrLimit; i++) {
    if ((trimmedData[i] > 0 && trimmedData[i-1] <= 0) || (trimmedData[i] < 0 && trimmedData[i-1] >= 0)) crossings++;
  }

  const brightness = Math.min((crossings / zcrLimit) * 6, 1);

  return {
    dna: {
      peakFrequency: freq,
      spectralCentroid: 0,
      attackMs: Math.max(0.1, attackMs),
      decayMs: Math.max(1, decayMs),
      zeroCrossingRate: crossings / zcrLimit,
      brightness
    },
    confidence
  };
};

export const getAcousticValidation = (dna: DNAProfile, sourceTags: string[], confidence: number): string[] => {
  const tags: string[] = [];
  
  if (dna.peakFrequency === 0) {
    tags.push('#Silent');
    return tags;
  }

  // Veto Logic: Если уверенность > 50%, мы чистим конфликтующие теги
  const isKick = sourceTags.some(t => t.toUpperCase().includes('KICK'));
  
  if (confidence > 50) {
    // Если это кик с высокой уверенностью, он не может быть хетом, если только яркость не зашкаливает (top 5%)
    if (isKick && dna.brightness < 0.9) {
      // Здесь мы могли бы удалять из sourceTags, но мы возвращаем новые акустические теги
      // которые дополняют или уточняют картину.
    }
  }

  if (dna.attackMs < 10) tags.push('#Tight');
  if (dna.peakFrequency < 60) tags.push('#Sub');
  if (dna.zeroCrossingRate > 0.4) tags.push('#Crunch');
  if (dna.brightness > 0.7) tags.push('#Bright');
  
  return tags;
};
