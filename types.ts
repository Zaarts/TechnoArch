
export interface DNAProfile {
  peakFrequency: number;
  spectralCentroid: number;
  attackMs: number;
  decayMs: number;
  zeroCrossingRate: number;
  brightness: number; // 0-1
}

export interface AudioSample {
  id: string;
  name: string;
  path: string;
  fullPath: string;
  type: 'one-shot' | 'loop' | 'unknown';
  sourceTags: string[];
  acousticTags: string[];
  dna: DNAProfile;
  confidenceScore: number;
  handle: FileSystemFileHandle;
}

export interface ScanProgress {
  totalFiles: number;
  processedFiles: number;
  currentFile: string;
  isScanning: boolean;
}

export enum SoundCategory {
  KICK = 'Kick',
  BASS = 'Bass',
  HAT = 'Hat',
  PERC = 'Percussion',
  ATMOS = 'Atmos',
  VOCAL = 'Vocal',
  UNKNOWN = 'Unknown'
}
