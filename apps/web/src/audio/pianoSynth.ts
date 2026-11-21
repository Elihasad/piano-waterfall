import { SplendidGrandPiano } from 'smplr';
import { clampMidi } from '../core/noteNames';
import type { SoundPreset } from '../core/types';

export interface NotePlayer {
  unlock(): Promise<void>;
  setPreset(preset: SoundPreset): void;
  getPreset(): SoundPreset;
  getAudioTime?(): number | null;
  playNote(midi: number, durationSec: number, velocity?: number, startAtAudioTime?: number): void;
  playMetronomeClick?(accent: boolean, startAtAudioTime?: number): void;
  stopAll(): void;
}

interface ActiveVoice {
  stop: () => void;
}

const MAX_POLYPHONY = 64;

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

/**
 * Generate a warm, natural concert-hall stereo impulse response with progressive
 * high-frequency air/wood damping (eliminates metallic white-noise hiss).
 */
function createHallImpulse(ctx: AudioContext, durationSec = 2.4, decay = 2.9): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * durationSec);
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let lp1 = 0;
    let lp2 = 0;
    for (let i = 0; i < length; i++) {
      const progress = i / length;
      const env = Math.pow(1 - progress, decay);
      // Slight pre-delay & early reflection warmth
      const preDelayGain = i < rate * 0.014 ? i / (rate * 0.014) : 1;
      const white = Math.random() * 2 - 1;
      // Progressive lowpass: brighter early reflections, warmer tail
      const alpha = Math.max(0.06, 0.34 * (1 - progress * 0.78));
      lp1 += alpha * (white - lp1);
      lp2 += alpha * (lp1 - lp2);
      data[i] = lp2 * env * preDelayGain;
    }
  }
  return impulse;
}

/**
 * Expressive Concert Piano engine combining:
 * 1. `SplendidGrandPiano` (danigb/smplr — 4-velocity-layer Steinway Grand samples) when online
 * 2. Bundled offline Salamander Grand Piano samples with velocity-sensitive felt lowpass,
 *    stereo keyboard panning, register-aware damper release, and warm concert hall reverb.
 */
export class PianoSynth implements NotePlayer {
  private ctx: AudioContext | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private lowShelf: BiquadFilterNode | null = null;
  private highShelf: BiquadFilterNode | null = null;
  private voices: ActiveVoice[] = [];
  private sampleBuffers = new Map<number, AudioBuffer>();
  private splendidPiano: SplendidGrandPiano | null = null;
  private splendidReady = false;
  private loadingStarted = false;
  private mutedByStop = false;
  private preset: SoundPreset = 'grand';
  private lastChordTime = -1;
  private chordNoteCount = 0;

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

      const masterGain = ctx.createGain();
      masterGain.gain.value = 1;

      lowShelf.connect(highShelf);
      highShelf.connect(dryGain);
      highShelf.connect(convolver);
      convolver.connect(wetGain);
      dryGain.connect(compressor);
      wetGain.connect(compressor);
      compressor.connect(masterGain);
      masterGain.connect(ctx.destination);

