import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Compass,
  Headphones,
  Layers,
  ListMusic,
  Music,
  Volume2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { NotePlayer } from '../audio/pianoSynth';
import {
  buildKeyInfo,
  CHORD_INTERVALS,
  formatPitchClass,
  mod12,
  PC_NAMES_SHARP,
} from '../core/accompaniment/harmonyAnalyzer';
import type { ChordQuality, Language } from '../core/types';

interface TheoryGuideTabProps {
  language: Language;
  player?: NotePlayer;
  initialTonicPc?: number;
  initialMode?: 'major' | 'minor';
}

type GuideSection = 'scales' | 'harmony' | 'progressions' | 'patterns' | 'roadmap';

interface ScaleDef {
  id: string;
  nameVi: string;
  nameEn: string;
  intervals: number[];
  formula: string;
  useVi: string;
  useEn: string;
}

const SCALE_DEFS: ReadonlyArray<ScaleDef> = [
  {
    id: 'major',
    nameVi: 'Trưởng (Ionian / Major)',
    nameEn: 'Major (Ionian)',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    formula: '1 – 1 – ½ – 1 – 1 – 1 – ½',
    useVi: 'Sáng, vui. Nền tảng cho hợp âm Imaj7 và đa số bài Pop/Ballad.',
    useEn: 'Bright, stable. Foundation for Imaj7 and most Pop/Ballad songs.',
  },
  {
    id: 'natural-minor',
    nameVi: 'Thứ tự nhiên (Aeolian)',
    nameEn: 'Natural Minor (Aeolian)',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    formula: '1 – ½ – 1 – 1 – ½ – 1 – 1',
    useVi: 'Trữ tình, buồn sâu lắng. Dùng cho hầu hết Ballad thứ & nhạc Việt.',
    useEn: 'Emotional, melancholic. Core scale for minor ballads and V-Pop.',
  },
  {
    id: 'harmonic-minor',
    nameVi: 'Thứ hòa thanh (Harmonic Minor)',
    nameEn: 'Harmonic Minor',
    intervals: [0, 2, 3, 5, 7, 8, 11],
    formula: '1 – ½ – 1 – 1 – ½ – 1½ – ½',
    useVi: 'Nâng bậc 7 lên ½ cung → tạo hợp âm V7 (vd E7 trong Am) cực hút trong Bolero & Cổ điển.',
    useEn: 'Raised 7th degree creates dominant V7 (e.g. E7 in Am) for Bolero & Classical pull.',
  },
  {
    id: 'major-pent',
    nameVi: 'Ngũ cung Trưởng (Major Pentatonic)',
    nameEn: 'Major Pentatonic',
    intervals: [0, 2, 4, 7, 9],
    formula: '1 – 2 – 3 – 5 – 6 (bỏ bậc 4 & 7)',
    useVi: 'Câu lót (Fill-in) an toàn nhất cho đệm hát: bấm nốt nào cũng êm tai, không bị chỏi!',
    useEn: 'Foolproof vocal fill-in scale: omits half-step tensions so every note blends cleanly.',
  },
  {
    id: 'minor-pent',
    nameVi: 'Ngũ cung Thứ (Minor Pentatonic)',
    nameEn: 'Minor Pentatonic',
    intervals: [0, 3, 5, 7, 10],
    formula: '1 – b3 – 4 – 5 – b7',
    useVi: 'Rất hợp Pop/Rock, R&B và lót câu trên tông thứ.',
    useEn: 'Essential for Pop/Rock, R&B, and expressive minor-key fills.',
  },
  {
    id: 'blues',
    nameVi: 'Âm giai Blues (Blues Scale)',
    nameEn: 'Blues Scale',
    intervals: [0, 3, 5, 6, 7, 10],
    formula: '1 – b3 – 4 – b5 – 5 – b7',
    useVi: 'Thêm "Blue note" (b5) tạo chất Blues / Jazz / Soul cực ngầu.',
    useEn: 'Adds the expressive b5 "blue note" for Blues, Jazz, and Soul licks.',
  },
  {
    id: 'dorian',
    nameVi: 'Dorian (Jazz / Lo-Fi)',
    nameEn: 'Dorian Mode (Jazz / Lo-Fi)',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    formula: 'Thứ tự nhiên + nâng bậc 6 trưởng',
    useVi: 'Âm giai chuẩn cho hợp âm bậc ii7 trong Jazz II–V–I (vd D Dorian trên Dm7) và Lo-Fi.',
    useEn: 'The go-to Jazz scale for ii7 chords (e.g. D Dorian over Dm7) and Neo-Soul/Lo-Fi.',
  },
  {
    id: 'mixolydian',
    nameVi: 'Mixolydian (Hợp âm V7)',
    nameEn: 'Mixolydian Mode (Dominant 7)',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    formula: 'Trưởng + hạ bậc 7 xuống b7',
    useVi: 'Âm giai chuẩn cho hợp âm át V7 (vd G Mixolydian trên G7) trong Jazz & Pop.',
    useEn: 'The standard chord-scale for dominant V7 chords (e.g. G Mixolydian over G7).',
  },
];

const RELATIVE_PAIRS: ReadonlyArray<{ major: string; minor: string; sig: string }> = [
  { major: 'C', minor: 'Am', sig: '0' },
  { major: 'G', minor: 'Em', sig: '1# (F#)' },
  { major: 'D', minor: 'Bm', sig: '2# (F#, C#)' },
  { major: 'A', minor: 'F#m', sig: '3# (F#, C#, G#)' },
  { major: 'E', minor: 'C#m', sig: '4# (F#, C#, G#, D#)' },
  { major: 'F', minor: 'Dm', sig: '1b (Bb)' },
  { major: 'Bb', minor: 'Gm', sig: '2b (Bb, Eb)' },
  { major: 'Eb', minor: 'Cm', sig: '3b (Bb, Eb, Ab)' },
];

