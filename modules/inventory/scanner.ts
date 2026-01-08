
import { AudioSample, ScanProgress, SoundType } from '../../types';
import { normalizeTags } from './normalizer';
import { analyzeAudioBuffer, getAcousticValidation } from './analyzer';

const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

const BLACKLIST_FOLDERS = ['/BACKUP/', '/SETTINGS/', '/DATA/', '/SYSTEM/', '/__MACOSX/', '/.GIT/'];
const WHITELIST_EXTENSIONS = ['.WAV', '.MP3', '.FLAC', '.AIF', '.AIFF', '.OGG', '.MID', '.MIDI'];

const isBlacklisted = (path: string): boolean => {
  const up = path.toUpperCase();
  return BLACKLIST_FOLDERS.some(f => up.includes(f));
};

async function processFile(file: File, relativePath: string, handle: FileSystemFileHandle | File): Promise<AudioSample | null> {
  const ext = file.name.substring(file.name.lastIndexOf('.')).toUpperCase();
  if (!WHITELIST_EXTENSIONS.includes(ext) || isBlacklisted(relativePath)) return null;

  try {
    const { tags: sourceTags, confidence, isMasterTag, musicalKey } = normalizeTags(relativePath, file.name);

    if (ext === '.MID' || ext === '.MIDI') {
      return { id: crypto.randomUUID(), name: file.name, path: relativePath, fullPath: `${relativePath}/${file.name}`, type: 'midi', sourceTags: ['#MIDI', ...sourceTags], acousticTags: [], dna: { peakFrequency: 0, spectralCentroid: 0, attackMs: 0, decayMs: 0, zeroCrossingRate: 0, brightness: 0 }, confidenceScore: 100, handle, musicalKey };
    }

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    
    let soundType: SoundType = audioBuffer.duration > 15 ? 'stem' : audioBuffer.duration >= 2 ? 'loop' : 'one-shot';
    sourceTags.push(`#${soundType.toUpperCase()}`);

    const dna = await analyzeAudioBuffer(audioBuffer);
    const acousticTags = getAcousticValidation(dna, isMasterTag ? sourceTags : []);
    
    return { id: crypto.randomUUID(), name: file.name, path: relativePath, fullPath: `${relativePath}/${file.name}`, type: soundType, sourceTags, acousticTags, dna, confidenceScore: confidence, handle, musicalKey };
  } catch { return null; }
}

export async function scanFolder(
  dirHandle: FileSystemDirectoryHandle, 
  onProgress: (p: ScanProgress) => void,
  onBatch: (samples: AudioSample[]) => void
): Promise<AudioSample[]> {
  const allSamples: AudioSample[] = [];
  let processed = 0;
  let filtered = 0;

  const queue: { handle: FileSystemFileHandle; path: string }[] = [];

  // Phase 1: Rapid Filter & Indexing
  async function collect(handle: FileSystemDirectoryHandle, currentPath: string) {
    for await (const entry of handle.values()) {
      if (entry.kind === 'directory') {
        const nextPath = `${currentPath}/${entry.name}`;
        if (!isBlacklisted(nextPath)) await collect(entry as FileSystemDirectoryHandle, nextPath);
      } else {
        const ext = entry.name.substring(entry.name.lastIndexOf('.')).toUpperCase();
        if (WHITELIST_EXTENSIONS.includes(ext)) {
          queue.push({ handle: entry as FileSystemFileHandle, path: currentPath });
        } else {
          filtered++;
        }
      }
    }
  }

  await collect(dirHandle, dirHandle.name);
  const total = queue.length;

  // Phase 2: Parallel Analysis (Batch Size 6)
  const BATCH_SIZE = 6;
  for (let i = 0; i < queue.length; i += BATCH_SIZE) {
    const batch = queue.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(async (item) => {
      const file = await item.handle.getFile();
      const sample = await processFile(file, item.path, item.handle);
      processed++;
      onProgress({ totalFiles: total, processedFiles: processed, currentFile: item.handle.name, isScanning: true, filteredCount: filtered });
      return sample;
    }));

    const validResults = results.filter((s): s is AudioSample => s !== null);
    allSamples.push(...validResults);
    onBatch(validResults); // Progressive update
  }

  return allSamples;
}

export async function scanFilesLegacy(
  files: FileList, 
  onProgress: (p: ScanProgress) => void,
  onBatch: (samples: AudioSample[]) => void
): Promise<AudioSample[]> {
  const allSamples: AudioSample[] = [];
  const queue = Array.from(files).filter(f => WHITELIST_EXTENSIONS.includes(f.name.substring(f.name.lastIndexOf('.')).toUpperCase()));
  const total = queue.length;

  for (let i = 0; i < queue.length; i += 6) {
    const batch = queue.slice(i, i + 6);
    const results = await Promise.all(batch.map(async (file, idx) => {
      const parts = file.webkitRelativePath.split('/'); parts.pop();
      const sample = await processFile(file, parts.join('/'), file);
      onProgress({ totalFiles: total, processedFiles: i + idx + 1, currentFile: file.name, isScanning: true, filteredCount: 0 });
      return sample;
    }));

    const validResults = results.filter((s): s is AudioSample => s !== null);
    allSamples.push(...validResults);
    onBatch(validResults);
  }
  return allSamples;
}
