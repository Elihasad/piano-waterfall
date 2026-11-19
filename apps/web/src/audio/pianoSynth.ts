import { clampMidi } from '../core/noteNames';

export interface NotePlayer {
  unlock(): Promise<void>;
  playNote(midi: number, durationSec: number, velocity?: number, startAtAudioTime?: number): void;
  stopAll(): void;
}

interface ActiveVoice {
  stop: () => void;
}

const MAX_POLYPHONY = 24;

function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (clampMidi(midi) - 69) / 12);
}

/**
 * Offline acoustic-style piano synthesizer using Web Audio API.
 * Layered fundamental + warm harmonics + lowpass brightness decay so it sounds
 * rich and musical while working 100% offline inside Android APK & iOS PWA.
 */
export class PianoSynth implements NotePlayer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private voices: ActiveVoice[] = [];

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.65;

      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.15;

      this.masterGain.connect(compressor);
      compressor.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  async unlock(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  playNote(
    midi: number,
    durationSec: number,
    velocity = 0.8,
    startAtAudioTime?: number,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    while (this.voices.length >= MAX_POLYPHONY) {
      const oldest = this.voices.shift();
      oldest?.stop();
    }

    const now = startAtAudioTime ?? ctx.currentTime;
    const freq = midiToFrequency(midi);
    const vel = Math.max(0.08, Math.min(1, velocity));
    const holdDur = Math.max(0.08, Math.min(durationSec, 8));
    const releaseDur = 0.35;
    const endTime = now + holdDur + releaseDur;

    const noteGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(10000, freq * (4 + vel * 5)), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 2.2), now + holdDur + 0.25);

    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.linearRampToValueAtTime(vel * 0.42, now + 0.008);
    noteGain.gain.exponentialRampToValueAtTime(vel * 0.18, now + Math.min(0.4, holdDur));
    noteGain.gain.setValueAtTime(vel * 0.18, now + holdDur);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    filter.connect(noteGain);
    noteGain.connect(this.masterGain);

    // Layer 3 partials (fundamental + 2nd + 3rd harmonic) for warm piano timbre
    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now);
    const g2 = ctx.createGain();
    g2.gain.value = 0.28;

    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 3, now);
    const g3 = ctx.createGain();
    g3.gain.value = 0.1;

    osc1.connect(filter);
    osc2.connect(g2);
    g2.connect(filter);
    osc3.connect(g3);
    g3.connect(filter);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);

    osc1.stop(endTime + 0.02);
    osc2.stop(endTime + 0.02);
    osc3.stop(endTime + 0.02);

    const voice: ActiveVoice = {
      stop: () => {
        try {
          const t = ctx.currentTime;
          const param = noteGain.gain as AudioParam & { cancelAndHoldAtTime?: (time: number) => void };
          if (typeof param.cancelAndHoldAtTime === 'function') {
            param.cancelAndHoldAtTime(t);
          } else {
            const currentVal = Math.max(0.0001, noteGain.gain.value);
            noteGain.gain.cancelScheduledValues(t);
            noteGain.gain.setValueAtTime(currentVal, t);
          }
          noteGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
          osc1.stop(t + 0.06);
          osc2.stop(t + 0.06);
          osc3.stop(t + 0.06);
        } catch {
          // Already stopped
        }
      },
    };

    this.voices.push(voice);
    osc1.onended = () => {
      const idx = this.voices.indexOf(voice);
      if (idx >= 0) this.voices.splice(idx, 1);
      noteGain.disconnect();
      filter.disconnect();
    };
  }

  stopAll(): void {
    const active = this.voices.splice(0);
    for (const v of active) {
      v.stop();
    }
  }
}
