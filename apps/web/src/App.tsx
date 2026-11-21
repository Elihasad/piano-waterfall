import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { MidiInputManager, type MidiDeviceState } from './audio/midiInput';
import { PianoSynth } from './audio/pianoSynth';
import { PlaybackClock, type PlaybackSnapshot } from './audio/playbackClock';
import { AppShell, type AppView } from './components/AppShell';
import { ArrangeView } from './components/ArrangeView';
import { ChordRibbon } from './components/ChordRibbon';
import { HomeView } from './components/HomeView';
import { LibraryView } from './components/LibraryView';
import { NoteQuizView } from './components/NoteQuizView';
import { PianoStage } from './components/PianoStage';
import { PracticePathDrawer, type PracticeStepConfig } from './components/PracticePathDrawer';
import { SettingsModal } from './components/SettingsModal';
import { TheoryView } from './components/TheoryView';
import { TopBar } from './components/TopBar';
import { ACCOMPANIMENT_STYLES } from './core/accompaniment/accompanimentGenerator';
import { analyzeSongHarmony } from './core/accompaniment/harmonyAnalyzer';
import { t } from './core/i18n';
import {
  deleteSong,
  getSettings,
  saveSettings,
  saveSong,
  seedDemoSongsIfEmpty,
} from './core/storage';
import type {
  AccompanimentStyleId,
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
  const clock = useMemo(() => {
    const c = new PlaybackClock(player);
    c.setLeadInSec(2.4);
    return c;
  }, [player]);

  const [activeView, setActiveView] = useState<AppView>('home');
  const [songs, setSongs] = useState<Song[]>(DEMO_SONGS);
  const [originalSong, setOriginalSong] = useState<Song>(DEMO_SONGS[0]);
  const [accompanimentSong, setAccompanimentSong] = useState<Song | null>(null);
  const [activeStyleId, setActiveStyleId] = useState<AccompanimentStyleId>('ballad-basic');
  const currentSong = accompanimentSong ?? originalSong;

  const [settings, setSettings] = useState<AppSettings>(() => {
    const loaded = getSettings();
    player.setPreset(loaded.soundPreset);
    return loaded;
  });
  const [fullKeyboard, setFullKeyboard] = useState(false);
  const [darkTheme, setDarkTheme] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pw-theme') === 'dark';
    } catch {
      return false;
    }
  });
  const [showPracticePath, setShowPracticePath] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('theme-dark', darkTheme);
    try {
      localStorage.setItem('pw-theme', darkTheme ? 'dark' : 'paper');
    } catch {
      // ignore
    }
  }, [darkTheme]);
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
      setOriginalSong(loaded[0]);
      setAccompanimentSong(null);
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
      setOriginalSong(song);
      setAccompanimentSong(null);
      clock.loadSong(song);
      setSnapshot(clock.getSnapshot());
      setActiveView('player');
    },
    [clock],
  );

  const handleApplyAccompaniment = useCallback(
    (accSong: Song, styleId: AccompanimentStyleId) => {
      setActiveStyleId(styleId);
      setAccompanimentSong(accSong);
      clock.loadSong(accSong);
      clock.play();
      setSnapshot(clock.getSnapshot());
      setActiveView('player');
    },
    [clock],
  );

  const handleReturnOriginal = useCallback(() => {
    setAccompanimentSong(null);
    clock.loadSong(originalSong);
    setSnapshot(clock.getSnapshot());
  }, [clock, originalSong]);

  const liveHarmony = useMemo(() => {
    if (currentSong.chords && currentSong.detectedKey) {
      return { key: currentSong.detectedKey, chords: currentSong.chords };
    }
    return analyzeSongHarmony(currentSong);
  }, [currentSong]);

  const activeStyleMeta = useMemo(
    () => ACCOMPANIMENT_STYLES.find((s) => s.id === activeStyleId),
    [activeStyleId],
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
      if (originalSong.id === id && next.length > 0) {
        selectSong(next[0]);
      }
    },
    [songs, originalSong.id, selectSong],
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

  const handleTogglePlay = useCallback(() => {
    void player.unlock();
    clock.togglePlay();
    setSnapshot(clock.getSnapshot());
  }, [clock, player]);

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
    (sec: number) => {
      clock.seek(sec);
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

  const handlePracticeModeChange = useCallback(
    (mode: PracticeMode) => {
      clock.setPracticeMode(mode);
      setSnapshot(clock.getSnapshot());
    },
    [clock],
  );

  const handleSoundPresetChange = useCallback(
    (preset: SoundPreset) => {
      handleUpdateSettings({ soundPreset: preset });
    },
    [handleUpdateSettings],
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

  const handleToggleMetronome = useCallback(() => {
    const next = !clock.getSnapshot().metronomeEnabled;
    clock.setMetronome(next);
    setSnapshot(clock.getSnapshot());
  }, [clock]);

  const handleApplyPracticeStep = useCallback(
    (cfg: PracticeStepConfig) => {
      clock.setLoop(cfg.loopEnabled, cfg.startMeasure, cfg.endMeasure);
      clock.setSpeedRatio(cfg.speedRatio);
      clock.setHands(cfg.hands);
      clock.setPracticeMode(cfg.practiceMode);
      const startMeasureObj = currentSong.measures[cfg.startMeasure - 1];
      clock.seek(startMeasureObj ? startMeasureObj.startTimeSec : 0);
      void player.unlock();
      clock.play();
      setSnapshot(clock.getSnapshot());
    },
    [clock, currentSong.measures, player],
  );

  const handleCycleNoteLabelMode = useCallback(() => {
    const idx = LABEL_CYCLE.indexOf(settings.noteLabelMode);
    const nextMode = LABEL_CYCLE[(idx + 1) % LABEL_CYCLE.length];
    handleUpdateSettings({ noteLabelMode: nextMode });
  }, [settings.noteLabelMode, handleUpdateSettings]);

  // Desktop keyboard shortcuts (active in Player view)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activeView !== 'player' || showSettings || showPracticePath) return;
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
      } else if (e.key.toLowerCase() === 'm') {
        handleToggleMetronome();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeView,
    showSettings,
    showPracticePath,
    clock,
    handleTogglePlay,
    handleStepMeasure,
    handleRestart,
    handleLoopChange,
    handleToggleMetronome,
  ]);

  return (
    <AppShell
      activeView={activeView}
      language={settings.language}
      darkTheme={darkTheme}
      midiDevices={midiState.connectedNames}
      onNavigate={(view) => {
        if (view !== 'player' && snapshot.isPlaying) {
          clock.pause();
          setSnapshot(clock.getSnapshot());
        }
        setActiveView(view);
      }}
      onToggleLanguage={() =>
        handleUpdateSettings({ language: settings.language === 'en' ? 'vi' : 'en' })
      }
      onToggleTheme={() => setDarkTheme((d) => !d)}
      onOpenSettings={() => setShowSettings(true)}
    >
      {activeView === 'home' && (
        <HomeView
          language={settings.language}
          songs={songs}
          currentSong={currentSong}
          onNavigate={setActiveView}
          onSelectSong={selectSong}
          onArrangeSong={(song) => {
            setOriginalSong(song);
            setAccompanimentSong(null);
            clock.loadSong(song);
            setSnapshot(clock.getSnapshot());
            setActiveView('arrange');
          }}
        />
      )}

      {activeView === 'player' && (
        <div className="flex flex-col w-full h-full bg-[#0c0e16]">
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
            metronomeEnabled={snapshot.metronomeEnabled}
            practiceMode={snapshot.practiceMode}
            waitingMidis={snapshot.waitingMidis}
            midiDevices={midiState.connectedNames}
            soundPreset={settings.soundPreset}
            hands={snapshot.hands}
            noteLabelMode={settings.noteLabelMode}
            effectsEnabled={settings.effectsEnabled}
            showFallingNoteLabels={settings.showFallingNoteLabels ?? true}
            keyboardLabelMode={settings.keyboardLabelMode ?? 'c-only'}
            leftHandColor={settings.leftHandColor ?? '#4ade80'}
            rightHandColor={settings.rightHandColor ?? '#22d3ee'}
            handSplitMode={settings.handSplitMode ?? 'auto'}
            fullKeyboard={fullKeyboard}
            darkTheme={darkTheme}
            isAccompanimentActive={Boolean(accompanimentSong)}
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
            onToggleEffects={() =>
              handleUpdateSettings({ effectsEnabled: !settings.effectsEnabled })
            }
            onUpdateDisplaySettings={handleUpdateSettings}
            onToggleFullKeyboard={() => setFullKeyboard((v) => !v)}
            onToggleTheme={() => setDarkTheme((d) => !d)}
            onToggleMetronome={handleToggleMetronome}
            onOpenPracticePath={() => setShowPracticePath(true)}
            onOpenAccompaniment={() => setActiveView('arrange')}
            onOpenTheory={() => setActiveView('theory')}
            onOpenQuiz={() => setActiveView('quiz')}
            onOpenHome={() => {
              if (snapshot.isPlaying) {
                clock.pause();
                setSnapshot(clock.getSnapshot());
              }
              setActiveView('home');
            }}
            onOpenLibrary={() => setActiveView('library')}
            onOpenSettings={() => setShowSettings(true)}
          />

          {isPortraitMobile && (
            <div className="bg-[#eceefe] border-b border-[#4f46e5]/30 px-3 py-1.5 text-[11px] text-[#4f46e5] font-medium flex items-center justify-center gap-1.5">
              <RotateCw className="w-3.5 h-3.5" />
              <span>{t(settings.language, 'portraitHint')}</span>
            </div>
          )}

          <ChordRibbon
            language={settings.language}
            detectedKey={liveHarmony.key}
            chords={liveHarmony.chords}
            currentTimeSec={snapshot.currentTimeSec}
            transpose={snapshot.transpose}
            noteLabelMode={settings.noteLabelMode}
            isAccompanimentActive={Boolean(accompanimentSong)}
            activeStyleLabel={
              activeStyleMeta
                ? settings.language === 'vi'
                  ? activeStyleMeta.nameVi
                  : activeStyleMeta.nameEn
                : undefined
            }
            onOpenStudio={() => setActiveView('arrange')}
            onReturnOriginal={handleReturnOriginal}
          />

          <PianoStage
            song={currentSong}
            clock={clock}
            player={player}
            transpose={snapshot.transpose}
            noteLabelMode={settings.noteLabelMode}
            showKeyLabels={settings.showKeyLabels}
            showFallingNoteLabels={settings.showFallingNoteLabels ?? true}
            keyboardLabelMode={settings.keyboardLabelMode ?? 'c-only'}
            leftHandColor={settings.leftHandColor ?? '#4ade80'}
            rightHandColor={settings.rightHandColor ?? '#22d3ee'}
            handSplitMode={settings.handSplitMode ?? 'auto'}
            effectsEnabled={settings.effectsEnabled}
            fullKeyboard={fullKeyboard}
            externalPressedMidis={externalPressedRef.current}
            onSnapshotTick={setSnapshot}
          />

          {showPracticePath && (
            <PracticePathDrawer
              language={settings.language}
              song={currentSong}
              onApplyStep={handleApplyPracticeStep}
              onClose={() => setShowPracticePath(false)}
            />
          )}
        </div>
      )}

      {activeView === 'library' && (
        <LibraryView
          language={settings.language}
          songs={songs}
          currentSongId={originalSong.id}
          onSelectSong={selectSong}
          onArrangeSong={(song) => {
            setOriginalSong(song);
            setAccompanimentSong(null);
            clock.loadSong(song);
            setSnapshot(clock.getSnapshot());
            setActiveView('arrange');
          }}
          onImportSong={handleImportSong}
          onDeleteSong={handleDeleteSong}
        />
      )}

      {activeView === 'arrange' && (
        <ArrangeView
          language={settings.language}
          originalSong={originalSong}
          isAccompanimentActive={Boolean(accompanimentSong)}
          activeStyleId={activeStyleId}
          onApplyAccompaniment={handleApplyAccompaniment}
          onReturnOriginal={() => {
            handleReturnOriginal();
            setActiveView('player');
          }}
        />
      )}

      {activeView === 'theory' && (
        <TheoryView
          language={settings.language}
          player={player}
          detectedKey={liveHarmony.key}
          onStartLessonSong={selectSong}
        />
      )}

      {activeView === 'quiz' && (
        <NoteQuizView
          language={settings.language}
          song={currentSong}
          player={player}
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
    </AppShell>
  );
}
