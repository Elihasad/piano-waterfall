import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Sliders,
  Sparkles,
  Library,
  Settings,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
} from 'lucide-react';
import type { HandControlState, NoteLabelMode, Song } from '../core/types';

interface TopBarProps {
  song: Song;
  isPlaying: boolean;
  currentTimeSec: number;
  speedRatio: number;
  transpose: number;
  loopEnabled: boolean;
  loopStartMeasure: number;
  loopEndMeasure: number;
  hands: HandControlState;
  noteLabelMode: NoteLabelMode;
  effectsEnabled: boolean;
  fullKeyboard: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
  onStepMeasure: (delta: -1 | 1) => void;
  onSeek: (timeSec: number) => void;
  onSpeedChange: (ratio: number) => void;
  onTransposeChange: (semitones: number) => void;
  onLoopChange: (enabled: boolean, start?: number, end?: number) => void;
  onHandsChange: (hands: HandControlState) => void;
  onCycleNoteLabelMode: () => void;
  onToggleEffects: () => void;
  onToggleFullKeyboard: () => void;
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export const TopBar: React.FC<TopBarProps> = ({
  song,
  isPlaying,
  currentTimeSec,
  speedRatio,
  transpose,
  loopEnabled,
  loopStartMeasure,
  loopEndMeasure,
  hands,
  noteLabelMode,
  effectsEnabled,
  fullKeyboard,
  onTogglePlay,
  onRestart,
  onStepMeasure,
  onSeek,
  onSpeedChange,
  onTransposeChange,
  onLoopChange,
  onHandsChange,
  onCycleNoteLabelMode,
  onToggleEffects,
  onToggleFullKeyboard,
  onOpenLibrary,
  onOpenSettings,
}) => {
  const [openPopover, setOpenPopover] = useState<'hands' | 'loop' | null>(null);

  const effectiveBpm = Math.round(song.defaultBpm * speedRatio);
  const currentMeasure =
    song.measures.find(
      (m) => currentTimeSec >= m.startTimeSec - 0.01 && currentTimeSec < m.endTimeSec,
    )?.number ?? song.measures.length;

  const labelButtonText =
    noteLabelMode === 'letters' ? 'C D E' : noteLabelMode === 'solfege' ? 'Đô Rê' : 'Tắt';

  const maxMeasure = Math.max(1, song.measures.length);

  return (
    <header className="relative z-20 bg-[#1a1b22] border-b border-[#2c2e3b] px-2 pt-1.5 pb-1 select-none">
      {/* Row 1: Primary Transport + Controls */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {/* Library & Song title */}
        <button
          type="button"
          onClick={onOpenLibrary}
          aria-label="Thư viện bản nhạc"
          className="flex items-center gap-1.5 px-2.5 h-9 rounded-lg bg-[#242632] hover:bg-[#2f3242] active:scale-95 text-slate-100 shrink-0 transition"
        >
          <Library className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold max-w-[110px] sm:max-w-[160px] truncate">
            {song.title}
          </span>
        </button>

        {/* Transport */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onRestart}
            aria-label="Phát lại từ đầu"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#242632] hover:bg-[#2f3242] active:scale-95 text-slate-200"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onStepMeasure(-1)}
            aria-label="Lùi 1 ô nhịp"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#242632] hover:bg-[#2f3242] active:scale-95 text-slate-200"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Tạm dừng' : 'Phát nhạc'}
            className="w-10 h-9 flex items-center justify-center rounded-lg bg-violet-600 hover:bg-violet-500 active:scale-95 text-white shadow"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={() => onStepMeasure(1)}
            aria-label="Tiến 1 ô nhịp"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#242632] hover:bg-[#2f3242] active:scale-95 text-slate-200"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Loop A-B */}
        <button
          type="button"
          onClick={() => setOpenPopover(openPopover === 'loop' ? null : 'loop')}
          aria-label="Lặp đoạn A-B"
          className={`flex items-center gap-1 px-2 h-9 rounded-lg text-xs font-medium shrink-0 transition ${
            loopEnabled
              ? 'bg-violet-600/30 text-violet-300 border border-violet-500/60'
              : 'bg-[#242632] text-slate-300 hover:bg-[#2f3242]'
          }`}
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>{loopEnabled ? `${loopStartMeasure}-${loopEndMeasure}` : 'A-B'}</span>
        </button>

        {/* BPM Control */}
        <div className="flex items-center gap-1 bg-[#242632] rounded-lg px-1.5 h-9 shrink-0">
          <span className="text-[10px] text-slate-400 font-semibold px-0.5">BPM</span>
          <button
            type="button"
            onClick={() => onSpeedChange(Math.max(0.25, +(speedRatio - 0.1).toFixed(2)))}
            aria-label="Giảm tốc độ"
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#323546] text-slate-200"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => onSpeedChange(speedRatio === 1 ? 0.7 : speedRatio === 0.7 ? 0.5 : 1)}
            title="Bấm để chuyển nhanh 100% / 70% / 50%"
            className="text-xs font-bold text-slate-100 min-w-[44px] text-center"
          >
            {effectiveBpm}
          </button>
          <button
            type="button"
            onClick={() => onSpeedChange(Math.min(2.0, +(speedRatio + 0.1).toFixed(2)))}
            aria-label="Tăng tốc độ"
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#323546] text-slate-200"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Hands Independent Control Popover trigger */}
        <button
          type="button"
          onClick={() => setOpenPopover(openPopover === 'hands' ? null : 'hands')}
          aria-label="Tay trái / phải"
          className={`flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-xs font-medium shrink-0 transition ${
            openPopover === 'hands'
              ? 'bg-cyan-600/30 text-cyan-200 border border-cyan-500/50'
              : 'bg-[#242632] text-slate-200 hover:bg-[#2f3242]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="inline-flex items-center gap-1">
            <span
              className={`w-2 h-2 rounded-full ${hands.left.visual ? 'bg-green-400' : 'bg-slate-600'}`}
            />
            <span
              className={`w-2 h-2 rounded-full ${hands.right.visual ? 'bg-cyan-400' : 'bg-slate-600'}`}
            />
          </span>
        </button>

        {/* Note Label Mode */}
        <button
          type="button"
          onClick={onCycleNoteLabelMode}
          aria-label="Tên nốt"
          className="px-2.5 h-9 rounded-lg bg-[#242632] hover:bg-[#2f3242] text-xs font-bold text-cyan-300 shrink-0"
        >
          {labelButtonText}
        </button>

        {/* Transpose */}
        <div className="flex items-center gap-0.5 bg-[#242632] rounded-lg px-1.5 h-9 shrink-0">
          <span className="text-[10px] text-slate-400 font-semibold">Tone</span>
          <button
            type="button"
            onClick={() => onTransposeChange(transpose - 1)}
            aria-label="Giảm tone"
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#323546]"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-xs font-semibold min-w-[24px] text-center">
            {transpose > 0 ? `+${transpose}` : transpose}
          </span>
          <button
            type="button"
            onClick={() => onTransposeChange(transpose + 1)}
            aria-label="Tăng tone"
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#323546]"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Effects */}
        <button
          type="button"
          onClick={onToggleEffects}
          aria-label="Hiệu ứng ánh sáng"
          className={`flex items-center gap-1 px-2 h-9 rounded-lg text-xs shrink-0 ${
            effectsEnabled
              ? 'bg-emerald-600/25 text-emerald-300 border border-emerald-500/40'
              : 'bg-[#242632] text-slate-400'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>

        {/* Keyboard Zoom Auto vs 88 */}
        <button
          type="button"
          onClick={onToggleFullKeyboard}
          aria-label="Thu phóng bàn phím"
          className="flex items-center gap-1 px-2 h-9 rounded-lg bg-[#242632] hover:bg-[#2f3242] text-xs text-slate-200 shrink-0"
        >
          {fullKeyboard ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          <span>{fullKeyboard ? '88' : 'Auto'}</span>
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Cài đặt"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#242632] hover:bg-[#2f3242] text-slate-300 shrink-0"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Row 2: Scrubber Progress Bar */}
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span className="font-mono min-w-[78px]">
          {formatTime(currentTimeSec)} / {formatTime(song.durationSec)}
        </span>
        <input
          type="range"
          min={0}
          max={song.durationSec}
          step={0.05}
          value={currentTimeSec}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Thanh tua thời gian"
          className="flex-1 h-1.5 accent-violet-500 bg-[#2c2e3b] rounded-lg cursor-pointer"
        />
        <span className="font-mono text-slate-300 min-w-[54px] text-right">
          Ô {currentMeasure}/{maxMeasure}
        </span>
      </div>

      {/* Popover: Hands Independent Controls */}
      {openPopover === 'hands' && (
        <div className="absolute right-2 top-[52px] z-30 w-72 rounded-xl bg-[#1e202b] border border-[#323548] shadow-2xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200">Tách tay trái / tay phải</span>
            <button
              type="button"
              onClick={() => setOpenPopover(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Đóng
            </button>
          </div>

          {/* 1-tap Presets */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() =>
                onHandsChange({
                  left: { audio: true, visual: true },
                  right: { audio: true, visual: true },
                })
              }
              className="py-1.5 rounded-lg bg-[#2a2d3d] hover:bg-[#35394d] text-[11px] font-semibold text-slate-100"
            >
              Cả 2 tay
            </button>
            <button
              type="button"
              onClick={() =>
                onHandsChange({
                  left: { audio: false, visual: false },
                  right: { audio: true, visual: true },
                })
              }
              className="py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-[11px] font-semibold text-cyan-300"
            >
              Chỉ tay phải
            </button>
            <button
              type="button"
              onClick={() =>
                onHandsChange({
                  left: { audio: true, visual: true },
                  right: { audio: false, visual: false },
                })
              }
              className="py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-[11px] font-semibold text-emerald-300"
            >
              Chỉ tay trái
            </button>
          </div>

          {/* Right Hand Row */}
          <div className="flex items-center justify-between bg-[#15161f] rounded-lg px-2.5 py-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span className="text-xs font-semibold text-slate-200">Tay phải</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Âm thanh tay phải"
                aria-pressed={hands.right.audio}
                onClick={() =>
                  onHandsChange({
                    ...hands,
                    right: { ...hands.right, audio: !hands.right.audio },
                  })
                }
                className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                  hands.right.audio ? 'bg-cyan-600/30 text-cyan-300' : 'bg-[#242632] text-slate-500'
                }`}
              >
                {hands.right.audio ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                Tiếng
              </button>
              <button
                type="button"
                aria-label="Hiển thị tay phải"
                aria-pressed={hands.right.visual}
                onClick={() =>
                  onHandsChange({
                    ...hands,
                    right: { ...hands.right, visual: !hands.right.visual },
                  })
                }
                className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                  hands.right.visual ? 'bg-cyan-600/30 text-cyan-300' : 'bg-[#242632] text-slate-500'
                }`}
              >
                {hands.right.visual ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                Hiện
              </button>
            </div>
          </div>

          {/* Left Hand Row */}
          <div className="flex items-center justify-between bg-[#15161f] rounded-lg px-2.5 py-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <span className="text-xs font-semibold text-slate-200">Tay trái</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Âm thanh tay trái"
                aria-pressed={hands.left.audio}
                onClick={() =>
                  onHandsChange({
                    ...hands,
                    left: { ...hands.left, audio: !hands.left.audio },
                  })
                }
                className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                  hands.left.audio ? 'bg-emerald-600/30 text-emerald-300' : 'bg-[#242632] text-slate-500'
                }`}
              >
                {hands.left.audio ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                Tiếng
              </button>
              <button
                type="button"
                aria-label="Hiển thị tay trái"
                aria-pressed={hands.left.visual}
                onClick={() =>
                  onHandsChange({
                    ...hands,
                    left: { ...hands.left, visual: !hands.left.visual },
                  })
                }
                className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                  hands.left.visual ? 'bg-emerald-600/30 text-emerald-300' : 'bg-[#242632] text-slate-500'
                }`}
              >
                {hands.left.visual ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                Hiện
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popover: A-B Loop Range */}
      {openPopover === 'loop' && (
        <div className="absolute left-36 top-[52px] z-30 w-64 rounded-xl bg-[#1e202b] border border-[#323548] shadow-2xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200">Lặp đoạn (theo ô nhịp)</span>
            <button
              type="button"
              onClick={() => onLoopChange(!loopEnabled, loopStartMeasure, loopEndMeasure)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                loopEnabled ? 'bg-violet-600 text-white' : 'bg-[#2a2d3d] text-slate-300'
              }`}
            >
              {loopEnabled ? 'Đang bật' : 'Đang tắt'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex flex-col gap-1 text-slate-300">
              <span>Từ ô nhịp</span>
              <input
                type="number"
                min={1}
                max={maxMeasure}
                value={loopStartMeasure}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(maxMeasure, Number(e.target.value) || 1));
                  onLoopChange(true, val, Math.max(val, loopEndMeasure));
                }}
                className="bg-[#121216] border border-[#2c2e3b] rounded px-2 py-1 text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-slate-300">
              <span>Đến ô nhịp</span>
              <input
                type="number"
                min={loopStartMeasure}
                max={maxMeasure}
                value={loopEndMeasure}
                onChange={(e) => {
                  const val = Math.max(
                    loopStartMeasure,
                    Math.min(maxMeasure, Number(e.target.value) || loopStartMeasure),
                  );
                  onLoopChange(true, loopStartMeasure, val);
                }}
                className="bg-[#121216] border border-[#2c2e3b] rounded px-2 py-1 text-slate-100"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => setOpenPopover(null)}
            className="w-full py-1.5 rounded-lg bg-[#2a2d3d] text-xs text-slate-200"
          >
            Xong
          </button>
        </div>
      )}
    </header>
  );
};
