import {
  generateAccompanimentSong,
} from '../accompaniment/accompanimentGenerator';
import {
  buildKeyInfo,
  parseChordProgressionText,
} from '../accompaniment/harmonyAnalyzer';
import { clampMidi } from '../noteNames';
import type { Hand, MeasureEvent, NoteEvent, Song } from '../types';

export type LessonLevel = 1 | 2 | 3;

export interface LessonItem {
  id: string;
  level: LessonLevel;
  code: string;
  sourceRef: string;
  titleVi: string;
  titleEn: string;
  goalVi: string;
  goalEn: string;
  fingeringTipVi: string;
  fingeringTipEn: string;
  bpm: number;
  buildSong: () => Song;
}

interface RawStep {
  beat: number;
  dur: number;
  midis: number[];
  hand: Hand;
  vel?: number;
}

function buildExerciseSong(opts: {
  id: string;
  title: string;
  composer: string;
  bpm: number;
  beatsPerMeasure?: number;
  totalMeasures: number;
  tonicPc: number;
  mode: 'major' | 'minor';
  steps: RawStep[];
}): Song {
  const bpm = opts.bpm;
  const beatsPerMeasure = opts.beatsPerMeasure ?? 4;
  const secPerBeat = 60 / bpm;
  const secPerMeasure = beatsPerMeasure * secPerBeat;

  const measures: MeasureEvent[] = [];
  for (let m = 0; m < opts.totalMeasures; m++) {
    measures.push({
      number: m + 1,
      startTimeSec: m * secPerMeasure,
      endTimeSec: (m + 1) * secPerMeasure,
      beats: beatsPerMeasure,
      beatType: 4,
    });
  }

  const notes: NoteEvent[] = [];
  let idCounter = 1;
  for (const st of opts.steps) {
    const startSec = st.beat * secPerBeat;
    const mNum = Math.min(opts.totalMeasures, Math.floor(st.beat / beatsPerMeasure) + 1);
    for (const m of st.midis) {
      notes.push({
        id: `${opts.id}-${idCounter++}`,
        midi: clampMidi(m),
        startTimeSec: startSec,
        durationSec: Math.max(0.12, st.dur * secPerBeat),
        velocity: st.vel ?? (st.hand === 'left' ? 0.7 : 0.82),
        hand: st.hand,
        measureNumber: mNum,
      });
    }
  }

  notes.sort((a, b) => a.startTimeSec - b.startTimeSec || a.midi - b.midi);
  const minMidi = notes.reduce((acc, n) => Math.min(acc, n.midi), 108);
  const maxMidi = notes.reduce((acc, n) => Math.max(acc, n.midi), 21);

  return {
    id: `lesson-${opts.id}`,
    title: opts.title,
    composer: opts.composer,
    sourceFormat: 'midi',
    createdAt: Date.now(),
    defaultBpm: bpm,
    durationSec: opts.totalMeasures * secPerMeasure,
    tempoEvents: [{ timeSec: 0, bpm }],
    measures,
    notes,
    minMidi,
    maxMidi,
    detectedKey: buildKeyInfo(opts.tonicPc, opts.mode),
  };
}

