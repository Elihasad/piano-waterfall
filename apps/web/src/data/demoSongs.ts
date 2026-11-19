import type { MeasureEvent, NoteEvent, Song } from './types';

function buildDemoSong(params: {
  id: string;
  title: string;
  composer: string;
  bpm: number;
  beats: number;
  beatType: number;
  rawNotes: Array<{
    midi: number;
    beatStart: number;
    beatDuration: number;
    hand: 'left' | 'right';
    velocity?: number;
  }>;
}): Song {
  const secPerBeat = 60 / params.bpm;
  const notes: NoteEvent[] = params.rawNotes
    .map((n, idx) => ({
      id: `${params.id}-n-${idx}`,
      midi: n.midi,
      startTimeSec: n.beatStart * secPerBeat,
      durationSec: n.beatDuration * secPerBeat,
      velocity: n.velocity ?? 0.8,
      hand: n.hand,
      measureNumber: Math.floor(n.beatStart / params.beats) + 1,
    }))
    .sort((a, b) => a.startTimeSec - b.startTimeSec);

  const maxBeat = params.rawNotes.reduce(
    (acc, n) => Math.max(acc, n.beatStart + n.beatDuration),
    params.beats,
  );
  const totalMeasures = Math.max(1, Math.ceil(maxBeat / params.beats));
  const measures: MeasureEvent[] = [];
  for (let i = 0; i < totalMeasures; i++) {
    measures.push({
      number: i + 1,
      startTimeSec: i * params.beats * secPerBeat,
      endTimeSec: (i + 1) * params.beats * secPerBeat,
      beats: params.beats,
      beatType: params.beatType,
    });
  }

  const minMidi = notes.reduce((acc, n) => Math.min(acc, n.midi), 60);
  const maxMidi = notes.reduce((acc, n) => Math.max(acc, n.midi), 72);

  return {
    id: params.id,
    title: params.title,
    composer: params.composer,
    sourceFormat: 'musicxml',
    createdAt: 1700000000000,
    defaultBpm: params.bpm,
    durationSec: totalMeasures * params.beats * secPerBeat,
    tempoEvents: [{ timeSec: 0, bpm: params.bpm }],
    measures,
    notes,
    minMidi,
    maxMidi,
  };
}

