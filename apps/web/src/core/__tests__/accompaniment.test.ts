import { describe, expect, it } from 'vitest';
import {
  ACCOMPANIMENT_STYLES,
  buildPresetAccompanimentSong,
  generateAccompanimentSong,
} from '../accompaniment/accompanimentGenerator';
import {
  analyzeSongHarmony,
  buildKeyInfo,
  detectKeyFromNotes,
  parseChordProgressionText,
} from '../accompaniment/harmonyAnalyzer';
import type { NoteEvent, Song } from '../types';

function makeChordSong(): Song {
  // 4-measure C - G - Am - F progression in C Major
  const chords = [
    { m: 1, t: 0, midis: [48, 60, 64, 67] }, // C
    { m: 2, t: 2, midis: [43, 59, 62, 67] }, // G
    { m: 3, t: 4, midis: [45, 60, 64, 69] }, // Am
    { m: 4, t: 6, midis: [41, 60, 65, 69] }, // F
  ];
  const notes: NoteEvent[] = [];
  let id = 1;
  for (const ch of chords) {
    ch.midis.forEach((midi, idx) => {
      notes.push({
        id: `n-${id++}`,
        midi,
        startTimeSec: ch.t,
        durationSec: 1.9,
        velocity: 0.8,
        hand: idx === 0 ? 'left' : 'right',
        measureNumber: ch.m,
      });
    });
  }
  return {
    id: 'test-c-maj',
    title: 'Pop Test',
    composer: 'Test',
    sourceFormat: 'midi',
    createdAt: 0,
    defaultBpm: 120,
    durationSec: 8,
    tempoEvents: [{ timeSec: 0, bpm: 120 }],
    measures: [
      { number: 1, startTimeSec: 0, endTimeSec: 2, beats: 4, beatType: 4 },
      { number: 2, startTimeSec: 2, endTimeSec: 4, beats: 4, beatType: 4 },
      { number: 3, startTimeSec: 4, endTimeSec: 6, beats: 4, beatType: 4 },
      { number: 4, startTimeSec: 6, endTimeSec: 8, beats: 4, beatType: 4 },
    ],
    notes,
    minMidi: 41,
    maxMidi: 69,
  };
}

describe('Accompaniment & Harmony Analyzer', () => {
  it('detects C Major key and C - G - Am - F chord progression from a MIDI song', () => {
    const song = makeChordSong();
    const { key, chords } = analyzeSongHarmony(song);
    expect(key.label).toBe('C Major');
    expect(chords.map((c) => c.symbol)).toEqual(['C', 'G', 'Am', 'F']);
  });

  it('parses custom Jazz & slash chord strings accurately', () => {
    const chords = parseChordProgressionText('Dm7 | G7 | Cmaj7 | C/E', 100);
    expect(chords.map((c) => c.symbol)).toEqual(['Dm7', 'G7', 'Cmaj7', 'C/E']);
    expect(chords[3].bassPc).toBe(4); // E bass
  });

  it('generates playable 2-hand songs for all 10 styles including Jazz Swing, Jazz Ballad, Lo-Fi, Bossa, Bolero, and Scale Drill', () => {
    const song = makeChordSong();
    const { key, chords } = analyzeSongHarmony(song);

    for (const style of ACCOMPANIMENT_STYLES) {
      const generated = generateAccompanimentSong({
        title: song.title,
        chords,
        key,
        styleId: style.id,
      });
      expect(generated.notes.length).toBeGreaterThan(10);
      expect(generated.notes.some((n) => n.hand === 'left')).toBe(true);
      expect(generated.notes.some((n) => n.hand === 'right')).toBe(true);
      expect(generated.chords?.length).toBeGreaterThan(0);
      expect(generated.detectedKey?.label).toBe('C Major');
    }
  });

  it('upgrades triads to 7th jazz colors in Jazz Swing and transposes preset progressions cleanly', () => {
    const key = buildKeyInfo(0, 'major');
    const triads = parseChordProgressionText('C | Am | F | G');
    const jazzSong = generateAccompanimentSong({
      title: 'Jazz Upgrade',
      chords: triads,
      key,
      styleId: 'jazz-swing',
    });
    expect(jazzSong.chords?.map((c) => c.symbol)).toEqual(['Cmaj7', 'Am7', 'Fmaj7', 'Gmaj7']);

    const transposed = buildPresetAccompanimentSong('jazz-251', 'jazz-ballad', 7, 'major'); // G Major II-V-I
    expect(transposed.detectedKey?.label).toBe('G Major');
    expect(transposed.chords?.[0].symbol).toBe('Am7');
    expect(transposed.chords?.[1].symbol).toBe('D7');
    expect(transposed.chords?.[2].symbol).toBe('Gmaj7');
  });

  it('detects A Minor key on minor chords', () => {
    const key = detectKeyFromNotes([
      { id: '1', midi: 45, startTimeSec: 0, durationSec: 2, velocity: 0.8, hand: 'left', measureNumber: 1 },
      { id: '2', midi: 57, startTimeSec: 0, durationSec: 2, velocity: 0.8, hand: 'right', measureNumber: 1 },
      { id: '3', midi: 60, startTimeSec: 0, durationSec: 2, velocity: 0.8, hand: 'right', measureNumber: 1 },
      { id: '4', midi: 64, startTimeSec: 0, durationSec: 2, velocity: 0.8, hand: 'right', measureNumber: 1 },
      { id: '5', midi: 50, startTimeSec: 2, durationSec: 2, velocity: 0.8, hand: 'left', measureNumber: 2 },
      { id: '6', midi: 53, startTimeSec: 2, durationSec: 2, velocity: 0.8, hand: 'right', measureNumber: 2 },
      { id: '7', midi: 57, startTimeSec: 2, durationSec: 2, velocity: 0.8, hand: 'right', measureNumber: 2 },
      { id: '8', midi: 52, startTimeSec: 4, durationSec: 2, velocity: 0.8, hand: 'left', measureNumber: 3 },
      { id: '9', midi: 56, startTimeSec: 4, durationSec: 2, velocity: 0.8, hand: 'right', measureNumber: 3 },
      { id: '10', midi: 59, startTimeSec: 4, durationSec: 2, velocity: 0.8, hand: 'right', measureNumber: 3 },
    ]);
    expect(key.label).toBe('A Minor');
  });
});
