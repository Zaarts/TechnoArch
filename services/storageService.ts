
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
  await tx.objectStore('samples').clear();
  for (const sample of samples) {
    // We strip non-serializable handle for the deep index storage if needed, 
    // but typically File objects/handles are serializable in IndexedDB.
    await tx.objectStore('samples').put(sample);
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
  const data = JSON.stringify({ samples, plugins, version: '3.3', timestamp: Date.now() });
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TA_OS_INDEX_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

export async function importIndex(jsonString: string) {
  const data = JSON.parse(jsonString);
  if (data.samples) await saveSamples(data.samples);
  if (data.plugins) await savePlugins(data.plugins);
  return data;
}
