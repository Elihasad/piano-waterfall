import { Midi } from '@tonejs/midi';
import { clampMidi } from '../noteNames';
import type { Hand, MeasureEvent, NoteEvent, Song, TempoEvent } from '../types';

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function parseMidiBuffer(buffer: ArrayBuffer, fallbackTitle: string): Song {
  const midi = new Midi(buffer);
  const defaultBpm = midi.header.tempos[0]?.bpm
    ? Math.round(midi.header.tempos[0].bpm)
    : 120;

  const tempoEvents: TempoEvent[] =
    midi.header.tempos.length > 0
      ? midi.header.tempos.map((t) => ({ timeSec: t.time ?? 0, bpm: Math.round(t.bpm) }))
      : [{ timeSec: 0, bpm: defaultBpm }];

  const timeSig = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4];
  const beats = timeSig[0] || 4;
  const beatType = timeSig[1] || 4;
  const measureDurationSec = beats * (4 / beatType) * (60 / defaultBpm);

  const nonEmptyTracks = midi.tracks.filter((t) => t.notes.length > 0);
  const hasTwoTracks = nonEmptyTracks.length >= 2;

  const notes: NoteEvent[] = [];
  let noteCounter = 0;

  nonEmptyTracks.forEach((track, trackIdx) => {
    track.notes.forEach((n) => {
      const clamped = clampMidi(n.midi);
      let hand: Hand;
      if (hasTwoTracks) {
        hand = trackIdx === 0 ? 'right' : 'left';
      } else {
        hand = clamped < 60 ? 'left' : 'right';
      }
      const startTimeSec = Math.max(0, n.time);
      const durationSec = Math.max(0.05, n.duration);
      const measureNumber = Math.floor(startTimeSec / measureDurationSec) + 1;
      notes.push({
        id: `m-${noteCounter++}`,
        midi: clamped,
        startTimeSec,
        durationSec,
        velocity: Math.max(0.1, Math.min(1, n.velocity || 0.8)),
        hand,
        measureNumber,
      });
    });
  });

  notes.sort((a, b) => a.startTimeSec - b.startTimeSec || a.midi - b.midi);

  const lastEnd = notes.reduce((acc, n) => Math.max(acc, n.startTimeSec + n.durationSec), 0);
  const totalMeasures = Math.max(1, Math.ceil(lastEnd / measureDurationSec));
  const measures: MeasureEvent[] = [];
  for (let i = 0; i < totalMeasures; i++) {
    measures.push({
      number: i + 1,
      startTimeSec: i * measureDurationSec,
      endTimeSec: (i + 1) * measureDurationSec,
      beats,
      beatType,
    });
  }

  const minMidi = notes.length > 0 ? notes.reduce((acc, n) => Math.min(acc, n.midi), 108) : 60;
  const maxMidi = notes.length > 0 ? notes.reduce((acc, n) => Math.max(acc, n.midi), 21) : 72;

  const title =
    midi.name?.trim() || fallbackTitle.replace(/\.(mid|midi)$/i, '') || 'Untitled MIDI';

  return {
    id: generateId('song'),
    title,
    composer: '',
    sourceFormat: 'midi',
    createdAt: Date.now(),
    defaultBpm,
    durationSec: Math.max(lastEnd, totalMeasures * measureDurationSec, 1),
    tempoEvents,
    measures,
    notes,
    minMidi,
    maxMidi,
  };
}
