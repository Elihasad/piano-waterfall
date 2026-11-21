import React, { useMemo, useState } from 'react';
import { Music2, Play, RotateCcw, Sparkles } from 'lucide-react';
import {
  ACCOMPANIMENT_STYLES,
  buildPresetAccompanimentSong,
  generateAccompanimentSong,
  PRACTICE_PROGRESSIONS,
  type StyleGenre,
} from '../core/accompaniment/accompanimentGenerator';
import {
  analyzeSongHarmony,
  buildKeyInfo,
  formatPitchClass,
  parseChordProgressionText,
  PC_NAMES_SHARP,
} from '../core/accompaniment/harmonyAnalyzer';
import type { AccompanimentStyleId, Language, Song } from '../core/types';

interface ArrangeViewProps {
  language: Language;
  originalSong: Song;
  isAccompanimentActive: boolean;
  activeStyleId: AccompanimentStyleId;
  onApplyAccompaniment: (song: Song, styleId: AccompanimentStyleId) => void;
  onReturnOriginal: () => void;
}

const GENRE_TABS: ReadonlyArray<{ id: StyleGenre; labelVi: string; labelEn: string }> = [
  { id: 'ballad-pop', labelVi: 'Ballad & Pop', labelEn: 'Ballad & Pop' },
  { id: 'jazz', labelVi: 'Jazz', labelEn: 'Jazz' },
  { id: 'bolero-latin', labelVi: 'Bolero & Latin', labelEn: 'Bolero & Latin' },
  { id: 'scale-drill', labelVi: 'Chạy Gam', labelEn: 'Scale Drills' },
];

