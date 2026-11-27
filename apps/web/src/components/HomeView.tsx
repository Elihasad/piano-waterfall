import React from 'react';
import {
  ArrowRight,
  BookOpen,
  Compass,
  GraduationCap,
  Library,
  Play,
  Sparkles,
  Upload,
} from 'lucide-react';
import { analyzeSongHarmony } from '../core/accompaniment/harmonyAnalyzer';
import type { Language, Song } from '../core/types';
import type { AppView } from './AppShell';

interface HomeViewProps {
  language: Language;
  songs: Song[];
  currentSong: Song;
  onNavigate: (view: AppView) => void;
  onSelectSong: (song: Song) => void;
  onArrangeSong: (song: Song) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  language,
  songs,
  currentSong,
  onNavigate,
  onSelectSong,
  onArrangeSong,
}) => {
  const isVi = language === 'vi';

  const quickCards: Array<{
    view: AppView;
    icon: React.ReactNode;
    accent: string;
    titleVi: string;
    titleEn: string;
    descVi: string;
    descEn: string;
  }> = [
    {
      view: 'library',
      icon: <Library className="w-5 h-5 text-[#4f46e5]" />,
      accent: 'bg-[#eceefe]',
      titleVi: 'Thư Viện & Nhập Bản Nhạc',
      titleEn: 'Library & Batch Import',
      descVi: 'Nhập hàng loạt file MIDI, MusicXML hoặc PDF offline. Tự nhận diện Gam & số ô nhịp.',
      descEn: 'Import multiple MIDI, MusicXML, or PDF files offline with automatic Key detection.',
    },
    {
      view: 'arrange',
      icon: <Sparkles className="w-5 h-5 text-[#7c3aed]" />,
      accent: 'bg-violet-500/15',
      titleVi: 'Đệm Hát Studio (11 Style)',
      titleEn: 'Accompaniment Arranger',
      descVi: 'Tự tách hợp âm từ MIDI hoặc dán [Am]Lời bài hát..., chọn Ballad, Pop, Jazz, Bolero, Waltz, Chạy Gam.',
      descEn: 'Auto-chord MIDI or paste [Chord]Lyrics across 11 styles: Ballad, Pop, Jazz, Bolero, Waltz, Scales.',
    },
    {
      view: 'theory',
      icon: <BookOpen className="w-5 h-5 text-[#2f9e6c]" />,
      accent: 'bg-[#e1f4ea]',
      titleVi: 'Học Viện Lý Thuyết Đệm Hát',
      titleEn: 'Music Theory & Jazz Academy',
      descVi: 'Bàn phím 2 quãng tám phát tiếng thật, 12 tông × 8 âm giai, Jazz Voicings, 8 sơ đồ phách & Luyện tai.',
      descEn: 'Interactive sounding piano, 12 keys × 8 scales, T–PD–D harmony, Jazz voicings & Ear Trainer.',
    },
    {
      view: 'quiz',
      icon: <GraduationCap className="w-5 h-5 text-[#c0822a]" />,
      accent: 'bg-[#faefdb]',
      titleVi: 'Luyện Đọc & Nghe Nốt',
      titleEn: 'Song-Context Note Quiz',
      descVi: 'Trích nốt trực tiếp từ các ô nhịp của bài đang tập để luyện đọc nốt và phản xạ tai nghe.',
      descEn: 'Practice note reading and ear recognition directly from any bar range of your current song.',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8f6f1] px-4 sm:px-6 py-5 pb-28 lg:pb-10">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* MuseKey Editorial Dark Hero */}
        <div className="staff-hero rounded-[1.75rem] p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-teal-200">
              <Compass className="w-3.5 h-3.5" />
              {isVi ? 'Piano Waterfall Studio · 100% Offline' : 'Piano Waterfall Studio · 100% Offline'}
            </div>

            <h1 className="display-serif text-3xl sm:text-5xl font-semibold leading-tight">
              {isVi ? (
                <>
                  Tập Piano & Đệm Hát từ{' '}
                  <span className="bg-gradient-to-r from-[#a5b4ff] via-[#c4b5fd] to-[#5eead4] bg-clip-text text-transparent">
                    những bản nhạc bạn yêu thích
                  </span>
                </>
              ) : (
                <>
                  Learn Piano & Chords from{' '}
                  <span className="bg-gradient-to-r from-[#a5b4ff] via-[#c4b5fd] to-[#5eead4] bg-clip-text text-transparent">
                    the music you love
                  </span>
                </>
              )}
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {isVi
                ? 'Chọn một bài trong thư viện để tập ngay với phím rơi 60fps, lộ trình 4 ô nhịp, hoặc mở Đệm Hát Studio & Lý Thuyết Nhạc Lý.'
                : 'Pick a song to practice with 60fps falling notes, 4-bar Practice Path, Accompaniment Arranger, and interactive Music Theory.'}
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('player')}
                className="px-5 py-2.5 rounded-full text-sm font-bold text-white inline-flex items-center gap-2 shadow-lg transition hover:opacity-95"
                style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
              >
                <Play className="w-4 h-4 fill-current" />
                {isVi ? `Tiếp tục tập: ${currentSong.title}` : `Continue: ${currentSong.title}`}
              </button>

              <button
                type="button"
                onClick={() => onNavigate('library')}
                className="px-5 py-2.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white text-sm font-semibold inline-flex items-center gap-2 transition"
              >
                <Upload className="w-4 h-4" />
                {isVi ? 'Nhập file MIDI / PDF' : 'Import MIDI / PDF'}
              </button>
            </div>
          </div>
        </div>

        {/* 4 Clear Navigation Cards */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="display-serif text-xl font-semibold text-[#14151c]">
              {isVi ? 'Bạn muốn bắt đầu từ đâu?' : 'Where would you like to start?'}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {quickCards.map((card) => (
              <button
                key={card.view}
                type="button"
                onClick={() => onNavigate(card.view)}
                className="paper-card rounded-2xl p-4 text-left flex items-start gap-3.5 hover:border-[#4f46e5]/50 transition group"
              >
                <div className={`w-11 h-11 rounded-xl ${card.accent} flex items-center justify-center shrink-0`}>
                  {card.icon}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-sm text-[#14151c] group-hover:text-[#4f46e5] transition">
                      {isVi ? card.titleVi : card.titleEn}
                    </h3>
                    <ArrowRight className="w-4 h-4 text-[#888d9c] group-hover:text-[#4f46e5] group-hover:translate-x-0.5 transition shrink-0" />
                  </div>
                  <p className="text-xs text-[#4a4f5e] leading-relaxed">
                    {isVi ? card.descVi : card.descEn}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Play Recent Songs */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="display-serif text-xl font-semibold text-[#14151c]">
              {isVi ? 'Bản nhạc sẵn có để tập ngay' : 'Ready to practice'}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('library')}
              className="text-xs font-semibold text-[#4f46e5] hover:underline inline-flex items-center gap-1"
            >
              {isVi ? `Xem tất cả (${songs.length})` : `View all (${songs.length})`}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {songs.slice(0, 4).map((s) => {
              const keyInfo = s.detectedKey ?? analyzeSongHarmony(s).key;
              return (
                <div
                  key={s.id}
                  className="paper-card rounded-2xl p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-[#14151c] truncate">{s.title}</div>
                    <div className="text-[11px] text-[#4a4f5e] mt-0.5">
                      {keyInfo.label} · {s.measures.length} {isVi ? 'ô nhịp' : 'bars'} ·{' '}
                      <span className="font-mono">{Math.round(s.defaultBpm)} BPM</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onArrangeSong(s)}
                      className="px-2.5 py-1.5 rounded-full bg-[#eceefe] hover:bg-[#dfe2fd] text-[#4f46e5] text-xs font-semibold"
                    >
                      {isVi ? 'Đệm' : 'Chords'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectSong(s)}
                      className="px-3.5 py-1.5 rounded-full bg-[#14151c] hover:bg-[#2a2d3d] text-white text-xs font-semibold inline-flex items-center gap-1"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      {isVi ? 'Tập' : 'Play'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3-Step Workflow Strip */}
        <div className="paper-card rounded-2xl p-4 sm:p-5">
          <h2 className="display-serif text-lg font-semibold text-[#14151c] mb-3">
            {isVi ? 'Quy trình tập nhanh trong 3 bước' : 'Get started in 3 simple steps'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl bg-[#f8f6f1] border border-[#e7e3d9] p-3 space-y-1">
              <div className="font-bold text-[#4f46e5]">01 · {isVi ? 'Chọn hoặc Nhập bài' : 'Import or Pick a Song'}</div>
              <p className="text-[#4a4f5e] leading-relaxed">
                {isVi
                  ? 'Tải hàng loạt file MIDI / MusicXML / PDF hoặc chọn bài mẫu có sẵn trong Thư viện.'
                  : 'Upload MIDI, MusicXML, or PDF scores in batch, or open a built-in piece.'}
              </p>
            </div>
            <div className="rounded-xl bg-[#f8f6f1] border border-[#e7e3d9] p-3 space-y-1">
              <div className="font-bold text-[#4f46e5]">02 · {isVi ? 'Chia nhỏ 4 ô nhịp / Đệm hát' : 'Use 4-Bar Path or Arranger'}</div>
              <p className="text-[#4a4f5e] leading-relaxed">
                {isVi
                  ? 'Mở Lộ trình 4 ô nhịp để tập chậm từng tay, hoặc sang Đệm Hát Studio để tập rải Ballad, Jazz, Bolero.'
                  : 'Open the 4-bar Practice Path for slow hand-by-hand steps, or switch to Accompaniment Studio.'}
              </p>
            </div>
            <div className="rounded-xl bg-[#f8f6f1] border border-[#e7e3d9] p-3 space-y-1">
              <div className="font-bold text-[#4f46e5]">03 · {isVi ? 'Chơi cùng MIDI & Máy đếm nhịp' : 'Play with MIDI & Metronome'}</div>
              <p className="text-[#4a4f5e] leading-relaxed">
                {isVi
                  ? 'Bật chế độ Wait (MIDI) để đàn chờ đúng phím, đổi tông nhanh theo giọng hát, nhạc chạy liên tục kể cả khi đổi tab.'
                  : 'Enable MIDI Wait mode, transpose to your vocal range, and toggle the built-in Metronome (M).'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
