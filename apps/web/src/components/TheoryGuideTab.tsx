import React, { useState } from 'react';
import { BookOpen, Compass, Layers, ListMusic, Music } from 'lucide-react';
import {
  buildKeyInfo,
  formatPitchClass,
  PC_NAMES_SHARP,
} from '../core/accompaniment/harmonyAnalyzer';
import type { Language } from '../core/types';

interface TheoryGuideTabProps {
  language: Language;
  initialTonicPc?: number;
  initialMode?: 'major' | 'minor';
}

type GuideSection = 'scales' | 'progressions' | 'patterns' | 'roadmap';

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
    descVi: 'Vòng quốc dân cho hàng nghìn bài Pop/Ballad. Sáng, dễ nghe, dễ hát.',
    descEn: 'The universal Pop/Ballad loop. Bright, emotional, and easy to sing over.',
  },
  {
    genre: 'V-Pop / Canon',
    color: 'border-violet-500/40 bg-violet-950/20',
    badge: 'bg-violet-500/20 text-violet-200',
    roman: 'I – V – vi – iii – IV – I – IV – V',
    example: 'C – G – Am – Em – F – C – F – G',
    descVi: 'Rất phổ biến trong nhạc Việt & Ballad buồn. Tạo đường bass đi xuống cực mượt (C→B→A→G→F→E→D→G nếu dùng đảo bass).',
    descEn: 'Classic Canon/V-Pop progression. Pairs beautifully with descending slash bass (C → G/B → Am → Em/G → F).',
  },
  {
    genre: 'Ballad Nhật / Việt (Royal Road)',
    color: 'border-pink-500/40 bg-pink-950/20',
    badge: 'bg-pink-500/20 text-pink-200',
    roman: 'IVmaj7 – V7 – iii7 – vi7',
    example: 'Fmaj7 – G7 – Em7 – Am7',
    descVi: 'Vòng "con đường hoàng gia" cực bắt tai trong Anime/V-Pop hiện đại, giàu cảm xúc hoài niệm.',
    descEn: 'The iconic Royal Road progression used in Anime & modern Asian ballads — rich and nostalgic.',
  },
  {
    genre: 'Jazz Chuẩn (II–V–I)',
    color: 'border-amber-500/40 bg-amber-950/20',
    badge: 'bg-amber-500/20 text-amber-200',
    roman: 'ii7 – V7 – Imaj7 – vi7',
    example: 'Dm7 – G7 – Cmaj7 – Am7',
    descVi: 'Xương sống của mọi bản Jazz. Thường thêm bậc 9 (Dm9 – G13 – Cmaj9) và bấm Shell Voicing (chỉ giữ bậc 3 & 7 ở tay trái).',
    descEn: 'The backbone of Jazz harmony. Extend with 9ths/13ths (Dm9 – G13 – Cmaj9) and use 3–7 shell voicings.',
  },
  {
    genre: 'Jazz Cổ Điển (Autumn Leaves)',
    color: 'border-amber-500/40 bg-amber-950/20',
    badge: 'bg-amber-500/20 text-amber-200',
    roman: 'iv7 – VII7 – IIImaj7 – VImaj7 – iiø7 – V7 – i7',
    example: 'Am7 – D7 – Gmaj7 – Cmaj7 – F#m7b5 – B7 – Em7',
    descVi: 'Đi theo vòng bậc 5 (Circle of Fifths), luyện nối chuyển giọng 3→7 cực chuẩn cho người mới học Jazz.',
    descEn: 'Circle-of-fifths motion — the gold standard for practicing smooth 3rd-to-7th Jazz voice leading.',
  },
  {
    genre: 'Bolero / Rumba (Thứ)',
    color: 'border-emerald-500/40 bg-emerald-950/20',
    badge: 'bg-emerald-500/20 text-emerald-200',
    roman: 'i – iv – V7 – i  /  i – VI – iv – V7',
    example: 'Am – Dm – E7 – Am  /  Am – F – Dm – E7',
    descVi: 'Đặc trưng dùng bậc V7 (E7 có nốt G# thuộc Thứ hòa thanh) để tạo sức hút mạnh về chủ âm Am.',
    descEn: 'Uses dominant V7 (E7 with raised G# from harmonic minor) for strong emotional pull back to tonic Am.',
  },
];

