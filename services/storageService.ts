
import { openDB, IDBPDatabase } from 'idb';
import { AudioSample, Plugin } from '../types';

const DB_NAME = 'TechnoArchitectDB';
const DB_VERSION = 1;

export async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('samples')) {
        db.createObjectStore('samples', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('plugins')) {
        db.createObjectStore('plugins', { keyPath: 'id' });
      }
    },
  });
}

export async function saveSamples(samples: AudioSample[]) {
  const db = await getDB();
  const tx = db.transaction('samples', 'readwrite');
  const store = tx.objectStore('samples');
  await store.clear();
  // Сохраняем порциями для стабильности
  for (const sample of samples) {
    await store.put(sample);
  }
  await tx.done;
}

export async function saveSamplesBatch(samples: AudioSample[]) {
  const db = await getDB();
  const tx = db.transaction('samples', 'readwrite');
  const store = tx.objectStore('samples');
  for (const sample of samples) {
    await store.put(sample);
  }
  await tx.done;
}

export async function loadSamples(): Promise<AudioSample[]> {
  const db = await getDB();
  return db.getAll('samples');
}

export async function savePlugins(plugins: Plugin[]) {
  const db = await getDB();
  const tx = db.transaction('plugins', 'readwrite');
  await tx.objectStore('plugins').clear();
  for (const plugin of plugins) {
    await tx.objectStore('plugins').put(plugin);
  }
  await tx.done;
}

export async function loadPlugins(): Promise<Plugin[]> {
  const db = await getDB();
  return db.getAll('plugins');
}

export async function clearAllData() {
  const db = await getDB();
  const tx = db.transaction(['samples', 'plugins'], 'readwrite');
  await tx.objectStore('samples').clear();
  await tx.objectStore('plugins').clear();
  await tx.done;
  localStorage.clear();
}

export async function exportIndex() {
  const samples = await loadSamples();
  const plugins = await loadPlugins();
  const data = JSON.stringify({ 
    samples, 
    plugins, 
    schema_version: '3.3.1', 
    export_date: new Date().toISOString() 
  });
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TECHNO_ARCHITECT_INDEX_${new Date().getTime()}.json`;
  a.click();
}

export async function importIndex(jsonString: string) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.samples || !Array.isArray(data.samples)) throw new Error("INVALID_SCHEMA: MISSING_SAMPLES");
    
    // Валидируем хотя бы первый объект
    if (data.samples.length > 0) {
      const test = data.samples[0];
      if (!test.id || !test.dna) throw new Error("INVALID_SCHEMA: CORRUPTED_DNA_DATA");
    }

    await saveSamples(data.samples);
    if (data.plugins) await savePlugins(data.plugins);
    return data;
  } catch (err) {
    console.error("IMPORT_FAILED:", err);
    throw err;
  }
}
