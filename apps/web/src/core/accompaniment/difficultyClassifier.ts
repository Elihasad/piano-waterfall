import type { DifficultyTier, PianoGrade, Song } from '../types';
import { detectKeyFromNotes, mod12 } from './harmonyAnalyzer';

const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

const GRADE_BY_NUM: Record<number, PianoGrade> = {
  1: 'Grade 1',
  2: 'Grade 2',
  3: 'Grade 3',
  4: 'Grade 4',
  5: 'Grade 5',
  6: 'Grade 6',
  7: 'Grade 7',
  8: 'Grade 8',
  9: 'Diploma',
};

/**
 * Automatically classify any piano Song into a standard ABRSM/RCM-aligned Grade (Grade 1–8 / Diploma)
 * and Difficulty Tier (beginner / intermediate / advanced) based on note density, polyphony,
 * pitch span, black-key ratio, and tempo. Runs in O(N) once on import so 10,000+ song libraries stay instant.
 */
export function classifySongDifficulty(song: Song): {
  difficulty: DifficultyTier;
  grade: PianoGrade;
  gradeNum: number;
} {
  if (song.notes.length === 0) {
    return { difficulty: 'beginner', grade: 'Grade 1', gradeNum: 1 };
  }

  const dur = Math.max(1, song.durationSec);
  const notesPerSec = song.notes.length / dur;
  const pitchSpan = Math.max(0, song.maxMidi - song.minMidi);

  let blackCount = 0;
  let maxSimultaneous = 1;
  let windowStart = 0;
  for (let i = 0; i < song.notes.length; i++) {
    if (BLACK_PCS.has(mod12(song.notes[i].midi))) blackCount++;
    while (song.notes[i].startTimeSec - song.notes[windowStart].startTimeSec > 0.04) {
      windowStart++;
    }
    const sim = i - windowStart + 1;
    if (sim > maxSimultaneous) maxSimultaneous = sim;
  }
  const blackRatio = blackCount / song.notes.length;

  // Composite score from 0..100 mapped cleanly to Grade 1..9 (Diploma)
  let score = 0;
  score += Math.min(42, notesPerSec * 4.5); // note speed / density
  score += Math.min(22, Math.max(0, maxSimultaneous - 1) * 3.8); // chord thickness
  score += Math.min(18, Math.max(0, pitchSpan - 18) * 0.42); // keyboard span
  score += Math.min(12, blackRatio * 24); // key complexity
  score += Math.min(6, Math.max(0, song.defaultBpm - 90) * 0.08); // tempo

  let gradeNum: number;
  if (score < 16) gradeNum = 1;
  else if (score < 26) gradeNum = 2;
  else if (score < 36) gradeNum = 3;
  else if (score < 47) gradeNum = 4;
  else if (score < 58) gradeNum = 5;
  else if (score < 68) gradeNum = 6;
  else if (score < 78) gradeNum = 7;
  else if (score < 88) gradeNum = 8;
  else gradeNum = 9;

  const difficulty: DifficultyTier =
    gradeNum <= 3 ? 'beginner' : gradeNum <= 6 ? 'intermediate' : 'advanced';

  return {
    difficulty,
    grade: GRADE_BY_NUM[gradeNum],
    gradeNum,
  };
}

/**
 * Enrich a Song with cached `detectedKey`, `difficulty`, `grade`, and `gradeNum` once on import.
 */
export function enrichSongMetadata(song: Song): Song {
  const detectedKey = song.detectedKey ?? detectKeyFromNotes(song.notes);
  if (song.difficulty && song.grade && song.gradeNum) {
    return song.detectedKey ? song : { ...song, detectedKey };
  }
  const cls = classifySongDifficulty(song);
  return {
    ...song,
    detectedKey,
    ...cls,
  };
}
