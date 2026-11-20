import { clampMidi } from '../noteNames';
import type {
  AccompanimentStyleId,
  ChordEvent,
  ChordQuality,
  DetectedKey,
  MeasureEvent,
  NoteEvent,
  Song,
} from '../types';
import {
  buildKeyInfo,
  CHORD_INTERVALS,
  formatChordSymbol,
  mod12,
  parseChordProgressionText,
} from './harmonyAnalyzer';

export type StyleGenre = 'ballad-pop' | 'jazz' | 'bolero-latin' | 'scale-drill';

export interface AccompanimentStyleMeta {
  id: AccompanimentStyleId;
  genre: StyleGenre;
  nameEn: string;
  nameVi: string;
  descEn: string;
  descVi: string;
  suggestedBpm: number;
  beatsPerMeasure: number;
  beatType: number;
  jazzColor?: boolean;
}

export const ACCOMPANIMENT_STYLES: ReadonlyArray<AccompanimentStyleMeta> = [
  {
    id: 'ballad-basic',
    genre: 'ballad-pop',
    nameEn: 'Ballad Arpeggio (1-5-8)',
    nameVi: 'Ballad Rải Cơ Bản (1-5-8)',
    descEn: 'LH smooth 1-5-8 arpeggio, RH voice-led block chords',
    descVi: 'Tay trái rải 1-5-8 mềm mại, tay phải giữ thế hợp âm đảo mượt',
    suggestedBpm: 76,
    beatsPerMeasure: 4,
    beatType: 4,
  },
  {
    id: 'ballad-arpeggio',
    genre: 'ballad-pop',
    nameEn: 'V-Pop / Ballad Flowing 8ths',
    nameVi: 'Ballad Rải Trữ Tình (8 nốt)',
    descEn: 'Continuous 8th-note broken chords flowing LH → RH',
    descVi: 'Rải móc đơn liên tục nối tay trái – phải (rất hợp V-Pop/Ballad)',
    suggestedBpm: 74,
    beatsPerMeasure: 4,
    beatType: 4,
  },
  {
    id: 'pop-groove',
    genre: 'ballad-pop',
    nameEn: 'Modern Pop Groove',
    nameVi: 'Pop Hiện Đại (Chập & Đảo Phách)',
    descEn: 'Solid octave bass with syncopated RH comping',
    descVi: 'Tay trái bass chắc, tay phải chập hợp âm có đảo phách hiện đại',
    suggestedBpm: 104,
    beatsPerMeasure: 4,
    beatType: 4,
  },
  {
    id: 'slow-rock-68',
    genre: 'ballad-pop',
    nameEn: 'Slow Rock / 6/8 Ballad',
    nameVi: 'Slow Rock / Ballad 6/8',
    descEn: 'Rolling 6/8 triplet arpeggios for romantic ballads',
    descVi: 'Rải chùm 3 nhịp 6/8 chậm rãi, sâu lắng',
    suggestedBpm: 88,
    beatsPerMeasure: 3,
    beatType: 4,
  },
  {
    id: 'jazz-swing',
    genre: 'jazz',
    nameEn: 'Jazz Swing (Walking Bass)',
    nameVi: 'Jazz Swing (Walking Bass + Comping)',
    descEn: 'LH quarter-note walking bass + RH 7th Charleston comping',
    descVi: 'Tay trái chạy Walking Bass 4 phách + tay phải nhả hợp âm màu 7th',
    suggestedBpm: 118,
    beatsPerMeasure: 4,
    beatType: 4,
    jazzColor: true,
  },
  {
    id: 'jazz-ballad',
    genre: 'jazz',
    nameEn: 'Jazz Ballad (Lush 7th/9th)',
    nameVi: 'Jazz Ballad (Hợp Âm Màu 7th/9th)',
    descEn: 'Warm spread 9th voicings with gentle LH root-7th shells',
    descVi: 'Thế bấm mở rộng maj9/m9 ấm áp, chuyển giọng mượt mà',
    suggestedBpm: 68,
    beatsPerMeasure: 4,
    beatType: 4,
    jazzColor: true,
  },
  {
    id: 'jazz-lofi',
    genre: 'jazz',
    nameEn: 'Lo-Fi / Neo-Soul Jazz',
    nameVi: 'Lo-Fi / Neo-Soul Jazz',
    descEn: 'Chill broken 9th chords with laid-back off-beat groove',
    descVi: 'Rải hợp âm màu maj9/m9 kiểu Lo-Fi thư giãn, nhấn nghịch phách nhẹ',
    suggestedBpm: 82,
    beatsPerMeasure: 4,
    beatType: 4,
    jazzColor: true,
  },
  {
    id: 'bossa-nova',
    genre: 'bolero-latin',
    nameEn: 'Bossa Nova (Latin Jazz)',
    nameVi: 'Bossa Nova (Latin Jazz)',
    descEn: 'Syncopated Brazilian clave comping with alternating root-5th bass',
    descVi: 'Tiết tấu Bossa Nova đảo phách + hợp âm màu 7th + bass luân phiên 1-5',
    suggestedBpm: 112,
    beatsPerMeasure: 4,
    beatType: 4,
    jazzColor: true,
  },
  {
    id: 'bolero',
    genre: 'bolero-latin',
    nameEn: 'Bolero / Rumba',
    nameVi: 'Bolero / Rumba Việt Nam',
    descEn: 'Classic Bolero pattern: Bass – Chord – Syncopated – Alt Bass – Chord',
    descVi: 'Điệu Bolero chuẩn: Bùm – Chát – chập đảo phách – Bùm phụ – Chát',
    suggestedBpm: 84,
    beatsPerMeasure: 4,
    beatType: 4,
  },
  {
    id: 'scale-drill',
    genre: 'scale-drill',
    nameEn: 'Scale & Diatonic Chords Drill',
    nameVi: 'Chạy Gam & Rải Hợp Âm Theo Tông',
    descEn: '2-octave scale run up/down + diatonic chords in the active key',
    descVi: 'Luyện chạy gam 2 quãng tám lên–xuống + rải 7 hợp âm bậc trong tông',
    suggestedBpm: 92,
    beatsPerMeasure: 4,
    beatType: 4,
  },
];