export const DEMO_SONGS: Song[] = [
  buildDemoSong({
    id: 'demo-ode-to-joy',
    title: 'Ode to Joy (Demo)',
    composer: 'Ludwig van Beethoven',
    bpm: 112,
    beats: 4,
    beatType: 4,
    rawNotes: [
      // Measure 1
      { midi: 64, beatStart: 0, beatDuration: 1, hand: 'right' },
      { midi: 64, beatStart: 1, beatDuration: 1, hand: 'right' },
      { midi: 65, beatStart: 2, beatDuration: 1, hand: 'right' },
      { midi: 67, beatStart: 3, beatDuration: 1, hand: 'right' },
      { midi: 48, beatStart: 0, beatDuration: 2, hand: 'left', velocity: 0.65 },
      { midi: 55, beatStart: 2, beatDuration: 2, hand: 'left', velocity: 0.65 },
      // Measure 2
      { midi: 67, beatStart: 4, beatDuration: 1, hand: 'right' },
      { midi: 65, beatStart: 5, beatDuration: 1, hand: 'right' },
      { midi: 64, beatStart: 6, beatDuration: 1, hand: 'right' },
      { midi: 62, beatStart: 7, beatDuration: 1, hand: 'right' },
      { midi: 50, beatStart: 4, beatDuration: 2, hand: 'left', velocity: 0.65 },
      { midi: 55, beatStart: 6, beatDuration: 2, hand: 'left', velocity: 0.65 },
      // Measure 3
      { midi: 60, beatStart: 8, beatDuration: 1, hand: 'right' },
      { midi: 60, beatStart: 9, beatDuration: 1, hand: 'right' },
      { midi: 62, beatStart: 10, beatDuration: 1, hand: 'right' },
      { midi: 64, beatStart: 11, beatDuration: 1, hand: 'right' },
      { midi: 48, beatStart: 8, beatDuration: 2, hand: 'left', velocity: 0.65 },
      { midi: 52, beatStart: 10, beatDuration: 2, hand: 'left', velocity: 0.65 },
      // Measure 4
      { midi: 64, beatStart: 12, beatDuration: 1.5, hand: 'right' },
      { midi: 62, beatStart: 13.5, beatDuration: 0.5, hand: 'right' },
      { midi: 62, beatStart: 14, beatDuration: 2, hand: 'right' },
      { midi: 55, beatStart: 12, beatDuration: 2, hand: 'left', velocity: 0.65 },
      { midi: 43, beatStart: 14, beatDuration: 2, hand: 'left', velocity: 0.65 },
      // Measure 5
      { midi: 64, beatStart: 16, beatDuration: 1, hand: 'right' },
      { midi: 64, beatStart: 17, beatDuration: 1, hand: 'right' },
      { midi: 65, beatStart: 18, beatDuration: 1, hand: 'right' },
      { midi: 67, beatStart: 19, beatDuration: 1, hand: 'right' },
      { midi: 48, beatStart: 16, beatDuration: 2, hand: 'left', velocity: 0.65 },
      { midi: 55, beatStart: 18, beatDuration: 2, hand: 'left', velocity: 0.65 },
      // Measure 6
      { midi: 67, beatStart: 20, beatDuration: 1, hand: 'right' },
      { midi: 65, beatStart: 21, beatDuration: 1, hand: 'right' },
      { midi: 64, beatStart: 22, beatDuration: 1, hand: 'right' },
      { midi: 62, beatStart: 23, beatDuration: 1, hand: 'right' },
      { midi: 50, beatStart: 20, beatDuration: 2, hand: 'left', velocity: 0.65 },
      { midi: 55, beatStart: 22, beatDuration: 2, hand: 'left', velocity: 0.65 },
      // Measure 7
      { midi: 60, beatStart: 24, beatDuration: 1, hand: 'right' },
      { midi: 60, beatStart: 25, beatDuration: 1, hand: 'right' },
      { midi: 62, beatStart: 26, beatDuration: 1, hand: 'right' },
      { midi: 64, beatStart: 27, beatDuration: 1, hand: 'right' },
      { midi: 48, beatStart: 24, beatDuration: 2, hand: 'left', velocity: 0.65 },
      { midi: 52, beatStart: 26, beatDuration: 2, hand: 'left', velocity: 0.65 },
      // Measure 8
      { midi: 62, beatStart: 28, beatDuration: 1.5, hand: 'right' },
      { midi: 60, beatStart: 29.5, beatDuration: 0.5, hand: 'right' },
      { midi: 60, beatStart: 30, beatDuration: 2, hand: 'right' },
      { midi: 55, beatStart: 28, beatDuration: 2, hand: 'left', velocity: 0.65 },
      { midi: 48, beatStart: 30, beatDuration: 2, hand: 'left', velocity: 0.7 },
    ],
  }),
  buildDemoSong({
    id: 'demo-fur-elise',
    title: 'Für Elise — Opening (Demo)',
    composer: 'Ludwig van Beethoven',
    bpm: 108,
    beats: 3,
    beatType: 8,
    rawNotes: [
      { midi: 76, beatStart: 0, beatDuration: 0.5, hand: 'right' },
      { midi: 75, beatStart: 0.5, beatDuration: 0.5, hand: 'right' },
      { midi: 76, beatStart: 1, beatDuration: 0.5, hand: 'right' },
      { midi: 75, beatStart: 1.5, beatDuration: 0.5, hand: 'right' },
      { midi: 76, beatStart: 2, beatDuration: 0.5, hand: 'right' },
      { midi: 71, beatStart: 2.5, beatDuration: 0.5, hand: 'right' },
      { midi: 74, beatStart: 3, beatDuration: 0.5, hand: 'right' },
      { midi: 72, beatStart: 3.5, beatDuration: 0.5, hand: 'right' },
      { midi: 69, beatStart: 4, beatDuration: 1, hand: 'right' },
      { midi: 45, beatStart: 4, beatDuration: 0.5, hand: 'left', velocity: 0.65 },
      { midi: 52, beatStart: 4.5, beatDuration: 0.5, hand: 'left', velocity: 0.65 },
      { midi: 57, beatStart: 5, beatDuration: 0.5, hand: 'left', velocity: 0.65 },
      { midi: 60, beatStart: 5.5, beatDuration: 0.5, hand: 'right' },
      { midi: 64, beatStart: 6, beatDuration: 0.5, hand: 'right' },
      { midi: 69, beatStart: 6.5, beatDuration: 0.5, hand: 'right' },
      { midi: 71, beatStart: 7, beatDuration: 1, hand: 'right' },
      { midi: 40, beatStart: 7, beatDuration: 0.5, hand: 'left', velocity: 0.65 },
      { midi: 52, beatStart: 7.5, beatDuration: 0.5, hand: 'left', velocity: 0.65 },
      { midi: 56, beatStart: 8, beatDuration: 0.5, hand: 'left', velocity: 0.65 },
      { midi: 64, beatStart: 8.5, beatDuration: 0.5, hand: 'right' },
      { midi: 68, beatStart: 9, beatDuration: 0.5, hand: 'right' },
      { midi: 71, beatStart: 9.5, beatDuration: 0.5, hand: 'right' },
      { midi: 72, beatStart: 10, beatDuration: 1, hand: 'right' },
      { midi: 45, beatStart: 10, beatDuration: 0.5, hand: 'left', velocity: 0.65 },
      { midi: 52, beatStart: 10.5, beatDuration: 0.5, hand: 'left', velocity: 0.65 },
      { midi: 57, beatStart: 11, beatDuration: 1, hand: 'left', velocity: 0.65 },
    ],
  }),
];
