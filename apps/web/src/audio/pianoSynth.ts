import { clampMidi } from '../core/noteNames';
import type { SoundPreset } from '../core/types';

export interface NotePlayer {
  unlock(): Promise<void>;
  setPreset(preset: SoundPreset): void;
  getPreset(): SoundPreset;
  playNote(midi: number, durationSec: number, velocity?: number, startAtAudioTime?: number): void;
  stopAll(): void;
}

interface ActiveVoice {
  stop: () => void;
}

const MAX_POLYPHONY = 32;

const SALAMANDER_SAMPLES: ReadonlyArray<{ midi: number; file: string }> = [
  { midi: 33, file: 'A1.mp3' },
  { midi: 36, file: 'C2.mp3' },
  { midi: 39, file: 'Ds2.mp3' },
  { midi: 42, file: 'Fs2.mp3' },
  { midi: 45, file: 'A2.mp3' },
  { midi: 48, file: 'C3.mp3' },
  { midi: 51, file: 'Ds3.mp3' },
  { midi: 54, file: 'Fs3.mp3' },
  { midi: 57, file: 'A3.mp3' },
  { midi: 60, file: 'C4.mp3' },
  { midi: 63, file: 'Ds4.mp3' },
  { midi: 66, file: 'Fs4.mp3' },
  { midi: 69, file: 'A4.mp3' },
  { midi: 72, file: 'C5.mp3' },
  { midi: 75, file: 'Ds5.mp3' },
  { midi: 78, file: 'Fs5.mp3' },
  { midi: 81, file: 'A5.mp3' },
  { midi: 84, file: 'C6.mp3' },
  { midi: 87, file: 'Ds6.mp3' },
  { midi: 90, file: 'Fs6.mp3' },
  { midi: 93, file: 'A6.mp3' },
  { midi: 96, file: 'C7.mp3' },
];

function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (clampMidi(midi) - 69) / 12);
}

function createHallImpulse(ctx: AudioContext, durationSec = 2.0, decay = 2.6): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * durationSec);
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const env = Math.pow(1 - i / length, decay);
      data[i] = (Math.random() * 2 - 1) * env;
    }
  }
  return impulse;
}

/**
 * Offline studio-quality sampled piano engine powered by bundled Salamander Grand Piano
 * samples (CC-BY 3.0) with 4 selectable presets: Grand, Studio, Bright, and Electric Piano.
 */
export class PianoSynth implements NotePlayer {
  private ctx: AudioContext | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private lowShelf: BiquadFilterNode | null = null;
  private highShelf: BiquadFilterNode | null = null;
  private voices: ActiveVoice[] = [];
  private sampleBuffers = new Map<number, AudioBuffer>();
  private loadingStarted = false;
  private preset: SoundPreset = 'grand';

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      const ctx = new AudioCtx();
      this.ctx = ctx;

      const lowShelf = ctx.createBiquadFilter();
      lowShelf.type = 'lowshelf';
      lowShelf.frequency.value = 220;

      const highShelf = ctx.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.value = 3200;

      const dryGain = ctx.createGain();
      const wetGain = ctx.createGain();

      const convolver = ctx.createConvolver();
      convolver.buffer = createHallImpulse(ctx, 2.0, 2.8);

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 18;
      compressor.ratio.value = 3.5;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.14;

      lowShelf.connect(highShelf);
      highShelf.connect(dryGain);
      highShelf.connect(convolver);
      convolver.connect(wetGain);
      dryGain.connect(compressor);
      wetGain.connect(compressor);
      compressor.connect(ctx.destination);

