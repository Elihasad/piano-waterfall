import React, { useMemo, useState } from 'react';
import { Music2, Play, RotateCcw, Sparkles, X } from 'lucide-react';
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

interface AccompanimentModalProps {
  language: Language;
  originalSong: Song;
  isAccompanimentActive: boolean;
  activeStyleId: AccompanimentStyleId;
  onApplyAccompaniment: (song: Song, styleId: AccompanimentStyleId) => void;
  onReturnOriginal: () => void;
  onClose: () => void;
}

const GENRE_TABS: ReadonlyArray<{ id: StyleGenre; labelVi: string; labelEn: string }> = [
  { id: 'ballad-pop', labelVi: 'Ballad & Pop', labelEn: 'Ballad & Pop' },
  { id: 'jazz', labelVi: 'Jazz', labelEn: 'Jazz' },
  { id: 'bolero-latin', labelVi: 'Bolero & Latin', labelEn: 'Bolero & Latin' },
  { id: 'scale-drill', labelVi: 'Chạy Gam', labelEn: 'Scale Drills' },
];

export const AccompanimentModal: React.FC<AccompanimentModalProps> = ({
  language,
  originalSong,
  isAccompanimentActive,
  activeStyleId,
  onApplyAccompaniment,
  onReturnOriginal,
  onClose,
}) => {
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
    if (firstInGenre) {
      setStyleId(firstInGenre.id);
    }
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
      onClose();
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
      onClose();
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
      onClose();
      return;
    }

    const parsed = parseChordProgressionText(
      customChordsText,
      selectedStyle.suggestedBpm,
      selectedStyle.beatsPerMeasure,
    );
    const customSong = generateAccompanimentSong({
      title: language === 'vi' ? 'Vòng Hợp Âm Tự Chọn' : 'Custom Chords',
      chords: parsed,
      key: activeKey,
      styleId,
      bpm: selectedStyle.suggestedBpm,
    });
    onApplyAccompaniment(customSong, styleId);
    onClose();
  };

  const isVi = language === 'vi';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[#1a1b22] border border-[#2c2e3b] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2c2e3b]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-bold text-slate-100">
              {isVi
                ? 'Đệm Hát Studio — Gam, Hợp Âm, Cách Rải & Jazz'
                : 'Accompaniment Studio — Scales, Chords & Jazz Styles'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[#2a2c38] text-slate-400"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Detected Key & Scale Banner */}
          <div className="rounded-xl bg-[#14151c] border border-[#262836] p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">
                  {isVi ? 'Gam / Tông hiện tại:' : 'Active Key / Scale:'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-violet-600/25 border border-violet-500/40 text-violet-200 font-bold">
                  {activeKey.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {activeKey.scalePcs.map((pc, i) => (
                  <span
                    key={`${pc}-${i}`}
                    className="px-1.5 py-0.5 rounded bg-[#222434] text-cyan-300 font-mono text-[11px]"
                  >
                    {formatPitchClass(pc)}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {activeKey.diatonicChords.map((dc) => (
                <span
                  key={dc.roman}
                  className="px-2 py-0.5 rounded-md bg-[#1d1f2b] border border-[#2d3042] text-slate-200 text-[11px]"
                >
                  <span className="text-slate-400 mr-1">{dc.roman}</span>
                  <span className="font-semibold text-white">{dc.symbol}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Source Selection */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSourceMode('song')}
                className={`px-3 py-1.5 rounded-lg font-semibold border transition ${
                  sourceMode === 'song'
                    ? 'bg-violet-600/25 border-violet-500 text-violet-100'
                    : 'bg-[#14151c] border-[#262836] text-slate-400 hover:text-slate-200'
                }`}
              >
                {isVi ? 'Từ bài đang mở' : 'From Current Song'}
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('preset')}
                className={`px-3 py-1.5 rounded-lg font-semibold border transition ${
                  sourceMode === 'preset'
                    ? 'bg-violet-600/25 border-violet-500 text-violet-100'
                    : 'bg-[#14151c] border-[#262836] text-slate-400 hover:text-slate-200'
                }`}
              >
                {isVi ? 'Vòng hợp âm mẫu' : 'Practice Progressions'}
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('custom')}
                className={`px-3 py-1.5 rounded-lg font-semibold border transition ${
                  sourceMode === 'custom'
                    ? 'bg-violet-600/25 border-violet-500 text-violet-100'
                    : 'bg-[#14151c] border-[#262836] text-slate-400 hover:text-slate-200'
                }`}
              >
                {isVi ? 'Tự nhập hợp âm' : 'Custom Chords'}
              </button>
            </div>

            {sourceMode === 'song' && (
              <div className="rounded-xl bg-[#14151c] border border-[#262836] p-2.5">
                <div className="text-[11px] text-slate-400 mb-1.5">
                  {isVi
                    ? `Đã tự nhận diện ${harmony.chords.length} ô nhịp hợp âm từ "${originalSong.title}":`
                    : `Detected ${harmony.chords.length} chord measures from "${originalSong.title}":`}
                </div>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {harmony.chords.slice(0, 32).map((c) => (
                    <span
                      key={c.measureNumber}
                      className="px-1.5 py-0.5 rounded bg-[#222433] text-slate-100 font-semibold text-[11px]"
                    >
                      <span className="text-slate-500 mr-1">{c.measureNumber}.</span>
                      {c.symbol}
                    </span>
                  ))}
                  {harmony.chords.length > 32 && (
                    <span className="text-[11px] text-slate-400 self-center ml-1">
                      +{harmony.chords.length - 32} {isVi ? 'ô nhịp nữa' : 'more'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {sourceMode === 'preset' && (
              <div className="space-y-2 rounded-xl bg-[#14151c] border border-[#262836] p-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
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
                      className={`text-left px-2.5 py-2 rounded-lg border transition ${
                        presetId === p.id
                          ? 'bg-violet-600/20 border-violet-500 text-white'
                          : 'bg-[#191b26] border-[#292b3a] text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="font-semibold text-[11px]">
                        {isVi ? p.nameVi : p.nameEn}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-400">
                    {isVi ? 'Chọn Tông:' : 'Key:'}
                  </span>
                  <select
                    value={tonicPc}
                    onChange={(e) => setTonicPc(Number(e.target.value))}
                    className="rounded-md bg-[#121216] border border-[#2c2e3b] px-2 py-1 text-slate-100 text-[11px]"
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
                    className="rounded-md bg-[#121216] border border-[#2c2e3b] px-2 py-1 text-slate-100 text-[11px]"
                  >
                    <option value="major">Major (Trưởng)</option>
                    <option value="minor">Minor (Thứ)</option>
                  </select>
                </div>
              </div>
            )}

            {sourceMode === 'custom' && (
              <div className="rounded-xl bg-[#14151c] border border-[#262836] p-2.5 space-y-1.5">
                <label className="text-[11px] text-slate-400 block">
                  {isVi
                    ? 'Nhập vòng hợp âm (cách nhau bởi dấu cách hoặc | , vd: Dm7 | G7 | Cmaj7 | Am7):'
                    : 'Enter chords separated by spaces or | (e.g. Dm7 | G7 | Cmaj7 | Am7):'}
                </label>
                <input
                  type="text"
                  value={customChordsText}
                  onChange={(e) => setCustomChordsText(e.target.value)}
                  className="w-full rounded-lg bg-[#121216] border border-[#2c2e3b] px-3 py-2 text-slate-100 font-mono text-xs"
                />
              </div>
            )}
          </div>

          {/* Genre Tabs + Playing Styles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Music2 className="w-3.5 h-3.5 text-cyan-400" />
                {isVi ? 'Dòng nhạc, Style chơi & Cách rải' : 'Genre, Playing Style & Arpeggio'}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {GENRE_TABS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleGenreSelect(g.id)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold transition ${
                    selectedGenre === g.id
                      ? 'bg-cyan-600 text-white'
                      : 'bg-[#222433] text-slate-300 hover:bg-[#2c2f42]'
                  }`}
                >
                  {isVi ? g.labelVi : g.labelEn}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {visibleStyles.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStyleId(st.id)}
                  className={`text-left p-2.5 rounded-xl border transition ${
                    styleId === st.id
                      ? 'bg-violet-600/20 border-violet-500 text-white'
                      : 'bg-[#14151c] border-[#262836] text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs">
                      {isVi ? st.nameVi : st.nameEn}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#232535] text-slate-300">
                      {st.suggestedBpm} BPM
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    {isVi ? st.descVi : st.descEn}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-[#2c2e3b]">
          <div>
            {isAccompanimentActive && (
              <button
                type="button"
                onClick={() => {
                  onReturnOriginal();
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-[#242632] hover:bg-[#2f3242] text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {isVi ? 'Quay về Bản gốc' : 'Back to Original'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-[#242632] text-xs text-slate-300"
            >
              {isVi ? 'Đóng' : 'Close'}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white inline-flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              {isVi ? 'Chạy Đệm Hát Ngay' : 'Start Accompaniment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
