
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
    // Note: handle is non-serializable if it's FileSystemFileHandle, 
    // we might need to store it differently or skip it for deep index storage
    // but for now we try to keep it if it's a File object or handle.
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