const PROGRESSION_CARDS = [
  {
    genre: 'Pop / Ballad',
    color: 'border-cyan-500/40 bg-cyan-950/20',
    badge: 'bg-cyan-500/20 text-cyan-200',
    roman: 'I – V – vi – IV',
    example: 'C – G – Am – F',
    descVi: 'Vòng "Best-Seller" cho hàng nghìn bài Pop/Ballad. Sáng, dễ nghe, dễ hát.',
    descEn: 'The classic "Best-Seller" progression. Bright, emotional, and easy to sing over.',
  },
  {
    genre: 'V-Pop / Canon',
    color: 'border-violet-500/40 bg-violet-950/20',
    badge: 'bg-violet-500/20 text-violet-200',
    roman: 'I – V – vi – iii – IV – I – IV – V',
    example: 'C – G/B – Am – Em/G – F – C/E – Dm7 – G',
    descVi: 'Rất phổ biến trong nhạc Việt & Ballad buồn. Dùng đảo bass (Slash Bass) tạo đường bass đi xuống liền bậc cực mượt.',
    descEn: 'Classic Canon/V-Pop progression. Pair with descending slash bass for smooth voice leading.',
  },
  {
    genre: 'Royal Road (Nhật / Việt)',
    color: 'border-pink-500/40 bg-pink-950/20',
    badge: 'bg-pink-500/20 text-pink-200',
    roman: 'IVmaj7 – V7 – iii7 – vi7',
    example: 'Fmaj7 – G7 – Em7 – Am7',
    descVi: 'Vòng "con đường hoàng gia" cực bắt tai trong Anime & V-Pop hiện đại, giàu cảm xúc hoài niệm.',
    descEn: 'The iconic Royal Road progression used in Anime & modern ballads — rich and nostalgic.',
  },
  {
    genre: 'Mode Mixture (Vay mượn)',
    color: 'border-rose-500/40 bg-rose-950/20',
    badge: 'bg-rose-500/20 text-rose-200',
    roman: 'I – IV – iv – I  /  I – bVI – bVII – I',
    example: 'C – F – Fm – C  /  C – Ab – Bb – C',
    descVi: 'Kỹ thuật vay hợp âm từ giọng Thứ cùng tên: thêm Fm vào giọng C tạo cảm giác "thắt tim" cực đắt giá cuối điệp khúc!',
    descEn: 'Borrowed chords from parallel minor: IV → iv → I adds instant emotional bittersweet color.',
  },
  {
    genre: 'Jazz Chuẩn (II–V–I)',
    color: 'border-amber-500/40 bg-amber-950/20',
    badge: 'bg-amber-500/20 text-amber-200',
    roman: 'ii7 – V7 – Imaj7 – vi7',
    example: 'Dm9 – G13 – Cmaj9 – Am7',
    descVi: 'Xương sống của mọi bản Jazz. Thay V7 bằng Tritone Sub (Db7 thay cho G7) tạo đường bass đi nửa cung D → Db → C cực sang!',
    descEn: 'Backbone of Jazz. Try Tritone Substitution (Dm7 – Db7 – Cmaj7) for chromatic bass motion.',
  },
  {
    genre: 'Bolero / Rumba (Thứ)',
    color: 'border-emerald-500/40 bg-emerald-950/20',
    badge: 'bg-emerald-500/20 text-emerald-200',
    roman: 'i – iv – V7 – i  /  i – VI – iv – V7',
    example: 'Am – Dm – E7 – Am  /  Am – F – Dm – E7',
    descVi: 'Dùng bậc V7 (E7 có nốt G# thuộc Thứ hòa thanh) để tạo sức hút mạnh về chủ âm Am.',
    descEn: 'Uses dominant V7 (E7 with raised G# from harmonic minor) for strong pull back to Am.',
  },
];

