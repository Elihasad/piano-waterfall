import { Midi } from '@tonejs/midi';
import { clampMidi } from '../noteNames';
import type { Hand, MeasureEvent, NoteEvent, Song, TempoEvent } from '../types';
import { normalizeHandSeparation } from './handSeparation';

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

  const allNonEmpty = midi.tracks.filter((t) => t.notes.length > 0);
  // Filter out GM Percussion tracks (channel 9 / drum kit) when melodic tracks exist
  const melodicTracks = allNonEmpty.filter(
    (t) => t.channel !== 9 && !t.instrument?.percussion,
  );
  const nonEmptyTracks = melodicTracks.length > 0 ? melodicTracks : allNonEmpty;

  // Determine per-track hand assignment smartly using track names & average pitch
  // (prevents inverted colors when Track 0 is Bass/LH or when a MIDI has 3+ tracks)
  const trackHands: Array<Hand | 'split'> = nonEmptyTracks.map((track) => {
    const name = (track.name || '').toLowerCase();
    if (/\b(left|lh|bass)\b/.test(name)) return 'left';
    if (/\b(right|rh|treble|melody)\b/.test(name)) return 'right';
    return 'split';
  });

  if (nonEmptyTracks.length === 2 && trackHands[0] === 'split' && trackHands[1] === 'split') {
    const avg0 =
      nonEmptyTracks[0].notes.reduce((s, n) => s + n.midi, 0) / nonEmptyTracks[0].notes.length;
    const avg1 =
      nonEmptyTracks[1].notes.reduce((s, n) => s + n.midi, 0) / nonEmptyTracks[1].notes.length;
    if (Math.abs(avg0 - avg1) >= 4) {
      trackHands[0] = avg0 >= avg1 ? 'right' : 'left';
      trackHands[1] = avg0 >= avg1 ? 'left' : 'right';
    }
  }

  const notes: NoteEvent[] = [];
  let noteCounter = 0;

  nonEmptyTracks.forEach((track, trackIdx) => {
    const assignedTrackHand = trackHands[trackIdx];
    track.notes.forEach((n) => {
      const clamped = clampMidi(n.midi);
      const hand: Hand =
        assignedTrackHand === 'split' ? (clamped < 60 ? 'left' : 'right') : assignedTrackHand;
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

  normalizeHandSeparation(notes);

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

  const cleanedFilename = fallbackTitle
    .replace(/\.(mid|midi)$/i, '')
    .replace(/_+/g, ' ')
    .trim();
  const title = cleanedFilename || midi.name?.trim() || 'Untitled MIDI';

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
