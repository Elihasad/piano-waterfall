import { describe, expect, it } from 'vitest';
import { LESSON_CURRICULUM } from '../lessons/lessonCurriculum';

describe('Alfred Level 1-3 & MusicTheory Lesson Curriculum', () => {
  it('provides 15 structured lessons across Levels 1, 2, and 3', () => {
    expect(LESSON_CURRICULUM).toHaveLength(15);
    expect(LESSON_CURRICULUM.filter((l) => l.level === 1)).toHaveLength(5);
    expect(LESSON_CURRICULUM.filter((l) => l.level === 2)).toHaveLength(5);
    expect(LESSON_CURRICULUM.filter((l) => l.level === 3)).toHaveLength(5);
  });

  it('generates valid playable two-hand exercises for every lesson', () => {
    for (const lesson of LESSON_CURRICULUM) {
      const song = lesson.buildSong();
      expect(song.notes.length).toBeGreaterThan(10);
      expect(song.measures.length).toBeGreaterThanOrEqual(4);
      expect(song.notes.some((n) => n.hand === 'left')).toBe(true);
      expect(song.notes.some((n) => n.hand === 'right')).toBe(true);
      expect(song.minMidi).toBeGreaterThanOrEqual(21);
      expect(song.maxMidi).toBeLessThanOrEqual(108);
    }
  });
});