const RHYTHM_PATTERNS = [
  {
    titleVi: '1. Ballad Rải Cơ Bản (1–5–8) · Nhịp 4/4',
    titleEn: '1. Basic Ballad Arpeggio (1–5–8) · 4/4',
    beats: ['1', '&', '2', '&', '3', '&', '4', '&'],
    rh: ['Hợp âm', '·', '·', '·', 'Hợp âm', '·', '·', '·'],
    lh: ['Bậc 1', '·', 'Bậc 5', '·', 'Bậc 8', '·', 'Bậc 5', '·'],
    tipVi: 'Tay trái rải 1–5–8 đều, tay phải giữ nguyên thế bấm hợp âm đảo gần nhất. Đạp pedal theo từng ô nhịp.',
    tipEn: 'LH rolls 1–5–8 smoothly; RH holds close voice-led chords. Lift & re-press sustain pedal on every chord change.',
  },
  {
    titleVi: '2. Ballad Rải Trữ Tình (8 nốt V-Pop) · Nhịp 4/4',
    titleEn: '2. Flowing V-Pop 8th Arpeggio · 4/4',
    beats: ['1', '&', '2', '&', '3', '&', '4', '&'],
    rh: ['·', '·', '·', 'Nốt 1', 'Nốt 2', 'Nốt 3', 'Nốt 2', 'Nốt 1'],
    lh: ['Bậc 1', 'Bậc 5', 'Bậc 8', '·', '·', '·', '·', '·'],
    tipVi: 'Chia đều 8 móc đơn nối liền từ tay trái lên tay phải. Rất hợp đoạn vào lời (Verse) nhẹ nhàng, da diết.',
    tipEn: 'Continuous 8th-note wave passing smoothly from LH to RH. Ideal for intimate verses.',
  },
  {
    titleVi: '3. Pop Hiện Đại (Chập & Đảo Phách) · Nhịp 4/4',
    titleEn: '3. Modern Pop Groove (Syncopated) · 4/4',
    beats: ['1', '&', '2', '&', '3', '&', '4', '&'],
    rh: ['Chập', '·', 'Chập', '·', '·', 'Đảo', 'Chập', '·'],
    lh: ['Bass 1', '·', '·', 'Oct', 'Bass 1', '·', '·', 'Bậc 5'],
    tipVi: 'Nhấn chắc phách 1 & 3 ở tay trái, tay phải đánh chập ngắn kết hợp đảo phách "& của 3" để tạo sức bật ở điệp khúc (Chorus).',
    tipEn: 'Punchy LH bass on 1 & 3 with syncopated RH push on the "and of 3" for energetic choruses.',
  },
  {
    titleVi: '4. Slow Rock / Ballad 6/8 · Nhịp 6/8',
    titleEn: '4. Slow Rock / 6/8 Ballad · 6/8',
    beats: ['1', '2', '3', '4', '5', '6'],
    rh: ['Hợp âm', '·', '·', 'Nốt 1', 'Nốt 2', 'Nốt 3'],
    lh: ['Bậc 1', 'Bậc 5', 'Bậc 8', '·', '·', '·'],
    tipVi: 'Nhấn nhẹ phách 1 (mạnh) và phách 4 (mạnh vừa), rải chùm 3 đều đặn — tránh đánh nhanh bị cứng.',
    tipEn: 'Accent beat 1 (strong) and beat 4 (medium) with a gentle rolling triplet sway.',
  },
  {
    titleVi: '5. Bolero / Rumba Việt Nam · Nhịp 4/4',
    titleEn: '5. Vietnamese Bolero / Rumba · 4/4',
    beats: ['1', '&', '2', '&', '3', '&', '4', '&'],
    rh: ['·', 'Chát', 'Chát', 'Chát', '·', 'Đảo', '·', 'Chát'],
    lh: ['Bùm 1', '·', '·', '·', 'Bùm 5', '·', 'Bùm 1', '·'],
    tipVi: 'Đặc trưng Bolero là chùm 3 nhỏ / chập nhẹ đầu ô nhịp nối sang Bùm phụ (bậc 5) ở phách 3. Giữ tay phải gọn, nảy nhẹ.',
    tipEn: 'Signature Bolero groove: root bass on 1, crisp RH chords, alt 5th bass on 3, and syncopated push on "& of 3".',
  },
  {
    titleVi: '6. Jazz Swing (Walking Bass + Comping) · Nhịp 4/4',
    titleEn: '6. Jazz Swing (Walking Bass + Comping) · 4/4',
    beats: ['1', 'a', '2', 'a', '3', 'a', '4', 'a'],
    rh: ['Comp 7', '·', '·', 'Swing!', '·', '·', 'Comp', '·'],
    lh: ['Bậc 1', '·', 'Bậc 3', '·', 'Bậc 5', '·', 'Dẫn ±1', '·'],
    tipVi: 'Tay trái đi đều 4 nốt đen (phách 4 luôn dẫn nửa cung tới gốc hợp âm sau!). Tay phải bỏ bớt nốt gốc, tập trung bậc 3–7–9.',
    tipEn: 'LH plays steady quarter-note walking bass (beat 4 approaches next root by half-step). RH focuses on 3–7–9 guide tones.',
  },
  {
    titleVi: '7. Bossa Nova & Lo-Fi Jazz · Nhịp 4/4',
    titleEn: '7. Bossa Nova & Lo-Fi Jazz · 4/4',
    beats: ['1', '&', '2', '&', '3', '&', '4', '&'],
    rh: ['Maj9', '·', '·', 'Đảo', '·', 'Đảo', '·', 'Đảo'],
    lh: ['Bậc 1', '·', '·', 'Bậc 5', 'Bậc 5', '·', '·', 'Bậc 1'],
    tipVi: 'Bossa Nova đánh thẳng (straight 8ths, không swing), nhấn mềm vào các phách nghịch (& của 2, & của 3, & của 4). Lo-Fi có thể rải chậm hợp âm maj9/m9.',
    tipEn: 'Bossa Nova uses straight 8ths with clave syncopation (& of 2, 3, 4); Lo-Fi rolls lush maj9/m9 chords softly.',
  },
];