export interface PracticeProgressionPreset {
  id: string;
  nameEn: string;
  nameVi: string;
  defaultStyle: AccompanimentStyleId;
  defaultKeyPc: number;
  defaultMode: 'major' | 'minor';
  chordsText: string;
}

export const PRACTICE_PROGRESSIONS: ReadonlyArray<PracticeProgressionPreset> = [
  {
    id: 'pop-1564',
    nameEn: 'Pop Classic (I – V – vi – IV)',
    nameVi: 'Vòng Pop Kinh Điển (C – G – Am – F)',
    defaultStyle: 'ballad-basic',
    defaultKeyPc: 0,
    defaultMode: 'major',
    chordsText: 'C | G | Am | F | C | G | Am | F',
  },
  {
    id: 'vpop-canon',
    nameEn: 'V-Pop / Canon Ballad',
    nameVi: 'Vòng Canon / Ballad Việt (C – G – Am – Em – F – C – F – G)',
    defaultStyle: 'ballad-arpeggio',
    defaultKeyPc: 0,
    defaultMode: 'major',
    chordsText: 'C | G | Am | Em | F | C | F | G',
  },
  {
    id: 'jazz-251',
    nameEn: 'Jazz II–V–I Turnaround',
    nameVi: 'Vòng Jazz Chuẩn (Dm7 – G7 – Cmaj7 – Am7)',
    defaultStyle: 'jazz-swing',
    defaultKeyPc: 0,
    defaultMode: 'major',
    chordsText: 'Dm7 | G7 | Cmaj7 | Am7 | Dm7 | G7 | Cmaj7 | Cmaj7',
  },
  {
    id: 'jazz-autumn',
    nameEn: 'Jazz Standard (Autumn Leaves)',
    nameVi: 'Jazz Cổ Điển (Am7 – D7 – Gmaj7 – Cmaj7 – F#m7b5 – B7 – Em7)',
    defaultStyle: 'jazz-ballad',
    defaultKeyPc: 4,
    defaultMode: 'minor',
    chordsText: 'Am7 | D7 | Gmaj7 | Cmaj7 | F#m7b5 | B7 | Em7 | Em7',
  },
  {
    id: 'jazz-lofi-neo',
    nameEn: 'Lo-Fi Chill (Fmaj7 – Em7 – Dm7 – Cmaj7)',
    nameVi: 'Lo-Fi / Neo-Soul (Fmaj7 – Em7 – Dm7 – Cmaj7)',
    defaultStyle: 'jazz-lofi',
    defaultKeyPc: 0,
    defaultMode: 'major',
    chordsText: 'Fmaj7 | Em7 | Dm7 | Cmaj7 | Fmaj7 | Em7 | Dm7 | G7',
  },
  {
    id: 'bolero-minor',
    nameEn: 'Vietnamese Bolero (Am – Dm – E7 – Am)',
    nameVi: 'Vòng Bolero Trữ Tình (Am – Dm – E7 – Am – F – Dm – E7 – Am)',
    defaultStyle: 'bolero',
    defaultKeyPc: 9,
    defaultMode: 'minor',
    chordsText: 'Am | Dm | E7 | Am | F | Dm | E7 | Am',
  },
];

