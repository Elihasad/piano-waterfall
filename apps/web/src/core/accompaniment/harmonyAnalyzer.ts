import type { ChordEvent, ChordQuality, DetectedKey, NoteEvent, Song } from '../types';

export const PC_NAMES_SHARP = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
export const PC_NAMES_SOLFEGE = ['Do', 'Do#', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'] as const;

// Krumhansl-Schmuckler tonal hierarchy profiles (major & minor)
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

export const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  '7': [0, 4, 7, 10],
  m7b5: [0, 3, 6, 10],
};

const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj: '',
  min: 'm',
  dim: 'dim',
  aug: 'aug',
  sus2: 'sus2',
  sus4: 'sus4',
  maj7: 'maj7',
  m7: 'm7',
  '7': '7',
  m7b5: 'm7b5',
};

export function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

export function formatChordSymbol(
  rootPc: number,
  quality: ChordQuality,
  bassPc?: number,
  transpose = 0,
): string {
  const r = mod12(rootPc + transpose);
  const b = bassPc !== undefined ? mod12(bassPc + transpose) : r;
  const base = `${PC_NAMES_SHARP[r]}${QUALITY_SUFFIX[quality]}`;
  return b !== r ? `${base}/${PC_NAMES_SHARP[b]}` : base;
}

export function formatPitchClass(pc: number, solfege = false): string {
  const idx = mod12(pc);
  return solfege ? PC_NAMES_SOLFEGE[idx] : PC_NAMES_SHARP[idx];
}

export function buildKeyInfo(tonicPc: number, mode: 'major' | 'minor'): DetectedKey {
  const t = mod12(tonicPc);
  const intervals = mode === 'major' ? MAJOR_SCALE_INTERVALS : MINOR_SCALE_INTERVALS;
  const scalePcs = intervals.map((iv) => mod12(t + iv));
  const qualities: ChordQuality[] =
    mode === 'major'
      ? ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim']
      : ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'];
  const romans =
    mode === 'major'
      ? ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
      : ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];

  const diatonicChords = scalePcs.map((rootPc, idx) => ({
    roman: romans[idx],
    rootPc,
    quality: qualities[idx],
    symbol: formatChordSymbol(rootPc, qualities[idx]),
  }));

  return {
    tonicPc: t,
    mode,
    label: `${PC_NAMES_SHARP[t]} ${mode === 'major' ? 'Major' : 'Minor'}`,
    scalePcs,
    diatonicChords,
  };
}

function pearsonCorrelation(a: number[], b: number[]): number {
  const meanA = a.reduce((s, v) => s + v, 0) / a.length;
  const meanB = b.reduce((s, v) => s + v, 0) / b.length;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < a.length; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}

/**
 * Detect the musical key (tonic + major/minor) of a song using duration-weighted
 * Krumhansl-Schmuckler pitch-class profile correlation.
 */
export function detectKeyFromNotes(notes: NoteEvent[]): DetectedKey {
  if (notes.length === 0) return buildKeyInfo(0, 'major');

  const hist = new Array<number>(12).fill(0);
  for (const n of notes) {
    const weight = Math.max(0.15, Math.min(2.5, n.durationSec)) * (n.hand === 'left' ? 1.35 : 1.0);
    hist[mod12(n.midi)] += weight;
  }

  let bestScore = -Infinity;
  let bestTonic = 0;
  let bestMode: 'major' | 'minor' = 'major';

  for (let tonic = 0; tonic < 12; tonic++) {
    const rotated = Array.from({ length: 12 }, (_, i) => hist[mod12(tonic + i)]);
    const majScore = pearsonCorrelation(rotated, MAJOR_PROFILE);
    if (majScore > bestScore) {
      bestScore = majScore;
      bestTonic = tonic;
      bestMode = 'major';
    }
    const minScore = pearsonCorrelation(rotated, MINOR_PROFILE);
    if (minScore > bestScore) {
      bestScore = minScore;
      bestTonic = tonic;
      bestMode = 'minor';
    }
  }

  return buildKeyInfo(bestTonic, bestMode);
}