      this.lowShelf = lowShelf;
      this.highShelf = highShelf;
      this.dryGain = dryGain;
      this.wetGain = wetGain;
      this.applyPresetRouting();
      void this.preloadSamples();
    }
    return this.ctx;
  }

  private applyPresetRouting(): void {
    if (!this.dryGain || !this.wetGain || !this.lowShelf || !this.highShelf) return;
    if (this.preset === 'grand') {
      this.dryGain.gain.value = 0.85;
      this.wetGain.gain.value = 0.36;
      this.lowShelf.gain.value = 2.5;
      this.highShelf.gain.value = 0.5;
    } else if (this.preset === 'studio') {
      this.dryGain.gain.value = 0.95;
      this.wetGain.gain.value = 0.1;
      this.lowShelf.gain.value = 0.5;
      this.highShelf.gain.value = 1.5;
    } else if (this.preset === 'bright') {
      this.dryGain.gain.value = 0.9;
      this.wetGain.gain.value = 0.22;
      this.lowShelf.gain.value = -1.5;
      this.highShelf.gain.value = 5.0;
    } else {
      // Electric Piano
      this.dryGain.gain.value = 0.88;
      this.wetGain.gain.value = 0.28;
      this.lowShelf.gain.value = 1.5;
      this.highShelf.gain.value = 2.0;
    }
  }

  private async preloadSamples(): Promise<void> {
    if (this.loadingStarted || !this.ctx) return;
    this.loadingStarted = true;
    const ctx = this.ctx;
    await Promise.all(
      SALAMANDER_SAMPLES.map(async (entry) => {
        try {
          const res = await fetch(`./samples/salamander/${entry.file}`);
          if (!res.ok) return;
          const arr = await res.arrayBuffer();
          const decoded = await ctx.decodeAudioData(arr);
          this.sampleBuffers.set(entry.midi, decoded);
        } catch {
          // Graceful fallback to synth if offline cache unavailable
        }
      }),
    );
  }

  private findClosestSample(midi: number): { baseMidi: number; buffer: AudioBuffer } | null {
    if (this.sampleBuffers.size === 0) return null;
    let bestMidi = -1;
    let bestDist = Infinity;
    for (const sampleMidi of this.sampleBuffers.keys()) {
      const dist = Math.abs(sampleMidi - midi);
      if (dist < bestDist) {
        bestDist = dist;
        bestMidi = sampleMidi;
      }
    }
    const buffer = this.sampleBuffers.get(bestMidi);
    return buffer ? { baseMidi: bestMidi, buffer } : null;
  }

  setPreset(preset: SoundPreset): void {
    this.preset = preset;
    this.applyPresetRouting();
  }

  getPreset(): SoundPreset {
    return this.preset;
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
    if (!ctx || !this.lowShelf) return;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    while (this.voices.length >= MAX_POLYPHONY) {
      const oldest = this.voices.shift();
      oldest?.stop();
    }

    const clamped = clampMidi(midi);
    const now = startAtAudioTime ?? ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1, velocity));
    const holdDur = Math.max(0.1, Math.min(durationSec, 8));

    // Electric Piano uses dedicated Rhodes-style FM/tine synthesis
    if (this.preset === 'electric') {
      this.playElectricPiano(ctx, clamped, now, holdDur, vel);
      return;
    }

    const sample = this.findClosestSample(clamped);
    if (sample) {
      this.playSampledPiano(ctx, sample.buffer, sample.baseMidi, clamped, now, holdDur, vel);
    } else {
      this.playFallbackSynth(ctx, clamped, now, holdDur, vel);
    }
  }

  private playSampledPiano(
    ctx: AudioContext,
    buffer: AudioBuffer,
    baseMidi: number,
    targetMidi: number,
    now: number,
    holdDur: number,
    vel: number,
  ): void {
    if (!this.lowShelf) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = Math.pow(2, (targetMidi - baseMidi) / 12);

    const releaseDur = this.preset === 'grand' ? 0.65 : this.preset === 'studio' ? 0.3 : 0.45;
    const endTime = now + holdDur + releaseDur;

    const noteGain = ctx.createGain();
    noteGain.gain.setValueAtTime(Math.max(0.0001, vel * 0.9), now);
    noteGain.gain.setValueAtTime(Math.max(0.0001, vel * 0.85), now + holdDur);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    src.connect(noteGain);
    noteGain.connect(this.lowShelf);

    src.start(now);
    src.stop(endTime + 0.03);

    const voice: ActiveVoice = {
      stop: () => {
        try {
          const t = ctx.currentTime;
          const param = noteGain.gain as AudioParam & { cancelAndHoldAtTime?: (time: number) => void };
          if (typeof param.cancelAndHoldAtTime === 'function') {
            param.cancelAndHoldAtTime(t);
          } else {
            const cur = Math.max(0.0001, noteGain.gain.value);
            noteGain.gain.cancelScheduledValues(t);
            noteGain.gain.setValueAtTime(cur, t);
          }
          noteGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
          src.stop(t + 0.07);
        } catch {
          // Already stopped
        }
      },
    };

    this.voices.push(voice);
    src.onended = () => {
      const idx = this.voices.indexOf(voice);
      if (idx >= 0) this.voices.splice(idx, 1);
      noteGain.disconnect();
    };
  }

  private playElectricPiano(
    ctx: AudioContext,
    midi: number,
    now: number,
    holdDur: number,
    vel: number,
  ): void {
    if (!this.lowShelf) return;
    const freq = midiToFrequency(midi);
    const releaseDur = 0.45;
    const endTime = now + holdDur + releaseDur;

    const noteGain = ctx.createGain();
    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.linearRampToValueAtTime(vel * 0.48, now + 0.006);
    noteGain.gain.exponentialRampToValueAtTime(vel * 0.24, now + Math.min(0.45, holdDur));
    noteGain.gain.setValueAtTime(vel * 0.24, now + holdDur);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, endTime);
    noteGain.connect(this.lowShelf);

    // Carrier sine + subtle bell tine overtone (7x partial decaying fast)
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, now);

    const tine = ctx.createOscillator();
    tine.type = 'sine';
    tine.frequency.setValueAtTime(freq * 7, now);
    const tineGain = ctx.createGain();
    tineGain.gain.setValueAtTime(vel * 0.14, now);
    tineGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(freq * 2, now);
    const bodyGain = ctx.createGain();
    bodyGain.gain.value = 0.16;

    carrier.connect(noteGain);
    tine.connect(tineGain);
    tineGain.connect(noteGain);
    body.connect(bodyGain);
    bodyGain.connect(noteGain);

    carrier.start(now);
    tine.start(now);
    body.start(now);
    carrier.stop(endTime + 0.02);
    tine.stop(now + 0.2);
    body.stop(endTime + 0.02);

    const voice: ActiveVoice = {
      stop: () => {
        try {
          const t = ctx.currentTime;
          const param = noteGain.gain as AudioParam & { cancelAndHoldAtTime?: (time: number) => void };
          if (typeof param.cancelAndHoldAtTime === 'function') {
            param.cancelAndHoldAtTime(t);
          } else {
            const cur = Math.max(0.0001, noteGain.gain.value);
            noteGain.gain.cancelScheduledValues(t);
            noteGain.gain.setValueAtTime(cur, t);
          }
          noteGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
          carrier.stop(t + 0.06);
          body.stop(t + 0.06);
        } catch {
          // Already stopped
        }
      },
    };
    this.voices.push(voice);
    carrier.onended = () => {
      const idx = this.voices.indexOf(voice);
      if (idx >= 0) this.voices.splice(idx, 1);
      noteGain.disconnect();
    };
  }

  private playFallbackSynth(
    ctx: AudioContext,
    midi: number,
    now: number,
    holdDur: number,
    vel: number,
  ): void {
    if (!this.lowShelf) return;
    const freq = midiToFrequency(midi);
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
    noteGain.connect(this.lowShelf);

    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now);
    const g2 = ctx.createGain();
    g2.gain.value = 0.28;

    osc1.connect(filter);
    osc2.connect(g2);
    g2.connect(filter);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(endTime + 0.02);
    osc2.stop(endTime + 0.02);

    const voice: ActiveVoice = {
      stop: () => {
        try {
          const t = ctx.currentTime;
          const param = noteGain.gain as AudioParam & { cancelAndHoldAtTime?: (time: number) => void };
          if (typeof param.cancelAndHoldAtTime === 'function') {
            param.cancelAndHoldAtTime(t);
          } else {
            const cur = Math.max(0.0001, noteGain.gain.value);
            noteGain.gain.cancelScheduledValues(t);
            noteGain.gain.setValueAtTime(cur, t);
          }
          noteGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
          osc1.stop(t + 0.06);
          osc2.stop(t + 0.06);
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