function upgradeQualityForJazz(quality: ChordQuality): ChordQuality {
  if (quality === 'maj') return 'maj7';
  if (quality === 'min') return 'm7';
  if (quality === 'dim') return 'm7b5';
  return quality;
}

/**
 * Choose the closest smooth-voice-led RH voicing around targetCenterMidi (typically C4..E5 = 60..76).
 */
function buildVoiceLedRhVoicing(
  rootPc: number,
  quality: ChordQuality,
  prevCenterMidi: number,
  addNinth = false,
): number[] {
  const baseIntervals = [...CHORD_INTERVALS[quality]];
  if (addNinth && (quality === 'maj7' || quality === 'm7' || quality === '7')) {
    baseIntervals.push(14); // 9th
  }
  const pcs = Array.from(new Set(baseIntervals.map((iv) => mod12(rootPc + iv))));

  // Generate candidate voicings across inversions in the middle-right piano register (58..79)
  let bestVoicing: number[] = [];
  let bestCost = Infinity;

  for (let startOct = 3; startOct <= 4; startOct++) {
    for (let rot = 0; rot < pcs.length; rot++) {
      const voicing: number[] = [];
      let cursor = startOct * 12 + pcs[rot];
      if (cursor < 57) cursor += 12;
      voicing.push(cursor);
      for (let i = 1; i < pcs.length; i++) {
        const pc = pcs[(rot + i) % pcs.length];
        let next = cursor + mod12(pc - mod12(cursor));
        if (next <= cursor) next += 12;
        voicing.push(next);
        cursor = next;
      }
      if (voicing[voicing.length - 1] > 81 || voicing[0] < 57) continue;
      const center = voicing.reduce((s, m) => s + m, 0) / voicing.length;
      const cost = Math.abs(center - prevCenterMidi);
      if (cost < bestCost) {
        bestCost = cost;
        bestVoicing = voicing;
      }
    }
  }

  if (bestVoicing.length === 0) {
    return baseIntervals.map((iv) => clampMidi(60 + rootPc + iv));
  }
  return bestVoicing.map(clampMidi);
}

function bassMidiForPc(pc: number, minMidi = 36, maxMidi = 48): number {
  let m = 36 + mod12(pc);
  while (m < minMidi) m += 12;
  while (m > maxMidi) m -= 12;
  return clampMidi(m);
}

/**
 * Generate a full playable Accompaniment Song from a Chord progression + Style + Key.
 */
