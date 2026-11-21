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
  Piano,
  Usb,
  BookOpen,
  Compass,
  GraduationCap,
  Bell,
  Moon,
  Sun,
  Home,
} from 'lucide-react';
import { t } from '../core/i18n';
import { midiToNoteLabel } from '../core/noteNames';
import type {
  HandControlState,
  Language,
  NoteLabelMode,
  PracticeMode,
  Song,
  SoundPreset,
} from '../core/types';

interface TopBarProps {
  language: Language;
  song: Song;
  isPlaying: boolean;
  currentTimeSec: number;
  speedRatio: number;
  transpose: number;
  loopEnabled: boolean;
  loopStartMeasure: number;
  loopEndMeasure: number;
  metronomeEnabled?: boolean;
  practiceMode: PracticeMode;
  waitingMidis: number[];
  midiDevices: string[];
  soundPreset: SoundPreset;
  hands: HandControlState;
  noteLabelMode: NoteLabelMode;
  effectsEnabled: boolean;
  fullKeyboard: boolean;
  darkTheme?: boolean;
  isAccompanimentActive?: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
  onStepMeasure: (delta: -1 | 1) => void;
  onSeek: (timeSec: number) => void;
  onSpeedChange: (ratio: number) => void;
  onTransposeChange: (semitones: number) => void;
  onLoopChange: (enabled: boolean, start?: number, end?: number) => void;
  onPracticeModeChange: (mode: PracticeMode) => void;
  onSoundPresetChange: (preset: SoundPreset) => void;
  onHandsChange: (hands: HandControlState) => void;
  onCycleNoteLabelMode: () => void;
  onToggleEffects: () => void;
  onToggleFullKeyboard: () => void;
  onToggleTheme?: () => void;
  onToggleMetronome?: () => void;
  onOpenPracticePath?: () => void;
  onOpenAccompaniment?: () => void;
  onOpenTheory?: () => void;
  onOpenQuiz?: () => void;
  onOpenHome?: () => void;
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
  language,
  song,
  isPlaying,
  currentTimeSec,
  speedRatio,
  transpose,
  loopEnabled,
  loopStartMeasure,
  loopEndMeasure,
  metronomeEnabled = false,
  practiceMode,
  waitingMidis,
  midiDevices,
  soundPreset,
  hands,
  noteLabelMode,
  effectsEnabled,
  fullKeyboard,
  darkTheme = false,
  isAccompanimentActive = false,
  onTogglePlay,
  onRestart,
  onStepMeasure,
  onSeek,
  onSpeedChange,
  onTransposeChange,
  onLoopChange,
  onPracticeModeChange,
  onSoundPresetChange,
  onHandsChange,
  onCycleNoteLabelMode,
  onToggleEffects,
  onToggleFullKeyboard,
  onToggleTheme,
  onToggleMetronome,
  onOpenPracticePath,
  onOpenAccompaniment,
  onOpenTheory,
  onOpenQuiz,
  onOpenHome,
  onOpenLibrary,
  onOpenSettings,
}) => {
  const [openPopover, setOpenPopover] = useState<'hands' | 'loop' | 'sound' | null>(null);

  const effectiveBpm = Math.round(song.defaultBpm * speedRatio);
  const currentMeasure =
    song.measures.find(
      (m) => currentTimeSec >= m.startTimeSec - 0.01 && currentTimeSec < m.endTimeSec,
    )?.number ?? song.measures.length;

  const labelButtonText =
    noteLabelMode === 'letters'
      ? t(language, 'labelLetters')
      : noteLabelMode === 'solfege'
        ? t(language, 'labelSolfege')
        : t(language, 'labelOff');

  const soundShortLabel =
    soundPreset === 'grand'
      ? 'Grand'
      : soundPreset === 'studio'
        ? 'Studio'
        : soundPreset === 'bright'
          ? 'Bright'
          : 'E-Piano';

  const maxMeasure = Math.max(1, song.measures.length);
  const midiConnected = midiDevices.length > 0;

  return (
    <header className="relative z-20 bg-white border-b border-[#e7e3d9] px-2.5 pt-2 pb-1.5 select-none text-[#14151c]">
      {/* Row 1: MuseKey Warm-Paper Studio Transport + Controls */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1.5">
        {/* Back to Home */}
        {onOpenHome && (
          <button
            type="button"
            onClick={onOpenHome}
            aria-label={language === 'vi' ? 'Trang chủ' : 'Home'}
            title={language === 'vi' ? 'Trang chủ' : 'Home'}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[#f8f6f1] hover:bg-[#edeae2] border border-[#e7e3d9] text-[#4a4f5e] shrink-0 transition"
          >
            <Home className="w-4 h-4" />
          </button>
        )}

        {/* Library & Song title */}
        <button
          type="button"
          onClick={onOpenLibrary}
          aria-label={t(language, 'libraryBtn')}
          className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-[#f8f6f1] hover:bg-[#edeae2] border border-[#e7e3d9] active:scale-95 text-[#14151c] shrink-0 transition"
        >
          <Library className="w-4 h-4 text-[#4f46e5]" />
          <span className="text-xs font-bold max-w-[110px] sm:max-w-[160px] truncate">
            {song.title}
          </span>
        </button>

        {/* Transport */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onRestart}
            aria-label={t(language, 'restart')}
            className="w-8 h-9 flex items-center justify-center rounded-full bg-[#f8f6f1] hover:bg-[#edeae2] border border-[#e7e3d9] active:scale-95 text-[#4a4f5e]"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onStepMeasure(-1)}
            aria-label={t(language, 'prevMeasure')}
            className="w-8 h-9 flex items-center justify-center rounded-full bg-[#f8f6f1] hover:bg-[#edeae2] border border-[#e7e3d9] active:scale-95 text-[#4a4f5e]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? t(language, 'pause') : t(language, 'play')}
            className="w-10 h-9 flex items-center justify-center rounded-full bg-[#14151c] hover:bg-[#2a2d3d] active:scale-95 text-white shadow-sm"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
          </button>
          <button
            type="button"
            onClick={() => onStepMeasure(1)}
            aria-label={t(language, 'nextMeasure')}
            className="w-8 h-9 flex items-center justify-center rounded-full bg-[#f8f6f1] hover:bg-[#edeae2] border border-[#e7e3d9] active:scale-95 text-[#4a4f5e]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Practice Path (MuseKey 4-Bar Drawer) */}
        {onOpenPracticePath && (
          <button
            type="button"
            onClick={onOpenPracticePath}
            aria-label={language === 'vi' ? 'Lộ trình 4 ô nhịp' : 'Practice Path'}
            className="flex items-center gap-1 px-2.5 h-9 rounded-full text-xs font-bold shrink-0 text-white shadow-sm transition"
            style={{ background: 'linear-gradient(135deg, #0f766e 0%, #4338ca 100%)' }}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Lộ trình' : 'Path'}</span>
          </button>
        )}

        {/* Practice Mode: Listen vs Wait (MIDI) */}
        <button
          type="button"
          onClick={() => onPracticeModeChange(practiceMode === 'listen' ? 'wait' : 'listen')}
          aria-label={t(language, 'practiceMode')}
          className={`flex items-center gap-1 px-2.5 h-9 rounded-full text-xs font-semibold shrink-0 border transition ${
            practiceMode === 'wait'
              ? 'bg-[#faefdb] text-[#c0822a] border-[#c0822a]/50'
              : 'bg-[#f8f6f1] text-[#4a4f5e] border-[#e7e3d9] hover:bg-[#edeae2]'
          }`}
        >
          <Usb className={`w-3.5 h-3.5 ${midiConnected ? 'text-[#2f9e6c]' : 'text-[#888d9c]'}`} />
          <span>{practiceMode === 'wait' ? t(language, 'modeWait') : t(language, 'modeListen')}</span>
        </button>

        {/* Loop A-B */}
        <button
          type="button"
          onClick={() => setOpenPopover(openPopover === 'loop' ? null : 'loop')}
          aria-label={t(language, 'loopAB')}
          className={`flex items-center gap-1 px-2.5 h-9 rounded-full text-xs font-semibold shrink-0 border transition ${
            loopEnabled
              ? 'bg-[#eceefe] text-[#4f46e5] border-[#4f46e5]/40'
              : 'bg-[#f8f6f1] text-[#4a4f5e] border-[#e7e3d9] hover:bg-[#edeae2]'
          }`}
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>{loopEnabled ? `${loopStartMeasure}-${loopEndMeasure}` : 'A-B'}</span>
        </button>

        {/* Metronome (M) */}
        {onToggleMetronome && (
          <button
            type="button"
            onClick={onToggleMetronome}
            aria-label={language === 'vi' ? 'Máy đếm nhịp' : 'Metronome'}
            className={`w-9 h-9 flex items-center justify-center rounded-full border shrink-0 transition ${
              metronomeEnabled
                ? 'bg-[#eceefe] text-[#4f46e5] border-[#4f46e5]/40'
                : 'bg-[#f8f6f1] text-[#4a4f5e] border-[#e7e3d9] hover:bg-[#edeae2]'
            }`}
            title={language === 'vi' ? 'Máy đếm nhịp (M)' : 'Metronome (M)'}
          >
            <Bell className="w-3.5 h-3.5" />
          </button>
        )}

        {/* BPM Control */}
        <div className="flex items-center gap-0.5 bg-[#f8f6f1] border border-[#e7e3d9] rounded-full px-2 h-9 shrink-0">
          <span className="text-[10px] text-[#888d9c] font-semibold px-0.5">{t(language, 'bpm')}</span>
          <button
            type="button"
            onClick={() => onSpeedChange(Math.max(0.25, +(speedRatio - 0.1).toFixed(2)))}
            aria-label={t(language, 'decreaseSpeed')}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#edeae2] text-[#4a4f5e]"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => onSpeedChange(speedRatio === 1 ? 0.7 : speedRatio === 0.7 ? 0.5 : 1)}
            className="text-xs font-bold font-mono text-[#14151c] min-w-[34px] text-center"
          >
            {effectiveBpm}
          </button>
          <button
            type="button"
            onClick={() => onSpeedChange(Math.min(2.0, +(speedRatio + 0.1).toFixed(2)))}
            aria-label={t(language, 'increaseSpeed')}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#edeae2] text-[#4a4f5e]"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Accompaniment / Arrange */}
        {onOpenAccompaniment && (
          <button
            type="button"
            onClick={onOpenAccompaniment}
            aria-label={language === 'vi' ? 'Đệm Hát & Gam' : 'Accompaniment & Chords'}
            className={`flex items-center gap-1 px-2.5 h-9 rounded-full text-xs font-bold shrink-0 border transition ${
              isAccompanimentActive
                ? 'bg-[#4f46e5] text-white border-[#4f46e5]'
                : 'bg-[#eceefe] text-[#4f46e5] border-[#4f46e5]/30 hover:bg-[#dfe2fd]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Đệm Hát' : 'Arrange'}</span>
          </button>
        )}

        {/* Theory Guide */}
        {onOpenTheory && (
          <button
            type="button"
            onClick={onOpenTheory}
            aria-label={language === 'vi' ? 'Hướng dẫn Lý thuyết Đệm Hát' : 'Piano Accompaniment Theory Guide'}
            className="flex items-center gap-1 px-2.5 h-9 rounded-full text-xs font-bold shrink-0 bg-[#e1f4ea] border border-[#2f9e6c]/30 text-[#2f9e6c] hover:bg-[#d0edd9] transition"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Lý thuyết' : 'Theory'}</span>
          </button>
        )}

        {/* Contextual Note Reading Quiz */}
        {onOpenQuiz && (
          <button
            type="button"
            onClick={onOpenQuiz}
            aria-label={language === 'vi' ? 'Đọc nốt' : 'Note Quiz'}
            className="flex items-center gap-1 px-2.5 h-9 rounded-full text-xs font-semibold shrink-0 bg-[#f8f6f1] border border-[#e7e3d9] text-[#4a4f5e] hover:bg-[#edeae2] transition"
          >
            <GraduationCap className="w-3.5 h-3.5 text-[#4f46e5]" />
            <span className="hidden lg:inline">{language === 'vi' ? 'Đọc nốt' : 'Quiz'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setOpenPopover(openPopover === 'sound' ? null : 'sound')}
          aria-label={t(language, 'soundPreset')}
          className={`flex items-center gap-1 px-2.5 h-9 rounded-full text-xs font-semibold shrink-0 border ${
            openPopover === 'sound'
              ? 'bg-[#eceefe] text-[#4f46e5] border-[#4f46e5]/40'
              : 'bg-[#f8f6f1] text-[#4a4f5e] border-[#e7e3d9] hover:bg-[#edeae2]'
          }`}
        >
          <Piano className="w-3.5 h-3.5 text-[#4f46e5]" />
          <span>{soundShortLabel}</span>
        </button>

        {/* Hands Independent Control Popover trigger */}
        <button
          type="button"
          onClick={() => setOpenPopover(openPopover === 'hands' ? null : 'hands')}
          aria-label={t(language, 'handsTitle')}
          className={`flex items-center gap-1.5 px-2.5 h-9 rounded-full text-xs font-semibold shrink-0 border transition ${
            openPopover === 'hands'
              ? 'bg-[#eceefe] text-[#4f46e5] border-[#4f46e5]/40'
              : 'bg-[#f8f6f1] text-[#4a4f5e] border-[#e7e3d9] hover:bg-[#edeae2]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="inline-flex items-center gap-1">
            <span
              className={`w-2 h-2 rounded-full ${hands.left.visual ? 'bg-[#34b8a2]' : 'bg-[#d0ccc2]'}`}
            />
            <span
              className={`w-2 h-2 rounded-full ${hands.right.visual ? 'bg-[#7a93ff]' : 'bg-[#d0ccc2]'}`}
            />
          </span>
        </button>

        {/* Note Label Mode */}
        <button
          type="button"
          onClick={onCycleNoteLabelMode}
          aria-label={t(language, 'noteLabels')}
          className="px-2.5 h-9 rounded-full bg-[#f8f6f1] hover:bg-[#edeae2] border border-[#e7e3d9] text-xs font-bold text-[#4f46e5] shrink-0"
        >
          {labelButtonText}
        </button>

        {/* Transpose */}
        <div className="flex items-center gap-0.5 bg-[#f8f6f1] border border-[#e7e3d9] rounded-full px-2 h-9 shrink-0">
          <span className="text-[10px] text-[#888d9c] font-semibold">{t(language, 'tone')}</span>
          <button
            type="button"
            onClick={() => onTransposeChange(transpose - 1)}
            aria-label={t(language, 'decreaseTone')}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#edeae2]"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-xs font-bold font-mono min-w-[22px] text-center">
            {transpose > 0 ? `+${transpose}` : transpose}
          </span>
          <button
            type="button"
            onClick={() => onTransposeChange(transpose + 1)}
            aria-label={t(language, 'increaseTone')}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#edeae2]"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Effects */}
        <button
          type="button"
          onClick={onToggleEffects}
          aria-label={t(language, 'effects')}
          className={`flex items-center gap-1 px-2.5 h-9 rounded-full text-xs border shrink-0 ${
            effectsEnabled
              ? 'bg-[#e1f4ea] text-[#2f9e6c] border-[#2f9e6c]/40'
              : 'bg-[#f8f6f1] text-[#888d9c] border-[#e7e3d9]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>

        {/* Keyboard Zoom Auto vs 88 */}
        <button
          type="button"
          onClick={onToggleFullKeyboard}
          aria-label={t(language, 'keyboardZoom')}
          className="flex items-center gap-1 px-2.5 h-9 rounded-full bg-[#f8f6f1] hover:bg-[#edeae2] border border-[#e7e3d9] text-xs font-semibold text-[#4a4f5e] shrink-0"
        >
          {fullKeyboard ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          <span>{fullKeyboard ? t(language, 'full88') : t(language, 'autoZoom')}</span>
        </button>

        {/* Dark / Soft Paper Theme Toggle */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={darkTheme ? 'Soft Paper Theme' : 'Dark Studio Theme'}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[#f8f6f1] hover:bg-[#edeae2] border border-[#e7e3d9] text-[#4a4f5e] shrink-0"
            title={darkTheme ? (language === 'vi' ? 'Nền giấy dịu mắt' : 'Soft Paper') : (language === 'vi' ? 'Nền tối Studio' : 'Dark Studio')}
          >
            {darkTheme ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        )}

        {/* Settings */}
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label={t(language, 'settingsTitle')}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-[#f8f6f1] hover:bg-[#edeae2] border border-[#e7e3d9] text-[#4a4f5e] shrink-0"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Row 2: Scrubber Progress Bar + Wait Mode indicator */}
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
          aria-label={t(language, 'timelineScrubber')}
          className="flex-1 h-1.5 accent-violet-500 bg-[#2c2e3b] rounded-lg cursor-pointer"
        />
        {practiceMode === 'wait' && waitingMidis.length > 0 && (
          <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 font-semibold text-[10px]">
            {t(language, 'waitingForKeys')}{' '}
            {waitingMidis
              .map((m) => midiToNoteLabel(m, noteLabelMode === 'off' ? 'letters' : noteLabelMode, true))
              .join(' + ')}
          </span>
        )}
        <span className="font-mono text-slate-300 min-w-[54px] text-right">
          {t(language, 'measureShort')} {currentMeasure}/{maxMeasure}
        </span>
      </div>

      {/* Popover: Sound Presets */}
      {openPopover === 'sound' && (
        <div className="absolute right-12 top-[52px] z-30 w-56 rounded-xl bg-[#1e202b] border border-[#323548] shadow-2xl p-2.5 space-y-1.5">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-xs font-bold text-slate-200">{t(language, 'soundPreset')}</span>
            <button
              type="button"
              onClick={() => setOpenPopover(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              {t(language, 'close')}
            </button>
          </div>
          {(
            [
              ['grand', t(language, 'soundGrand')],
              ['studio', t(language, 'soundStudio')],
              ['bright', t(language, 'soundBright')],
              ['electric', t(language, 'soundElectric')],
            ] as const
          ).map(([id, name]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                onSoundPresetChange(id);
                setOpenPopover(null);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition ${
                soundPreset === id
                  ? 'bg-violet-600 text-white'
                  : 'bg-[#15161f] text-slate-200 hover:bg-[#2a2d3d]'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Popover: Hands Independent Controls */}
      {openPopover === 'hands' && (
        <div className="absolute right-2 top-[52px] z-30 w-72 rounded-xl bg-[#1e202b] border border-[#323548] shadow-2xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200">{t(language, 'handsTitle')}</span>
            <button
              type="button"
              onClick={() => setOpenPopover(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              {t(language, 'close')}
            </button>
          </div>

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
              {t(language, 'bothHands')}
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
              {t(language, 'rightOnly')}
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
              {t(language, 'leftOnly')}
            </button>
          </div>

          <div className="flex items-center justify-between bg-[#15161f] rounded-lg px-2.5 py-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span className="text-xs font-semibold text-slate-200">{t(language, 'rightHand')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label={t(language, 'rightAudio')}
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
                {t(language, 'sound')}
              </button>
              <button
                type="button"
                aria-label={t(language, 'rightVisual')}
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
                {t(language, 'show')}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between bg-[#15161f] rounded-lg px-2.5 py-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <span className="text-xs font-semibold text-slate-200">{t(language, 'leftHand')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label={t(language, 'leftAudio')}
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
                {t(language, 'sound')}
              </button>
              <button
                type="button"
                aria-label={t(language, 'leftVisual')}
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
                {t(language, 'show')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popover: A-B Loop Range */}
      {openPopover === 'loop' && (
        <div className="absolute left-36 top-[52px] z-30 w-64 rounded-xl bg-[#1e202b] border border-[#323548] shadow-2xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200">{t(language, 'loopSectionTitle')}</span>
            <button
              type="button"
              onClick={() => onLoopChange(!loopEnabled, loopStartMeasure, loopEndMeasure)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                loopEnabled ? 'bg-violet-600 text-white' : 'bg-[#2a2d3d] text-slate-300'
              }`}
            >
              {loopEnabled ? t(language, 'loopOn') : t(language, 'loopOff')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex flex-col gap-1 text-slate-300">
              <span>{t(language, 'fromMeasure')}</span>
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
              <span>{t(language, 'toMeasure')}</span>
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
            {t(language, 'done')}
          </button>
        </div>
      )}
    </header>
  );
};
