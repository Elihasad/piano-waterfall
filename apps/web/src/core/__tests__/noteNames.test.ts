import { describe, it, expect } from 'vitest';
import { clampMidi, isBlackKey, midiToNoteLabel, computeAutoKeyRange } from '../noteNames';

describe('noteNames', () => {
  it('formats letters and solfege labels accurately', () => {
    expect(midiToNoteLabel(60, 'letters')).toBe('C');
    expect(midiToNoteLabel(60, 'letters', true)).toBe('C4');
    expect(midiToNoteLabel(61, 'letters')).toBe('C#');
    expect(midiToNoteLabel(62, 'solfege')).toBe('Rê');
    expect(midiToNoteLabel(64, 'off')).toBe('');
  });

  it('identifies black keys and clamps out-of-range MIDI pitches', () => {
    expect(isBlackKey(60)).toBe(false);
    expect(isBlackKey(61)).toBe(true);
    expect(clampMidi(10)).toBe(21);
    expect(clampMidi(120)).toBe(108);
    expect(midiToNoteLabel(120, 'letters', true)).toBe('C8');
  });

  it('computes padded readable auto key range ending on white keys', () => {
    const range = computeAutoKeyRange(60, 72);
    expect(range.startMidi).toBeLessThanOrEqual(55);
    expect(range.endMidi).toBeGreaterThanOrEqual(77);
    expect(isBlackKey(range.startMidi)).toBe(false);
    expect(isBlackKey(range.endMidi)).toBe(false);
    expect(range.endMidi - range.startMidi).toBeGreaterThanOrEqual(24);
  });
});