export function generateAccompanimentSong(options: {
  title: string;
  chords: ChordEvent[];
  key: DetectedKey;
  styleId: AccompanimentStyleId;
  bpm?: number;
}): Song {
  const style =
    ACCOMPANIMENT_STYLES.find((s) => s.id === options.styleId) ?? ACCOMPANIMENT_STYLES[0];
  const bpm = Math.max(40, Math.min(200, Math.round(options.bpm ?? style.suggestedBpm)));
  const secPerBeat = 60 / bpm;

  // Special mode: Scale & Diatonic Chords Drill in the detected key
  if (style.id === 'scale-drill') {
    return generateScaleDrillSong(options.key, bpm);
  }

  const rawChords =
    options.chords.length > 0
      ? options.chords
      : parseChordProgressionText('C | G | Am | F', bpm, style.beatsPerMeasure);

  const beatsPerMeasure = style.beatsPerMeasure;
  const secPerMeasure = beatsPerMeasure * secPerBeat;

  const measures: MeasureEvent[] = [];
  const chordsOut: ChordEvent[] = [];
  const notes: NoteEvent[] = [];
  let idCounter = 1;
  let prevRhCenter = 66; // F#4 center for warm piano accompaniment

  const pushNote = (
    midi: number,
    startSec: number,
    durBeats: number,
    velocity: number,
    hand: 'left' | 'right',
    measureNumber: number,
  ) => {
    notes.push({
      id: `acc-${measureNumber}-${idCounter++}`,
      midi: clampMidi(midi),
      startTimeSec: Math.max(0, startSec),
      durationSec: Math.max(0.12, durBeats * secPerBeat),
      velocity: Math.max(0.25, Math.min(0.95, velocity)),
      hand,
      measureNumber,
    });
  };

  rawChords.forEach((rawChord, mIdx) => {
    const mNum = mIdx + 1;
    const mStart = mIdx * secPerMeasure;
    const mEnd = mStart + secPerMeasure;
    const effQuality = style.jazzColor ? upgradeQualityForJazz(rawChord.quality) : rawChord.quality;
    const effSymbol = formatChordSymbol(rawChord.rootPc, effQuality, rawChord.bassPc);
    const effPcs = CHORD_INTERVALS[effQuality].map((iv) => mod12(rawChord.rootPc + iv));

    measures.push({
      number: mNum,
      startTimeSec: mStart,
      endTimeSec: mEnd,
      beats: style.id === 'slow-rock-68' ? 6 : beatsPerMeasure,
      beatType: style.id === 'slow-rock-68' ? 8 : style.beatType,
    });

    chordsOut.push({
      measureNumber: mNum,
      startTimeSec: mStart,
      endTimeSec: mEnd,
      rootPc: rawChord.rootPc,
      bassPc: rawChord.bassPc,
      quality: effQuality,
      symbol: effSymbol,
      pitchClasses: effPcs,
    });

    const addNinth = style.id === 'jazz-ballad' || style.id === 'jazz-lofi';
    const rhVoicing = buildVoiceLedRhVoicing(rawChord.rootPc, effQuality, prevRhCenter, addNinth);
    prevRhCenter = rhVoicing.reduce((s, m) => s + m, 0) / rhVoicing.length;

    const bassRoot = bassMidiForPc(rawChord.bassPc, 36, 47);
    const fifthMidi = clampMidi(bassRoot + 7);
    const octaveMidi = clampMidi(bassRoot + 12);
    const nextChord = rawChords[(mIdx + 1) % rawChords.length];
    const nextBassRoot = bassMidiForPc(nextChord.bassPc, 36, 47);

    switch (style.id) {
      case 'ballad-basic': {
        // LH: 1 – 5 – 8 – 5 (beats 0, 1, 2, 3)
        pushNote(bassRoot, mStart, 2.0, 0.72, 'left', mNum);
        pushNote(fifthMidi, mStart + 1 * secPerBeat, 1.5, 0.62, 'left', mNum);
        pushNote(octaveMidi, mStart + 2 * secPerBeat, 1.5, 0.65, 'left', mNum);
        pushNote(fifthMidi, mStart + 3 * secPerBeat, 0.95, 0.58, 'left', mNum);
        // RH: Warm block chord on beat 1 & gentle re-touch on beat 3
        for (const m of rhVoicing) {
          pushNote(m, mStart, 2.0, 0.78, 'right', mNum);
          pushNote(m, mStart + 2 * secPerBeat, 1.9, 0.68, 'right', mNum);
        }
        break;
      }

      case 'ballad-arpeggio': {
        // Flowing 8th-note LH -> RH arpeggio: 1 - 5 - 8 - RH[0] - RH[1] - RH[2] - RH[1] - RH[0]
        const r0 = rhVoicing[0];
        const r1 = rhVoicing[1] ?? r0 + 4;
        const r2 = rhVoicing[2] ?? r1 + 3;
        const top = rhVoicing[rhVoicing.length - 1] ?? r2;
        const pattern: Array<{ midi: number; hand: 'left' | 'right'; vel: number; dur: number }> = [
          { midi: bassRoot, hand: 'left', vel: 0.76, dur: 2.0 },
          { midi: fifthMidi, hand: 'left', vel: 0.62, dur: 1.4 },
          { midi: octaveMidi, hand: 'left', vel: 0.66, dur: 1.2 },
          { midi: r0, hand: 'right', vel: 0.72, dur: 1.1 },
          { midi: r1, hand: 'right', vel: 0.76, dur: 1.2 },
          { midi: top, hand: 'right', vel: 0.8, dur: 1.2 },
          { midi: r2, hand: 'right', vel: 0.7, dur: 0.9 },
          { midi: r1, hand: 'right', vel: 0.66, dur: 0.6 },
        ];
        pattern.forEach((step, idx) => {
          pushNote(step.midi, mStart + idx * 0.5 * secPerBeat, step.dur, step.vel, step.hand, mNum);
        });
        break;
      }

      case 'pop-groove': {
        // LH: solid bass on beat 1, syncopated 2.5, beat 3
        pushNote(bassRoot, mStart, 1.4, 0.8, 'left', mNum);
        pushNote(octaveMidi, mStart + 1.5 * secPerBeat, 0.5, 0.66, 'left', mNum);
        pushNote(bassRoot, mStart + 2 * secPerBeat, 1.5, 0.76, 'left', mNum);
        pushNote(fifthMidi, mStart + 3.5 * secPerBeat, 0.45, 0.64, 'left', mNum);
        // RH: Pop rhythmic comping on 0, 1, 2.5, 3
        const hits = [
          { beat: 0, dur: 0.85, vel: 0.82 },
          { beat: 1, dur: 0.85, vel: 0.72 },
          { beat: 2.5, dur: 0.5, vel: 0.76 },
          { beat: 3, dur: 0.9, vel: 0.74 },
        ];
        for (const h of hits) {
          for (const m of rhVoicing) {
            pushNote(m, mStart + h.beat * secPerBeat, h.dur, h.vel, 'right', mNum);
          }
        }
        break;
      }

      case 'slow-rock-68': {
        // 3 quarter-note beats subdivided into 6 eighth-note pulses (0, 0.5, 1, 1.5, 2, 2.5)
        const r0 = rhVoicing[0];
        const r1 = rhVoicing[1] ?? r0 + 4;
        const r2 = rhVoicing[rhVoicing.length - 1] ?? r1 + 3;
        pushNote(bassRoot, mStart, 1.5, 0.76, 'left', mNum);
        pushNote(fifthMidi, mStart + 0.5 * secPerBeat, 1.0, 0.62, 'left', mNum);
        pushNote(octaveMidi, mStart + 1.0 * secPerBeat, 1.0, 0.66, 'left', mNum);
        pushNote(r0, mStart + 1.5 * secPerBeat, 0.8, 0.74, 'right', mNum);
        pushNote(r1, mStart + 2.0 * secPerBeat, 0.8, 0.76, 'right', mNum);
        pushNote(r2, mStart + 2.5 * secPerBeat, 0.6, 0.72, 'right', mNum);
        // Subtle RH chord anchor on beat 1
        for (const m of rhVoicing) {
          pushNote(m, mStart, 1.3, 0.66, 'right', mNum);
        }
        break;
      }

      case 'jazz-swing': {
        // LH: 4-beat Walking Bass (Root -> 3rd -> 5th -> chromatic approach to next root!)
        const thirdIv = effQuality === 'min' || effQuality === 'm7' || effQuality === 'm7b5' ? 3 : 4;
        const fifthIv = effQuality === 'm7b5' || effQuality === 'dim' ? 6 : 7;
        const approach = nextBassRoot > bassRoot ? nextBassRoot - 1 : nextBassRoot + 1;
        const walk = [bassRoot, bassRoot + thirdIv, bassRoot + fifthIv, approach];
        walk.forEach((m, b) => {
          pushNote(m, mStart + b * secPerBeat, 0.92, b === 0 ? 0.78 : 0.68, 'left', mNum);
        });
        // RH: Jazz Charleston swing comping (beat 1 + swing-and-of-2 at 1.67 + beat 3.67)
        const compHits = [
          { beat: 0, dur: 0.65, vel: 0.78 },
          { beat: 1.67, dur: 0.5, vel: 0.7 },
          { beat: 3.33, dur: 0.55, vel: 0.66 },
        ];
        for (const h of compHits) {
          for (const m of rhVoicing) {
            pushNote(m, mStart + h.beat * secPerBeat, h.dur, h.vel, 'right', mNum);
          }
        }
        break;
      }

      case 'jazz-ballad': {
        // LH: Open shell voicing (Root + 7th or Root + 5th) held richly
        const seventhIv = effQuality === 'maj7' ? 11 : 10;
        pushNote(bassRoot, mStart, 3.8, 0.72, 'left', mNum);
        pushNote(bassRoot + seventhIv, mStart + 0.12 * secPerBeat, 3.5, 0.6, 'left', mNum);
        // RH: Gently rolled lush 9th voicing on beat 1 + soft color re-voicing on beat 3
        rhVoicing.forEach((m, i) => {
          pushNote(m, mStart + i * 0.06 * secPerBeat, 2.2, 0.74, 'right', mNum);
        });
        rhVoicing.forEach((m, i) => {
          pushNote(m, mStart + (2.5 + i * 0.05) * secPerBeat, 1.4, 0.64, 'right', mNum);
        });
        break;
      }

      case 'jazz-lofi': {
        // LH: Warm root + fifth on 1 & laid-back pickup on 3.5
        pushNote(bassRoot, mStart, 2.6, 0.74, 'left', mNum);
        pushNote(fifthMidi, mStart + 2.5 * secPerBeat, 1.2, 0.6, 'left', mNum);
        // RH: Broken chill 9th voicing with slight swing micro-timing
        rhVoicing.forEach((m, i) => {
          pushNote(m, mStart + (0.04 * i) * secPerBeat, 1.6, 0.74, 'right', mNum);
        });
        // Syncopated gentle chord stab on 1.67 & 3.0
        for (const m of rhVoicing) {
          pushNote(m, mStart + 1.67 * secPerBeat, 0.9, 0.66, 'right', mNum);
        }
        const topNote = rhVoicing[rhVoicing.length - 1];
        pushNote(topNote, mStart + 3.0 * secPerBeat, 0.85, 0.68, 'right', mNum);
        break;
      }

      case 'bossa-nova': {
        // LH: Bossa dotted-quarter alternating bass (1, 1.5, 2, 3.5)
        pushNote(bassRoot, mStart, 1.4, 0.76, 'left', mNum);
        pushNote(fifthMidi, mStart + 1.5 * secPerBeat, 0.5, 0.64, 'left', mNum);
        pushNote(fifthMidi, mStart + 2.0 * secPerBeat, 1.4, 0.72, 'left', mNum);
        pushNote(bassRoot, mStart + 3.5 * secPerBeat, 0.45, 0.64, 'left', mNum);
        // RH: Classic Bossa Nova clave comping (0, 1.5, 2.5, 3.5)
        const bossaHits = [
          { beat: 0, dur: 0.75, vel: 0.78 },
          { beat: 1.5, dur: 0.75, vel: 0.72 },
          { beat: 2.5, dur: 0.65, vel: 0.68 },
          { beat: 3.5, dur: 0.45, vel: 0.72 },
        ];
        for (const h of bossaHits) {
          for (const m of rhVoicing) {
            pushNote(m, mStart + h.beat * secPerBeat, h.dur, h.vel, 'right', mNum);
          }
        }
        break;
      }

      case 'bolero': {
        // Classic Vietnamese Bolero: Bass 1 -> Chord 1.5 -> Chord 2 -> Syncopated 2.5 -> Alt Bass 3 -> Chord 3.5
        pushNote(bassRoot, mStart, 1.4, 0.8, 'left', mNum);
        pushNote(fifthMidi, mStart + 2.0 * secPerBeat, 0.95, 0.7, 'left', mNum);
        pushNote(bassRoot, mStart + 3.0 * secPerBeat, 0.95, 0.72, 'left', mNum);

        const boleroHits = [
          { beat: 0.5, dur: 0.45, vel: 0.66 },
          { beat: 1.0, dur: 0.45, vel: 0.72 },
          { beat: 1.5, dur: 0.45, vel: 0.68 },
          { beat: 2.5, dur: 0.45, vel: 0.74 },
          { beat: 3.5, dur: 0.45, vel: 0.7 },
        ];
        for (const h of boleroHits) {
          for (const m of rhVoicing) {
            pushNote(m, mStart + h.beat * secPerBeat, h.dur, h.vel, 'right', mNum);
          }
        }
        break;
      }
    }
  });

  notes.sort((a, b) => a.startTimeSec - b.startTimeSec || a.midi - b.midi);
  const minMidi = notes.reduce((acc, n) => Math.min(acc, n.midi), 108);
  const maxMidi = notes.reduce((acc, n) => Math.max(acc, n.midi), 21);

  return {
    id: `acc-${style.id}-${Date.now()}`,
    title: `${options.title} — ${style.nameVi}`,
    composer: `${options.key.label} · ${style.nameEn}`,
    sourceFormat: 'midi',
    createdAt: Date.now(),
    defaultBpm: bpm,
    durationSec: Math.max(2, rawChords.length * secPerMeasure),
    tempoEvents: [{ timeSec: 0, bpm }],
    measures,
    notes,
    minMidi,
    maxMidi,
    chords: chordsOut,
    detectedKey: options.key,
  };
}

