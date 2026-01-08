
import { AudioSample, ScanProgress } from '../../types';
import { normalizeTags } from './normalizer';
import { analyzeAudioBuffer, getAcousticValidation } from './analyzer';

const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

export async function scanFolder(
  dirHandle: FileSystemDirectoryHandle,
  onProgress: (p: ScanProgress) => void
): Promise<AudioSample[]> {
  const samples: AudioSample[] = [];
  let totalProcessed = 0;

  async function recursiveScan(handle: FileSystemDirectoryHandle, currentPath: string) {
    for await (const entry of handle.values()) {
      if (entry.kind === 'directory') {
        await recursiveScan(entry as FileSystemDirectoryHandle, `${currentPath}/${entry.name}`);
      } else if (entry.kind === 'file') {
        const fileEntry = entry as FileSystemFileHandle;
        if (fileEntry.name.match(/\.(wav|mp3|aif|flac)$/i)) {
          totalProcessed++;
          onProgress({
            totalFiles: -1,
            processedFiles: totalProcessed,
            currentFile: fileEntry.name,
            isScanning: true
          });

          try {
            const file = await fileEntry.getFile();
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            
            // Этап 1: Контекстный анализ (Пути и Имена)
            const { tags: sourceTags, confidence } = normalizeTags(currentPath, fileEntry.name);
            
            // Этап 2: Акустический DNA
            const dna = await analyzeAudioBuffer(audioBuffer);
            
            // Этап 3: Валидация и Матрица Приоритетов (Veto Power)
            let acousticTags = getAcousticValidation(dna);
            
            // Если акустика говорит, что это Hat, а в тегах пути Kick - отдаем приоритет звуку
            const isKickInPath = sourceTags.includes('#Kick');
            const isHatByDNA = acousticTags.includes('#Hat');
            
            if (isKickInPath && isHatByDNA && dna.spectralCentroid > 4000) {
              // Явное противоречие: удаляем ошибочный тег
              sourceTags.splice(sourceTags.indexOf('#Kick'), 1);
              if (!acousticTags.includes('#Mislabeled')) acousticTags.push('#Mislabeled');
            }

            samples.push({
              id: crypto.randomUUID(),
              name: fileEntry.name,
              path: currentPath,
              fullPath: `${currentPath}/${fileEntry.name}`,
              type: audioBuffer.duration < 2 ? 'one-shot' : 'loop',
              sourceTags,
              acousticTags,
              dna,
              confidenceScore: confidence,
              handle: fileEntry
            });
          } catch (e) {
            console.error(`Analysis failed for ${fileEntry.name}:`, e);
          }
        }
      }
    }
  }

  await recursiveScan(dirHandle, dirHandle.name);
  return samples;
}
