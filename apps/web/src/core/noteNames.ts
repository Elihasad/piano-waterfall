import type { NoteLabelMode } from './types';

export const MIN_PIANO_MIDI = 21; // A0
export const MAX_PIANO_MIDI = 108; // C8

const LETTER_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const SOLFEGE_NAMES = [
  'Đô',
  'Đô#',
  'Rê',
  'Rê#',
  'Mi',
  'Fa',
  'Fa#',
  'Sol',
  'Sol#',
  'La',
  'La#',
  'Si',
] as const;

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

export function clampMidi(midi: number): number {
  if (!Number.isFinite(midi)) return 60;
  return Math.max(MIN_PIANO_MIDI, Math.min(MAX_PIANO_MIDI, Math.round(midi)));
}

export function isBlackKey(midi: number): boolean {
  const clamped = clampMidi(midi);
  return BLACK_PITCH_CLASSES.has(clamped % 12);
}

export function midiToNoteLabel(
  midi: number,
  mode: NoteLabelMode,
  includeOctave = false,
): string {
  if (mode === 'off') return '';
  const clamped = clampMidi(midi);
  const pitchClass = clamped % 12;
  const octave = Math.floor(clamped / 12) - 1;
  const base = mode === 'solfege' ? SOLFEGE_NAMES[pitchClass] : LETTER_NAMES[pitchClass];
  return includeOctave ? `${base}${octave}` : base;
}

export function computeAutoKeyRange(
  minMidi: number,
  maxMidi: number,
): { startMidi: number; endMidi: number } {
  const safeMin = clampMidi(Number.isFinite(minMidi) ? minMidi : 60);
  const safeMax = clampMidi(Number.isFinite(maxMidi) ? maxMidi : 72);
  const low = Math.min(safeMin, safeMax);
  const high = Math.max(safeMin, safeMax);

  let startMidi = clampMidi(low - 5);
  let endMidi = clampMidi(high + 5);

  const minSpan = 24;
  if (endMidi - startMidi < minSpan) {
    const deficit = minSpan - (endMidi - startMidi);
    const padLow = Math.ceil(deficit / 2);
    const padHigh = Math.floor(deficit / 2);
    startMidi = clampMidi(startMidi - padLow);
    endMidi = clampMidi(endMidi + padHigh);
    if (endMidi - startMidi < minSpan) {
      if (startMidi === MIN_PIANO_MIDI) {
        endMidi = clampMidi(startMidi + minSpan);
      } else {
        startMidi = clampMidi(endMidi - minSpan);
      }
    }
  }

  if (isBlackKey(startMidi) && startMidi > MIN_PIANO_MIDI) {
    startMidi -= 1;
  }
  if (isBlackKey(endMidi) && endMidi < MAX_PIANO_MIDI) {
    endMidi += 1;
  }

  return { startMidi, endMidi };
}
