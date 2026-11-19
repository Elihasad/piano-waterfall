import { describe, it, expect } from 'vitest';
import { PlaybackClock } from '../playbackClock';
import type { NotePlayer } from '../pianoSynth';
import type { Song } from '../../core/types';

function createFakePlayer() {
  const calls: Array<{ midi: number; durationSec: number; velocity: number }> = [];
  const player: NotePlayer = {
    async unlock() {},
    playNote(midi, durationSec, velocity = 0.8) {
      calls.push({ midi, durationSec, velocity });
    },
    stopAll() {},
  };
  return { player, calls };
}

const TEST_SONG: Song = {
  id: 'test-song',
  title: 'Test',
  composer: '',
  sourceFormat: 'musicxml',
  createdAt: 0,
  defaultBpm: 120,
  durationSec: 4,
  tempoEvents: [{ timeSec: 0, bpm: 120 }],
  measures: [
    { number: 1, startTimeSec: 0, endTimeSec: 2, beats: 4, beatType: 4 },
    { number: 2, startTimeSec: 2, endTimeSec: 4, beats: 4, beatType: 4 },
  ],
  notes: [
    { id: 'n1', midi: 60, startTimeSec: 0, durationSec: 1, velocity: 0.8, hand: 'right', measureNumber: 1 },
    { id: 'n2', midi: 48, startTimeSec: 0, durationSec: 1, velocity: 0.7, hand: 'left', measureNumber: 1 },
    { id: 'n3', midi: 105, startTimeSec: 1, durationSec: 0.5, velocity: 0.8, hand: 'right', measureNumber: 1 },
    { id: 'n4', midi: 67, startTimeSec: 2, durationSec: 1, velocity: 0.8, hand: 'right', measureNumber: 2 },
  ],
  minMidi: 48,
  maxMidi: 105,
};

describe('PlaybackClock', () => {
  it('scales song time and note durations by speedRatio', () => {
    const { player, calls } = createFakePlayer();
    const clock = new PlaybackClock(player);
    clock.loadSong(TEST_SONG);
    clock.setSpeedRatio(0.5);
    clock.play();

    const snap = clock.advance(1.0); // 1.0s real time -> 0.5s song time
    expect(snap.currentTimeSec).toBeCloseTo(0.5, 3);
    expect(calls).toHaveLength(2);
    expect(calls[0].durationSec).toBeCloseTo(2.0, 3);
  });

  it('wraps cleanly at A-B loop boundary without double-triggering end-boundary notes', () => {
    const { player, calls } = createFakePlayer();
    const clock = new PlaybackClock(player);
    clock.loadSong(TEST_SONG);
    clock.setLoop(true, 1, 1); // 0s..2s
    clock.play();

    clock.advance(1.5);
    expect(calls.map((c) => c.midi)).toEqual([60, 48, 105]);
    calls.length = 0;

    // Crossing 2.0s wraps to 0.0s, triggers n1 & n2 (at 0s), does NOT trigger n4 (at 2.0s)
    const snap = clock.advance(0.6);
    expect(snap.currentTimeSec).toBeCloseTo(0.1, 3);
    expect(calls.map((c) => c.midi)).toEqual([60, 48]);
  });

  it('mutes hand audio independently from visual activeNotes', () => {
    const { player, calls } = createFakePlayer();
    const clock = new PlaybackClock(player);
    clock.loadSong(TEST_SONG);
    clock.setHands({
      left: { audio: true, visual: true },
      right: { audio: false, visual: true },
    });
    clock.play();

    const snap = clock.advance(0.2);
    expect(calls.map((c) => c.midi)).toEqual([48]); // only left hand heard
    expect(snap.activeNotes.map((n) => n.midi)).toEqual([60, 48]); // both hands visible
  });

  it('clamps transposed pitches to valid piano bounds 21..108 and steps measures', () => {
    const { player, calls } = createFakePlayer();
    const clock = new PlaybackClock(player);
    clock.loadSong(TEST_SONG);
    clock.setTranspose(12);
    clock.play();

    clock.advance(1.2);
    // n3 (midi 105) + 12 = 117 -> clamped to 108
    expect(calls.map((c) => c.midi)).toContain(108);

    clock.stepMeasure(1);
    expect(clock.getSnapshot().currentTimeSec).toBeCloseTo(2.0, 3);
    clock.stepMeasure(-1);
    expect(clock.getSnapshot().currentTimeSec).toBeCloseTo(0.0, 3);
  });

  it('resets cleanly to loop start when loop is enabled while playhead is already past loop end', () => {
    const { player, calls } = createFakePlayer();
    const clock = new PlaybackClock(player);
    clock.loadSong(TEST_SONG);
    clock.seek(2.8); // past measure 1 end (2.0s)
    clock.setLoop(true, 1, 1); // 0s..2s
    clock.play();

    const snap = clock.advance(0.1);
    expect(snap.currentTimeSec).toBeCloseTo(0.1, 3);
    expect(calls.map((c) => c.midi)).toEqual([60, 48]);
  });
});
