import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { MidiInputManager, type MidiDeviceState } from './audio/midiInput';
import { PianoSynth } from './audio/pianoSynth';
import { PlaybackClock, type PlaybackSnapshot } from './audio/playbackClock';
import { LibraryModal } from './components/LibraryModal';
import { PianoStage } from './components/PianoStage';
import { SettingsModal } from './components/SettingsModal';
import { TopBar } from './components/TopBar';
import { t } from './core/i18n';
import {
  deleteSong,
  getSettings,
  saveSettings,
  saveSong,
  seedDemoSongsIfEmpty,
} from './core/storage';
import type {
  AppSettings,
  HandControlState,
  NoteLabelMode,
  PracticeMode,
  Song,
  SoundPreset,
} from './core/types';
import { DEMO_SONGS } from './data/demoSongs';

const LABEL_CYCLE: NoteLabelMode[] = ['letters', 'solfege', 'off'];

export default function App() {
  const player = useMemo(() => new PianoSynth(), []);
  const clock = useMemo(() => new PlaybackClock(player), [player]);

  const [songs, setSongs] = useState<Song[]>(DEMO_SONGS);
  const [currentSong, setCurrentSong] = useState<Song>(DEMO_SONGS[0]);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const loaded = getSettings();
    player.setPreset(loaded.soundPreset);
    return loaded;
  });
  const [fullKeyboard, setFullKeyboard] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [midiState, setMidiState] = useState<MidiDeviceState>({
    supported: false,
    connectedNames: [],
  });
  const externalPressedRef = useRef<Set<number>>(new Set());
  const midiManagerRef = useRef<MidiInputManager | null>(null);

  const [snapshot, setSnapshot] = useState<PlaybackSnapshot>(() => {
    clock.loadSong(DEMO_SONGS[0]);
    return clock.getSnapshot();
  });

  useEffect(() => {
    let mounted = true;
    void seedDemoSongsIfEmpty().then((loaded) => {
      if (!mounted || loaded.length === 0) return;
      setSongs(loaded);
      setCurrentSong(loaded[0]);
      clock.loadSong(loaded[0]);
      setSnapshot(clock.getSnapshot());
    });
    return () => {
      mounted = false;
    };
  }, [clock]);

  const connectMidi = useCallback(() => {
    midiManagerRef.current?.disconnect();
    const manager = new MidiInputManager({
      onNoteOn: (midi, velocity) => {
        externalPressedRef.current.add(midi);
        void player.unlock();
        player.playNote(midi, 1.2, velocity);
        clock.handleUserNoteOn(midi);
        setSnapshot(clock.getSnapshot());
      },
      onNoteOff: (midi) => {
        externalPressedRef.current.delete(midi);
        clock.handleUserNoteOff(midi);
      },
      onDevicesChange: (state) => {
        setMidiState(state);
      },
    });
    midiManagerRef.current = manager;
    void manager.connect();
  }, [clock, player]);

  useEffect(() => {
    connectMidi();
    return () => midiManagerRef.current?.disconnect();
  }, [connectMidi]);

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortraitMobile(window.innerWidth < 600 && window.innerHeight > window.innerWidth);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  const selectSong = useCallback(
    (song: Song) => {
      setCurrentSong(song);
      clock.loadSong(song);
      setSnapshot(clock.getSnapshot());
    },
    [clock],
  );

  const handleImportSong = useCallback(async (song: Song) => {
    await saveSong(song);
    setSongs((prev) => [song, ...prev.filter((s) => s.id !== song.id)]);
  }, []);

  const handleDeleteSong = useCallback(
    async (id: string) => {
      await deleteSong(id);
      const next = songs.filter((s) => s.id !== id);
      setSongs(next);
      if (currentSong.id === id && next.length > 0) {
        selectSong(next[0]);
      }
    },
    [songs, currentSong.id, selectSong],
  );

  const handleUpdateSettings = useCallback(
    (partial: Partial<AppSettings>) => {
      const updated = saveSettings(partial);
      if (partial.soundPreset) {
        player.setPreset(partial.soundPreset);
      }
      setSettings(updated);
    },
    [player],
  );

  const handleSoundPresetChange = useCallback(
    (preset: SoundPreset) => {
      handleUpdateSettings({ soundPreset: preset });
    },
    [handleUpdateSettings],
  );

  const handlePracticeModeChange = useCallback(
    (mode: PracticeMode) => {
      clock.setPracticeMode(mode);
      setSnapshot(clock.getSnapshot());
    },
    [clock],
  );

  const handleTogglePlay = useCallback(() => {
    clock.togglePlay();
    setSnapshot(clock.getSnapshot());
  }, [clock]);

  const handleRestart = useCallback(() => {
    clock.restart();
    setSnapshot(clock.getSnapshot());
  }, [clock]);

  const handleStepMeasure = useCallback(
    (delta: -1 | 1) => {
      clock.stepMeasure(delta);
      setSnapshot(clock.getSnapshot());
    },
    [clock],
  );

  const handleSeek = useCallback(
    (timeSec: number) => {
      clock.seek(timeSec);
      setSnapshot(clock.getSnapshot());
    },
    [clock],
  );

  const handleSpeedChange = useCallback(
    (ratio: number) => {
      clock.setSpeedRatio(ratio);
      setSnapshot(clock.getSnapshot());
    },
    [clock],
  );

  const handleTransposeChange = useCallback(
    (semitones: number) => {
      clock.setTranspose(semitones);
      setSnapshot(clock.getSnapshot());
    },
    [clock],
  );

  const handleLoopChange = useCallback(
    (enabled: boolean, start?: number, end?: number) => {
      clock.setLoop(enabled, start, end);
      setSnapshot(clock.getSnapshot());
    },
    [clock],
  );

  const handleHandsChange = useCallback(
    (hands: HandControlState) => {
      clock.setHands(hands);
      setSnapshot(clock.getSnapshot());
    },
    [clock],
  );

  const handleCycleNoteLabelMode = useCallback(() => {
    const idx = LABEL_CYCLE.indexOf(settings.noteLabelMode);
    const nextMode = LABEL_CYCLE[(idx + 1) % LABEL_CYCLE.length];
    handleUpdateSettings({ noteLabelMode: nextMode });
  }, [settings.noteLabelMode, handleUpdateSettings]);

  // Desktop keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showLibrary || showSettings) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleStepMeasure(-1);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleStepMeasure(1);
      } else if (e.key.toLowerCase() === 'r') {
        handleRestart();
      } else if (e.key.toLowerCase() === 'l') {
        const s = clock.getSnapshot();
        handleLoopChange(!s.loopEnabled, s.loopStartMeasure, s.loopEndMeasure);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    showLibrary,
    showSettings,
    clock,
    handleTogglePlay,
    handleStepMeasure,
    handleRestart,
    handleLoopChange,
  ]);

  return (
    <div className="flex flex-col w-full h-full bg-[#121216] text-slate-100">
      <TopBar
        language={settings.language}
        song={currentSong}
        isPlaying={snapshot.isPlaying}
        currentTimeSec={snapshot.currentTimeSec}
        speedRatio={snapshot.speedRatio}
        transpose={snapshot.transpose}
        loopEnabled={snapshot.loopEnabled}
        loopStartMeasure={snapshot.loopStartMeasure}
        loopEndMeasure={snapshot.loopEndMeasure}
        practiceMode={snapshot.practiceMode}
        waitingMidis={snapshot.waitingMidis}
        midiDevices={midiState.connectedNames}
        soundPreset={settings.soundPreset}
        hands={snapshot.hands}
        noteLabelMode={settings.noteLabelMode}
        effectsEnabled={settings.effectsEnabled}
        fullKeyboard={fullKeyboard}
        onTogglePlay={handleTogglePlay}
        onRestart={handleRestart}
        onStepMeasure={handleStepMeasure}
        onSeek={handleSeek}
        onSpeedChange={handleSpeedChange}
        onTransposeChange={handleTransposeChange}
        onLoopChange={handleLoopChange}
        onPracticeModeChange={handlePracticeModeChange}
        onSoundPresetChange={handleSoundPresetChange}
        onHandsChange={handleHandsChange}
        onCycleNoteLabelMode={handleCycleNoteLabelMode}
        onToggleEffects={() => handleUpdateSettings({ effectsEnabled: !settings.effectsEnabled })}
        onToggleFullKeyboard={() => setFullKeyboard((v) => !v)}
        onOpenLibrary={() => setShowLibrary(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      {isPortraitMobile && (
        <div className="bg-violet-950/70 border-b border-violet-500/40 px-3 py-1.5 text-[11px] text-violet-200 flex items-center justify-center gap-1.5">
          <RotateCw className="w-3.5 h-3.5" />
          <span>{t(settings.language, 'portraitHint')}</span>
        </div>
      )}

      <PianoStage
        song={currentSong}
        clock={clock}
        player={player}
        transpose={snapshot.transpose}
        noteLabelMode={settings.noteLabelMode}
        showKeyLabels={settings.showKeyLabels}
        effectsEnabled={settings.effectsEnabled}
        fullKeyboard={fullKeyboard}
        externalPressedMidis={externalPressedRef.current}
        onSnapshotTick={setSnapshot}
      />

      {showLibrary && (
        <LibraryModal
          language={settings.language}
          songs={songs}
          currentSongId={currentSong.id}
          omrServerUrl={settings.omrServerUrl}
          onSelectSong={selectSong}
          onImportSong={handleImportSong}
          onDeleteSong={handleDeleteSong}
          onOpenSettings={() => setShowSettings(true)}
          onClose={() => setShowLibrary(false)}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          midiDevices={midiState.connectedNames}
          midiSupported={midiState.supported}
          onReconnectMidi={connectMidi}
          onSave={handleUpdateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
