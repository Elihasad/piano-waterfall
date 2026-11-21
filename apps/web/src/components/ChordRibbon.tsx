import React from 'react';
import { Music2, RotateCcw, Sparkles } from 'lucide-react';
import {
  formatChordSymbol,
  formatPitchClass,
  mod12,
  PC_NAMES_SHARP,
} from '../core/accompaniment/harmonyAnalyzer';
import type { ChordEvent, DetectedKey, Language, NoteLabelMode } from '../core/types';

interface ChordRibbonProps {
  language: Language;
  detectedKey?: DetectedKey;
  chords: ChordEvent[];
  currentTimeSec: number;
  transpose: number;
  noteLabelMode: NoteLabelMode;
  isAccompanimentActive: boolean;
  activeStyleLabel?: string;
  onOpenStudio: () => void;
  onReturnOriginal: () => void;
}

export const ChordRibbon: React.FC<ChordRibbonProps> = ({
  language,
  detectedKey,
  chords,
  currentTimeSec,
  transpose,
  noteLabelMode,
  isAccompanimentActive,
  activeStyleLabel,
  onOpenStudio,
  onReturnOriginal,
}) => {
  if (chords.length === 0) return null;

  const useSolfege = noteLabelMode === 'solfege';
  let activeIdx = chords.findIndex(
    (c) => currentTimeSec >= c.startTimeSec - 0.02 && currentTimeSec < c.endTimeSec - 0.02,
  );
  if (activeIdx === -1) {
    activeIdx = currentTimeSec >= chords[chords.length - 1].startTimeSec ? chords.length - 1 : 0;
  }

  const current = chords[activeIdx];
  const next = chords[activeIdx + 1] ?? null;

  const currentSymbol = formatChordSymbol(
    current.rootPc,
    current.quality,
    current.bassPc,
    transpose,
  );
  const currentToneNames = current.pitchClasses
    .map((pc) => formatPitchClass(pc + transpose, useSolfege))
    .join(' · ');

  const nextSymbol = next
    ? formatChordSymbol(next.rootPc, next.quality, next.bassPc, transpose)
    : null;

  const keyLabel = detectedKey
    ? `${PC_NAMES_SHARP[mod12(detectedKey.tonicPc + transpose)]} ${
        detectedKey.mode === 'major' ? 'Major' : 'Minor'
      }`
    : null;

  return (
    <div className="w-full bg-[#f8f6f1] border-b border-[#e7e3d9] px-3 py-1.5 flex items-center justify-between gap-2 text-xs shrink-0 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-2 min-w-0">
        {keyLabel && (
          <span className="px-2.5 py-0.5 rounded-full bg-white border border-[#e7e3d9] text-[#4a4f5e] font-semibold text-[11px] shrink-0">
            {language === 'vi' ? 'Gam' : 'Key'}: <strong className="text-[#14151c]">{keyLabel}</strong>
          </span>
        )}

        <div className="flex items-center gap-2 bg-[#eceefe] border border-[#4f46e5]/30 rounded-full px-3 py-0.5 shrink-0">
          <span className="text-[11px] text-[#4f46e5] font-semibold font-mono">
            M{current.measureNumber}
          </span>
          <span className="text-sm font-extrabold text-[#14151c] tracking-tight">
            {currentSymbol}
          </span>
          <span className="text-[11px] text-[#4f46e5] font-mono font-semibold">{currentToneNames}</span>
        </div>

        {nextSymbol && (
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-[#888d9c] shrink-0">
            <span>→</span>
            <span className="px-2 py-0.5 rounded-full bg-white border border-[#e7e3d9] text-[#14151c] font-semibold">
              {nextSymbol}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {activeStyleLabel && isAccompanimentActive && (
          <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#e1f4ea] text-[#2f9e6c] text-[11px] font-semibold">
            <Sparkles className="w-3 h-3" />
            {activeStyleLabel}
          </span>
        )}
        <button
          type="button"
          onClick={onOpenStudio}
          className="px-2.5 py-0.5 rounded-full bg-white hover:bg-[#eceefe] border border-[#e7e3d9] text-[#4f46e5] text-[11px] font-semibold inline-flex items-center gap-1 transition"
        >
          <Music2 className="w-3 h-3" />
          {language === 'vi' ? 'Đổi Style' : 'Style'}
        </button>
        {isAccompanimentActive && (
          <button
            type="button"
            onClick={onReturnOriginal}
            className="px-2.5 py-0.5 rounded-full bg-[#14151c] hover:bg-[#2a2d3d] text-white text-[11px] font-semibold inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            {language === 'vi' ? 'Bản gốc' : 'Original'}
          </button>
        )}
      </div>
    </div>
  );
};
