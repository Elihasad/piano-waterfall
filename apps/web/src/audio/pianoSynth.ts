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
  startTime: number;
  endTime: number;
  stop: () => void;
}

type VelocityLayer = 'PP' | 'MP' | 'MF' | 'FF';

interface SampleManifestEntry {
  midi: number;
  file: string;
}

type SteinwayManifest = Record<VelocityLayer, SampleManifestEntry[]>;

const MAX_POLYPHONY = 128;

const SALAMANDER_SAMPLES: ReadonlyArray<SampleManifestEntry> = [
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
 * Generates a natural concert-hall stereo impulse response with subtle pre-delay
 * and progressive high-frequency wooden/air absorption (zero metallic hiss).
 */
function createHallImpulse(ctx: AudioContext, durationSec = 2.3, decay = 2.75): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * durationSec);
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let lp1 = 0;
    let lp2 = 0;
    const preDelaySamples = Math.floor(rate * (ch === 0 ? 0.015 : 0.018));
    for (let i = 0; i < length; i++) {
      const progress = i / length;
      const env = Math.pow(1 - progress, decay);
      const preDelayGain = i < preDelaySamples ? (i / Math.max(1, preDelaySamples)) * 0.35 : 1;
      const white = Math.random() * 2 - 1;
      // Progressive lowpass: warm wooden early reflections -> silky dark hall tail
      const alpha = Math.max(0.05, 0.32 * (1 - progress * 0.8));
      lp1 += alpha * (white - lp1);
      lp2 += alpha * (lp1 - lp2);
      data[i] = lp2 * env * preDelayGain;
    }
  }
  return impulse;
}

/**
 * Studio-grade 100% Offline Multi-Velocity Concert Piano Engine:
 * - `grand`: 4-Velocity-Layer Public Domain Akai Steinway Concert Grand (`PP / MP / MF / FF`, 78 bundled .m4a samples)
 *            with smooth velocity crossfading, stereo lid panning, and warm concert hall acoustics.
 * - `studio`: Close-mic Yamaha C5 Salamander Grand Piano (22 bundled .mp3 samples) with tight studio clarity.
 * - `bright`: Intimate Felt Soft Piano using the Steinway `PP` soft-hammer layer + warm felt damper lowpass.
 * - `electric`: Warm Rhodes Mk1 Electric Piano with woody tine transient & stereo shimmer.
 */
export class PianoSynth implements NotePlayer {
  private ctx: AudioContext | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private lowShelf: BiquadFilterNode | null = null;
  private midPresence: BiquadFilterNode | null = null;
  private highShelf: BiquadFilterNode | null = null;
  private voices: ActiveVoice[] = [];
  private salamanderBuffers = new Map<number, AudioBuffer>();
  private steinwayLayers: Record<VelocityLayer, Map<number, AudioBuffer>> = {
    PP: new Map(),
    MP: new Map(),
    MF: new Map(),
    FF: new Map(),
  };
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
      lowShelf.frequency.value = 190;

      const midPresence = ctx.createBiquadFilter();
      midPresence.type = 'peaking';
      midPresence.frequency.value = 1800;
      midPresence.Q.value = 0.9;

      const highShelf = ctx.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.value = 3800;

      const dryGain = ctx.createGain();
      const wetGain = ctx.createGain();

      const convolver = ctx.createConvolver();
      convolver.buffer = createHallImpulse(ctx, 2.3, 2.75);

      // Gentle mastering bus compressor prevents clipping on loud chords while keeping full dynamics
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 20;
      compressor.ratio.value = 3.0;
      compressor.attack.value = 0.006;
      compressor.release.value = 0.16;

      const masterGain = ctx.createGain();
      masterGain.gain.value = 1;

      lowShelf.connect(midPresence);
      midPresence.connect(highShelf);
      highShelf.connect(dryGain);
      highShelf.connect(convolver);
      convolver.connect(wetGain);
      dryGain.connect(compressor);
      wetGain.connect(compressor);
      compressor.connect(masterGain);
      masterGain.connect(ctx.destination);

