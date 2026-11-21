import React from 'react';
import { BookOpen } from 'lucide-react';
import type { NotePlayer } from '../audio/pianoSynth';
import type { DetectedKey, Language } from '../core/types';
import { TheoryGuideTab } from './TheoryGuideTab';

interface TheoryViewProps {
  language: Language;
  player: NotePlayer;
  detectedKey?: DetectedKey;
}

export const TheoryView: React.FC<TheoryViewProps> = ({ language, player, detectedKey }) => {
  const isVi = language === 'vi';
  return (
    <div className="flex-1 overflow-y-auto bg-[#f8f6f1] px-4 sm:px-6 py-5 pb-24 md:pb-8">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* MuseKey Teal-to-Indigo Hero */}
        <div className="theory-hero rounded-[1.75rem] p-5 sm:p-7 text-white shadow-lg">
          <div className="text-xs font-medium text-teal-100/90 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            {isVi
              ? 'Học viện Nhạc lý Đệm Hát · Chuẩn giáo trình 21st-Century Music Theory'
              : 'Piano Accompaniment Theory Academy · 21st-Century Music Theory'}
          </div>
          <h1 className="display-serif text-3xl sm:text-4xl font-semibold mt-1">
            {isVi ? 'Lý thuyết Đệm Hát & Jazz' : 'Music Theory & Jazz Guide'}
          </h1>
          <p className="text-sm text-teal-50/90 max-w-2xl mt-1.5 leading-relaxed">
            {isVi
              ? 'Tra nhanh 12 tông × 8 âm giai trên bàn phím phát tiếng thật, hiểu chức năng hòa thanh T–PD–D, đảo hợp âm Voice Leading, Jazz Voicings và luyện tai hợp âm.'
              : 'Explore 12 keys × 8 scales on an interactive sounding piano, master T–PD–D harmonic functions, Voice Leading, Jazz voicings, and chord ear training.'}
          </p>
        </div>

        {/* High-contrast Editorial Dark-Slate Theory Panel for crystal-clear mini-piano & chord color badges */}
        <div className="rounded-[1.5rem] bg-[#161722] border border-[#2a2c3d] p-4 sm:p-5 shadow-md">
          <TheoryGuideTab
            language={language}
            player={player}
            initialTonicPc={detectedKey?.tonicPc ?? 0}
            initialMode={detectedKey?.mode ?? 'major'}
          />
        </div>
      </div>
    </div>
  );
};
