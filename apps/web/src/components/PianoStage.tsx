import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { NotePlayer } from '../audio/pianoSynth';
import type { PlaybackClock, PlaybackSnapshot } from '../audio/playbackClock';
import { computeAutoKeyRange, MAX_PIANO_MIDI, MIN_PIANO_MIDI } from '../core/noteNames';
import type { NoteLabelMode, Song } from '../core/types';
import { buildKeyboardLayout, hitTestKey } from '../renderer/keyboardLayout';
import { renderWaterfallFrame, type Particle } from '../renderer/waterfallRenderer';

interface PianoStageProps {
  song: Song;
  clock: PlaybackClock;
  player: NotePlayer;
  transpose: number;
  noteLabelMode: NoteLabelMode;
  showKeyLabels: boolean;
  effectsEnabled: boolean;
  fullKeyboard: boolean;
  externalPressedMidis: Set<number>;
  onSnapshotTick: (snapshot: PlaybackSnapshot) => void;
}

const LOOK_AHEAD_SEC = 2.8;

export const PianoStage: React.FC<PianoStageProps> = ({
  song,
  clock,
  player,
  transpose,
  noteLabelMode,
  showKeyLabels,
  effectsEnabled,
  fullKeyboard,
  externalPressedMidis,
  onSnapshotTick,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const manualPressedRef = useRef<Set<number>>(new Set());
  const scrubRef = useRef<{
    active: boolean;
    startY: number;
    startTimeSec: number;
    wasPlaying: boolean;
  }>({ active: false, startY: 0, startTimeSec: 0, wasPlaying: false });

  const [size, setSize] = useState({ width: 800, height: 420 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
      }
    };
    update();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const keyboardHeight = Math.max(80, Math.min(136, Math.floor(size.height * 0.28)));
  const waterfallHeight = Math.max(120, size.height - keyboardHeight);

  const keyRange = useMemo(() => {
    if (fullKeyboard) {
      return { startMidi: MIN_PIANO_MIDI, endMidi: MAX_PIANO_MIDI };
    }
    return computeAutoKeyRange(song.minMidi + transpose, song.maxMidi + transpose);
  }, [fullKeyboard, song.minMidi, song.maxMidi, transpose]);

  const layout = useMemo(
    () => buildKeyboardLayout(keyRange.startMidi, keyRange.endMidi, size.width, keyboardHeight),
    [keyRange.startMidi, keyRange.endMidi, size.width, keyboardHeight],
  );

  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    let lastUiReport = 0;

    // Background heartbeat so music continues smoothly when switching browser tabs
    // (requestAnimationFrame pauses in hidden tabs, but setInterval + Web Audio lookahead keeps playing)
    const bgTimer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.max(0, (now - lastTs) / 1000);
      if (document.hidden || elapsed >= 0.25) {
        lastTs = now;
        const snap = clock.advance(Math.min(elapsed, 2.0));
        onSnapshotTick(snap);
      }
    }, 200);

    const frame = () => {
      const now = performance.now();
      const rawDelta = Math.max(0, (now - lastTs) / 1000);
      lastTs = now;
      const clampedDelta = Math.min(rawDelta, 0.25);

      const snap = clock.advance(clampedDelta);

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const targetW = Math.floor(size.width * dpr);
        const targetH = Math.floor(size.height * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const combinedPressed = new Set<number>(manualPressedRef.current);
        for (const m of externalPressedMidis) combinedPressed.add(m);

        renderWaterfallFrame(ctx, {
          song,
          layout,
          width: size.width,
          waterfallHeight,
          keyboardHeight,
          currentTimeSec: snap.currentTimeSec,
          lookAheadSec: LOOK_AHEAD_SEC,
          transpose: snap.transpose,
          hands: snap.hands,
          noteLabelMode,
          showKeyLabels,
          effectsEnabled,
          loopEnabled: snap.loopEnabled,
          loopStartMeasure: snap.loopStartMeasure,
          loopEndMeasure: snap.loopEndMeasure,
          particles: particlesRef.current,
          manualPressedMidis: combinedPressed,
          waitingMidis: new Set(snap.waitingMidis),
          isPlaying: snap.isPlaying,
        });
      }

      if (now - lastUiReport > 100) {
        lastUiReport = now;
        onSnapshotTick(snap);
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => {
      window.clearInterval(bgTimer);
      cancelAnimationFrame(rafId);
    };
  }, [
    song,
    clock,
    layout,
    size.width,
    size.height,
    waterfallHeight,
    keyboardHeight,
    noteLabelMode,
    showKeyLabels,
    effectsEnabled,
    externalPressedMidis,
    onSnapshotTick,
  ]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (y >= waterfallHeight) {
      const midi = hitTestKey(layout, x, y - waterfallHeight);
      if (midi !== null) {
        void player.unlock();
        player.playNote(midi, 0.85, 0.85);
        clock.handleUserNoteOn(midi);
        manualPressedRef.current.add(midi);
        setTimeout(() => {
          manualPressedRef.current.delete(midi);
          clock.handleUserNoteOff(midi);
        }, 320);
        onSnapshotTick(clock.getSnapshot());
      }
      return;
    }

    const snap = clock.getSnapshot();
    scrubRef.current = {
      active: true,
      startY: y,
      startTimeSec: snap.currentTimeSec,
      wasPlaying: snap.isPlaying,
    };
    if (snap.isPlaying) clock.pause();
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!scrubRef.current.active) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const dy = y - scrubRef.current.startY;
    const pxPerSec = waterfallHeight / LOOK_AHEAD_SEC;
    const nextTime = scrubRef.current.startTimeSec + dy / pxPerSec;
    clock.seek(nextTime);
    onSnapshotTick(clock.getSnapshot());
  };

  const handlePointerUp = () => {
    if (!scrubRef.current.active) return;
    const shouldResume = scrubRef.current.wasPlaying;
    scrubRef.current.active = false;
    if (shouldResume) clock.play();
    onSnapshotTick(clock.getSnapshot());
  };

  return (
    <div ref={containerRef} className="relative flex-1 w-full h-full overflow-hidden bg-[#121216]">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="block w-full h-full touch-none cursor-ns-resize"
        aria-label="Piano Waterfall Canvas"
      />
    </div>
  );
};