const RHYTHM_PATTERNS = [
  {
    titleVi: '1. Ballad Rải Cơ Bản (1–5–8) · Nhịp 4/4',
    titleEn: '1. Basic Ballad Arpeggio (1–5–8) · 4/4',
    beats: ['1', '&', '2', '&', '3', '&', '4', '&'],
    rh: ['Hợp âm', '·', '·', '·', 'Hợp âm', '·', '·', '·'],
    lh: ['Bậc 1', '·', 'Bậc 5', '·', 'Bậc 8', '·', 'Bậc 5', '·'],
    tipVi: 'Tay trái rải 1–5–8 đều, tay phải giữ thế hợp âm đảo gần nhất. Nhấc & đạp lại pedal khi đổi hợp âm.',
    tipEn: 'LH rolls 1–5–8 smoothly; RH holds close voice-led chords. Refresh pedal on every chord change.',
  },
  {
    titleVi: '2. Ballad Rải Trữ Tình (8 nốt V-Pop) · Nhịp 4/4',
    titleEn: '2. Flowing V-Pop 8th Arpeggio · 4/4',
    beats: ['1', '&', '2', '&', '3', '&', '4', '&'],
    rh: ['·', '·', '·', 'Nốt 1', 'Nốt 2', 'Nốt 3', 'Nốt 2', 'Nốt 1'],
    lh: ['Bậc 1', 'Bậc 5', 'Bậc 8', '·', '·', '·', '·', '·'],
    tipVi: 'Chia đều 8 móc đơn nối liền từ tay trái lên tay phải. Rất hợp đoạn vào lời (Verse) nhẹ nhàng.',
    tipEn: 'Continuous 8th-note wave passing smoothly from LH to RH. Ideal for intimate verses.',
  },
  {
    titleVi: '3. Pop Hiện Đại (Chập & Đảo Phách) · Nhịp 4/4',
    titleEn: '3. Modern Pop Groove (Syncopated) · 4/4',
    beats: ['1', '&', '2', '&', '3', '&', '4', '&'],
    rh: ['Chập', '·', 'Chập', '·', '·', 'Đảo', 'Chập', '·'],
    lh: ['Bass 1', '·', '·', 'Oct', 'Bass 1', '·', '·', 'Bậc 5'],
    tipVi: 'Nhấn chắc phách 1 & 3 ở tay trái, tay phải chập gọn kết hợp đảo phách "& của 3" cho điệp khúc (Chorus).',
    tipEn: 'Punchy LH bass on 1 & 3 with syncopated RH push on the "and of 3" for energetic choruses.',
  },
  {
    titleVi: '4. Slow Rock / Ballad 6/8 · Nhịp 6/8',
    titleEn: '4. Slow Rock / 6/8 Ballad · 6/8',
    beats: ['1', '2', '3', '4', '5', '6'],
    rh: ['Hợp âm', '·', '·', 'Nốt 1', 'Nốt 2', 'Nốt 3'],
    lh: ['Bậc 1', 'Bậc 5', 'Bậc 8', '·', '·', '·'],
    tipVi: 'Nhấn nhẹ phách 1 (mạnh) và phách 4 (mạnh vừa), rải chùm 3 đều đặn.',
    tipEn: 'Accent beat 1 (strong) and beat 4 (medium) with a gentle rolling triplet sway.',
  },
  {
    titleVi: '5. Waltz / Valse Cổ Điển · Nhịp 3/4',
    titleEn: '5. Classic Waltz / Valse · 3/4',
    beats: ['1', '2', '3'],
    rh: ['·', 'Chát', 'Chát (nhẹ)'],
    lh: ['Bùm 1', '·', '·'],
    tipVi: 'Phách 1 tay trái đánh bass trầm chắc, phách 2 và 3 tay phải nhả hợp âm nhẹ nhàng tạo độ đung đưa.',
    tipEn: 'Strong LH bass on beat 1, light buoyant RH chords on beats 2 and 3.',
  },
  {
    titleVi: '6. Bolero / Rumba Việt Nam · Nhịp 4/4',
    titleEn: '6. Vietnamese Bolero / Rumba · 4/4',
    beats: ['1', '&', '2', '&', '3', '&', '4', '&'],
    rh: ['·', 'Chát', 'Chát', 'Chát', '·', 'Đảo', '·', 'Chát'],
    lh: ['Bùm 1', '·', '·', '·', 'Bùm 5', '·', 'Bùm 1', '·'],
    tipVi: 'Chập nhẹ đầu ô nhịp nối sang Bùm phụ (bậc 5) ở phách 3. Giữ tay phải gọn, nảy nhẹ.',
    tipEn: 'Root bass on 1, crisp RH chords, alt 5th bass on 3, and syncopated push on "& of 3".',
  },
  {
    titleVi: '7. Jazz Swing (Walking Bass + Comping) · Nhịp 4/4',
    titleEn: '7. Jazz Swing (Walking Bass + Comping) · 4/4',
    beats: ['1', 'a', '2', 'a', '3', 'a', '4', 'a'],
    rh: ['Comp 7', '·', '·', 'Swing!', '·', '·', 'Comp', '·'],
    lh: ['Bậc 1', '·', 'Bậc 3', '·', 'Bậc 5', '·', 'Dẫn ±1', '·'],
    tipVi: 'Tay trái đi đều 4 nốt đen (phách 4 dẫn nửa cung tới gốc hợp âm sau). Tay phải bấm Shell Voicing (3–7–9).',
    tipEn: 'LH quarter-note walking bass (beat 4 chromatic approach). RH comps 3–7–9 guide tones.',
  },
  {
    titleVi: '8. Bossa Nova & Lo-Fi Jazz · Nhịp 4/4',
    titleEn: '8. Bossa Nova & Lo-Fi Jazz · 4/4',
    beats: ['1', '&', '2', '&', '3', '&', '4', '&'],
    rh: ['Maj9', '·', '·', 'Đảo', '·', 'Đảo', '·', 'Đảo'],
    lh: ['Bậc 1', '·', '·', 'Bậc 5', 'Bậc 5', '·', '·', 'Bậc 1'],
    tipVi: 'Bossa Nova đánh thẳng (straight 8ths), nhấn mềm phách nghịch. Lo-Fi rải chậm hợp âm maj9/m9 ấm áp.',
    tipEn: 'Bossa uses straight 8ths with clave syncopation; Lo-Fi gently rolls lush maj9/m9 chords.',
  },
];

const MINI_WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
const MINI_BLACK_KEYS: ReadonlyArray<{ offset: number; afterWhiteIdx: number }> = [
  { offset: 1, afterWhiteIdx: 0 },
  { offset: 3, afterWhiteIdx: 1 },
  { offset: 6, afterWhiteIdx: 3 },
  { offset: 8, afterWhiteIdx: 4 },
  { offset: 10, afterWhiteIdx: 5 },
];

const MiniPiano: React.FC<{
  activeMidis: number[];
  rootPc: number;
  onPlayMidi?: (midi: number) => void;
}> = ({ activeMidis, rootPc, onPlayMidi }) => {
  const activeSet = new Set(activeMidis);
  const octaves = [60, 72]; // C4..B5 (2 octaves)
  const whiteKeys: number[] = [];
  const blackKeys: Array<{ midi: number; leftPct: number }> = [];

  octaves.forEach((base, octIdx) => {
    for (const off of MINI_WHITE_OFFSETS) {
      whiteKeys.push(base + off);
    }
    for (const bk of MINI_BLACK_KEYS) {
      const globalWhiteIdx = octIdx * 7 + bk.afterWhiteIdx;
      blackKeys.push({
        midi: base + bk.offset,
        leftPct: ((globalWhiteIdx + 0.68) / 14) * 100,
      });
    }
  });

  return (
    <div className="relative w-full h-20 select-none rounded-lg overflow-hidden border border-[#2c2f42] bg-[#0f1016]">
      <div className="flex w-full h-full">
        {whiteKeys.map((midi) => {
          const isActive = activeSet.has(midi);
          const isRoot = isActive && mod12(midi) === rootPc;
          return (
            <button
              key={midi}
              type="button"
              onClick={() => onPlayMidi?.(midi)}
              className={`flex-1 h-full border-r border-slate-700/60 flex flex-col justify-end items-center pb-1 transition ${
                isRoot
                  ? 'bg-violet-400 text-slate-950 font-extrabold'
                  : isActive
                    ? 'bg-cyan-300 text-slate-950 font-bold'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
              }`}
            >
              <span className="text-[9px] leading-none">{formatPitchClass(midi)}</span>
            </button>
          );
        })}
      </div>
      {blackKeys.map(({ midi, leftPct }) => {
        const isActive = activeSet.has(midi);
        const isRoot = isActive && mod12(midi) === rootPc;
        return (
          <button
            key={midi}
            type="button"
            onClick={() => onPlayMidi?.(midi)}
            style={{ left: `${leftPct}%`, width: `${(0.64 / 14) * 100}%` }}
            className={`absolute top-0 h-[58%] rounded-b-md border border-slate-900 flex items-end justify-center pb-1 z-10 transition ${
              isRoot
                ? 'bg-violet-500 text-white font-bold'
                : isActive
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-[#1a1c26] hover:bg-[#2a2d3d] text-slate-400'
            }`}
          >
            {isActive && <span className="text-[8px] leading-none">{formatPitchClass(midi)}</span>}
          </button>
        );
      })}
    </div>
  );
};

