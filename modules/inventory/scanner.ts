
import { AudioSample, ScanProgress, SoundType } from '../../types';
import { normalizeTags } from './normalizer';
import { analyzeAudioBuffer, getAcousticValidation } from './analyzer';

const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

// Черный список системных папок FL Studio и ОС
const BLACKLIST_FOLDERS = [
  '/Backup/', '/Settings/', '/Artwork/', '/Skins/', '/Templates/', 
  '/Help/', '/Data/', '/System/', '/__MACOSX/', '/.git/', '/Local Settings/'
];
const WHITELIST_EXTENSIONS = ['.wav', '.mp3', '.flac', '.aif', '.aiff', '.ogg', '.mid', '.midi'];

const isBlacklisted = (path: string): boolean => {
  const upperPath = path.toUpperCase();
  return BLACKLIST_FOLDERS.some(folder => upperPath.includes(folder.toUpperCase()));
};

async function processFile(
  file: File,
  relativePath: string,
  handle: FileSystemFileHandle | File
): Promise<AudioSample | null> {
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  
  // 1. Быстрые фильтры без декодирования
  if (!WHITELIST_EXTENSIONS.includes(ext)) return null;
  if (isBlacklisted(relativePath)) return null;
  if (file.size < 500) return null; // Игнорируем подозрительно маленькие файлы (метаданные)

  try {
    // 2. MIDI Logic
    if (ext === '.mid' || ext === '.midi') {
      return {
        id: crypto.randomUUID(),
        name: file.name,
        path: relativePath,
        fullPath: `${relativePath}/${file.name}`,
        type: 'midi',
        sourceTags: ['#MIDI'],
        acousticTags: [],
        dna: { peakFrequency: 0, spectralCentroid: 0, attackMs: 0, decayMs: 0, zeroCrossingRate: 0, brightness: 0 },
        confidenceScore: 100,
        handle
      };
    }

    // 3. Audio Processing with safety catch
    const arrayBuffer = await file.arrayBuffer();
    
    // Браузеры часто кидают ошибку на MakingThumbnail.wav и подобные "фальшивые" wav
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    } catch (decodeErr) {
      // Бесшумно пропускаем файлы, которые не являются аудио, несмотря на расширение
      return null;
    }
    
    // Classification by length
    let soundType: SoundType = 'unknown';
    if (audioBuffer.duration > 15) soundType = 'stem';
    else if (audioBuffer.duration >= 2) soundType = 'loop';
    else soundType = 'one-shot';

    const { tags: sourceTags, confidence } = normalizeTags(relativePath, file.name);
    sourceTags.push(`#${soundType.toUpperCase()}`);

    const dna = await analyzeAudioBuffer(audioBuffer);
    const acousticTags = getAcousticValidation(dna);
    
    return {
      id: crypto.randomUUID(),
      name: file.name,
      path: relativePath,
      fullPath: `${relativePath}/${file.name}`,
      type: soundType,
      sourceTags,
      acousticTags,
      dna,
      confidenceScore: confidence,
      handle
    };
  } catch (e) {
    // Глобальный catch для непредвиденных ошибок чтения
    return null;
  }
}

export async function scanFolder(
  dirHandle: FileSystemDirectoryHandle,
  onProgress: (p: ScanProgress) => void
): Promise<AudioSample[]> {
  const samples: AudioSample[] = [];
  let totalProcessed = 0;
  let filteredCount = 0;

  async function recursiveScan(handle: FileSystemDirectoryHandle, currentPath: string) {
    for await (const entry of handle.values()) {
      if (entry.kind === 'directory') {
        const path = `${currentPath}/${entry.name}`;
        if (isBlacklisted(path)) {
          filteredCount++;
          continue;
        }
        await recursiveScan(entry as FileSystemDirectoryHandle, path);
      } else if (entry.kind === 'file') {
        const fileEntry = entry as FileSystemFileHandle;
        const ext = fileEntry.name.substring(fileEntry.name.lastIndexOf('.')).toLowerCase();
        
        if (!WHITELIST_EXTENSIONS.includes(ext)) {
          filteredCount++;
          continue;
        }

        totalProcessed++;
        onProgress({ totalFiles: -1, processedFiles: totalProcessed, currentFile: fileEntry.name, isScanning: true, filteredCount });
        
        const file = await fileEntry.getFile();
        const sample = await processFile(file, currentPath, fileEntry);
        if (sample) samples.push(sample);
        else filteredCount++;
      }
    }
  }

  await recursiveScan(dirHandle, dirHandle.name);
  return samples;
}

export async function scanFilesLegacy(
  files: FileList,
  onProgress: (p: ScanProgress) => void
): Promise<AudioSample[]> {
  const samples: AudioSample[] = [];
  let filteredCount = 0;
  const audioFiles = Array.from(files).filter(f => {
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
    const isOk = WHITELIST_EXTENSIONS.includes(ext) && !isBlacklisted(f.webkitRelativePath) && f.size > 500;
    if (!isOk) filteredCount++;
    return isOk;
  });
  
  for (let i = 0; i < audioFiles.length; i++) {
    const file = audioFiles[i];
    const pathParts = file.webkitRelativePath.split('/');
    pathParts.pop();
    const currentPath = pathParts.join('/');

    onProgress({
      totalFiles: audioFiles.length,
      processedFiles: i + 1,
      currentFile: file.name,
      isScanning: true,
      filteredCount
    });

    const sample = await processFile(file, currentPath, file);
    if (sample) samples.push(sample);
    else filteredCount++;
  }

  return samples;
}