const CANDIDATE_QUALITIES: ChordQuality[] = ['maj', 'min', '7', 'maj7', 'm7', 'sus4', 'sus2', 'dim', 'm7b5'];

/**
 * Identify the best-matching chord for a collection of notes in a measure/window.
 */
export function detectChordForNotes(
  notes: NoteEvent[],
  key: DetectedKey,
): { rootPc: number; bassPc: number; quality: ChordQuality; pitchClasses: number[] } {
  if (notes.length === 0) {
    const fallbackQuality: ChordQuality = key.mode === 'major' ? 'maj' : 'min';
    const ivs = CHORD_INTERVALS[fallbackQuality];
    return {
      rootPc: key.tonicPc,
      bassPc: key.tonicPc,
      quality: fallbackQuality,
      pitchClasses: ivs.map((iv) => mod12(key.tonicPc + iv)),
    };
  }

  const pcWeight = new Array<number>(12).fill(0);
  let lowestMidi = Infinity;
  let bassPc = mod12(notes[0].midi);

  for (const n of notes) {
    const pc = mod12(n.midi);
    const durW = Math.max(0.15, Math.min(2.5, n.durationSec));
    const handW = n.hand === 'left' ? 1.45 : 1.0;
    pcWeight[pc] += durW * handW;
    if (n.midi < lowestMidi) {
      lowestMidi = n.midi;
      bassPc = pc;
    }
  }

  const totalW = pcWeight.reduce((s, v) => s + v, 0) || 1;
  const scaleSet = new Set(key.scalePcs);

  let bestScore = -Infinity;
  let bestRoot = key.tonicPc;
  let bestQuality: ChordQuality = key.mode === 'major' ? 'maj' : 'min';

  for (let root = 0; root < 12; root++) {
    for (const quality of CANDIDATE_QUALITIES) {
      const ivs = CHORD_INTERVALS[quality];
      const toneSet = new Set(ivs.map((iv) => mod12(root + iv)));

      let matchedW = 0;
      let nonChordW = 0;
      for (let pc = 0; pc < 12; pc++) {
        if (toneSet.has(pc)) matchedW += pcWeight[pc];
        else nonChordW += pcWeight[pc];
      }

      // Count how many distinct chord tones are actually present
      let tonesPresent = 0;
      for (const pc of toneSet) {
        if (pcWeight[pc] > totalW * 0.05) tonesPresent++;
      }

      // Preference weights: root in bass, diatonic chord tones, simplicity of triad vs 7th unless 7th is clearly played
      const coverage = matchedW / totalW;
      const completeness = tonesPresent / ivs.length;
      const bassBonus = bassPc === root ? 0.24 : toneSet.has(bassPc) ? 0.08 : -0.05;
      const diatonicBonus = [...toneSet].every((pc) => scaleSet.has(pc)) ? 0.14 : 0;
      const seventhPenalty = ivs.length === 4 ? (tonesPresent >= 4 ? 0.05 : -0.14) : 0;
      const susDimPenalty = quality === 'dim' || quality === 'sus2' || quality === 'sus4' || quality === 'm7b5' ? -0.06 : 0;

      const score =
        coverage * 1.4 +
        completeness * 0.45 -
        (nonChordW / totalW) * 0.5 +
        bassBonus +
        diatonicBonus +
        seventhPenalty +
        susDimPenalty;

      if (score > bestScore) {
        bestScore = score;
        bestRoot = root;
        bestQuality = quality;
      }
    }
  }

  const pitchClasses = CHORD_INTERVALS[bestQuality].map((iv) => mod12(bestRoot + iv));
  const useSlashBass = bassPc !== bestRoot && pitchClasses.includes(bassPc);
  return {
    rootPc: bestRoot,
    bassPc: useSlashBass ? bassPc : bestRoot,
    quality: bestQuality,
    pitchClasses,
  };
}

/**
 * Analyze a full Song to detect its musical key and per-measure chord progression.
 */
