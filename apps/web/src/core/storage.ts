import { openDB, type IDBPDatabase } from 'idb';
import { DEMO_SONGS } from '../data/demoSongs';
import type { AppSettings, Song } from './types';

const DB_NAME = 'piano-waterfall-db';
const DB_VERSION = 1;
const STORE_SONGS = 'songs';
const SETTINGS_KEY = 'piano-waterfall-settings';

const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  soundPreset: 'grand',
  omrServerUrl: '',
  noteLabelMode: 'letters',
  showKeyLabels: true,
  showFallingNoteLabels: true,
  keyboardLabelMode: 'c-only',
  leftHandColor: '#4ade80',
  rightHandColor: '#22d3ee',
  handSplitMode: 'auto',
  effectsEnabled: true,
};

let dbPromise: Promise<IDBPDatabase> | null = null;
const memoryStore = new Map<string, Song>();

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

async function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_SONGS)) {
          db.createObjectStore(STORE_SONGS, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export function __resetStorageForTests(): void {
  memoryStore.clear();
  dbPromise = null;
}

export async function listSongs(): Promise<Song[]> {
  let songs: Song[];
  if (!hasIndexedDb()) {
    songs = Array.from(memoryStore.values());
  } else {
    const db = await getDb();
    songs = (await db.getAll(STORE_SONGS)) as Song[];
  }
  return songs.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getSong(id: string): Promise<Song | undefined> {
  if (!hasIndexedDb()) {
    return memoryStore.get(id);
  }
  const db = await getDb();
  return (await db.get(STORE_SONGS, id)) as Song | undefined;
}

export async function saveSong(song: Song): Promise<void> {
  if (!hasIndexedDb()) {
    memoryStore.set(song.id, song);
    return;
  }
  const db = await getDb();
  await db.put(STORE_SONGS, song);
}

export async function deleteSong(id: string): Promise<void> {
  if (!hasIndexedDb()) {
    memoryStore.delete(id);
    return;
  }
  const db = await getDb();
  await db.delete(STORE_SONGS, id);
}

export async function seedDemoSongsIfEmpty(): Promise<Song[]> {
  const existing = await listSongs();
  if (existing.length > 0) return existing;
  for (const demo of DEMO_SONGS) {
    await saveSong(demo);
  }
  return listSongs();
}

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(partial: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...partial };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}
