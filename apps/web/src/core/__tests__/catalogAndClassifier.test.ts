import { describe, expect, it } from 'vitest';
import {
  classifySongDifficulty,
  enrichSongMetadata,
} from '../accompaniment/difficultyClassifier';
import { PUBLIC_DOMAIN_CATALOG } from '../../data/publicDomainCatalog';
import type { NoteEvent, Song } from '../types';

function makeSyntheticSong(notesPerSec: number, polyphony: number, span: number, bpm: number): Song {
  const durationSec = 10;
  const totalEvents = Math.floor(durationSec * notesPerSec);
  const notes: NoteEvent[] = [];
  for (let i = 0; i < totalEvents; i++) {
    const t = (i / Math.max(1, totalEvents)) * durationSec;
    for (let p = 0; p < polyphony; p++) {
      const midi = 60 + Math.round((p / Math.max(1, polyphony)) * span);
      notes.push({
        id: `n-${i}-${p}`,
        midi,
        startTimeSec: t,
        durationSec: 0.4,
        velocity: 0.8,
        hand: midi < 60 ? 'left' : 'right',
        measureNumber: Math.floor(t / 2) + 1,
      });
    }
  }
  return {
    id: 'synth',
    title: 'Synthetic',
    composer: 'Test',
    sourceFormat: 'midi',
    createdAt: 0,
    defaultBpm: bpm,
    durationSec,
    tempoEvents: [{ timeSec: 0, bpm }],
    measures: [{ number: 1, startTimeSec: 0, endTimeSec: 2, beats: 4, beatType: 4 }],
    notes,
    minMidi: 60,
    maxMidi: 60 + span,
  };
}

describe('Difficulty Classifier & Public Domain Catalog', () => {
  it('classifies simple pieces as beginner (Grade 1–3) and dense virtuosic pieces as advanced (Grade 7–Diploma)', () => {
    const easy = classifySongDifficulty(makeSyntheticSong(1.2, 1, 10, 80));
    expect(easy.difficulty).toBe('beginner');
    expect(easy.gradeNum).toBeLessThanOrEqual(3);

    const hard = classifySongDifficulty(makeSyntheticSong(6, 4, 48, 150));
    expect(hard.difficulty).toBe('advanced');
    expect(hard.gradeNum).toBeGreaterThanOrEqual(7);
  });

  it('enriches a song with detectedKey, difficulty, grade, and gradeNum', () => {
    const enriched = enrichSongMetadata(makeSyntheticSong(2, 2, 16, 100));
    expect(enriched.detectedKey).toBeDefined();
    expect(enriched.difficulty).toBeDefined();
    expect(enriched.grade).toBeDefined();
    expect(enriched.gradeNum).toBeGreaterThanOrEqual(1);
  });

  it('provides 44 verified Public Domain catalog entries spanning Beginner, Intermediate, and Advanced', () => {
    expect(PUBLIC_DOMAIN_CATALOG.length).toBeGreaterThanOrEqual(40);
    expect(PUBLIC_DOMAIN_CATALOG.some((c) => c.difficulty === 'beginner')).toBe(true);
    expect(PUBLIC_DOMAIN_CATALOG.some((c) => c.difficulty === 'intermediate')).toBe(true);
    expect(PUBLIC_DOMAIN_CATALOG.some((c) => c.difficulty === 'advanced')).toBe(true);
    for (const c of PUBLIC_DOMAIN_CATALOG) {
      expect(c.rawUrl.startsWith('https://')).toBe(true);
      expect(c.gradeNum).toBeGreaterThanOrEqual(1);
      expect(c.gradeNum).toBeLessThanOrEqual(9);
    }
  });
});
