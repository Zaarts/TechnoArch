
import { AudioSample, ScanProgress, SoundType } from '../../types';
import { normalizeTags } from './normalizer';
import { analyzeAudioBuffer, getAcousticValidation } from './analyzer';

const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

const BLACKLIST_FOLDERS = ['/BACKUP/', '/SETTINGS/', '/ARTWORK/', '/SKINS/', '/TEMPLATES/', '/HELP/', '/DATA/', '/SYSTEM/', '/__MACOSX/', '/.GIT/'];
const WHITELIST_EXTENSIONS = ['.WAV', '.MP3', '.FLAC', '.AIF', '.AIFF', '.OGG', '.MID', '.MIDI'];

const isBlacklisted = (path: string): boolean => {
  const up = path.toUpperCase();
  return BLACKLIST_FOLDERS.some(f => up.includes(f));
};

async function processFile(file: File, relativePath: string, handle: FileSystemFileHandle | File): Promise<AudioSample | null> {
  const ext = file.name.substring(file.name.lastIndexOf('.')).toUpperCase();
  if (!WHITELIST_EXTENSIONS.includes(ext) || isBlacklisted(relativePath) || file.size < 500) return null;

  try {
    if (ext === '.MID' || ext === '.MIDI') {
      return { id: crypto.randomUUID(), name: file.name, path: relativePath, fullPath: `${relativePath}/${file.name}`, type: 'midi', sourceTags: ['#MIDI'], acousticTags: [], dna: { peakFrequency: 0, spectralCentroid: 0, attackMs: 0, decayMs: 0, zeroCrossingRate: 0, brightness: 0 }, confidenceScore: 100, handle };
    }

    const arrayBuffer = await file.arrayBuffer();
    let audioBuffer: AudioBuffer;
    try { audioBuffer = await audioCtx.decodeAudioData(arrayBuffer); } catch { return null; }
    
    let soundType: SoundType = audioBuffer.duration > 15 ? 'stem' : audioBuffer.duration >= 2 ? 'loop' : 'one-shot';
    const { tags: sourceTags, confidence, isMasterTag } = normalizeTags(relativePath, file.name);
    sourceTags.push(`#${soundType.toUpperCase()}`);

    const dna = await analyzeAudioBuffer(audioBuffer);
    
    // Если Master Tag найден по имени (например #Kick), анализатор добавляет только доп. теги (#Punchy)
    const acousticTags = getAcousticValidation(dna, isMasterTag ? sourceTags : []);
    
    return { id: crypto.randomUUID(), name: file.name, path: relativePath, fullPath: `${relativePath}/${file.name}`, type: soundType, sourceTags, acousticTags, dna, confidenceScore: confidence, handle };
  } catch { return null; }
}

export async function scanFolder(dirHandle: FileSystemDirectoryHandle, onProgress: (p: ScanProgress) => void): Promise<AudioSample[]> {
  const samples: AudioSample[] = [];
  let totalProcessed = 0;
  let filteredCount = 0;

  async function recursiveScan(handle: FileSystemDirectoryHandle, currentPath: string) {
    for await (const entry of handle.values()) {
      if (entry.kind === 'directory') {
        const path = `${currentPath}/${entry.name}`;
        if (isBlacklisted(path)) { filteredCount++; continue; }
        await recursiveScan(entry as FileSystemDirectoryHandle, path);
      } else if (entry.kind === 'file') {
        const fileEntry = entry as FileSystemFileHandle;
        if (!WHITELIST_EXTENSIONS.includes(fileEntry.name.substring(fileEntry.name.lastIndexOf('.')).toUpperCase())) { filteredCount++; continue; }
        totalProcessed++;
        onProgress({ totalFiles: -1, processedFiles: totalProcessed, currentFile: fileEntry.name, isScanning: true, filteredCount });
        const file = await fileEntry.getFile();
        const sample = await processFile(file, currentPath, fileEntry);
        if (sample) samples.push(sample); else filteredCount++;
      }
    }
  }
  await recursiveScan(dirHandle, dirHandle.name);
  return samples;
}

export async function scanFilesLegacy(files: FileList, onProgress: (p: ScanProgress) => void): Promise<AudioSample[]> {
  const samples: AudioSample[] = [];
  let filteredCount = 0;
  const audioFiles = Array.from(files).filter(f => {
    const isOk = WHITELIST_EXTENSIONS.includes(f.name.substring(f.name.lastIndexOf('.')).toUpperCase()) && !isBlacklisted(f.webkitRelativePath) && f.size > 500;
    if (!isOk) filteredCount++;
    return isOk;
  });
  for (let i = 0; i < audioFiles.length; i++) {
    const file = audioFiles[i];
    onProgress({ totalFiles: audioFiles.length, processedFiles: i + 1, currentFile: file.name, isScanning: true, filteredCount });
    const parts = file.webkitRelativePath.split('/'); parts.pop();
    const sample = await processFile(file, parts.join('/'), file);
    if (sample) samples.push(sample); else filteredCount++;
  }
  return samples;
}