export const ArrangeView: React.FC<ArrangeViewProps> = ({
  language,
  originalSong,
  isAccompanimentActive,
  activeStyleId,
  onApplyAccompaniment,
  onReturnOriginal,
}) => {
  const isVi = language === 'vi';
  const harmony = useMemo(() => analyzeSongHarmony(originalSong), [originalSong]);

  const [sourceMode, setSourceMode] = useState<'song' | 'preset' | 'custom'>('song');
  const [selectedGenre, setSelectedGenre] = useState<StyleGenre>(() => {
    const found = ACCOMPANIMENT_STYLES.find((s) => s.id === activeStyleId);
    return found?.genre ?? 'ballad-pop';
  });
  const [styleId, setStyleId] = useState<AccompanimentStyleId>(activeStyleId);
  const [presetId, setPresetId] = useState<string>(PRACTICE_PROGRESSIONS[0].id);
  const [tonicPc, setTonicPc] = useState<number>(harmony.key.tonicPc);
  const [keyMode, setKeyMode] = useState<'major' | 'minor'>(harmony.key.mode);
  const [customChordsText, setCustomChordsText] = useState<string>(() =>
    harmony.chords
      .slice(0, 16)
      .map((c) => c.symbol)
      .join(' | '),
  );

  const selectedStyle =
    ACCOMPANIMENT_STYLES.find((s) => s.id === styleId) ?? ACCOMPANIMENT_STYLES[0];
  const visibleStyles = ACCOMPANIMENT_STYLES.filter((s) => s.genre === selectedGenre);

  const activeKey = useMemo(
    () => (sourceMode === 'song' ? harmony.key : buildKeyInfo(tonicPc, keyMode)),
    [sourceMode, harmony.key, tonicPc, keyMode],
  );

  const handleGenreSelect = (genre: StyleGenre) => {
    setSelectedGenre(genre);
    const firstInGenre = ACCOMPANIMENT_STYLES.find((s) => s.genre === genre);
    if (firstInGenre) setStyleId(firstInGenre.id);
  };

  const handleApply = () => {
    if (styleId === 'scale-drill') {
      const drillSong = generateAccompanimentSong({
        title: activeKey.label,
        chords: [],
        key: activeKey,
        styleId: 'scale-drill',
        bpm: selectedStyle.suggestedBpm,
      });
      onApplyAccompaniment(drillSong, styleId);
      return;
    }

    if (sourceMode === 'song') {
      const accSong = generateAccompanimentSong({
        title: originalSong.title,
        chords: harmony.chords,
        key: harmony.key,
        styleId,
        bpm: originalSong.defaultBpm || selectedStyle.suggestedBpm,
      });
      onApplyAccompaniment(accSong, styleId);
      return;
    }

    if (sourceMode === 'preset') {
      const presetSong = buildPresetAccompanimentSong(
        presetId,
        styleId,
        tonicPc,
        keyMode,
        selectedStyle.suggestedBpm,
      );
      onApplyAccompaniment(presetSong, styleId);
      return;
    }

    const parsed = parseChordProgressionText(
      customChordsText,
      selectedStyle.suggestedBpm,
      selectedStyle.beatsPerMeasure,
    );
    const customSong = generateAccompanimentSong({
      title: isVi ? 'Đệm Hát Tự Chọn' : 'Custom Arrangement',
      chords: parsed,
      key: activeKey,
      styleId,
      bpm: selectedStyle.suggestedBpm,
    });
    onApplyAccompaniment(customSong, styleId);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8f6f1] px-4 sm:px-6 py-5 pb-28 lg:pb-8">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Indigo-Violet-Teal MuseKey Arranger Hero */}
        <div className="arrange-hero rounded-[1.75rem] p-5 sm:p-7 text-white shadow-lg flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-indigo-100/90 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {isVi ? 'Đệm Hát Studio · 11 Style Ballad, Jazz, Bolero & Chạy Gam' : 'Accompaniment Arranger · 11 Styles'}
            </div>
            <h1 className="display-serif text-3xl sm:text-4xl font-semibold">
              {isVi ? 'Phối Đệm Hát Piano' : 'Piano Arranger'}
            </h1>
            <p className="text-sm text-indigo-100/90 max-w-xl">
              {isVi
                ? 'Tự tách hợp âm từ bài MIDI đang mở, chọn vòng hợp âm chuẩn, hoặc dán thẳng lời bài hát có hợp âm dạng [Am]Mưa buồn... để tạo bài đệm 2 tay.'
                : 'Auto-extract chords from your loaded MIDI, pick a classic progression, or paste [Chord]Lyric sheets to generate a two-hand accompaniment.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAccompanimentActive && (
              <button
                type="button"
                onClick={onReturnOriginal}
                className="px-4 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {isVi ? 'Bản gốc' : 'Original'}
              </button>
            )}
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2.5 rounded-full bg-white hover:bg-slate-100 text-[#14151c] text-sm font-bold inline-flex items-center gap-1.5 shadow-md"
            >
              <Play className="w-4 h-4 fill-current text-[#4f46e5]" />
              {isVi ? 'Chạy Đệm Hát Ngay' : 'Play Arrangement'}
            </button>
          </div>
        </div>

        {/* Active Key & Diatonic Chords Card */}
        <div className="paper-card rounded-2xl p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[#4a4f5e] font-medium">
                {isVi ? 'Gam / Tông hiện tại:' : 'Active Key:'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#eceefe] text-[#4f46e5] font-bold text-xs">
                {activeKey.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {activeKey.scalePcs.map((pc, i) => (
                <span
                  key={`${pc}-${i}`}
                  className="px-2 py-0.5 rounded-md bg-[#f3f0e8] text-[#14151c] font-mono text-xs font-semibold"
                >
                  {formatPitchClass(pc)}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeKey.diatonicChords.map((dc) => (
              <span
                key={dc.roman}
                className="px-2.5 py-1 rounded-lg bg-[#faf8f4] border border-[#e7e3d9] text-xs"
              >
                <span className="text-[#888d9c] mr-1">{dc.roman}</span>
                <span className="font-bold text-[#14151c]">{dc.symbol}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Source Selector Card */}
        <div className="paper-card rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5 bg-[#edeae2] p-1 rounded-full w-fit">
            {[
              { id: 'song' as const, vi: 'Từ bài đang mở', en: 'From Current Song' },
              { id: 'preset' as const, vi: 'Vòng hợp âm mẫu', en: 'Practice Presets' },
              { id: 'custom' as const, vi: 'Dán [Hợp âm]Lời / Tự nhập', en: 'Paste [Chord]Lyrics' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSourceMode(tab.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                  sourceMode === tab.id
                    ? 'bg-white text-[#14151c] shadow-sm'
                    : 'text-[#4a4f5e] hover:text-[#14151c]'
                }`}
              >
                {isVi ? tab.vi : tab.en}
              </button>
            ))}
          </div>

          {sourceMode === 'song' && (
            <div className="space-y-2">
              <div className="text-xs text-[#4a4f5e]">
                {isVi
                  ? `Đã tự nhận diện ${harmony.chords.length} ô nhịp hợp âm từ "${originalSong.title}":`
                  : `Detected ${harmony.chords.length} chord bars from "${originalSong.title}":`}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {harmony.chords.slice(0, 32).map((c) => (
                  <span
                    key={c.measureNumber}
                    className="px-2 py-0.5 rounded-md bg-[#f8f6f1] border border-[#e7e3d9] text-xs font-semibold text-[#14151c]"
                  >
                    <span className="text-[#888d9c] mr-1">{c.measureNumber}.</span>
                    {c.symbol}
                  </span>
                ))}
              </div>
            </div>
          )}

          {sourceMode === 'preset' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRACTICE_PROGRESSIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPresetId(p.id);
                      setTonicPc(p.defaultKeyPc);
                      setKeyMode(p.defaultMode);
                      const st = ACCOMPANIMENT_STYLES.find((s) => s.id === p.defaultStyle);
                      if (st) {
                        setSelectedGenre(st.genre);
                        setStyleId(st.id);
                      }
                    }}
                    className={`text-left px-3 py-2.5 rounded-xl border text-xs font-semibold transition ${
                      presetId === p.id
                        ? 'bg-[#eceefe] border-[#4f46e5] text-[#14151c]'
                        : 'bg-[#faf8f4] border-[#e7e3d9] text-[#4a4f5e] hover:border-[#c8c3b6]'
                    }`}
                  >
                    {isVi ? p.nameVi : p.nameEn}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#4a4f5e] font-medium">{isVi ? 'Chọn Tông:' : 'Key:'}</span>
                <select
                  value={tonicPc}
                  onChange={(e) => setTonicPc(Number(e.target.value))}
                  className="rounded-lg bg-white border border-[#e7e3d9] px-2.5 py-1 text-[#14151c] font-semibold"
                >
                  {PC_NAMES_SHARP.map((name, idx) => (
                    <option key={name} value={idx}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  value={keyMode}
                  onChange={(e) => setKeyMode(e.target.value as 'major' | 'minor')}
                  className="rounded-lg bg-white border border-[#e7e3d9] px-2.5 py-1 text-[#14151c] font-semibold"
                >
                  <option value="major">Major (Trưởng)</option>
                  <option value="minor">Minor (Thứ)</option>
                </select>
              </div>
            </div>
          )}

          {sourceMode === 'custom' && (
            <div className="space-y-1.5">
              <label className="text-xs text-[#4a4f5e] block">
                {isVi
                  ? 'Nhập vòng hợp âm (vd: Dm7 | G7 | Cmaj7 | Am7) HOẶC dán lời có hợp âm trong ngoặc vuông [Am]Mưa buồn [Dm]rơi [E7]mãi [Am]:'
                  : 'Enter chords (e.g. Dm7 | G7 | Cmaj7 | Am7) OR paste [Chord]Lyrics like [Am]Rainy [Dm]days [E7]here [Am]:'}
              </label>
              <textarea
                rows={3}
                value={customChordsText}
                onChange={(e) => setCustomChordsText(e.target.value)}
                className="w-full rounded-xl bg-[#faf8f4] border border-[#e7e3d9] px-3 py-2 text-[#14151c] font-mono text-xs focus:outline-none focus:border-[#4f46e5]"
              />
            </div>
          )}
        </div>

        {/* Genre Tabs + Playing Styles Grid */}
        <div className="paper-card rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-sm text-[#14151c] flex items-center gap-1.5">
              <Music2 className="w-4 h-4 text-[#4f46e5]" />
              {isVi ? 'Chọn Dòng Nhạc, Style Chơi & Cách Rải' : 'Choose Genre, Playing Style & Arpeggio'}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {GENRE_TABS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleGenreSelect(g.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                    selectedGenre === g.id
                      ? 'bg-[#4f46e5] text-white'
                      : 'bg-[#f3f0e8] text-[#4a4f5e] hover:text-[#14151c]'
                  }`}
                >
                  {isVi ? g.labelVi : g.labelEn}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {visibleStyles.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStyleId(st.id)}
                className={`text-left p-3.5 rounded-2xl border transition ${
                  styleId === st.id
                    ? 'bg-[#eceefe] border-[#4f46e5] shadow-sm'
                    : 'bg-[#faf8f4] border-[#e7e3d9] hover:border-[#c8c3b6]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-xs text-[#14151c]">
                    {isVi ? st.nameVi : st.nameEn}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#e7e3d9] text-[#4a4f5e]">
                    {st.suggestedBpm} BPM
                  </span>
                </div>
                <p className="text-[11px] text-[#4a4f5e] mt-1.5 leading-snug">
                  {isVi ? st.descVi : st.descEn}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
