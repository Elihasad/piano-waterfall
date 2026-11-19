import { clampMidi } from '../core/noteNames';
import type { HandControlState, NoteEvent, Song } from '../core/types';
import type { NotePlayer } from './pianoSynth';

export interface PlaybackSnapshot {
  isPlaying: boolean;
  currentTimeSec: number;
  speedRatio: number;
  transpose: number;
  loopEnabled: boolean;
  loopStartMeasure: number;
  loopEndMeasure: number;
  hands: HandControlState;
  activeNotes: NoteEvent[];
}

export class PlaybackClock {
  private player: NotePlayer;
  private song: Song | null = null;
  private isPlaying = false;
  private currentTimeSec = 0;
  private speedRatio = 1;
  private transpose = 0;
  private loopEnabled = false;
  private loopStartMeasure = 1;
  private loopEndMeasure = 1;
  private hands: HandControlState = {
    left: { audio: true, visual: true },
    right: { audio: true, visual: true },
  };
  private cursorTimeSec = -1;

  constructor(player: NotePlayer) {
    this.player = player;
  }

  loadSong(song: Song): void {
    this.player.stopAll();
    this.song = song;
    this.isPlaying = false;
    this.currentTimeSec = 0;
    this.cursorTimeSec = -1;
    this.loopEnabled = false;
    this.loopStartMeasure = 1;
    this.loopEndMeasure = Math.min(4, Math.max(1, song.measures.length));
  }

  play(): void {
    if (!this.song) return;
    if (this.currentTimeSec >= this.song.durationSec) {
      this.currentTimeSec = 0;
      this.cursorTimeSec = -1;
    }
    this.isPlaying = true;
    void this.player.unlock();
  }

  pause(): void {
    this.isPlaying = false;
    this.player.stopAll();
  }