export function analyzeSongHarmony(song: Song): {
  key: DetectedKey;
  chords: ChordEvent[];
} {
  const key = detectKeyFromNotes(song.notes);
  const measures =
    song.measures.length > 0
      ? song.measures
      : [
          {
            number: 1,
            startTimeSec: 0,
            endTimeSec: Math.max(2, song.durationSec),
            beats: 4,
            beatType: 4,
          },
        ];

  const chords: ChordEvent[] = [];
  let prevChord: ChordEvent | null = null;

  for (const m of measures) {
    const mNotes = song.notes.filter(
      (n) => n.startTimeSec >= m.startTimeSec - 0.03 && n.startTimeSec < m.endTimeSec - 0.02,
    );
    if (mNotes.length === 0 && prevChord) {
      chords.push({
        ...prevChord,
        measureNumber: m.number,
        startTimeSec: m.startTimeSec,
        endTimeSec: m.endTimeSec,
      });
      continue;
    }

    const detected = detectChordForNotes(mNotes, key);
    const ev: ChordEvent = {
      measureNumber: m.number,
      startTimeSec: m.startTimeSec,
      endTimeSec: m.endTimeSec,
      rootPc: detected.rootPc,
      bassPc: detected.bassPc,
      quality: detected.quality,
      symbol: formatChordSymbol(detected.rootPc, detected.quality, detected.bassPc),
      pitchClasses: detected.pitchClasses,
    };
    chords.push(ev);
    prevChord = ev;
  }

  return { key, chords };
}

const NOTE_LETTER_TO_PC: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/**
 * Parse a user-typed chord progression string like "C | G | Am7 | Fmaj7",
 * "Dm7 G7 Cmaj7", OR bracketed chord-and-lyric sheets like "[Am]Mưa buồn [Dm]rơi [E7]mãi [Am]".
 */
export function parseChordProgressionText(
  text: string,
  bpm = 90,
  beatsPerMeasure = 4,
): ChordEvent[] {
  const bracketMatches = [...text.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim());
  const tokens =
    bracketMatches.length > 0
      ? bracketMatches
      : text
          .split(/[\s|,;]+/)
          .map((s) => s.trim())
          .filter(Boolean);
  const secPerMeasure = (60 / Math.max(30, bpm)) * beatsPerMeasure;
  const result: ChordEvent[] = [];

  for (const raw of tokens) {
    const m = raw.match(/^([A-Ga-g])([#b]?)(maj7|m7b5|m7|dim|aug|sus4|sus2|m|7)?(?:\/([A-Ga-g])([#b]?))?$/i);
    if (!m) continue;
    const rootLetter = m[1].toUpperCase();
    const rootAcc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
    const rootPc = mod12(NOTE_LETTER_TO_PC[rootLetter] + rootAcc);

    const qualStr = (m[3] || '').toLowerCase();
    let quality: ChordQuality = 'maj';
    if (qualStr === 'm') quality = 'min';
    else if (qualStr === 'm7') quality = 'm7';
    else if (qualStr === 'maj7') quality = 'maj7';
    else if (qualStr === '7') quality = '7';
    else if (qualStr === 'dim') quality = 'dim';
    else if (qualStr === 'aug') quality = 'aug';
    else if (qualStr === 'sus2') quality = 'sus2';
    else if (qualStr === 'sus4') quality = 'sus4';
    else if (qualStr === 'm7b5') quality = 'm7b5';

    let bassPc = rootPc;
    if (m[4]) {
      const bAcc = m[5] === '#' ? 1 : m[5] === 'b' ? -1 : 0;
      bassPc = mod12(NOTE_LETTER_TO_PC[m[4].toUpperCase()] + bAcc);
    }

    const idx = result.length;
    result.push({
      measureNumber: idx + 1,
      startTimeSec: idx * secPerMeasure,
      endTimeSec: (idx + 1) * secPerMeasure,
      rootPc,
      bassPc,
      quality,
      symbol: formatChordSymbol(rootPc, quality, bassPc),
      pitchClasses: CHORD_INTERVALS[quality].map((iv) => mod12(rootPc + iv)),
    });
  }

  return result;
}