export const LESSON_CURRICULUM: ReadonlyArray<LessonItem> = [
  // ==================== LEVEL 1 (Beginner Foundation) ====================
  {
    id: 'lv1-c-position',
    level: 1,
    code: '1.1',
    sourceRef: 'Level 1 · 5-Finger Basics',
    titleVi: 'Thế Tay Đô 5 Ngón (C Position Warm-Up)',
    titleEn: 'C 5-Finger Position Warm-Up',
    goalVi: 'Làm quen 5 phím C–D–E–F–G cho cả tay phải (C4–G4) và tay trái (C3–G3), giữ ngón tay cong tròn đều lực.',
    goalEn: 'Master C–D–E–F–G five-finger position in both hands with curved fingers and steady quarter/half notes.',
    fingeringTipVi: 'Tay phải: ngón 1 trên C4 → 5 trên G4 · Tay trái: ngón 5 trên C3 → 1 trên G3.',
    fingeringTipEn: 'RH: 1 on C4 → 5 on G4 · LH: 5 on C3 → 1 on G3.',
    bpm: 84,
    buildSong: () => {
      const steps: RawStep[] = [];
      // M1-M2: RH C-D-E-F-G-F-E-D-C
      const rhSeq = [60, 62, 64, 65, 67, 65, 64, 62];
      rhSeq.forEach((m, i) => steps.push({ beat: i, dur: 0.9, midis: [m], hand: 'right' }));
      // M3-M4: LH C3-D3-E3-F3-G3-F3-E3-D3
      const lhSeq = [48, 50, 52, 53, 55, 53, 52, 50];
      lhSeq.forEach((m, i) => steps.push({ beat: 8 + i, dur: 0.9, midis: [m], hand: 'left' }));
      // M5-M8: Both hands together parallel + final C chord
      rhSeq.forEach((m, i) => {
        steps.push({ beat: 16 + i, dur: 0.9, midis: [m], hand: 'right' });
        steps.push({ beat: 16 + i, dur: 0.9, midis: [lhSeq[i]], hand: 'left' });
      });
      steps.push({ beat: 24, dur: 3.8, midis: [60, 64, 67], hand: 'right' });
      steps.push({ beat: 24, dur: 3.8, midis: [48, 55], hand: 'left' });
      return buildExerciseSong({
        id: 'lv1-c-position',
        title: 'Bài 1.1 · Thế Tay Đô 5 Ngón (C Position)',
        composer: 'Studio Curriculum · Level 1',
        bpm: 84,
        totalMeasures: 7,
        tonicPc: 0,
        mode: 'major',
        steps,
      });
    },
  },
  {
    id: 'lv1-primary-chords-c',
    level: 1,
    code: '1.2',
    sourceRef: 'Level 1 · Primary Chords',
    titleVi: '3 Hợp Âm Chính Trong Đô Trưởng (I – IV – V7 – I)',
    titleEn: 'Primary Chords in C Major (I – IV – V7 – I)',
    goalVi: 'Học cách chuyển mượt C → F → G7 → C bằng thế đảo gần nhất (không nhảy tay) cho cả hai tay.',
    goalEn: 'Connect C (C-E-G), F (C-F-A), and G7 (B-F-G) smoothly with minimal finger movement.',
    fingeringTipVi: 'C (1-3-5) → F (1-3-5 giữ nguyên C) → G7 (1-4-5 lùi C→B, giữ G).',
    fingeringTipEn: 'Keep common tones: C stays for F; G stays for G7 while thumb steps down to B.',
    bpm: 76,
    buildSong: () => {
      const steps: RawStep[] = [];
      const prog: Array<{ rh: number[]; lh: number[] }> = [
        { rh: [60, 64, 67], lh: [48, 52, 55] }, // C
        { rh: [60, 65, 69], lh: [48, 53, 57] }, // F/C
        { rh: [60, 64, 67], lh: [48, 52, 55] }, // C
        { rh: [59, 65, 67], lh: [47, 53, 55] }, // G7
        { rh: [60, 64, 67], lh: [48, 52, 55] }, // C
        { rh: [60, 65, 69], lh: [48, 53, 57] }, // F/C
        { rh: [59, 65, 67], lh: [47, 53, 55] }, // G7
        { rh: [60, 64, 67], lh: [48, 52, 55] }, // C
      ];
      prog.forEach((p, idx) => {
        const b = idx * 4;
        steps.push({ beat: b, dur: 1.9, midis: p.rh, hand: 'right' });
        steps.push({ beat: b + 2, dur: 1.9, midis: p.rh, hand: 'right', vel: 0.72 });
        steps.push({ beat: b, dur: 3.8, midis: p.lh, hand: 'left' });
      });
      return buildExerciseSong({
        id: 'lv1-primary-chords-c',
        title: 'Bài 1.2 · Hợp Âm Chính C – F – G7 – C',
        composer: 'Studio Curriculum · Level 1',
        bpm: 76,
        totalMeasures: 8,
        tonicPc: 0,
        mode: 'major',
        steps,
      });
    },
  },
  {
    id: 'lv1-middle-c-waltz',
    level: 1,
    code: '1.3',
    sourceRef: 'Level 1 · 3/4 Rhythm',
    titleVi: 'Thế Middle C & Nhịp Waltz 3/4 + Nốt Móc Đơn',
    titleEn: 'Middle C Position & 3/4 Waltz Time',
    goalVi: 'Đặt cả 2 ngón cái trên phím Đô giữa (C4), luyện nhịp 3/4 đung đưa và câu giai điệu có nốt móc đơn.',
    goalEn: 'Place both thumbs on Middle C, feel 3/4 waltz pulse, and read smooth eighth-note pairs.',
    fingeringTipVi: 'Cả 2 ngón cái chia sẻ phím C4; phách 1 nhấn nhẹ, phách 2–3 thả lỏng.',
    fingeringTipEn: 'Both thumbs share C4; gently accent beat 1 and lighten beats 2–3.',
    bpm: 96,
    buildSong: () => {
      const steps: RawStep[] = [];
      // 8 measures of 3/4 (24 beats)
      const melody: Array<[number, number, number]> = [
        [0, 1, 60], [1, 1, 64], [2, 1, 67],
        [3, 1.5, 65], [4.5, 0.5, 64], [5, 1, 62],
        [6, 1, 64], [7, 1, 67], [8, 1, 69],
        [9, 3, 67],
        [12, 1, 65], [13, 0.5, 64], [13.5, 0.5, 62], [14, 1, 60],
        [15, 1, 62], [16, 1, 64], [17, 1, 65],
        [18, 1.5, 64], [19.5, 0.5, 62], [20, 1, 59],
        [21, 3, 60],
      ];
      melody.forEach(([b, d, m]) => steps.push({ beat: b, dur: d * 0.95, midis: [m], hand: 'right' }));
      const bassBars = [48, 50, 48, 43, 45, 50, 43, 48];
      bassBars.forEach((root, idx) => {
        const b = idx * 3;
        steps.push({ beat: b, dur: 1.0, midis: [root], hand: 'left', vel: 0.76 });
        steps.push({ beat: b + 1, dur: 0.8, midis: [root + 7], hand: 'left', vel: 0.6 });
        steps.push({ beat: b + 2, dur: 0.8, midis: [root + 7], hand: 'left', vel: 0.56 });
      });
      return buildExerciseSong({
        id: 'lv1-middle-c-waltz',
        title: 'Bài 1.3 · Thế Middle C & Điệu Waltz 3/4',
        composer: 'Studio Curriculum · Level 1',
        bpm: 96,
        beatsPerMeasure: 3,
        totalMeasures: 8,
        tonicPc: 0,
        mode: 'major',
        steps,
      });
    },
  },
  {
    id: 'lv1-hanon-aerobics',
    level: 1,
    code: '1.4',
    sourceRef: 'Level 1 · Finger Technic',
    titleVi: 'Luyện Ngón Hanon & Giãn Quãng 6',
    titleEn: 'Hanon Finger Aerobics & 6th Intervals',
    goalVi: 'Tăng độ độc lập và đều lực cho ngón 4 & ngón 5 (ngón yếu nhất) theo mẫu Hanon số 1.',
    goalEn: 'Strengthen independent 4th & 5th fingers with classic Hanon #1 ascending/descending pattern.',
    fingeringTipVi: 'Bước lên: bỏ 1 phím giữa ngón 1 và ngón 2 (1-2-3-4-5-4-3-2). Giữ cổ tay mềm!',
    fingeringTipEn: 'Ascending: skip 1 key between fingers 1 & 2 (1-2-3-4-5-4-3-2). Keep wrists relaxed!',
    bpm: 88,
    buildSong: () => {
      const steps: RawStep[] = [];
      const scale = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
      let beat = 0;
      for (let start = 0; start < 4; start++) {
        const pat = [start, start + 2, start + 3, start + 4, start + 5, start + 4, start + 3, start + 2];
        pat.forEach((deg) => {
          steps.push({ beat, dur: 0.46, midis: [60 + scale[deg]], hand: 'right' });
          steps.push({ beat, dur: 0.46, midis: [48 + scale[deg]], hand: 'left' });
          beat += 0.5;
        });
      }
      for (let start = 4; start >= 1; start--) {
        const pat = [start + 5, start + 3, start + 2, start + 1, start, start + 1, start + 2, start + 3];
        pat.forEach((deg) => {
          steps.push({ beat, dur: 0.46, midis: [60 + scale[deg]], hand: 'right' });
          steps.push({ beat, dur: 0.46, midis: [48 + scale[deg]], hand: 'left' });
          beat += 0.5;
        });
      }
      return buildExerciseSong({
        id: 'lv1-hanon-aerobics',
        title: 'Bài 1.4 · Luyện Ngón Hanon Khởi Động',
        composer: 'Studio Curriculum · Level 1',
        bpm: 88,
        totalMeasures: 8,
        tonicPc: 0,
        mode: 'major',
        steps,
      });
    },
  },
  {
    id: 'lv1-c-scale-thumb',
    level: 1,
    code: '1.5',
    sourceRef: 'Level 1 · Major Scale',
    titleVi: 'Gam Đô Trưởng 2 Quãng Tám & Kỹ Thuật Luồn Ngón Cái',
    titleEn: 'C Major Scale (2 Octaves) & Thumb-Under Technique',
    goalVi: 'Chạy liền mạch Gam Đô Trưởng lên–xuống và rải 7 hợp âm bậc để mở khóa mọi bài đệm hát giọng C.',
    goalEn: 'Play smooth 2-octave C Major scale with thumb-under crossing plus all 7 diatonic chords.',
    fingeringTipVi: 'Tay phải lên: 1-2-3-[1]-2-3-4-[1]-2-3-[1]-2-3-4-5. Chuẩn bị ngón cái ngay khi ngón 2 bấm!',
    fingeringTipEn: 'RH ascending: 1-2-3-(1)-2-3-4-(1)-2-3-(1)-2-3-4-5. Prepare thumb early!',
    bpm: 92,
    buildSong: () =>
      generateAccompanimentSong({
        title: 'Bài 1.5 · Gam C Major',
        chords: [],
        key: buildKeyInfo(0, 'major'),
        styleId: 'scale-drill',
        bpm: 92,
      }),
  },

  // ==================== LEVEL 2 (Elementary Keys & Chords) ====================
  {
    id: 'lv2-g-major',
    level: 2,
    code: '2.1',
    sourceRef: 'Level 2 · Sharp Keys',
    titleVi: 'Giọng Sol Trưởng (G Major · 1# F#) & Hợp Âm G – C – D7',
    titleEn: 'Key of G Major (1# F#) & G – C – D7 Chords',
    goalVi: 'Làm quen hóa biểu 1 dấu thăng (F#) và rải Ballad mượt trên giọng Sol Trưởng.',
    goalEn: 'Master 1-sharp key signature (F#) with smooth ballad accompaniment in G Major.',
    fingeringTipVi: 'Mọi nốt Fa đều bấm phím đen F#! Hợp âm D7 dùng thế đảo F#–C–D rất gọn tay.',
    fingeringTipEn: 'Every F is F#! Play D7 in close inversion (F#–C–D) from G major.',
    bpm: 80,
    buildSong: () =>
      generateAccompanimentSong({
        title: 'Bài 2.1 · Giọng G Major (1#)',
        chords: parseChordProgressionText('G | Em | C | D7 | G | C | D7 | G', 80),
        key: buildKeyInfo(7, 'major'),
        styleId: 'ballad-basic',
        bpm: 80,
      }),
  },
  {
    id: 'lv2-f-major',
    level: 2,
    code: '2.2',
    sourceRef: 'Level 2 · Flat Keys',
    titleVi: 'Giọng Fa Trưởng (F Major · 1b Bb) & Hợp Âm F – Bb – C7',
    titleEn: 'Key of F Major (1b Bb) & F – Bb – C7 Chords',
    goalVi: 'Làm quen hóa biểu 1 dấu giáng (Bb) và rải 8 nốt trữ tình trên giọng Fa Trưởng.',
    goalEn: 'Practice 1-flat key signature (Bb) with flowing 8th-note ballad arpeggios.',
    fingeringTipVi: 'Chạy gam F Major tay phải dùng 1-2-3-4-[1]-2-3-4 (ngón 4 bấm phím đen Bb, không dùng ngón 5).',
    fingeringTipEn: 'RH F Major scale uses 1-2-3-4-1-2-3-4 so finger 4 lands naturally on Bb.',
    bpm: 76,
    buildSong: () =>
      generateAccompanimentSong({
        title: 'Bài 2.2 · Giọng F Major (1b)',
        chords: parseChordProgressionText('F | Dm | Bb | C7 | F | Bb | C7 | F', 76),
        key: buildKeyInfo(5, 'major'),
        styleId: 'ballad-arpeggio',
        bpm: 76,
      }),
  },
  {
    id: 'lv2-a-minor-bolero',
    level: 2,
    code: '2.3',
    sourceRef: 'Level 2 · Minor & Bolero',
    titleVi: 'Giọng La Thứ Hòa Thanh (Am · E7) & Điệu Bolero',
    titleEn: 'A Harmonic Minor (Am – Dm – E7) & Bolero',
    goalVi: 'Nắm vững nốt bậc 7 tăng (G# trong E7) và ghép điệu Bolero/Rumba đặc trưng trên tông thứ.',
    goalEn: 'Feel the harmonic minor pull of E7 (G#) resolving to Am in a classic Bolero groove.',
    fingeringTipVi: 'Tay trái giữ chắc Bùm (phách 1) – Bùm phụ bậc 5 (phách 3); tay phải chập gọn.',
    fingeringTipEn: 'Keep LH bass solid on beats 1 & 3 while RH plays light, crisp off-beat chords.',
    bpm: 84,
    buildSong: () =>
      generateAccompanimentSong({
        title: 'Bài 2.3 · La Thứ Hòa Thanh (Bolero)',
        chords: parseChordProgressionText('Am | Dm | E7 | Am | F | Dm | E7 | Am', 84),
        key: buildKeyInfo(9, 'minor'),
        styleId: 'bolero',
        bpm: 84,
      }),
  },
  {
    id: 'lv2-seventh-chords',
    level: 2,
    code: '2.4',
    sourceRef: 'Level 2 · 7th Chords',
    titleVi: 'Từ Vựng Hợp Âm Bảy (Swinging Sevenths)',
    titleEn: 'The 7th Chord Vocabulary (Swinging Sevenths)',
    goalVi: 'Làm quen 4 màu hợp âm bảy (Maj7, Min7, Dom7, m7b5) và luyện chuyển thế đảo mượt.',
    goalEn: 'Master Maj7, Min7, Dom7, and Half-Diminished 7th chords with smooth voice leading.',
    fingeringTipVi: 'Cảm nhận sự khác biệt giữa Cmaj7 (sáng mơ màng) và C7 (căng, hút sang Fmaj7).',
    fingeringTipEn: 'Listen closely to the shift from bright Cmaj7 to dominant C7 pulling into Fmaj7.',
    bpm: 100,
    buildSong: () =>
      generateAccompanimentSong({
        title: 'Bài 2.4 · Từ Vựng Hợp Âm Bảy',
        chords: parseChordProgressionText('Cmaj7 | C7 | Fmaj7 | Fm7 | Em7 | A7 | Dm7 | G7', 100),
        key: buildKeyInfo(0, 'major'),
        styleId: 'bossa-nova',
        bpm: 100,
      }),
  },
  {
    id: 'lv2-16th-rhythm',
    level: 2,
    code: '2.5',
    sourceRef: 'Level 2 · 16th & Groove',
    titleVi: 'Tiết Tấu Móc Kép (16th Notes) & Đảo Phách Pop',
    titleEn: '16th-Note Agility & Syncopated Pop Groove',
    goalVi: 'Kiểm soát đều tốc độ nhóm 4 nốt móc kép (`1-e-&-a`) và cảm nhận đảo phách Pop hiện đại.',
    goalEn: 'Develop crisp 16th-note subdivisions and syncopated Pop accompaniment timing.',
    fingeringTipVi: 'Đếm "1-e-and-a, 2-e-and-a" với Máy đếm nhịp (M) ở tốc độ 70% trước khi tăng lên 100%.',
    fingeringTipEn: 'Turn on Metronome (M) and start at 70% speed until every 16th-note is even.',
    bpm: 100,
    buildSong: () =>
      generateAccompanimentSong({
        title: 'Bài 2.5 · Pop Đảo Phách Hiện Đại',
        chords: parseChordProgressionText('C | G | Am | F | Dm7 | G7 | C | G', 100),
        key: buildKeyInfo(0, 'major'),
        styleId: 'pop-groove',
        bpm: 100,
      }),
  },

  // ==================== LEVEL 3 (Intermediate Harmony & Jazz) ====================
  {
    id: 'lv3-alberti-bass',
    level: 3,
    code: '3.1',
    sourceRef: 'Level 3 · Classical Pattern',
    titleVi: 'Kỹ Thuật Alberti Bass Cổ Điển (C – G – E – G)',
    titleEn: 'Classical Alberti Bass Pattern (C – G – E – G)',
    goalVi: 'Tập xoay cổ tay mềm mại cho mẫu tay trái `Thấp – Cao – Giữa – Cao` nổi tiếng của Mozart.',
    goalEn: 'Use gentle wrist rotation for Mozart-style Low–High–Mid–High left-hand accompaniment.',
    fingeringTipVi: 'Tay trái đánh thật nhẹ (p) để giai điệu tay phải hát nổi bật lên trên!',
    fingeringTipEn: 'Keep LH Alberti pattern soft (piano) so the RH melody sings effortlessly.',
    bpm: 96,
    buildSong: () => {
      const steps: RawStep[] = [];
      const bars: Array<{ lh: [number, number, number]; rh: Array<[number, number, number]> }> = [
        { lh: [48, 52, 55], rh: [[0, 2, 64], [2, 1, 67], [3, 1, 72]] }, // C
        { lh: [48, 53, 57], rh: [[0, 2, 69], [2, 2, 65]] }, // F
        { lh: [47, 50, 55], rh: [[0, 1.5, 67], [1.5, 0.5, 65], [2, 2, 62]] }, // G
        { lh: [48, 52, 55], rh: [[0, 4, 64]] }, // C
        { lh: [45, 48, 52], rh: [[0, 2, 69], [2, 1, 67], [3, 1, 64]] }, // Am
        { lh: [50, 53, 57], rh: [[0, 2, 65], [2, 2, 62]] }, // Dm
        { lh: [47, 53, 55], rh: [[0, 1, 62], [1, 1, 64], [2, 1, 65], [3, 1, 62]] }, // G7
        { lh: [48, 52, 55], rh: [[0, 4, 60]] }, // C
      ];
      bars.forEach((bar, bIdx) => {
        const base = bIdx * 4;
        const [lo, mid, hi] = bar.lh;
        const alb = [lo, hi, mid, hi, lo, hi, mid, hi];
        alb.forEach((m, i) =>
          steps.push({ beat: base + i * 0.5, dur: 0.46, midis: [m], hand: 'left', vel: i % 4 === 0 ? 0.66 : 0.54 }),
        );
        bar.rh.forEach(([off, d, m]) =>
          steps.push({ beat: base + off, dur: d * 0.95, midis: [m], hand: 'right', vel: 0.84 }),
        );
      });
      return buildExerciseSong({
        id: 'lv3-alberti-bass',
        title: 'Bài 3.1 · Đệm Alberti Bass Cổ Điển',
        composer: 'Studio Curriculum · Level 3',
        bpm: 96,
        totalMeasures: 8,
        tonicPc: 0,
        mode: 'major',
        steps,
      });
    },
  },
  {
    id: 'lv3-e-major-4sharps',
    level: 3,
    code: '3.2',
    sourceRef: 'Level 3 · 4-Sharp Keys',
    titleVi: 'Giọng Mi Trưởng (E Major · 4#) & Vòng Bậc 5',
    titleEn: 'Key of E Major (4# Sharps) & Circle of Fifths',
    goalVi: 'Chinh phục giọng 4 dấu thăng (F#, C#, G#, D#) — tông cực phổ biến trong Ballad & nhạc Anime.',
    goalEn: 'Play comfortably in 4-sharp E Major (F#, C#, G#, D#) used in countless modern ballads.',
    fingeringTipVi: 'Cụm phím đen giúp định vị tay cực dễ: đặt ngón 2–3 lên F#–G# và C#–D#.',
    fingeringTipEn: 'Use the black-key clusters (F#–G# and C#–D#) as natural tactile anchors.',
    bpm: 78,
    buildSong: () =>
      generateAccompanimentSong({
        title: 'Bài 3.2 · Giọng E Major (4#)',
        chords: parseChordProgressionText('E | B | C#m | A | E | B | A | E', 78),
        key: buildKeyInfo(4, 'major'),
        styleId: 'ballad-arpeggio',
        bpm: 78,
      }),
  },
  {
    id: 'lv3-mode-mixture',
    level: 3,
    code: '3.3',
    sourceRef: 'Level 3 · Mode Mixture',
    titleVi: 'Hợp Âm Vay Mượn Cảm Xúc (I – IV – iv – I & bVI – bVII)',
    titleEn: 'Borrowed Chords / Mode Mixture (IV → iv → I)',
    goalVi: 'Ứng dụng hợp âm vay mượn từ giọng thứ cùng tên (Fm, Ab, Bb trong giọng C) để tạo cao trào sâu lắng.',
    goalEn: 'Master bittersweet Mode Mixture (Fm, Ab, Bb borrowed into C Major) for cinematic ballads.',
    fingeringTipVi: 'Nghe kỹ bước bán cung đi xuống ở tay phải: A (trong F) → Ab (trong Fm) → G (trong C)!',
    fingeringTipEn: 'Highlight the chromatic voice-leading line: A (F) → Ab (Fm) → G (C).',
    bpm: 72,
    buildSong: () =>
      generateAccompanimentSong({
        title: 'Bài 3.3 · Hòa Thanh Vay Mượn (Mode Mixture)',
        chords: parseChordProgressionText('C | F | Fm | C | Am | Ab | Bb | C', 72),
        key: buildKeyInfo(0, 'major'),
        styleId: 'ballad-basic',
        bpm: 72,
      }),
  },
  {
    id: 'lv3-jazz-251',
    level: 3,
    code: '3.4',
    sourceRef: 'Level 3 · Jazz Swing',
    titleVi: 'Jazz Sequences: Walking Bass & II–V–I (Dm7 – G7 – Cmaj7)',
    titleEn: 'Jazz Swing: Walking Bass & II–V–I Turnaround',
    goalVi: 'Tập Walking Bass 4 phách tay trái kết hợp nhả hợp âm màu 7th/9th kiểu Charleston ở tay phải.',
    goalEn: 'Coordinate steady 4-beat LH walking bass with syncopated RH 7th-chord comping.',
    fingeringTipVi: 'Tập riêng tay trái Walking Bass trước, để ý phách 4 luôn dẫn nửa cung vào gốc ô nhịp sau!',
    fingeringTipEn: 'Master LH walking bass alone first; notice the chromatic approach note on beat 4.',
    bpm: 112,
    buildSong: () =>
      generateAccompanimentSong({
        title: 'Bài 3.4 · Jazz II–V–I Walking Bass',
        chords: parseChordProgressionText('Dm7 | G7 | Cmaj7 | Am7 | Dm7 | G7 | Em7 | A7', 112),
        key: buildKeyInfo(0, 'major'),
        styleId: 'jazz-swing',
        bpm: 112,
      }),
  },
  {
    id: 'lv3-jazz-tritone',
    level: 3,
    code: '3.5',
    sourceRef: 'Level 3 · Jazz Harmony',
    titleVi: 'Jazz Ballad & Thay Thế Tam Cung (Dm7 – Db7 – Cmaj7)',
    titleEn: 'Jazz Ballad & Tritone Substitution (Dm7 – Db7 – Cmaj7)',
    goalVi: 'Thay G7 bằng Db7 (chung tam cung B–F) tạo đường bass đi bán cung D → Db → C đầy mê hoặc.',
    goalEn: 'Apply Tritone Substitution (Db7 for G7) with warm spread 9th voicings.',
    fingeringTipVi: 'Đánh chậm, mềm, để các nốt màu bậc 7 & 9 ngân vang hòa quyện trong phòng hòa nhạc.',
    fingeringTipEn: 'Play slowly with light touch so the 7th and 9th tensions bloom warmly.',
    bpm: 68,
    buildSong: () =>
      generateAccompanimentSong({
        title: 'Bài 3.5 · Jazz Ballad & Tritone Sub',
        chords: parseChordProgressionText('Dm7 | Db7 | Cmaj7 | A7 | Dm7 | G7 | Fmaj7 | Cmaj7', 68),
        key: buildKeyInfo(0, 'major'),
        styleId: 'jazz-ballad',
        bpm: 68,
      }),
  },
];
