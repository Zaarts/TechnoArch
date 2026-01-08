
import { DNAProfile } from '../../types';

export const analyzeAudioBuffer = async (buffer: AudioBuffer): Promise<DNAProfile> => {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  
  // 1. Поиск пиковой амплитуды
  let maxAmp = 0;
  for (let i = 0; i < data.length; i++) {
    const amp = Math.abs(data[i]);
    if (amp > maxAmp) maxAmp = amp;
  }

  // 2. Zero Crossing Rate (Текстура: хруст/шум)
  let crossings = 0;
  for (let i = 1; i < data.length; i++) {
    if ((data[i] >= 0 && data[i-1] < 0) || (data[i] < 0 && data[i-1] >= 0)) {
      crossings++;
    }
  }
  const zcr = crossings / data.length;

  // 3. Spectral Centroid (Яркость) - упрощенный расчет через энергию частот
  let weightedSum = 0;
  let totalSum = 0;
  const fftSize = 1024;
  for (let i = 0; i < Math.min(data.length, fftSize); i++) {
      const mag = Math.abs(data[i]);
      weightedSum += i * mag;
      totalSum += mag;
  }
  const centroid = totalSum > 0 ? (weightedSum / totalSum) * (sampleRate / fftSize) : 0;

  // 4. ADSR (Attack / Decay)
  // Attack: время до 90% пика
  let attackIdx = 0;
  for (let i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) >= maxAmp * 0.9) {
          attackIdx = i;
          break;
      }
  }
  const attackMs = (attackIdx / sampleRate) * 1000;

  // Decay: время от пика до 10%
  let decayIdx = data.length;
  for (let i = attackIdx; i < data.length; i++) {
      if (Math.abs(data[i]) <= maxAmp * 0.1) {
          decayIdx = i;
          break;
      }
  }
  const decayMs = ((decayIdx - attackIdx) / sampleRate) * 1000;

  return {
    peakFrequency: (attackIdx > 0) ? (sampleRate / (attackIdx * 2 + 1)) : 60,
    spectralCentroid: centroid,
    attackMs,
    decayMs,
    zeroCrossingRate: zcr,
    brightness: Math.min(centroid / 8000, 1)
  };
};

export const getAcousticValidation = (dna: DNAProfile): string[] => {
  const tags: string[] = [];
  
  // Логика Veto Power (Приоритет 1: Текстура и Тембр)
  if (dna.spectralCentroid < 400 && dna.brightness < 0.2) tags.push('#Kick');
  else if (dna.spectralCentroid > 3000 || dna.zeroCrossingRate > 0.15) tags.push('#Hat');
  else if (dna.peakFrequency < 150 && dna.attackMs > 15) tags.push('#Bass');
  else tags.push('#Percussion');
  
  // Динамические характеристики (Приоритет 2)
  if (dna.attackMs < 4) tags.push('#Punchy');
  if (dna.decayMs > 600) tags.push('#LongTail');
  else if (dna.decayMs < 150) tags.push('#Tight');

  // Текстура
  if (dna.zeroCrossingRate > 0.2) tags.push('#Distorted');
  if (dna.brightness > 0.7) tags.push('#Airy');

  return tags;
};
