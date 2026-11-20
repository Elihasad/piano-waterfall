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
