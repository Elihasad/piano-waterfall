export type Hand = 'left' | 'right';

export type NoteLabelMode = 'letters' | 'solfege' | 'off';

export type SourceFormat = 'musicxml' | 'midi' | 'pdf';

export type Language = 'en' | 'vi';

export type SoundPreset = 'grand' | 'studio' | 'bright' | 'electric';

export type PracticeMode = 'listen' | 'wait';

export interface NoteEvent {
  id: string;
  midi: number;
  startTimeSec: number;
  durationSec: number;
  velocity: number;
  hand: Hand;
  measureNumber: number;
}

export interface MeasureEvent {
  number: number;
  startTimeSec: number;
  endTimeSec: number;
  beats: number;
  beatType: number;
}

export interface TempoEvent {
  timeSec: number;
  bpm: number;
}

export type ChordQuality =
  | 'maj'
  | 'min'
  | 'dim'
  | 'aug'
  | 'sus2'
  | 'sus4'
  | 'maj7'
  | 'm7'
  | '7'
  | 'm7b5';

export interface ChordEvent {
  measureNumber: number;
  startTimeSec: number;
  endTimeSec: number;
  rootPc: number; // 0=C .. 11=B
  bassPc: number; // equals rootPc unless slash chord
  quality: ChordQuality;
  symbol: string; // e.g. "C", "Am7", "G/B"
  pitchClasses: number[]; // chord tones in 0..11
}

export interface DetectedKey {
  tonicPc: number; // 0..11
  mode: 'major' | 'minor';
  label: string; // e.g. "C Major", "A Minor"
  scalePcs: number[]; // 7 pitch classes
  diatonicChords: Array<{ roman: string; symbol: string; rootPc: number; quality: ChordQuality }>;
}

export type AccompanimentStyleId =
  | 'ballad-basic'
  | 'ballad-arpeggio'
  | 'pop-groove'
  | 'slow-rock-68'
  | 'waltz-34'
  | 'bolero'
  | 'bossa-nova'
  | 'jazz-swing'
  | 'jazz-ballad'
  | 'jazz-lofi'
  | 'scale-drill';

export interface Song {
  id: string;
  title: string;
  composer: string;
  sourceFormat: SourceFormat;
  createdAt: number;
  defaultBpm: number;
  durationSec: number;
  tempoEvents: TempoEvent[];
  measures: MeasureEvent[];
  notes: NoteEvent[];
  minMidi: number;
  maxMidi: number;
  chords?: ChordEvent[];
  detectedKey?: DetectedKey;
}

export interface HandControlState {
  left: { audio: boolean; visual: boolean };
  right: { audio: boolean; visual: boolean };
}

export interface AppSettings {
  language: Language;
  soundPreset: SoundPreset;
  omrServerUrl: string;
  noteLabelMode: NoteLabelMode;
  showKeyLabels: boolean;
  effectsEnabled: boolean;
}