export const TheoryGuideTab: React.FC<TheoryGuideTabProps> = ({
  language,
  initialTonicPc = 0,
  initialMode = 'major',
}) => {
  const isVi = language === 'vi';
  const [section, setSection] = useState<GuideSection>('scales');
  const [lookupTonic, setLookupTonic] = useState<number>(initialTonicPc);
  const [lookupMode, setLookupMode] = useState<'major' | 'minor'>(initialMode);

  const keyInfo = buildKeyInfo(lookupTonic, lookupMode);

  const subTabs: Array<{ id: GuideSection; icon: React.ReactNode; labelVi: string; labelEn: string }> = [
    { id: 'scales', icon: <Compass className="w-3.5 h-3.5" />, labelVi: '1. Cách dùng Gam', labelEn: '1. Scales & Keys' },
    { id: 'progressions', icon: <Layers className="w-3.5 h-3.5" />, labelVi: '2. Vòng Hợp Âm', labelEn: '2. Progressions' },
    { id: 'patterns', icon: <ListMusic className="w-3.5 h-3.5" />, labelVi: '3. Cách Rải & Jazz', labelEn: '3. Patterns & Jazz' },
    { id: 'roadmap', icon: <BookOpen className="w-3.5 h-3.5" />, labelVi: '4. Quy trình 4 bước', labelEn: '4. 4-Step Method' },
  ];

  return (
    <div className="space-y-4 text-xs text-slate-200">
      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-1.5">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSection(tab.id)}
            className={`px-3 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1.5 border transition ${
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

      {/* SECTION 1: SCALES & KEYS */}
      {section === 'scales' && (
        <div className="space-y-3">
          {/* Interactive 12-Key Lookup */}
          <div className="rounded-xl bg-[#14151c] border border-violet-500/35 p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-violet-200 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5" />
                {isVi ? 'Bảng tra nhanh Gam & 7 Hợp Âm trong Tông' : 'Interactive 12-Key Scale & Chord Lookup'}
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={lookupTonic}
                  onChange={(e) => setLookupTonic(Number(e.target.value))}
                  className="rounded-md bg-[#121216] border border-[#2c2e3b] px-2 py-1 text-slate-100 text-[11px]"
                >
                  {PC_NAMES_SHARP.map((name, idx) => (
                    <option key={name} value={idx}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  value={lookupMode}
                  onChange={(e) => setLookupMode(e.target.value as 'major' | 'minor')}
                  className="rounded-md bg-[#121216] border border-[#2c2e3b] px-2 py-1 text-slate-100 text-[11px]"
                >
                  <option value="major">Major (Trưởng)</option>
                  <option value="minor">Minor (Thứ)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400">
                {isVi ? '7 nốt trong gam:' : '7 scale notes:'}
              </span>
              {keyInfo.scalePcs.map((pc, i) => (
                <span
                  key={`${pc}-${i}`}
                  className="px-2 py-0.5 rounded bg-[#222435] text-cyan-300 font-mono font-bold text-[11px]"
                >
                  {i + 1}. {formatPitchClass(pc)}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 pt-1">
              {keyInfo.diatonicChords.map((dc) => (
                <div
                  key={dc.roman}
                  className="rounded-lg bg-[#1d1f2c] border border-[#2c2f42] p-1.5 text-center"
                >
                  <div className="text-[10px] text-slate-400">{dc.roman}</div>
                  <div className="font-bold text-white text-xs">{dc.symbol}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Formulas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-[#14151c] border border-[#262836] p-3 space-y-1.5">
              <div className="font-bold text-cyan-300">
                {isVi ? 'Công thức Gam Trưởng (Major)' : 'Major Scale Formula'}
              </div>
              <div className="font-mono text-[11px] bg-[#1c1e2a] px-2 py-1 rounded text-white">
                1 – 1 – ½ – 1 – 1 – 1 – ½
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {isVi
                  ? 'Âm sắc tươi sáng, vui vẻ. 3 hợp âm chính là bậc I, IV, V (đều Trưởng); 3 hợp âm phụ là ii, iii, vi (đều Thứ).'
                  : 'Bright, uplifting sound. Primary chords I, IV, V are Major; secondary ii, iii, vi are Minor.'}
              </p>
            </div>

            <div className="rounded-xl bg-[#14151c] border border-[#262836] p-3 space-y-1.5">
              <div className="font-bold text-violet-300">
                {isVi ? 'Công thức Gam Thứ (Natural Minor)' : 'Natural Minor Formula'}
              </div>
              <div className="font-mono text-[11px] bg-[#1c1e2a] px-2 py-1 rounded text-white">
                1 – ½ – 1 – 1 – ½ – 1 – 1
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {isVi
                  ? 'Âm sắc sâu lắng, trữ tình. Khi đệm hát/Bolero, bậc v thường đổi thành V7 (Thứ hòa thanh, nâng bậc 7 lên ½ cung) để hút mạnh về bậc i.'
                  : 'Emotional, melancholic color. In ballads & Bolero, v is often raised to V7 (harmonic minor) for a strong resolution to i.'}
              </p>
            </div>
          </div>

          {/* Relative Major / Minor Table + Pentatonic/Jazz tip */}
          <div className="rounded-xl bg-[#14151c] border border-[#262836] p-3 space-y-2">
            <div className="font-bold text-slate-100">
              {isVi
                ? 'Cặp Tông Song Song (dùng chung 100% nốt & hợp âm!)'
                : 'Relative Major / Minor Pairs (Share the exact same notes!)'}
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
            <p className="text-[11px] text-amber-200/90 bg-amber-950/30 border border-amber-500/30 rounded-lg p-2 leading-relaxed">
              {isVi
                ? '💡 Mẹo chạy câu lót (Fill-in) & Jazz: Chỉ dùng 5 nốt Ngũ cung (bậc 1–2–3–5–6 của gam Trưởng, vd C–D–E–G–A) để lót cuối câu hát — bấm kiểu nào cũng êm tai, không bị chỏi! Trong Jazz/Lo-Fi, dùng thêm gam Dorian trên hợp âm bậc ii7 (vd D Dorian = các phím trắng từ D).'
                : '💡 Fill-in & Jazz tip: Use the 5-note Major Pentatonic (degrees 1–2–3–5–6, e.g. C–D–E–G–A) for foolproof vocal fills. For Jazz/Lo-Fi ii7 chords, try Dorian mode.'}
            </p>
          </div>
        </div>
      )}

      {/* SECTION 2: PROGRESSIONS & VOICE LEADING */}
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

          {/* Voice Leading & Extensions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-[#14151c] border border-[#262836] p-3 space-y-1.5">
              <div className="font-bold text-emerald-300">
                {isVi ? 'Bí quyết Đảo Hợp Âm (Voice Leading)' : 'Secret to Smooth Chords (Voice Leading)'}
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {isVi
                  ? 'Đừng đánh mọi hợp âm ở thế gốc (1-3-5) khiến tay phải nhảy xa! Hãy giữ lại nốt chung và chỉ dịch 1–2 phím gần nhất:'
                  : 'Avoid jumping in root position! Keep common tones and move other fingers by only 1–2 keys:'}
              </p>
              <div className="font-mono text-[11px] bg-[#1c1e2a] p-2 rounded space-y-0.5 text-cyan-200">
                <div>C (C–E–G) → Am (C–E–A) : {isVi ? 'giữ C, E · chỉ nhích G→A' : 'keep C, E · move G→A'}</div>
                <div>C (C–E–G) → F (C–F–A) : {isVi ? 'giữ C · nhích E→F, G→A' : 'keep C · move E→F, G→A'}</div>
                <div>C (C–E–G) → G (B–D–G) : {isVi ? 'giữ G · lùi C→B, E→D' : 'keep G · move C→B, E→D'}</div>
              </div>
            </div>

            <div className="rounded-xl bg-[#14151c] border border-[#262836] p-3 space-y-1.5">
              <div className="font-bold text-amber-300">
                {isVi ? 'Hợp Âm Màu (Color Chords)' : 'Color Extensions & Slash Chords'}
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1 leading-relaxed list-disc pl-4">
                <li>
                  <strong className="text-white">add9 / sus2</strong> (vd <code className="text-cyan-300">Cadd9 = C–D–E–G</code>):{' '}
                  {isVi ? 'làm Ballad/V-Pop trong trẻo, hiện đại hơn.' : 'adds sparkling Pop/Ballad warmth.'}
                </li>
                <li>
                  <strong className="text-white">maj7 / m7 / 9</strong> (vd <code className="text-cyan-300">Cmaj7, Am9</code>):{' '}
                  {isVi ? 'tạo chất Jazz, Bossa Nova, Lo-Fi sang trọng.' : 'essential for Jazz, Bossa & Lo-Fi richness.'}
                </li>
                <li>
                  <strong className="text-white">Slash Bass</strong> (vd <code className="text-cyan-300">G/B, C/E, Am/G</code>):{' '}
                  {isVi ? 'tay trái đi nốt bass liền bậc xuống dần (C→B→A→G→F) cực êm.' : 'creates smooth stepwise basslines.'}
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: ARPEGGIO PATTERNS & RHYTHM GRIDS */}
      {section === 'patterns' && (
        <div className="space-y-2.5">
          <div className="rounded-xl bg-indigo-950/35 border border-indigo-500/35 p-2.5 text-[11px] text-indigo-100 leading-relaxed">
            {isVi
              ? '🎹 Quy tắc phân vùng: Tay trái chơi vùng C2–C4 (rải 1–5–8, tránh bấm chập 3 nốt quá thấp dưới C3 sẽ bị đục tiếng). Tay phải chơi vùng C4–C6 (bấm thế hợp âm đảo + điền câu lót).'
              : '🎹 Register Rule: Keep LH in C2–C4 (open 1–5–8 intervals, avoid muddy triads below C3) and RH in C4–C6 (voice-led chords + fills).'}
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

      {/* SECTION 4: 4-STEP PRACTICE ROADMAP */}
      {section === 'roadmap' && (
        <div className="space-y-2.5">
          {[
            {
              step: '01',
              titleVi: 'Xác định Tông & 7 Hợp Âm của bài',
              titleEn: 'Find the Key & 7 Diatonic Chords',
              bodyVi:
                'Mở bài MIDI trong app (hoặc tra tông bài hát). Kiểm tra thanh Gam phía trên đàn để biết 7 phím thuộc tông và dùng nút Tone +/- để dịch về đúng quãng giọng hát.',
              bodyEn:
                'Load a MIDI song or pick your vocal key. Check the Key badge and transpose with Tone +/- to fit the singer comfortably.',
            },
            {
              step: '02',
              titleVi: 'Tập nối Tay Phải trước (Voice Leading) ở 65–75 BPM',
              titleEn: 'Practice RH Voice Leading First at 65–75 BPM',
              bodyVi:
                'Tắt tạm tay trái, chỉ tập bấm chuyển giữa các hợp âm bằng thế đảo gần nhất. Đảm bảo chuyển mượt không cần nhìn xuống tay quá lâu.',
              bodyEn:
                'Mute LH temporarily and connect RH chord inversions smoothly by keeping common tones.',
            },
            {
              step: '03',
              titleVi: 'Ghép Tay Trái + Nguyên tắc Đạp Pedal chuẩn',
              titleEn: 'Add LH Pattern + Clean Sustain Pedal Technique',
              bodyVi:
                'Ghép tay trái 1–5–8 (Ballad) hoặc Walking Bass (Jazz). Quy tắc Pedal: nhấn nốt mới → NHẤC chân lên dứt khoát → đạp xuống lại ngay (Syncopated Pedaling) để tiếng vang mà không bị nhòe giữa 2 hợp âm.',
              bodyEn:
                'Combine LH 1–5–8 or Walking Bass. Use syncopated pedaling: strike the new chord, immediately lift and re-depress the pedal so harmonies stay clean.',
            },
            {
              step: '04',
              titleVi: 'Tạo sắc thái (Đoạn nhỏ – Điệp khúc lớn) & Câu lót Fill-in',
              titleEn: 'Shape Dynamics (Verse vs Chorus) & Add Fills',
              bodyVi:
                'Verse (lời 1): đánh nhẹ, dùng Ballad Rải 8 nốt. Chorus (điệp khúc): tăng lực, chuyển sang Pop Chập hoặc rải quãng 10 mở rộng. Cuối ô nhịp 4 & 8 thêm 2–3 nốt Ngũ cung để nối câu mượt như đệm chuyên nghiệp.',
              bodyEn:
                'Keep verses soft with flowing arpeggios; open up choruses with rhythmic comping and add 2–3 pentatonic fill notes at phrase endings.',
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