      this.lowShelf = lowShelf;
      this.highShelf = highShelf;
      this.dryGain = dryGain;
      this.wetGain = wetGain;
      this.masterGain = masterGain;
      this.applyPresetRouting();
      void this.preloadSamples();
      this.initSplendidGrand(ctx, lowShelf);
    }
    return this.ctx;
  }

  private initSplendidGrand(ctx: AudioContext, destination: AudioNode): void {
    // Load multi-velocity Steinway Grand Piano from smplr in the background;
    // falls back seamlessly to bundled offline Salamander samples while loading or offline.
    try {
      const piano = new SplendidGrandPiano(ctx, {
        destination,
        decayTime: 0.72,
        volume: 105,
      });
      this.splendidPiano = piano;
      void piano.load
        .then(() => {
          this.splendidReady = true;
        })
        .catch(() => {
          this.splendidReady = false;
        });
    } catch {
      this.splendidReady = false;
    }
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

  getAudioTime(): number | null {
    const ctx = this.ensureContext();
    return ctx ? ctx.currentTime : null;
  }

  playMetronomeClick(accent: boolean, startAtAudioTime?: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const now = startAtAudioTime ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(accent ? 1120 : 800, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(accent ? 0.24 : 0.14, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
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

    if (this.mutedByStop && this.masterGain) {
      const t = ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(t);
      this.masterGain.gain.setValueAtTime(1, t);
      this.mutedByStop = false;
    }

    while (this.voices.length >= MAX_POLYPHONY) {
      const oldest = this.voices.shift();
      oldest?.stop();
    }

    const clamped = clampMidi(midi);
    const baseNow = startAtAudioTime ?? ctx.currentTime;
    const rawVel = Math.max(0.1, Math.min(1, velocity));
    const holdDur = Math.max(0.1, Math.min(durationSec, 8));

    // Organic chord micro-spread (0..6ms) + subtle dynamic nuance so chords bloom like a human pianist
    let humanOffset = 0;
    if (Math.abs(baseNow - this.lastChordTime) < 0.008) {
      this.chordNoteCount = Math.min(8, this.chordNoteCount + 1);
      humanOffset = this.chordNoteCount * 0.0022 + Math.random() * 0.0018;
    } else {
      this.lastChordTime = baseNow;
      this.chordNoteCount = 0;
    }
    const now = baseNow + humanOffset;
    const expressiveVel = Math.max(
      0.12,
      Math.min(0.98, Math.pow(rawVel, 1.2) * (0.97 + Math.random() * 0.06)),
    );

    // Electric Piano uses dedicated Rhodes-style FM/tine synthesis
    if (this.preset === 'electric') {
      this.playElectricPiano(ctx, clamped, now, holdDur, expressiveVel);
      return;
    }

    // Prefer 4-velocity-layer Steinway Grand (smplr) when loaded for rich, non-mechanical acoustics
    if (this.splendidReady && this.splendidPiano) {
      const midiVel = Math.max(18, Math.min(127, Math.round(expressiveVel * 127)));
      // Register-aware natural sustain tail
      const registerTail = clamped < 52 ? 0.35 : clamped < 72 ? 0.18 : 0.08;
      const stopFn = this.splendidPiano.start({
        note: clamped,
        velocity: midiVel,
        time: now,
        duration: holdDur + registerTail,
      });
      if (typeof stopFn === 'function') {
        const voice: ActiveVoice = {
          stop: () => {
            try {
              stopFn(ctx.currentTime);
            } catch {
              // ignore
            }
          },
        };
        this.voices.push(voice);
      }
      return;
    }

    const sample = this.findClosestSample(clamped);
    if (sample) {
      this.playSampledPiano(ctx, sample.buffer, sample.baseMidi, clamped, now, holdDur, expressiveVel);
    } else {
      this.playFallbackSynth(ctx, clamped, now, holdDur, expressiveVel);
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

    // Register-aware natural damper release (bass rings longer, treble decays crisper)
    const baseRelease = this.preset === 'grand' ? 0.85 : this.preset === 'studio' ? 0.42 : 0.6;
    const registerFactor = targetMidi < 50 ? 1.35 : targetMidi > 78 ? 0.72 : 1.0;
    const releaseDur = baseRelease * registerFactor;
    const endTime = now + holdDur + releaseDur;

    // Velocity-sensitive felt hammer lowpass filter (soft notes = warm/dark, loud notes = bright)
    const hammerFilter = ctx.createBiquadFilter();
    hammerFilter.type = 'lowpass';
    const peakCutoff = Math.min(16000, 1100 + Math.pow(vel, 1.8) * 13500);
    const sustainCutoff = Math.max(850, peakCutoff * 0.52);
    hammerFilter.frequency.setValueAtTime(peakCutoff, now);
    hammerFilter.frequency.exponentialRampToValueAtTime(sustainCutoff, now + Math.min(holdDur, 1.2));

    const noteGain = ctx.createGain();
    // Smooth 3ms de-click attack + natural string decay curve
    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.linearRampToValueAtTime(Math.max(0.001, vel * 0.92), now + 0.003);
    noteGain.gain.exponentialRampToValueAtTime(Math.max(0.001, vel * 0.72), now + holdDur);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    src.connect(hammerFilter);
    hammerFilter.connect(noteGain);

    // Natural stereo piano keyboard panning (bass left -> treble right)
    let panner: StereoPannerNode | null = null;
    if (typeof ctx.createStereoPanner === 'function') {
      panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-0.38, Math.min(0.38, ((targetMidi - 60) / 36) * 0.35));
      noteGain.connect(panner);
      panner.connect(this.lowShelf);
    } else {
      noteGain.connect(this.lowShelf);
    }

    src.start(now);
    src.stop(endTime + 0.04);

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
          noteGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
          src.stop(t + 0.08);
        } catch {
          // Already stopped
        }
      },
    };

    this.voices.push(voice);
    src.onended = () => {
      const idx = this.voices.indexOf(voice);
      if (idx >= 0) this.voices.splice(idx, 1);
      hammerFilter.disconnect();
      noteGain.disconnect();
      panner?.disconnect();
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
    // Immediately fade master bus to silence in 15ms so ZERO lookahead notes or reverb tails leak after Pause/Stop
    if (this.ctx && this.masterGain) {
      const t = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(t);
      this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), t);
      this.masterGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);
      this.mutedByStop = true;
    }
    try {
      this.splendidPiano?.stop();
    } catch {
      // ignore
    }
    const active = this.voices.splice(0);
    for (const v of active) {
      v.stop();
    }
  }
}