/**
 * Generate a 2-octave Scale Run + Diatonic Chord Arpeggio drill in any key.
 */
function generateScaleDrillSong(key: DetectedKey, bpm: number): Song {
  const secPerBeat = 60 / bpm;
  const secPerMeasure = 4 * secPerBeat;
  const notes: NoteEvent[] = [];
  const measures: MeasureEvent[] = [];
  const chords: ChordEvent[] = [];
  let idCounter = 1;

  const intervals = key.mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
  const rhRoot = 60 + key.tonicPc;
  const lhRoot = 48 + key.tonicPc;

  // Build 2-octave ascending + descending scale (28 notes + final tonic = 32 eighth notes = 4 measures!)
  const upOffsets = [
    ...intervals,
    ...intervals.map((iv) => iv + 12),
    24,
  ];
  const downOffsets = [...upOffsets].reverse().slice(1);
  const scaleRun = [...upOffsets, ...downOffsets, 0]; // 30 notes -> fits cleanly in 4 measures

  for (let m = 0; m < 4; m++) {
    const start = m * secPerMeasure;
    measures.push({
      number: m + 1,
      startTimeSec: start,
      endTimeSec: start + secPerMeasure,
      beats: 4,
      beatType: 4,
    });
    const tonicQuality: ChordQuality = key.mode === 'major' ? 'maj' : 'min';
    chords.push({
      measureNumber: m + 1,
      startTimeSec: start,
      endTimeSec: start + secPerMeasure,
      rootPc: key.tonicPc,
      bassPc: key.tonicPc,
      quality: tonicQuality,
      symbol: formatChordSymbol(key.tonicPc, tonicQuality),
      pitchClasses: CHORD_INTERVALS[tonicQuality].map((iv) => mod12(key.tonicPc + iv)),
    });
  }

  scaleRun.forEach((off, idx) => {
    const t = idx * 0.5 * secPerBeat;
    const mNum = Math.floor(idx / 8) + 1;
    const dur = idx === scaleRun.length - 1 ? 1.5 * secPerBeat : 0.48 * secPerBeat;
    notes.push({
      id: `scale-rh-${idCounter++}`,
      midi: clampMidi(rhRoot + off),
      startTimeSec: t,
      durationSec: dur,
      velocity: idx % 4 === 0 ? 0.86 : 0.74,
      hand: 'right',
      measureNumber: mNum,
    });
    notes.push({
      id: `scale-lh-${idCounter++}`,
      midi: clampMidi(lhRoot + off),
      startTimeSec: t,
      durationSec: dur,
      velocity: idx % 4 === 0 ? 0.72 : 0.62,
      hand: 'left',
      measureNumber: mNum,
    });
  });

  // Measures 5..12: All 7 diatonic chords + return to I (arpeggiated 1-3-5-8!)
  const diatonicCycle = [...key.diatonicChords, key.diatonicChords[0]];
  diatonicCycle.forEach((dc, idx) => {
    const mNum = 5 + idx;
    const mStart = (mNum - 1) * secPerMeasure;
    measures.push({
      number: mNum,
      startTimeSec: mStart,
      endTimeSec: mStart + secPerMeasure,
      beats: 4,
      beatType: 4,
    });
    chords.push({
      measureNumber: mNum,
      startTimeSec: mStart,
      endTimeSec: mStart + secPerMeasure,
      rootPc: dc.rootPc,
      bassPc: dc.rootPc,
      quality: dc.quality,
      symbol: `${dc.symbol} (${dc.roman})`,
      pitchClasses: CHORD_INTERVALS[dc.quality].map((iv) => mod12(dc.rootPc + iv)),
    });

    const bass = bassMidiForPc(dc.rootPc, 36, 47);
    const ivs = CHORD_INTERVALS[dc.quality];
    const rhTones = [...ivs.map((iv) => clampMidi(60 + dc.rootPc + iv)), clampMidi(72 + dc.rootPc)];
    // LH root + 5th
    notes.push({
      id: `scale-ch-lh-${idCounter++}`,
      midi: bass,
      startTimeSec: mStart,
      durationSec: 3.6 * secPerBeat,
      velocity: 0.74,
      hand: 'left',
      measureNumber: mNum,
    });
    // RH arpeggio up then block chord
    rhTones.forEach((m, i) => {
      notes.push({
        id: `scale-ch-rh-${idCounter++}`,
        midi: m,
        startTimeSec: mStart + i * 0.5 * secPerBeat,
        durationSec: 1.5 * secPerBeat,
        velocity: 0.78,
        hand: 'right',
        measureNumber: mNum,
      });
    });
    for (const m of rhTones.slice(0, 3)) {
      notes.push({
        id: `scale-ch-blk-${idCounter++}`,
        midi: m,
        startTimeSec: mStart + 2.5 * secPerBeat,
        durationSec: 1.3 * secPerBeat,
        velocity: 0.74,
        hand: 'right',
        measureNumber: mNum,
      });
    }
  });

  notes.sort((a, b) => a.startTimeSec - b.startTimeSec || a.midi - b.midi);
  const minMidi = notes.reduce((acc, n) => Math.min(acc, n.midi), 108);
  const maxMidi = notes.reduce((acc, n) => Math.max(acc, n.midi), 21);

  return {
    id: `scale-drill-${key.tonicPc}-${key.mode}-${Date.now()}`,
    title: `Chạy Gam & Hợp Âm — ${key.label}`,
    composer: `Scale & Diatonic Chords`,
    sourceFormat: 'midi',
    createdAt: Date.now(),
    defaultBpm: bpm,
    durationSec: measures.length * secPerMeasure,
    tempoEvents: [{ timeSec: 0, bpm }],
    measures,
    notes,
    minMidi,
    maxMidi,
    chords,
    detectedKey: key,
  };
}

