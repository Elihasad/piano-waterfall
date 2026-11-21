import React, { useState } from 'react';
import { BookOpen, GraduationCap } from 'lucide-react';
import type { NotePlayer } from '../audio/pianoSynth';
import type { DetectedKey, Language, Song } from '../core/types';
import { LessonsTab } from './LessonsTab';
import { TheoryGuideTab } from './TheoryGuideTab';

interface TheoryViewProps {
  language: Language;
  player: NotePlayer;
  detectedKey?: DetectedKey;
  onStartLessonSong: (song: Song) => void;
}

export const TheoryView: React.FC<TheoryViewProps> = ({
  language,
  player,
  detectedKey,
  onStartLessonSong,
}) => {
  const isVi = language === 'vi';
  const [activeTab, setActiveTab] = useState<'lessons' | 'theory'>('lessons');

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8f6f1] px-4 sm:px-6 py-5 pb-24 md:pb-8">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* MuseKey Teal-to-Indigo Hero */}
        <div className="theory-hero rounded-[1.75rem] p-5 sm:p-7 text-white shadow-lg flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-teal-100/90 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              {isVi
                ? 'Học viện Piano · Lộ trình thực hành & Nhạc lý đệm hát'
                : 'Piano Academy · Progressive Lessons & Accompaniment Theory'}
            </div>
            <h1 className="display-serif text-3xl sm:text-4xl font-semibold">
              {isVi ? 'Bài Học & Lý Thuyết Đệm Hát' : 'Lessons & Music Theory'}
            </h1>
            <p className="text-sm text-teal-50/90 max-w-2xl leading-relaxed">
              {isVi
                ? '15 bài tập thực hành có lộ trình rõ ràng từ Cơ bản (Level 1) đến Jazz (Level 3), kèm từ điển nhạc lý tương tác phát tiếng đàn thật.'
                : '15 progressive playable exercises from Beginner (Level 1) to Jazz (Level 3), paired with an interactive sounding theory reference.'}
            </p>
          </div>

          {/* 2-Tab Pill Switcher: Lessons vs Theory Reference */}
          <div className="flex items-center gap-1 bg-black/25 p-1 rounded-full border border-white/15 shrink-0 self-start sm:self-end">
            <button
              type="button"
              onClick={() => setActiveTab('lessons')}
              className={`px-4 py-2 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition ${
                activeTab === 'lessons'
                  ? 'bg-white text-[#14151c] shadow-sm'
                  : 'text-white/85 hover:text-white'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              {isVi ? 'Bài Học & Lộ Trình' : 'Lessons'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('theory')}
              className={`px-4 py-2 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition ${
                activeTab === 'theory'
                  ? 'bg-white text-[#14151c] shadow-sm'
                  : 'text-white/85 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              {isVi ? 'Lý Thuyết & Tra Cứu' : 'Theory Reference'}
            </button>
          </div>
        </div>

        {activeTab === 'lessons' ? (
          <LessonsTab language={language} onStartLessonSong={onStartLessonSong} />
        ) : (
          <div className="rounded-[1.5rem] bg-[#161722] border border-[#2a2c3d] p-4 sm:p-5 shadow-md">
            <TheoryGuideTab
              language={language}
              player={player}
              initialTonicPc={detectedKey?.tonicPc ?? 0}
              initialMode={detectedKey?.mode ?? 'major'}
            />
          </div>
        )}
      </div>
    </div>
  );
};
