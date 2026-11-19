import { describe, it, expect, beforeEach } from 'vitest';
import {
  seedDemoSongsIfEmpty,
  listSongs,
  saveSong,
  deleteSong,
  getSettings,
  saveSettings,
  __resetStorageForTests,
} from '../storage';
import { DEMO_SONGS } from '../../data/demoSongs';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetStorageForTests();
  });

  it('seeds demo songs when empty, persists new songs, and deletes songs', async () => {
    const seeded = await seedDemoSongsIfEmpty();
    expect(seeded.length).toBe(DEMO_SONGS.length);

    const customSong = { ...DEMO_SONGS[0], id: 'custom-1', title: 'My Piece', createdAt: Date.now() + 1000 };
    await saveSong(customSong);
    const all = await listSongs();
    expect(all[0].id).toBe('custom-1');

    await deleteSong('custom-1');
    const afterDelete = await listSongs();
    expect(afterDelete.find((s) => s.id === 'custom-1')).toBeUndefined();
  });

  it('round-trips app settings in localStorage', () => {
    const defaults = getSettings();
    expect(defaults.noteLabelMode).toBe('letters');
    expect(defaults.effectsEnabled).toBe(true);

    const updated = saveSettings({
      omrServerUrl: 'https://omr.example.com',
      noteLabelMode: 'solfege',
    });
    expect(updated.omrServerUrl).toBe('https://omr.example.com');
    expect(getSettings().noteLabelMode).toBe('solfege');
  });
});