const EAR_QUIZ_QUALITIES: ReadonlyArray<{ id: ChordQuality; label: string }> = [
  { id: 'maj', label: 'Major (Trưởng)' },
  { id: 'min', label: 'Minor (Thứ)' },
  { id: 'maj7', label: 'Maj7 (Jazz sáng)' },
  { id: '7', label: 'Dom7 (Hút / Blues)' },
  { id: 'm7', label: 'Min7 (Jazz / Lo-Fi)' },
];

export const TheoryGuideTab: React.FC<TheoryGuideTabProps> = ({
  language,
  player,
  initialTonicPc = 0,
  initialMode = 'major',
}) => {
  const isVi = language === 'vi';
  const [section, setSection] = useState<GuideSection>('scales');
  const [lookupTonic, setLookupTonic] = useState<number>(initialTonicPc);
  const [lookupMode, setLookupMode] = useState<'major' | 'minor'>(initialMode);
  const [selectedScaleId, setSelectedScaleId] = useState<string>(
    initialMode === 'minor' ? 'natural-minor' : 'major',
  );
  const [previewMidis, setPreviewMidis] = useState<number[] | null>(null);
  const [previewLabel, setPreviewLabel] = useState<string | null>(null);

  // Ear-training mini-quiz state
  const [quizTarget, setQuizTarget] = useState<{ rootPc: number; quality: ChordQuality }>(() => ({
    rootPc: 0,
    quality: 'maj',
  }));
  const [quizFeedback, setQuizFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [quizStreak, setQuizStreak] = useState(0);

  const keyInfo = useMemo(() => buildKeyInfo(lookupTonic, lookupMode), [lookupTonic, lookupMode]);
  const activeScale = SCALE_DEFS.find((s) => s.id === selectedScaleId) ?? SCALE_DEFS[0];

  const scaleMidis = useMemo(() => {
    const base = 60 + lookupTonic;
    return [...activeScale.intervals.map((iv) => base + iv), base + 12];
  }, [lookupTonic, activeScale]);

  const playChordMidis = (midis: number[], arpeggiate = false) => {
    if (!player) return;
    void player.unlock();
    const audioNow = player.getAudioTime?.() ?? undefined;
    midis.forEach((m, idx) => {
      const delay = arpeggiate ? idx * 0.16 : idx * 0.025;
      player.playNote(m, arpeggiate ? 0.65 : 1.4, 0.78, audioNow !== undefined ? audioNow + delay : undefined);
    });
  };

  const handleSelectChordPreview = (rootPc: number, quality: ChordQuality, label: string) => {
    const ivs = CHORD_INTERVALS[quality];
    const midis = ivs.map((iv) => 60 + rootPc + iv);
    setPreviewMidis(midis);
    setPreviewLabel(label);
    playChordMidis(midis, false);
  };

  const handlePlayScale = () => {
    setPreviewMidis(null);
    setPreviewLabel(null);
    playChordMidis(scaleMidis, true);
  };

  const nextQuizQuestion = () => {
    const roots = [0, 2, 4, 5, 7, 9];
    const nextRoot = roots[Math.floor(Math.random() * roots.length)];
    const nextQual = EAR_QUIZ_QUALITIES[Math.floor(Math.random() * EAR_QUIZ_QUALITIES.length)].id;
    setQuizTarget({ rootPc: nextRoot, quality: nextQual });
    setQuizFeedback(null);
    const midis = CHORD_INTERVALS[nextQual].map((iv) => 60 + nextRoot + iv);
    playChordMidis(midis, false);
  };

  const handlePlayQuizChord = () => {
    const midis = CHORD_INTERVALS[quizTarget.quality].map((iv) => 60 + quizTarget.rootPc + iv);
    playChordMidis(midis, false);
  };

  const handleGuessQuiz = (guessed: ChordQuality) => {
    if (guessed === quizTarget.quality) {
      setQuizFeedback('correct');
      setQuizStreak((s) => s + 1);
    } else {
      setQuizFeedback('wrong');
      setQuizStreak(0);
    }
  };

  const subTabs: Array<{ id: GuideSection; icon: React.ReactNode; labelVi: string; labelEn: string }> = [
    { id: 'scales', icon: <Compass className="w-3.5 h-3.5" />, labelVi: '1. Gam & Phím Đàn', labelEn: '1. Scales & Keys' },
    { id: 'harmony', icon: <Music className="w-3.5 h-3.5" />, labelVi: '2. Chức Năng & Hợp Âm', labelEn: '2. Chords & Function' },
    { id: 'progressions', icon: <Layers className="w-3.5 h-3.5" />, labelVi: '3. Vòng Hợp Âm', labelEn: '3. Progressions' },
    { id: 'patterns', icon: <ListMusic className="w-3.5 h-3.5" />, labelVi: '4. Cách Rải & Jazz', labelEn: '4. Patterns & Jazz' },
    { id: 'roadmap', icon: <BookOpen className="w-3.5 h-3.5" />, labelVi: '5. Lộ Trình & Luyện Tai', labelEn: '5. Roadmap & Ear' },
  ];

  const displayMidis = previewMidis ?? scaleMidis;

  return (
    <div className="space-y-4 text-xs text-slate-200">
      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-1.5">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSection(tab.id)}
            className={`px-2.5 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1.5 border transition ${
              section === tab.id
                ? 'bg-cyan-600/25 border-cyan-500 text-cyan-100'
                : 'bg-[#14151c] border-[#262836] text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.icon}
            {isVi ? tab.labelVi : tab.labelEn}
          </button>
        ))}
      </div>

      {/* SECTION 1: SCALES & INTERACTIVE MINI-PIANO */}
      {section === 'scales' && (
        <div className="space-y-3">
          <div className="rounded-xl bg-[#14151c] border border-violet-500/35 p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-violet-200 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5" />
                {isVi
                  ? 'Bàn phím tra Gam & 7 Hợp Âm (bấm phím hoặc hợp âm để nghe!)'
                  : 'Interactive 12-Key Scale & Chord Piano (click keys or chords to hear!)'}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  value={lookupTonic}
                  onChange={(e) => {
                    setLookupTonic(Number(e.target.value));
                    setPreviewMidis(null);
                    setPreviewLabel(null);
                  }}
                  className="rounded-md bg-[#121216] border border-[#2c2e3b] px-2 py-1 text-slate-100 text-[11px]"
                >
                  {PC_NAMES_SHARP.map((name, idx) => (
                    <option key={name} value={idx}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedScaleId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedScaleId(id);
                    setLookupMode(id.includes('minor') || id === 'dorian' || id === 'blues' ? 'minor' : 'major');
                    setPreviewMidis(null);
                    setPreviewLabel(null);
                  }}
                  className="rounded-md bg-[#121216] border border-[#2c2e3b] px-2 py-1 text-slate-100 text-[11px]"
                >
                  {SCALE_DEFS.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {isVi ? sc.nameVi : sc.nameEn}
                    </option>
                  ))}
                </select>
                {player && (
                  <button
                    type="button"
                    onClick={handlePlayScale}
                    className="px-2.5 py-1 rounded-md bg-cyan-600/25 hover:bg-cyan-600/40 border border-cyan-500/40 text-cyan-200 font-semibold inline-flex items-center gap-1 text-[11px]"
                  >
                    <Volume2 className="w-3 h-3" />
                    {isVi ? 'Nghe Gam' : 'Play Scale'}
                  </button>
                )}
              </div>
            </div>

            <MiniPiano
              activeMidis={displayMidis}
              rootPc={previewMidis ? mod12(previewMidis[0]) : lookupTonic}
              onPlayMidi={(m) => playChordMidis([m], false)}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 mr-1.5">
                  {previewLabel ? (isVi ? 'Đang xem hợp âm:' : 'Showing chord:') : (isVi ? 'Công thức:' : 'Formula:')}
                </span>
                <span className="font-mono text-white font-semibold">
                  {previewLabel ?? activeScale.formula}
                </span>
              </div>
              <span className="text-slate-300">
                {isVi ? activeScale.useVi : activeScale.useEn}
              </span>
            </div>

            {/* Clickable 7 Diatonic Chords */}
            <div className="pt-1 space-y-1">
              <div className="text-[11px] text-slate-400">
                {isVi
                  ? `7 Hợp âm bậc của ${keyInfo.label} (bấm từng ô để xem phím & nghe tiếng):`
                  : `7 Diatonic Chords in ${keyInfo.label} (click any chord to preview):`}
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                {keyInfo.diatonicChords.map((dc) => (
                  <button
                    key={dc.roman}
                    type="button"
                    onClick={() => handleSelectChordPreview(dc.rootPc, dc.quality, `${dc.symbol} (${dc.roman})`)}
                    className="rounded-lg bg-[#1d1f2c] hover:bg-violet-600/30 border border-[#2c2f42] hover:border-violet-400 p-1.5 text-center transition"
                  >
                    <div className="text-[10px] text-slate-400">{dc.roman}</div>
                    <div className="font-bold text-white text-xs">{dc.symbol}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Relative Major / Minor Table */}
          <div className="rounded-xl bg-[#14151c] border border-[#262836] p-3 space-y-2">
            <div className="font-bold text-slate-100">
              {isVi
                ? 'Cặp Tông Song Song (dùng chung 100% nốt & hóa biểu)'
                : 'Relative Major / Minor Pairs (Same Key Signature)'}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {RELATIVE_PAIRS.map((p) => (
                <div
                  key={p.major}
                  className="rounded-lg bg-[#1b1d28] border border-[#2a2d3e] px-2 py-1.5 flex items-center justify-between text-[11px]"
                >
                  <span className="font-bold text-white">
                    {p.major} ↔ {p.minor}
                  </span>
                  <span className="text-slate-400 text-[10px]">{p.sig}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: CHORD FORMULAS, T-PD-D HARMONIC FUNCTION & CADENCES */}
      {section === 'harmony' && (
        <div className="space-y-3">
          {/* Chord Building Formulas */}
          <div className="rounded-xl bg-[#14151c] border border-[#262836] p-3 space-y-2">
            <div className="font-bold text-cyan-300">
              {isVi
                ? 'Cấu tạo Hợp Âm Ba & Hợp Âm Bảy (bấm để nghe trên gốc C)'
                : 'Triad & Seventh Chord Formulas (click to hear on C)'}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(
                [
                  { q: 'maj', name: 'Major (C)', formula: '0 – 4 – 7 (3T + 3t)', feelVi: 'Sáng, vững' },
                  { q: 'min', name: 'Minor (Cm)', formula: '0 – 3 – 7 (3t + 3T)', feelVi: 'Buồn, sâu' },
                  { q: 'dim', name: 'Dim (C°)', formula: '0 – 3 – 6 (3t + 3t)', feelVi: 'Căng, chuyển tiếp' },
                  { q: 'sus4', name: 'Sus4 (Csus4)', formula: '0 – 5 – 7 (4Đ + 2T)', feelVi: 'Treo lơ lửng' },
                  { q: 'maj7', name: 'Maj7 (Cmaj7)', formula: '0 – 4 – 7 – 11', feelVi: 'Mơ màng, Jazz' },
                  { q: '7', name: 'Dom7 (C7)', formula: '0 – 4 – 7 – 10', feelVi: 'Hút mạnh về bậc I' },
                  { q: 'm7', name: 'Min7 (Cm7)', formula: '0 – 3 – 7 – 10', feelVi: 'Êm, Lo-Fi/Jazz' },
                  { q: 'm7b5', name: 'Half-Dim (Cm7b5)', formula: '0 – 3 – 6 – 10', feelVi: 'iiø7 trong Jazz thứ' },
                ] as Array<{ q: ChordQuality; name: string; formula: string; feelVi: string }>
              ).map((item) => (
                <button
                  key={item.q}
                  type="button"
                  onClick={() => playChordMidis(CHORD_INTERVALS[item.q].map((iv) => 60 + iv), false)}
                  className="text-left rounded-lg bg-[#1b1d28] hover:bg-violet-600/25 border border-[#2a2d3e] hover:border-violet-400 p-2 transition"
                >
                  <div className="font-bold text-white text-[11px] flex items-center justify-between">
                    <span>{item.name}</span>
                    {player && <Volume2 className="w-3 h-3 text-cyan-400" />}
                  </div>
                  <div className="font-mono text-[10px] text-cyan-300 mt-0.5">{item.formula}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{item.feelVi}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 3 Harmonic Functions (T -> PD -> D -> T) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-xl bg-emerald-950/25 border border-emerald-500/35 p-3 space-y-1">
              <div className="font-bold text-emerald-300">
                1. Tonic (T) — {isVi ? 'Chủ âm (Về nhà)' : 'Home / Stability'}
              </div>
              <div className="font-mono text-white font-bold text-xs">I · vi · iii</div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {isVi
                  ? 'Cảm giác ổn định, mở đầu hoặc kết câu. Có thể thay I bằng vi (C → Am) để làm mềm câu hát.'
                  : 'Stable arrival & departure. vi often substitutes for I for a softer mood.'}
              </p>
            </div>
            <div className="rounded-xl bg-cyan-950/25 border border-cyan-500/35 p-3 space-y-1">
              <div className="font-bold text-cyan-300">
                2. Pre-dominant (PD) — {isVi ? 'Mở đường' : 'Motion / Build'}
              </div>
              <div className="font-mono text-white font-bold text-xs">IV · ii · ii7</div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {isVi
                  ? 'Đẩy cảm xúc đi xa khỏi chủ âm để chuẩn bị bước vào hợp âm át (V). Trong Jazz hay dùng ii7 thay cho IV.'
                  : 'Leads smoothly away from Tonic into Dominant. Jazz favors ii7 over IV.'}
              </p>
            </div>
            <div className="rounded-xl bg-amber-950/25 border border-amber-500/35 p-3 space-y-1">
              <div className="font-bold text-amber-300">
                3. Dominant (D) — {isVi ? 'Căng & Hút về I' : 'Tension → Home'}
              </div>
              <div className="font-mono text-white font-bold text-xs">V · V7 · vii°</div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {isVi
                  ? 'Chứa tam cung (tritone) giữa bậc 4 & bậc 7 tạo lực hút cực mạnh giải quyết về Tonic (I).'
                  : 'Contains the tritone tension (4th & 7th scale degrees) that pulls strongly back to I.'}
              </p>
            </div>
          </div>

          {/* 4 Cadences */}
          <div className="rounded-xl bg-[#14151c] border border-[#262836] p-3 space-y-1.5">
            <div className="font-bold text-slate-100">
              {isVi ? '4 Kiểu Kết Câu (Cadences)' : '4 Essential Cadences'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
              <div className="bg-[#1b1d28] rounded-lg p-2">
                <strong className="text-emerald-300">Authentic (V → I):</strong>{' '}
                {isVi ? 'Kết trọn vẹn, dứt khoát (G7 → C).' : 'Strong, complete resolution (G7 → C).'}
              </div>
              <div className="bg-[#1b1d28] rounded-lg p-2">
                <strong className="text-cyan-300">Plagal (IV → I):</strong>{' '}
                {isVi ? 'Kết "Amen" êm dịu, rất hợp Ballad (F → C hoặc Fm → C).' : 'Warm "Amen" ending (F → C or borrowed Fm → C).'}
              </div>
              <div className="bg-[#1b1d28] rounded-lg p-2">
                <strong className="text-amber-300">Half (... → V):</strong>{' '}
                {isVi ? 'Kết lửng như dấu phẩy, mở ra câu tiếp theo (Dm → G).' : 'Open "comma" pause leading into the next phrase.'}
              </div>
              <div className="bg-[#1b1d28] rounded-lg p-2">
                <strong className="text-violet-300">Deceptive (V → vi):</strong>{' '}
                {isVi ? 'Kết tránh bất ngờ (G7 → Am), kéo dài cảm xúc cực hay!' : 'Surprise detour (G7 → Am) to extend emotional tension.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: PROGRESSIONS & VOICE LEADING */}
      {section === 'progressions' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PROGRESSION_CARDS.map((card) => (
              <div key={card.roman} className={`rounded-xl border p-3 space-y-1.5 ${card.color}`}>
                <div className="flex items-center justify-between gap-1">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${card.badge}`}>
                    {card.genre}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-white">{card.roman}</span>
                </div>
                <div className="font-mono text-xs text-cyan-200 font-semibold">{card.example}</div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {isVi ? card.descVi : card.descEn}
                </p>
              </div>
            ))}
          </div>

          {/* Voice Leading & Color Extensions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-[#14151c] border border-[#262836] p-3 space-y-1.5">
              <div className="font-bold text-emerald-300">
                {isVi ? 'Bí quyết Đảo Hợp Âm (Voice Leading)' : 'Smooth Chords (Voice Leading)'}
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {isVi
                  ? 'Giữ lại nốt chung và chỉ dịch 1–2 phím gần nhất để tay phải không phải nhảy xa:'
                  : 'Keep common tones and move other fingers by only 1–2 keys:'}
              </p>
              <div className="font-mono text-[11px] bg-[#1c1e2a] p-2 rounded space-y-0.5 text-cyan-200">
                <div>C (C–E–G) → Am (C–E–A) : {isVi ? 'giữ C, E · chỉ nhích G→A' : 'keep C, E · move G→A'}</div>
                <div>C (C–E–G) → F (C–F–A) : {isVi ? 'giữ C · nhích E→F, G→A' : 'keep C · move E→F, G→A'}</div>
                <div>C (C–E–G) → G (B–D–G) : {isVi ? 'giữ G · lùi C→B, E→D' : 'keep G · move C→B, E→D'}</div>
              </div>
            </div>

            <div className="rounded-xl bg-[#14151c] border border-[#262836] p-3 space-y-1.5">
              <div className="font-bold text-amber-300">
                {isVi ? 'Hợp Âm Màu & Bass Đảo' : 'Color Extensions & Slash Bass'}
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1 leading-relaxed list-disc pl-4">
                <li>
                  <strong className="text-white">add9 / sus2</strong> (<code className="text-cyan-300">Cadd9 = C–D–E–G</code>):{' '}
                  {isVi ? 'làm Ballad/V-Pop trong trẻo, hiện đại.' : 'adds sparkling Pop/Ballad warmth.'}
                </li>
                <li>
                  <strong className="text-white">maj7 / m7 / 9</strong> (<code className="text-cyan-300">Cmaj9, Am9</code>):{' '}
                  {isVi ? 'tạo chất Jazz, Bossa Nova, Lo-Fi sang trọng.' : 'essential for Jazz, Bossa & Lo-Fi richness.'}
                </li>
                <li>
                  <strong className="text-white">Slash Bass</strong> (<code className="text-cyan-300">C → G/B → Am → Em/G → F</code>):{' '}
                  {isVi ? 'đường bass đi liền bậc xuống dần cực êm.' : 'creates smooth stepwise basslines.'}
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: JAZZ THEORY & ARPEGGIO RHYTHM GRIDS */}
      {section === 'patterns' && (
        <div className="space-y-2.5">
          {/* Jazz Theory Quick Reference */}
          <div className="rounded-xl bg-amber-950/25 border border-amber-500/35 p-3 space-y-2">
            <div className="font-bold text-amber-300">
              {isVi ? '🎷 Cẩm nang Jazz Piano cốt lõi' : '🎷 Essential Jazz Piano Theory'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="bg-[#181924] rounded-lg p-2 space-y-0.5">
                <div className="font-bold text-white">1. Shell & Rootless Voicings</div>
                <p className="text-slate-300 leading-snug">
                  {isVi
                    ? 'Bỏ bớt nốt gốc & bậc 5 ở tay phải; tập trung 2 nốt dẫn (Guide Tones: bậc 3 & 7) + bậc 9. Type A: 3–5–7–9 · Type B: 7–9–3–5.'
                    : 'Focus on guide tones (3rd & 7th) + 9th. Type A: 3–5–7–9 · Type B: 7–9–3–5.'}
                </p>
              </div>
              <div className="bg-[#181924] rounded-lg p-2 space-y-0.5">
                <div className="font-bold text-white">2. Tritone Sub & Altered V7</div>
                <p className="text-slate-300 leading-snug">
                  {isVi
                    ? 'G7 (B–F) và Db7 (F–Cb) dùng chung đúng 1 tam cung → thay G7 bằng Db7 trong Dm7 → Db7 → Cmaj7! Thêm b9/#9/#5 để tạo màu Jazz đậm.'
                    : 'G7 & Db7 share the exact B–F tritone → swap G7 for Db7 in Dm7–Db7–Cmaj7!'}
                </p>
              </div>
              <div className="bg-[#181924] rounded-lg p-2 space-y-0.5">
                <div className="font-bold text-white">3. Chord–Scale Map</div>
                <p className="text-slate-300 leading-snug">
                  {isVi
                    ? 'Imaj7 → Ionian/Lydian · ii7 → Dorian · V7 → Mixolydian (hoặc Altered) · iiø7 → Locrian.'
                    : 'Imaj7 → Ionian/Lydian · ii7 → Dorian · V7 → Mixolydian/Altered · iiø7 → Locrian.'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-indigo-950/35 border border-indigo-500/35 p-2.5 text-[11px] text-indigo-100 leading-relaxed">
            {isVi
              ? '🎹 Quy tắc phân vùng: Tay trái chơi vùng C2–C4 (rải 1–5–8, tránh bấm chập 3 nốt dưới C3 dễ đục tiếng). Tay phải chơi vùng C4–C6 (thế hợp âm đảo + câu lót).'
              : '🎹 Register Rule: Keep LH in C2–C4 (open 1–5–8 intervals, avoid muddy triads below C3) and RH in C4–C6.'}
          </div>

          {RHYTHM_PATTERNS.map((pat) => (
            <div
              key={pat.titleEn}
              className="rounded-xl bg-[#14151c] border border-[#262836] p-3 space-y-2"
            >
              <div className="font-bold text-white text-xs">
                {isVi ? pat.titleVi : pat.titleEn}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse text-[11px] font-mono">
                  <thead>
                    <tr className="text-slate-400 border-b border-[#262836]">
                      <th className="text-left pr-2 py-1 font-sans w-14">
                        {isVi ? 'Phách' : 'Beat'}
                      </th>
                      {pat.beats.map((b, i) => (
                        <th key={i} className="px-1.5 py-1">
                          {b}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#1e2030]">
                      <td className="text-left pr-2 py-1 font-sans text-cyan-300 font-semibold">
                        {isVi ? 'Tay phải' : 'RH'}
                      </td>
                      {pat.rh.map((cell, i) => (
                        <td
                          key={i}
                          className={`px-1 py-1 ${
                            cell !== '·' ? 'text-cyan-200 font-bold bg-cyan-950/40 rounded' : 'text-slate-600'
                          }`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="text-left pr-2 py-1 font-sans text-emerald-300 font-semibold">
                        {isVi ? 'Tay trái' : 'LH'}
                      </td>
                      {pat.lh.map((cell, i) => (
                        <td
                          key={i}
                          className={`px-1 py-1 ${
                            cell !== '·' ? 'text-emerald-200 font-bold bg-emerald-950/40 rounded' : 'text-slate-600'
                          }`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {isVi ? pat.tipVi : pat.tipEn}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* SECTION 5: 4-STEP ROADMAP + INTERACTIVE EAR TRAINER */}
      {section === 'roadmap' && (
        <div className="space-y-3">
          {/* Quick Interactive Ear Trainer */}
          {player && (
            <div className="rounded-xl bg-violet-950/25 border border-violet-500/40 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-violet-200 flex items-center gap-1.5">
                  <Headphones className="w-4 h-4 text-cyan-300" />
                  {isVi ? 'Luyện Tai Nhanh — Nghe & Đoán Màu Hợp Âm' : 'Quick Ear Trainer — Guess the Chord Quality'}
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-bold text-[11px]">
                  Streak: {quizStreak}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePlayQuizChord}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold inline-flex items-center gap-1.5"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  {isVi ? 'Nghe hợp âm' : 'Play Chord'}
                </button>
                <button
                  type="button"
                  onClick={nextQuizQuestion}
                  className="px-3 py-1.5 rounded-lg bg-[#242634] hover:bg-[#2f3245] text-slate-200 font-semibold"
                >
                  {isVi ? 'Câu mới' : 'New Chord'}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {EAR_QUIZ_QUALITIES.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => handleGuessQuiz(q.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#1a1c28] hover:bg-violet-600/30 border border-[#2c2f42] text-slate-100 font-semibold text-[11px]"
                  >
                    {q.label}
                  </button>
                ))}
              </div>

              {quizFeedback && (
                <div
                  className={`flex items-center gap-1.5 text-[11px] font-semibold ${
                    quizFeedback === 'correct' ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {quizFeedback === 'correct' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {isVi
                        ? `Chính xác! Đó là ${PC_NAMES_SHARP[quizTarget.rootPc]} ${quizTarget.quality}. Bấm "Câu mới" để tiếp tục!`
                        : `Correct! It was ${PC_NAMES_SHARP[quizTarget.rootPc]} ${quizTarget.quality}.`}
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      {isVi ? 'Chưa đúng rồi — bấm "Nghe hợp âm" và thử lại nhé!' : 'Not quite — listen again and retry!'}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 4-Step Roadmap */}
          {[
            {
              step: '01',
              titleVi: 'Xác định Tông & 7 Hợp Âm của bài (hoặc dán [Hợp âm]Lời)',
              titleEn: 'Find the Key & 7 Diatonic Chords (or paste [Chord]Lyrics)',
              bodyVi:
                'Mở bài MIDI hoặc dán lời kèm hợp âm dạng [Am]Mưa buồn [Dm]rơi... trong tab Thực hành. Kiểm tra Gam phía trên đàn và dùng Tone +/- để dịch về đúng quãng giọng hát.',
              bodyEn:
                'Load a MIDI or paste [Chord]Lyric sheets in Practice. Check the Key badge and transpose with Tone +/- to match the singer.',
            },
            {
              step: '02',
              titleVi: 'Chia đoạn 4 ô nhịp — Tập nối Tay Phải trước (70% tốc độ)',
              titleEn: 'Chunk into 4-Bar Loops — Master RH Voice Leading at 70% BPM',
              bodyVi:
                'Bật A–B Loop từng đoạn 4 ô nhịp, tắt tạm tay trái để tập nối tay phải theo thế đảo gần nhất (giữ nốt chung, hạn chế nhảy tay).',
              bodyEn:
                'Use A–B Loop on 4-bar chunks, mute LH first, and connect RH chord inversions smoothly.',
            },
            {
              step: '03',
              titleVi: 'Ghép Tay Trái + Nguyên tắc Đạp Pedal chuẩn (Syncopated Pedaling)',
              titleEn: 'Add LH Pattern + Clean Syncopated Pedaling',
              bodyVi:
                'Ghép tay trái 1–5–8 (Ballad), Bùm–Chát (Waltz/Bolero) hoặc Walking Bass (Jazz). Quy tắc Pedal: bấm hợp âm mới → nhấc chân dứt khoát → đạp lại ngay để tiếng vang sạch.',
              bodyEn:
                'Combine LH pattern with clean pedaling: strike the new chord, immediately lift and re-depress pedal.',
            },
            {
              step: '04',
              titleVi: 'Tạo sắc thái Verse / Chorus & Câu lót Fill-in Ngũ cung',
              titleEn: 'Shape Verse / Chorus Dynamics & Pentatonic Fills',
              bodyVi:
                'Verse đánh nhẹ (Ballad Rải 8 nốt), Chorus bùng nổ (Pop Chập / mở rộng quãng). Cuối ô nhịp 4 & 8 thêm 2–3 nốt Ngũ cung hoặc vay hợp âm iv (Fm trong C) để tạo cao trào.',
              bodyEn:
                'Keep verses soft with arpeggios, build choruses with groove, and add pentatonic fills or borrowed iv chords at phrase endings.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-xl bg-[#14151c] border border-[#262836] p-3 flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-violet-600/25 border border-violet-500/40 text-violet-200 font-extrabold flex items-center justify-center shrink-0">
                {item.step}
              </div>
              <div className="space-y-1">
                <div className="font-bold text-white text-xs">
                  {isVi ? item.titleVi : item.titleEn}
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {isVi ? item.bodyVi : item.bodyEn}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
