
import { DNAProfile } from '../../types';

const findStartIdx = (data: Float32Array, threshold = 0.02): number => {
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > threshold) return i;
  }
  return 0;
};

// Нормализация амплитуды для корректного анализа тихих записей
const normalizeBuffer = (data: Float32Array): Float32Array => {
  let max = 0;
  for (let i = 0; i < data.length; i++) {
    const abs = Math.abs(data[i]);
    if (abs > max) max = abs;
  }
  if (max === 0) return data;
  const result = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) result[i] = data[i] / max;
  return result;
};

const estimateFundamental = (data: Float32Array, startIdx: number, sampleRate: number): { freq: number, score: number } => {
  // Final Precision: Анализируем только ПЕРВЫЕ 100мс (Транзиент)
  const windowMs = 100;
  const windowSamples = Math.floor(sampleRate * (windowMs / 1000));
  const fftSize = 4096;
  const segment = data.slice(startIdx, startIdx + Math.min(windowSamples, data.length - startIdx));
  
  if (segment.length < 512) return { freq: 0, score: 0 };

  const searchMin = Math.floor(sampleRate / 500); // 500Hz
  const searchMax = Math.floor(sampleRate / 25);  // 25Hz
  
  let bestOffset = 0;
  let maxCorr = -Infinity;
  let secondCorr = -Infinity;

  for (let offset = searchMin; offset < searchMax; offset++) {
    let corr = 0;
    for (let i = 0; i < Math.min(fftSize, segment.length - offset); i++) {
      corr += segment[i] * segment[i + offset];
    }
    // Sub-Bass Bias (30-80Hz)
    if (offset >= Math.floor(sampleRate/80) && offset <= Math.floor(sampleRate/30)) corr *= 2.5;

    if (corr > maxCorr) { secondCorr = maxCorr; maxCorr = corr; bestOffset = offset; }
    else if (corr > secondCorr) { secondCorr = corr; }
  }

  const freq = bestOffset > 0 ? sampleRate / bestOffset : 0;
  const score = maxCorr > 0 ? (maxCorr / (secondCorr || 1)) : 0;
  return { freq: (freq < 20 || freq > 1200) ? 0 : freq, score };
};

export const analyzeAudioBuffer = async (buffer: AudioBuffer, sourceTags: string[], semanticData: { isLocked: boolean, masterCategory?: string }): Promise<{ dna: DNAProfile, confidence: number }> => {
  let data = buffer.getChannelData(0);
  data = normalizeBuffer(data); // Нормализация перед DSP
  const sampleRate = buffer.sampleRate;
  const startIdx = findStartIdx(data, 0.05);
  const trimmed = data.slice(startIdx);

  if (trimmed.length < 512) return { dna: { peakFrequency: 0, spectralCentroid: 0, attackMs: 0, decayMs: 0, zeroCrossingRate: 0, brightness: 0 }, confidence: 0 };

  // 1. Атака (ADSR)
  let peakIdx = 0; let maxAmp = 0;
  const atkWindow = Math.floor(sampleRate * 0.08); // 80ms window for attack peak
  for (let i = 0; i < Math.min(trimmed.length, atkWindow); i++) {
    const a = Math.abs(trimmed[i]);
    if (a > maxAmp) { maxAmp = a; peakIdx = i; }
  }
  const attackMs = (peakIdx / sampleRate) * 1000;

  // 2. Частота (Fundamental)
  const { freq, score: freqScore } = estimateFundamental(data, startIdx, sampleRate);

  // 3. Текстура (ZCR)
  let crossings = 0;
  const zcrSize = Math.min(trimmed.length, Math.floor(sampleRate * 0.05));
  for (let i = 1; i < zcrSize; i++) if ((trimmed[i]>0 && trimmed[i-1]<=0) || (trimmed[i]<0 && trimmed[i-1]>=0)) crossings++;
  const brightness = Math.min((crossings / zcrSize) * 6, 1);

  // 4. Расчет Confidence (The Truth Math)
  let confidence = semanticData.isLocked ? 60 : 20;
  
  // Zone Consistency (+30)
  if (semanticData.masterCategory === 'Kick' || semanticData.masterCategory === 'Bass') {
    if (freq > 0 && freq < 150) confidence += 30;
  } else if (semanticData.masterCategory === 'Hat') {
    if (brightness > 0.6) confidence += 30;
  } else if (semanticData.masterCategory === 'Vocal') {
    if (freq > 150 && freq < 1000) confidence += 30;
  }

  // Transient Consistency (+10)
  if (semanticData.masterCategory === 'Kick' && attackMs < 15) confidence += 10;
  
  return {
    dna: { peakFrequency: freq, spectralCentroid: 0, attackMs, decayMs: 0, zeroCrossingRate: crossings/zcrSize, brightness },
    confidence: Math.min(100, confidence)
  };
};

export const getAcousticValidation = (dna: DNAProfile, masterCategory?: string): string[] => {
  const tags: string[] = [];
  const freq = dna.peakFrequency;

  if (freq === 0 && dna.brightness < 0.1) { tags.push('#Silent'); return tags; }

  // Frequency Zoning Rules
  if (freq > 0 && freq < 150) {
    if (masterCategory !== 'Bass') tags.push('#Kick');
    if (dna.zeroCrossingRate > 0.3) tags.push('#Grit'); // Нойз в сабе = Grit, а не Hat
  } else if (freq >= 150 && freq < 3000) {
    tags.push('#MidRange');
  } else if (dna.brightness > 0.7 || freq >= 3000) {
    // Запрещено вешать Hat на залоченные низкочастотные категории
    if (masterCategory !== 'Kick' && masterCategory !== 'Bass') tags.push('#Hat');
  }

  if (dna.attackMs < 10) tags.push('#Tight');
  return tags;
};