export function buildPresetAccompanimentSong(
  presetId: string,
  styleId: AccompanimentStyleId,
  tonicPc?: number,
  mode?: 'major' | 'minor',
  bpm?: number,
): Song {
  const preset =
    PRACTICE_PROGRESSIONS.find((p) => p.id === presetId) ?? PRACTICE_PROGRESSIONS[0];
  const targetTonic = tonicPc ?? preset.defaultKeyPc;
  const targetMode = mode ?? preset.defaultMode;
  const key = buildKeyInfo(targetTonic, targetMode);
  const style = ACCOMPANIMENT_STYLES.find((s) => s.id === styleId) ?? ACCOMPANIMENT_STYLES[0];
  const baseChords = parseChordProgressionText(
    preset.chordsText,
    bpm ?? style.suggestedBpm,
    style.beatsPerMeasure,
  );

  // Transpose preset chords if user picked a different key than preset default
  const shift = mod12(targetTonic - preset.defaultKeyPc);
  const transposedChords: ChordEvent[] =
    shift === 0
      ? baseChords
      : baseChords.map((c) => {
          const newRoot = mod12(c.rootPc + shift);
          const newBass = mod12(c.bassPc + shift);
          return {
            ...c,
            rootPc: newRoot,
            bassPc: newBass,
            symbol: formatChordSymbol(newRoot, c.quality, newBass),
            pitchClasses: c.pitchClasses.map((pc) => mod12(pc + shift)),
          };
        });

  return generateAccompanimentSong({
    title: preset.nameVi.split('(')[0].trim(),
    chords: transposedChords,
    key,
    styleId,
    bpm: bpm ?? style.suggestedBpm,
  });
}
