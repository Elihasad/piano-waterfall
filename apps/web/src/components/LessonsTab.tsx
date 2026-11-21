import React, { useState } from 'react';
import { BookMarked, CheckCircle2, Circle, Play, Sparkles } from 'lucide-react';
import { LESSON_CURRICULUM, type LessonItem, type LessonLevel } from '../core/lessons/lessonCurriculum';
import type { Language, Song } from '../core/types';

interface LessonsTabProps {
  language: Language;
  onStartLessonSong: (song: Song) => void;
}

const STORAGE_KEY = 'pw-completed-lessons';

export const LessonsTab: React.FC<LessonsTabProps> = ({ language, onStartLessonSong }) => {
  const isVi = language === 'vi';
  const [selectedLevel, setSelectedLevel] = useState<'all' | LessonLevel>('all');
  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const toggleDone = (id: string) => {
    setCompletedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const visibleLessons =
    selectedLevel === 'all'
      ? LESSON_CURRICULUM
      : LESSON_CURRICULUM.filter((l) => l.level === selectedLevel);

  const totalCount = LESSON_CURRICULUM.length;
  const doneCount = completedIds.filter((id) => LESSON_CURRICULUM.some((l) => l.id === id)).length;
  const overallPct = Math.round((doneCount / Math.max(1, totalCount)) * 100);

  const levelMeta: Record<LessonLevel, { titleVi: string; titleEn: string; badge: string }> = {
    1: {
      titleVi: 'Level 1 · Nhập Môn',
      titleEn: 'Level 1 · Beginner',
      badge: 'bg-[#e1f4ea] text-[#2f9e6c]',
    },
    2: {
      titleVi: 'Level 2 · Sơ Trung Cấp',
      titleEn: 'Level 2 · Elementary',
      badge: 'bg-[#eceefe] text-[#4f46e5]',
    },
    3: {
      titleVi: 'Level 3 · Trung Cấp & Jazz',
      titleEn: 'Level 3 · Intermediate & Jazz',
      badge: 'bg-[#faefdb] text-[#c0822a]',
    },
  };

  const handlePractice = (lesson: LessonItem) => {
    const song = lesson.buildSong();
    onStartLessonSong(song);
  };

  return (
    <div className="space-y-4">
      {/* Progress Overview Card */}
      <div className="paper-card rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-[#4f46e5] uppercase tracking-wider flex items-center gap-1.5">
              <BookMarked className="w-3.5 h-3.5" />
              {isVi
                ? 'Lộ trình học Piano từng bước · Cơ bản → Trung cấp → Đệm hát & Jazz'
                : 'Structured Piano Curriculum · Beginner → Elementary → Intermediate & Jazz'}
            </div>
            <div className="text-sm font-bold text-[#14151c] mt-0.5">
              {isVi
                ? `Đã hoàn thành ${doneCount} / ${totalCount} bài học (${overallPct}%)`
                : `Completed ${doneCount} of ${totalCount} lessons (${overallPct}%)`}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 bg-[#edeae2] p-1 rounded-full">
            {([
              { id: 'all' as const, vi: 'Tất cả (15)', en: 'All (15)' },
              { id: 1 as const, vi: 'Level 1', en: 'Level 1' },
              { id: 2 as const, vi: 'Level 2', en: 'Level 2' },
              { id: 3 as const, vi: 'Level 3 & Jazz', en: 'Level 3 & Jazz' },
            ]).map((lvl) => (
              <button
                key={String(lvl.id)}
                type="button"
                onClick={() => setSelectedLevel(lvl.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  selectedLevel === lvl.id
                    ? 'bg-white text-[#14151c] shadow-sm'
                    : 'text-[#4a4f5e] hover:text-[#14151c]'
                }`}
              >
                {isVi ? lvl.vi : lvl.en}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full h-2 rounded-full bg-[#d3cdc0] overflow-hidden">
          <div
            className="h-full bg-[#4f46e5] rounded-full transition-all"
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      {/* Lesson Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {visibleLessons.map((lesson) => {
          const done = completedIds.includes(lesson.id);
          const meta = levelMeta[lesson.level];
          return (
            <div
              key={lesson.id}
              className={`paper-card rounded-2xl p-4 flex flex-col justify-between gap-3 transition ${
                done ? 'opacity-90 border-[#2f9e6c]/40' : ''
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.badge}`}>
                      {isVi ? `Bài ${lesson.code}` : `Lesson ${lesson.code}`}
                    </span>
                    <span className="text-[10px] text-[#888d9c] font-medium">
                      {lesson.sourceRef}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleDone(lesson.id)}
                    aria-label={`Mark lesson ${lesson.code} complete`}
                    className="shrink-0"
                  >
                    {done ? (
                      <CheckCircle2 className="w-5 h-5 text-[#2f9e6c]" />
                    ) : (
                      <Circle className="w-5 h-5 text-[#888d9c] hover:text-[#4f46e5]" />
                    )}
                  </button>
                </div>

                <h3 className="font-bold text-sm text-[#14151c] leading-snug">
                  {isVi ? lesson.titleVi : lesson.titleEn}
                </h3>

                <p className="text-xs text-[#4a4f5e] leading-relaxed">
                  {isVi ? lesson.goalVi : lesson.goalEn}
                </p>

                <div className="rounded-xl bg-[#f8f6f1] border border-[#e7e3d9] px-2.5 py-2 text-[11px] text-[#4a4f5e] flex items-start gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#4f46e5] shrink-0 mt-0.5" />
                  <span>{isVi ? lesson.fingeringTipVi : lesson.fingeringTipEn}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#e7e3d9]">
                <span className="text-[11px] font-mono text-[#888d9c]">{lesson.bpm} BPM</span>
                <button
                  type="button"
                  onClick={() => handlePractice(lesson)}
                  className="px-4 py-1.5 rounded-full bg-[#14151c] hover:bg-[#2a2d3d] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {isVi ? 'Tập bài này ngay' : 'Practice Exercise'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