  togglePlay(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  restart(): void {
    this.player.stopAll();
    if (this.loopEnabled && this.song) {
      const { startSec } = this.getLoopBounds();
      this.currentTimeSec = startSec;
    } else {
      this.currentTimeSec = 0;
    }
    this.cursorTimeSec = -1;
  }

  seek(timeSec: number): void {
    if (!this.song) return;
    this.player.stopAll();
    this.currentTimeSec = Math.max(0, Math.min(this.song.durationSec, timeSec));
    this.cursorTimeSec = this.currentTimeSec - 0.0001;
  }

  stepMeasure(delta: -1 | 1): void {
    if (!this.song || this.song.measures.length === 0) return;
    const measures = this.song.measures;
    let currentIdx = measures.findIndex(
      (m) => this.currentTimeSec >= m.startTimeSec - 0.005 && this.currentTimeSec < m.endTimeSec - 0.005,
    );
    if (currentIdx === -1) {
      currentIdx = this.currentTimeSec >= measures[measures.length - 1].startTimeSec ? measures.length - 1 : 0;
    }

    if (delta === -1 && this.currentTimeSec - measures[currentIdx].startTimeSec > 0.25) {
      // Jump to start of current measure if already partway through it
      this.seek(measures[currentIdx].startTimeSec);
      return;
    }

    const nextIdx = Math.max(0, Math.min(measures.length - 1, currentIdx + delta));
    this.seek(measures[nextIdx].startTimeSec);
  }

  setSpeedRatio(ratio: number): void {
    this.speedRatio = Math.max(0.25, Math.min(2.0, ratio));
  }

  setTranspose(semitones: number): void {
    this.transpose = Math.max(-12, Math.min(12, Math.round(semitones)));
  }

  setLoop(enabled: boolean, startMeasure?: number, endMeasure?: number): void {
    this.loopEnabled = enabled;
    const maxMeasure = Math.max(1, this.song?.measures.length ?? 1);
    if (startMeasure !== undefined) {
      this.loopStartMeasure = Math.max(1, Math.min(maxMeasure, Math.round(startMeasure)));
    }
    if (endMeasure !== undefined) {
      this.loopEndMeasure = Math.max(this.loopStartMeasure, Math.min(maxMeasure, Math.round(endMeasure)));
    }
  }

  setHands(hands: HandControlState): void {
    this.hands = {
      left: { ...hands.left },
      right: { ...hands.right },
    };
  }

  private getLoopBounds(): { startSec: number; endSec: number } {
    if (!this.song || this.song.measures.length === 0) {
      return { startSec: 0, endSec: this.song?.durationSec ?? 1 };
    }
    const startM = this.song.measures[this.loopStartMeasure - 1] ?? this.song.measures[0];
    const endM =
      this.song.measures[this.loopEndMeasure - 1] ??
      this.song.measures[this.song.measures.length - 1];
    return { startSec: startM.startTimeSec, endSec: endM.endTimeSec };
  }

  private triggerNotesInWindow(fromInclusive: number, toExclusive: number): void {
    if (!this.song || toExclusive <= fromInclusive) return;
    for (const note of this.song.notes) {
      if (note.startTimeSec < fromInclusive) continue;
      if (note.startTimeSec >= toExclusive) break;
      const handAudioEnabled =
        note.hand === 'left' ? this.hands.left.audio : this.hands.right.audio;
      if (!handAudioEnabled) continue;

      const pitchedMidi = clampMidi(note.midi + this.transpose);
      const scaledDuration = note.durationSec / this.speedRatio;
      this.player.playNote(pitchedMidi, scaledDuration, note.velocity);
    }
  }

  advance(deltaRealSec: number): PlaybackSnapshot {
    if (!this.song || !this.isPlaying || deltaRealSec <= 0) {
      return this.getSnapshot();
    }

    const deltaSongSec = deltaRealSec * this.speedRatio;
    const prevTime = this.currentTimeSec;
    const startWindow = this.cursorTimeSec < 0 ? prevTime : this.cursorTimeSec;
    let nextTime = prevTime + deltaSongSec;

    if (this.loopEnabled) {
      const { startSec, endSec } = this.getLoopBounds();
      const loopLen = Math.max(0.05, endSec - startSec);
      if (nextTime >= endSec) {
        this.triggerNotesInWindow(startWindow, endSec);
        const overflow = (nextTime - endSec) % loopLen;
        nextTime = startSec + overflow;
        this.triggerNotesInWindow(startSec, nextTime);
        this.currentTimeSec = nextTime;
        this.cursorTimeSec = nextTime;
        return this.getSnapshot();
      }
    }

    this.triggerNotesInWindow(startWindow, nextTime);

    if (nextTime >= this.song.durationSec) {
      this.currentTimeSec = this.song.durationSec;
      this.cursorTimeSec = this.song.durationSec;
      this.isPlaying = false;
    } else {
      this.currentTimeSec = nextTime;
      this.cursorTimeSec = nextTime;
    }

    return this.getSnapshot();
  }

  getSnapshot(): PlaybackSnapshot {
    const activeNotes: NoteEvent[] = [];
    if (this.song) {
      const t = this.currentTimeSec;
      for (const note of this.song.notes) {
        if (note.startTimeSec > t) break;
        if (note.startTimeSec + note.durationSec > t) {
          const visible =
            note.hand === 'left' ? this.hands.left.visual : this.hands.right.visual;
          if (visible) {
            activeNotes.push(note);
          }
        }
      }
    }

    return {
      isPlaying: this.isPlaying,
      currentTimeSec: this.currentTimeSec,
      speedRatio: this.speedRatio,
      transpose: this.transpose,
      loopEnabled: this.loopEnabled,
      loopStartMeasure: this.loopStartMeasure,
      loopEndMeasure: this.loopEndMeasure,
      hands: {
        left: { ...this.hands.left },
        right: { ...this.hands.right },
      },
      activeNotes,
    };
  }
}