      this.lowShelf = lowShelf;
      this.midPresence = midPresence;
      this.highShelf = highShelf;
      this.dryGain = dryGain;
      this.wetGain = wetGain;
      this.masterGain = masterGain;
      this.applyPresetRouting();
      void this.preloadAllLocalSamples();
    }
    return this.ctx;
  }

  private applyPresetRouting(): void {
    if (!this.dryGain || !this.wetGain || !this.lowShelf || !this.midPresence || !this.highShelf) {
      return;
    }
    if (this.preset === 'grand') {
      // Steinway Concert Grand: warm resonant soundboard, lush concert hall air
      this.dryGain.gain.value = 0.86;
      this.wetGain.gain.value = 0.34;
      this.lowShelf.gain.value = 2.2;
      this.midPresence.gain.value = 0.6;
      this.highShelf.gain.value = 1.2;
    } else if (this.preset === 'studio') {
      // Yamaha C5 Studio: focused close-mic punch & sparkle
      this.dryGain.gain.value = 0.96;
      this.wetGain.gain.value = 0.13;
      this.lowShelf.gain.value = 0.8;
      this.midPresence.gain.value = 1.6;
      this.highShelf.gain.value = 2.0;
    } else if (this.preset === 'bright') {
      // Felt Soft Piano: intimate warm wood, silky softened highs, cozy room reverb
      this.dryGain.gain.value = 0.82;
      this.wetGain.gain.value = 0.38;
      this.lowShelf.gain.value = 3.2;
      this.midPresence.gain.value = -1.5;
      this.highShelf.gain.value = -4.5;
    } else {
      // Rhodes Mk1 Electric Piano
      this.dryGain.gain.value = 0.88;
      this.wetGain.gain.value = 0.28;
      this.lowShelf.gain.value = 2.0;
      this.midPresence.gain.value = 0.5;
      this.highShelf.gain.value = 1.8;
    }
  }

  private async decodeIntoMap(
    ctx: AudioContext,
    url: string,
    midi: number,
    target: Map<number, AudioBuffer>,
  ): Promise<void> {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const arr = await res.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arr);
      target.set(midi, decoded);
    } catch {
      // Graceful fallback if audio decoding unavailable (e.g. jsdom unit tests)
    }
  }

  private async preloadAllLocalSamples(): Promise<void> {
    if (this.loadingStarted || !this.ctx) return;
    this.loadingStarted = true;
    const ctx = this.ctx;

    // 1. Load Salamander (Yamaha C5) + Steinway manifest in parallel
    const salamanderPromise = Promise.all(
      SALAMANDER_SAMPLES.map((entry) =>
        this.decodeIntoMap(ctx, `./samples/salamander/${entry.file}`, entry.midi, this.salamanderBuffers),
      ),
    );

    let manifest: SteinwayManifest | null = null;
    try {
      const res = await fetch('./samples/steinway/manifest.json');
      if (res.ok) {
        manifest = (await res.json()) as SteinwayManifest;
      }
    } catch {
      manifest = null;
    }

    if (manifest) {
      // 2. Priority load MF + PP first so Steinway Grand & Felt Piano sound gorgeous immediately
      const loadLayer = async (layer: VelocityLayer) => {
        const list = manifest?.[layer] ?? [];
        const map = this.steinwayLayers[layer];
        // Batch by 6 to keep main thread & mobile audio decoder silky smooth
        for (let i = 0; i < list.length; i += 6) {
          await Promise.all(
            list
              .slice(i, i + 6)
              .map((entry) =>
                this.decodeIntoMap(ctx, `./samples/steinway/${entry.file}`, entry.midi, map),
              ),
          );
        }
      };

      await Promise.all([salamanderPromise, loadLayer('MF'), loadLayer('PP')]);
      // 3. Hydrate MP & FF layers seamlessly in background for full 4-layer dynamic realism
      await loadLayer('MP');
      await loadLayer('FF');
    } else {
      await salamanderPromise;
    }
  }

  private findClosestInMap(
    map: Map<number, AudioBuffer>,
    midi: number,
  ): { baseMidi: number; buffer: AudioBuffer } | null {
    if (map.size === 0) return null;
    let bestMidi = -1;
    let bestDist = Infinity;
    for (const sampleMidi of map.keys()) {
      const dist = Math.abs(sampleMidi - midi);
      if (dist < bestDist) {
        bestDist = dist;
        bestMidi = sampleMidi;
      }
    }
    const buffer = map.get(bestMidi);
    return buffer ? { baseMidi: bestMidi, buffer } : null;
  }

  /**
   * Selects 1 (or 2 crossfaded) velocity layers from our 4 bundled Steinway recordings
   * (`PP`, `MP`, `MF`, `FF`) so soft passages sound genuinely velvety and forte notes sparkle!
   */
  private selectSteinwayLayers(
    vel: number,
  ): Array<{ layer: VelocityLayer; gainWeight: number }> {
    const avail = (l: VelocityLayer) => this.steinwayLayers[l].size > 0;
    const allLayers: VelocityLayer[] = ['PP', 'MP', 'MF', 'FF'];
    const order: VelocityLayer[] = allLayers.filter(avail);
    if (order.length === 0) return [];
    if (order.length === 1) return [{ layer: order[0], gainWeight: 1 }];

    // Continuous position across loaded layers (0 = softest PP, 1 = loudest FF)
    const scaled = Math.max(0, Math.min(1, vel)) * (order.length - 1);
    const lowIdx = Math.floor(scaled);
    const highIdx = Math.min(order.length - 1, lowIdx + 1);
    const frac = scaled - lowIdx;

    // Crossfade smoothly only in the central transition band (0.25..0.75) to save polyphony while removing jumps
    if (lowIdx === highIdx || frac < 0.25) {
      return [{ layer: order[lowIdx], gainWeight: 1 }];
    }
    if (frac > 0.75) {
      return [{ layer: order[highIdx], gainWeight: 1 }];
    }
    const mix = (frac - 0.25) / 0.5;
    // Equal-power crossfade keeps loudness perfectly smooth across velocity boundaries
    return [
      { layer: order[lowIdx], gainWeight: Math.cos(mix * Math.PI * 0.5) },
      { layer: order[highIdx], gainWeight: Math.sin(mix * Math.PI * 0.5) },
    ];
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
    return ctx && ctx.state === 'running' ? ctx.currentTime : null;
  }

  playMetronomeClick(accent: boolean, startAtAudioTime?: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const now = Math.max(ctx.currentTime + 0.002, startAtAudioTime ?? ctx.currentTime);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(accent ? 1120 : 800, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(accent ? 0.22 : 0.13, now + 0.003);
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

    const audioNow = ctx.currentTime;
    if (this.mutedByStop && this.masterGain) {
      this.masterGain.gain.cancelScheduledValues(audioNow);
      this.masterGain.gain.setValueAtTime(1, audioNow);
      this.mutedByStop = false;
    }

    // Prune already-finished voices
    if (this.voices.length > 0) {
      this.voices = this.voices.filter((v) => v.endTime > audioNow);
    }

    // If still above MAX_POLYPHONY, only steal the oldest ALREADY-STARTED voice (never kill future lookahead notes!)
    while (this.voices.length >= MAX_POLYPHONY) {
      const idx = this.voices.findIndex((v) => v.startTime <= audioNow);
      if (idx === -1) break;
      const [oldest] = this.voices.splice(idx, 1);
      oldest?.stop();
    }

    const clamped = clampMidi(midi);
    const baseNow = Math.max(audioNow + 0.002, startAtAudioTime ?? audioNow);
    const rawVel = Math.max(0.08, Math.min(1, velocity));
    const holdDur = Math.max(0.12, Math.min(durationSec, 9));

    // Organic chord micro-spread (0..5ms) + gentle human velocity micro-nuance
    let humanOffset = 0;
    if (Math.abs(baseNow - this.lastChordTime) < 0.008) {
      this.chordNoteCount = Math.min(8, this.chordNoteCount + 1);
      humanOffset = this.chordNoteCount * 0.0018 + Math.random() * 0.0014;
    } else {
      this.lastChordTime = baseNow;
      this.chordNoteCount = 0;
    }
    const now = baseNow + humanOffset;
    const expressiveVel = Math.max(
      0.1,
      Math.min(0.98, Math.pow(rawVel, 1.15) * (0.97 + Math.random() * 0.05)),
    );

    // 1. Rhodes Mk1 Electric Piano
    if (this.preset === 'electric') {
      this.playElectricPiano(ctx, clamped, now, holdDur, expressiveVel);
      return;
    }

    // 2. Steinway Concert Grand (4-Layer Multi-Velocity Offline)
    if (this.preset === 'grand') {
      const picks = this.selectSteinwayLayers(expressiveVel);
      if (picks.length > 0) {
        for (const pick of picks) {
          const sample = this.findClosestInMap(this.steinwayLayers[pick.layer], clamped);
          if (sample) {
            this.playSampledPiano(ctx, sample.buffer, sample.baseMidi, clamped, now, holdDur, expressiveVel * pick.gainWeight, {
              baseRelease: 0.95,
              attackSec: 0.0025,
              cutoffMin: 2400,
              cutoffMax: 17500,
              gainScale: 1.05,
            });
          }
        }
        return;
      }
    }

    // 3. Intimate Felt Soft Piano (uses real Steinway PP soft-hammer recordings + warm felt lowpass)
    if (this.preset === 'bright') {
      const ppSample =
        this.findClosestInMap(this.steinwayLayers.PP, clamped) ??
        this.findClosestInMap(this.steinwayLayers.MP, clamped) ??
        this.findClosestInMap(this.salamanderBuffers, clamped);
      if (ppSample) {
        this.playSampledPiano(ctx, ppSample.buffer, ppSample.baseMidi, clamped, now, holdDur, expressiveVel, {
          baseRelease: 1.05,
          attackSec: 0.008,
          cutoffMin: 850,
          cutoffMax: 4400,
          gainScale: 1.08,
        });
        return;
      }
    }

    // 4. Yamaha C5 Studio (Salamander Grand) — also serves as instant fallback while Steinway decodes
    const salamander = this.findClosestInMap(this.salamanderBuffers, clamped);
    if (salamander) {
      this.playSampledPiano(ctx, salamander.buffer, salamander.baseMidi, clamped, now, holdDur, expressiveVel, {
        baseRelease: this.preset === 'studio' ? 0.58 : 0.88,
        attackSec: 0.0025,
        cutoffMin: 1400,
        cutoffMax: 16500,
        gainScale: 0.96,
      });
      return;
    }

    // 5. Fallback Steinway MF if Salamander hasn't finished yet
    const fallbackSteinway = this.findClosestInMap(this.steinwayLayers.MF, clamped);
    if (fallbackSteinway) {
      this.playSampledPiano(ctx, fallbackSteinway.buffer, fallbackSteinway.baseMidi, clamped, now, holdDur, expressiveVel, {
        baseRelease: 0.9,
        attackSec: 0.003,
        cutoffMin: 2000,
        cutoffMax: 16500,
        gainScale: 1.0,
      });
      return;
    }

    this.playFallbackSynth(ctx, clamped, now, holdDur, expressiveVel);
  }

  private playSampledPiano(
    ctx: AudioContext,
    buffer: AudioBuffer,
    baseMidi: number,
    targetMidi: number,
    now: number,
    holdDur: number,
    vel: number,
    profile: {
      baseRelease: number;
      attackSec: number;
      cutoffMin: number;
      cutoffMax: number;
      gainScale: number;
    },
  ): void {
    if (!this.lowShelf) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = Math.pow(2, (targetMidi - baseMidi) / 12);

    // Register-aware natural damper release: bass strings resonate longer, high treble decays crisp
    const registerFactor = targetMidi < 48 ? 1.38 : targetMidi < 60 ? 1.15 : targetMidi > 80 ? 0.65 : 1.0;
    const releaseDur = profile.baseRelease * registerFactor;
    const endTime = now + holdDur + releaseDur;

    // Velocity-sensitive hammer lowpass filter for silky dynamic shading
    const hammerFilter = ctx.createBiquadFilter();
    hammerFilter.type = 'lowpass';
    const peakCutoff = Math.min(
      profile.cutoffMax,
      profile.cutoffMin + Math.pow(Math.min(1, vel), 1.55) * (profile.cutoffMax - profile.cutoffMin),
    );
    const sustainCutoff = Math.max(700, peakCutoff * 0.58);
    hammerFilter.frequency.setValueAtTime(peakCutoff, now);
    hammerFilter.frequency.exponentialRampToValueAtTime(sustainCutoff, now + Math.min(holdDur, 1.4));

    const noteGain = ctx.createGain();
    const peakAmp = Math.max(0.002, Math.min(1.15, vel * profile.gainScale));
    // Smooth de-click attack -> natural string hold -> realistic damper fade
    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.linearRampToValueAtTime(peakAmp, now + profile.attackSec);
    noteGain.gain.exponentialRampToValueAtTime(Math.max(0.001, peakAmp * 0.74), now + holdDur);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    src.connect(hammerFilter);
    hammerFilter.connect(noteGain);

    // Natural stereo concert grand lid panning (bass left -> treble right)
    let panner: StereoPannerNode | null = null;
    if (typeof ctx.createStereoPanner === 'function') {
      panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-0.38, Math.min(0.38, ((targetMidi - 60) / 36) * 0.36));
      noteGain.connect(panner);
      panner.connect(this.lowShelf);
    } else {
      noteGain.connect(this.lowShelf);
    }

    src.start(now);
    src.stop(endTime + 0.04);

    const voice: ActiveVoice = {
      startTime: now,
      endTime: endTime + 0.08,
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
    const releaseDur = 0.55;
    const endTime = now + holdDur + releaseDur;

    const noteGain = ctx.createGain();
    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.linearRampToValueAtTime(Math.max(0.001, vel * 0.36), now + 0.006);
    noteGain.gain.exponentialRampToValueAtTime(Math.max(0.001, vel * 0.16), now + holdDur);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, now);

    // Subtle warm 2nd harmonic body
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(freq * 2, now);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.12 * vel, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + Math.min(holdDur, 0.9));

    // Classic Rhodes glassy bell tine transient
    const tine = ctx.createOscillator();
    tine.type = 'sine';
    tine.frequency.setValueAtTime(freq * 7, now);
    const tineGain = ctx.createGain();
    tineGain.gain.setValueAtTime(0.24 * vel, now);
    tineGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(6200, freq * 8), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(900, freq * 2.4), now + Math.min(holdDur, 1.0));

    carrier.connect(filter);
    body.connect(bodyGain);
    bodyGain.connect(filter);
    tine.connect(tineGain);
    tineGain.connect(filter);
    filter.connect(noteGain);

    let panner: StereoPannerNode | null = null;
    if (typeof ctx.createStereoPanner === 'function') {
      panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-0.32, Math.min(0.32, ((midi - 60) / 36) * 0.3));
      noteGain.connect(panner);
      panner.connect(this.lowShelf);
    } else {
      noteGain.connect(this.lowShelf);
    }

    carrier.start(now);
    body.start(now);
    tine.start(now);
    carrier.stop(endTime + 0.02);
    body.stop(endTime + 0.02);
    tine.stop(now + 0.19);

    const voice: ActiveVoice = {
      startTime: now,
      endTime: endTime + 0.08,
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
          carrier.stop(t + 0.07);
          body.stop(t + 0.07);
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
      filter.disconnect();
      bodyGain.disconnect();
      tineGain.disconnect();
      panner?.disconnect();
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
    const endTime = now + holdDur + 0.5;

    const noteGain = ctx.createGain();
    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.linearRampToValueAtTime(Math.max(0.001, vel * 0.34), now + 0.005);
    noteGain.gain.exponentialRampToValueAtTime(Math.max(0.001, vel * 0.14), now + holdDur);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(7200, freq * 8), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(700, freq * 2.2), now + Math.min(holdDur, 0.9));
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
      startTime: now,
      endTime: endTime + 0.08,
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
    const active = this.voices.splice(0);
    for (const v of active) {
      v.stop();
    }
  }
}
