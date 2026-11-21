import type { Hand, NoteEvent } from '../types';

/**
 * Post-parse hand-separation cleanup shared by MIDI and MusicXML parsers.
 * Prevents inverted/crossed Left (green) & Right (cyan) hand colors on multi-part,
 * SATB, Lieder, and complex MIDI scores while preserving genuine two-hand playing.
 */
export function normalizeHandSeparation(notes: NoteEvent[]): void {
  if (notes.length === 0) return;

  // Ensure chronological + ascending pitch order
  notes.sort((a, b) => a.startTimeSec - b.startTimeSec || a.midi - b.midi);

  // Pass 1: Simultaneous onset clusters (±60ms) — never let a Right note sit below a Left note
  let clusterStart = 0;
  while (clusterStart < notes.length) {
    let clusterEnd = clusterStart + 1;
    while (
      clusterEnd < notes.length &&
      notes[clusterEnd].startTimeSec - notes[clusterStart].startTimeSec <= 0.06
    ) {
      clusterEnd++;
    }
    if (clusterEnd - clusterStart >= 2) {
      const slice = notes.slice(clusterStart, clusterEnd);
      const leftNotes = slice.filter((n) => n.hand === 'left');
      const rightNotes = slice.filter((n) => n.hand === 'right');
      if (leftNotes.length > 0 && rightNotes.length > 0) {
        const maxLeft = Math.max(...leftNotes.map((n) => n.midi));
        const minRight = Math.min(...rightNotes.map((n) => n.midi));
        if (minRight < maxLeft) {
          const sortedByPitch = [...slice].sort((a, b) => a.midi - b.midi);
          const leftCount = leftNotes.length;
          sortedByPitch.forEach((n, idx) => {
            n.hand = idx < leftCount ? 'left' : 'right';
          });
        }
      }
    }
    clusterStart = clusterEnd;
  }

  // Pass 2: Extreme register & sustaining-overlap guard
  // (fixes high treble notes >= C5 erroneously tagged 'left' in SATB/multi-track files,
  //  and low bass notes <= B2 erroneously tagged 'right')
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const t = note.startTimeSec;

    // Look at nearby sounding notes within a short sliding window
    let lowestSoundingRight = Infinity;
    let highestSoundingRight = -Infinity;
    let lowestSoundingLeft = Infinity;
    let highestSoundingLeft = -Infinity;

    for (let j = Math.max(0, i - 16); j < Math.min(notes.length, i + 16); j++) {
      if (j === i) continue;
      const other = notes[j];
      const overlaps =
        other.startTimeSec <= t + 0.04 && other.startTimeSec + other.durationSec > t + 0.02;
      if (!overlaps) continue;
      if (other.hand === 'right') {
        if (other.midi < lowestSoundingRight) lowestSoundingRight = other.midi;
        if (other.midi > highestSoundingRight) highestSoundingRight = other.midi;
      } else {
        if (other.midi < lowestSoundingLeft) lowestSoundingLeft = other.midi;
        if (other.midi > highestSoundingLeft) highestSoundingLeft = other.midi;
      }
    }

    if (note.hand === 'left') {
      // High note >= C5 (72) is almost always Right Hand unless a much higher Right note is playing
      if (note.midi >= 72 && highestSoundingRight < note.midi + 7) {
        note.hand = 'right';
      } else if (lowestSoundingRight < Infinity && note.midi > lowestSoundingRight + 3 && note.midi >= 64) {
        // Note is well above a simultaneously sustaining Right-hand note and in treble register
        note.hand = 'right';
      }
    } else {
      // Low note <= B2 (47) is almost always Left Hand unless a much lower Left note is playing
      if (note.midi <= 47 && lowestSoundingLeft > note.midi - 7) {
        note.hand = 'left';
      } else if (highestSoundingLeft > -Infinity && note.midi < highestSoundingLeft - 3 && note.midi <= 55) {
        note.hand = 'left';
      }
    }
  }
}

/**
 * Resolves the effective hand of a note given an optional user override:
 * - 'auto': use parsed & normalized hand
 * - 'pitch': strict split at Middle C (C4 = MIDI 60)
 * - 'swap': flip left <-> right
 */
export function resolveEffectiveHand(
  note: Pick<NoteEvent, 'hand' | 'midi'>,
  override: 'auto' | 'pitch' | 'swap' = 'auto',
): Hand {
  if (override === 'pitch') return note.midi < 60 ? 'left' : 'right';
  if (override === 'swap') return note.hand === 'left' ? 'right' : 'left';
  return note.hand;
}
