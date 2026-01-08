
import { DNAProfile } from '../../types';

const findStartIdx = (data: Float32Array, threshold = 0.001): number => {
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > threshold) return i;
  }
  return 0;
};

const estimateFundamental = (data: Float32Array, startIdx: number, sampleRate: number): number => {
  const windowSize = 2048;
  if (data.length - startIdx < windowSize) return 0;
  const segment = data.slice(startIdx, startIdx + windowSize);
  let crossings = 0;
  for (let i = 1; i < segment.length; i++) {
    if ((segment[i] > 0 && segment[i-1] <= 0) || (segment[i] < 0 && segment[i-1] >= 0)) crossings++;
  }
  return (crossings / 2) * (sampleRate / segment.length);
};

export const analyzeAudioBuffer = async (buffer: AudioBuffer): Promise<DNAProfile> => {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const startIdx = findStartIdx(data);
  const trimmedData = data.slice(startIdx);
  
  if (trimmedData.length < 128) {
    return { peakFrequency: 0, spectralCentroid: 0, attackMs: 0, decayMs: 0, zeroCrossingRate: 0, brightness: 0 };
  }

  let maxAmp = 0;
  let peakIdx = 0;
  const searchLimit = Math.min(trimmedData.length, Math.floor(sampleRate * 0.3));
  for (let i = 0; i < searchLimit; i++) {
    const amp = Math.abs(trimmedData[i]);
    if (amp > maxAmp) { maxAmp = amp; peakIdx = i; }
  }

  let crossings = 0;
  const analysisLen = Math.min(trimmedData.length, sampleRate);
  for (let i = 1; i < analysisLen; i++) {
    if ((trimmedData[i] > 0 && trimmedData[i-1] <= 0) || (trimmedData[i] < 0 && trimmedData[i-1] >= 0)) crossings++;
  }
  const zcr = crossings / analysisLen;

  const peakFreq = estimateFundamental(data, startIdx, sampleRate);
  
  let weightedSum = 0;
  let totalSum = 0;
  const step = Math.max(1, Math.floor(analysisLen / 1024));
  for (let i = 0; i < analysisLen; i += step) {
    const mag = Math.abs(trimmedData[i]);
    weightedSum += i * mag;
    totalSum += mag;
  }
  const centroid = totalSum > 0 ? (weightedSum / totalSum) * (sampleRate / analysisLen) : 0;

  let attackStartIdx = 0;
  for (let i = 0; i < peakIdx; i++) {
    if (Math.abs(trimmedData[i]) >= maxAmp * 0.1) { attackStartIdx = i; break; }
  }
  const attackMs = ((peakIdx - attackStartIdx) / sampleRate) * 1000;

  let decayEndIdx = trimmedData.length;
  for (let i = peakIdx; i < trimmedData.length; i++) {
    if (Math.abs(trimmedData[i]) < maxAmp * 0.1) { decayEndIdx = i; break; }
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

export const getAcousticValidation = (dna: DNAProfile, existingTags: string[]): string[] => {
  const tags: string[] = [];
  
  // VETO POWER: Если Master Tag уже определен (напр. Vocal), анализатор не помечает файл как Hat
  const hasMasterType = existingTags.some(t => ['#Kick', '#Bass', '#Hat', '#Vocal', '#Snare'].includes(t));

  if (!hasMasterType) {
    if (dna.peakFrequency > 20 && dna.peakFrequency < 115 && dna.brightness < 0.22) tags.push('#Kick');
    else if (dna.brightness > 0.68 || dna.zeroCrossingRate > 0.35) tags.push('#Hat');
    else if (dna.peakFrequency > 30 && dna.peakFrequency < 210 && dna.attackMs > 18) tags.push('#Bass');
    else tags.push('#Percussion');
  }

  // Дополнительные теги
  if (dna.attackMs < 7) tags.push('#Punchy');
  if (dna.decayMs > 1200) tags.push('#Ambient');
  if (dna.zeroCrossingRate > 0.45) tags.push('#Gritty');

  return tags;
};
