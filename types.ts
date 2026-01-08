
export interface DNAProfile {
  peakFrequency: number;
  spectralCentroid: number;
  attackMs: number;
  decayMs: number;
  zeroCrossingRate: number;
  brightness: number; // 0-1
}

export type SoundType = 'one-shot' | 'loop' | 'stem' | 'midi' | 'unknown';

export interface AudioSample {
  id: string;
  name: string;
  path: string;
  fullPath: string;
  type: SoundType;
  sourceTags: string[];
  acousticTags: string[];
  dna: DNAProfile;
  confidenceScore: number;
  handle: FileSystemFileHandle | File;
  musicalKey?: string;
}

export interface Plugin {
  id: string;
  name: string;
  type: 'EQ' | 'Dynamics' | 'Distortion' | 'Reverb' | 'Delay' | 'Synth' | 'Other';
}

export interface ScanProgress {
  totalFiles: number;
  processedFiles: number;
  currentFile: string;
  isScanning: boolean;
  filteredCount: number;
}
