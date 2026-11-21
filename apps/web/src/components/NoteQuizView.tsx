import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  Flame,
  GraduationCap,
  SkipForward,
  Volume2,
  XCircle,
} from 'lucide-react';
import type { NotePlayer } from '../audio/pianoSynth';
import { formatPitchClass, mod12 } from '../core/accompaniment/harmonyAnalyzer';
import type { Language, Song } from '../core/types';

interface NoteQuizViewProps {
  language: Language;
  song: Song;
  player: NotePlayer;
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const LETTER_TO_PC: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export const NoteQuizView: React.FC<NoteQuizViewProps> = ({ language, song, player }) => {
  const isVi = language === 'vi';
  const totalBars = Math.max(1, song.measures.length);
  const [fromBar, setFromBar] = useState(1);
  const [toBar, setToBar] = useState(Math.min(4, totalBars));
  const [accidental, setAccidental] = useState<-1 | 0 | 1>(0);
  const [noteIdx, setNoteIdx] = useState(0);
  const [rightCount, setRightCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [lastResult, setLastResult] = useState<'right' | 'wrong' | null>(null);

  const quizNotes = useMemo(() => {
    const filtered = song.notes.filter(
      (n) => n.measureNumber >= fromBar && n.measureNumber <= toBar,
    );
    return filtered.length > 0 ? filtered.slice(0, 40) : song.notes.slice(0, 24);
  }, [song.notes, fromBar, toBar]);

  const currentNote = quizNotes[noteIdx % Math.max(1, quizNotes.length)];
  const totalAnswered = rightCount + wrongCount;
  const accuracy = totalAnswered > 0 ? Math.round((rightCount / totalAnswered) * 100) : 100;

  const playCurrentNote = () => {
    if (!currentNote) return;
    void player.unlock();
    player.playNote(currentNote.midi, 1.1, 0.85);
  };

  const handleGuess = (letter: string) => {
    if (!currentNote) return;
    const guessedPc = mod12(LETTER_TO_PC[letter] + accidental);
    const targetPc = mod12(currentNote.midi);
    playCurrentNote();

    if (guessedPc === targetPc) {
      setRightCount((c) => c + 1);
      setStreak((s) => s + 1);
      setLastResult('right');
      setRevealed(false);
      setAccidental(0);
      setNoteIdx((i) => (i + 1) % quizNotes.length);
    } else {
      setWrongCount((c) => c + 1);
      setStreak(0);
      setLastResult('wrong');
    }
  };

  const octave = currentNote ? Math.floor(currentNote.midi / 12) - 1 : 4;
  const targetName = currentNote ? `${formatPitchClass(currentNote.midi)}${octave}` : 'C4';

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8f6f1] px-4 sm:px-6 py-5 pb-28 lg:pb-8">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Hero */}
        <div className="theory-hero rounded-[1.75rem] p-5 sm:p-6 text-white shadow-lg flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-teal-100/90 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4" />
              {isVi ? 'Luyện Đọc & Nghe Nốt Trong Ngữ Cảnh Bài Hát' : 'Song-Context Note Reading & Ear Quiz'}
            </div>
            <h1 className="display-serif text-2xl sm:text-3xl font-semibold mt-1">
              {song.title}
            </h1>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/80">{isVi ? 'Đoạn ô nhịp:' : 'Bars:'}</span>
            <input
              type="number"
              min={1}
              max={totalBars}
              value={fromBar}
              onChange={(e) => {
                const v = Math.max(1, Math.min(totalBars, Number(e.target.value) || 1));
                setFromBar(v);
                if (v > toBar) setToBar(v);
                setNoteIdx(0);
              }}
              className="w-14 px-2 py-1 rounded-lg bg-white/15 border border-white/25 text-white font-mono text-center"
            />
            <span>–</span>
            <input
              type="number"
              min={fromBar}
              max={totalBars}
              value={toBar}
              onChange={(e) => {
                const v = Math.max(fromBar, Math.min(totalBars, Number(e.target.value) || fromBar));
                setToBar(v);
                setNoteIdx(0);
              }}
              className="w-14 px-2 py-1 rounded-lg bg-white/15 border border-white/25 text-white font-mono text-center"
            />
          </div>
        </div>

        {/* 4 Status Pills (MuseKey Style) */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="px-3 py-1 rounded-full bg-[#e1f4ea] text-[#2f9e6c] inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {rightCount} {isVi ? 'đúng' : 'right'}
          </span>
          <span className="px-3 py-1 rounded-full bg-[#fbe6e7] text-[#d4545a] inline-flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" />
            {wrongCount} {isVi ? 'sai' : 'mistakes'}
          </span>
          <span className="px-3 py-1 rounded-full bg-[#eceefe] text-[#4f46e5]">
            {accuracy}% {isVi ? 'chính xác' : 'accuracy'}
          </span>
          <span className="px-3 py-1 rounded-full bg-[#faefdb] text-[#c0822a] inline-flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" />
            {streak} {isVi ? 'chuỗi' : 'streak'}
          </span>
        </div>

        {/* Main Quiz Card */}
        {currentNote && (
          <div className="paper-card rounded-2xl p-6 text-center space-y-5">
            <div className="text-xs text-[#4a4f5e] font-medium">
              {isVi
                ? `Nốt ${noteIdx + 1} / ${quizNotes.length} · Ô nhịp ${currentNote.measureNumber} · ${
                    currentNote.hand === 'left' ? 'Tay trái (Bass)' : 'Tay phải (Treble)'
                  }`
                : `Note ${noteIdx + 1} of ${quizNotes.length} · Measure ${currentNote.measureNumber} · ${
                    currentNote.hand === 'left' ? 'Left hand' : 'Right hand'
                  }`}
            </div>

            <div className="py-4">
              <div className="display-serif text-4xl font-bold text-[#14151c]">
                {revealed ? targetName : `MIDI #${currentNote.midi}`}
              </div>
              <p className="text-xs text-[#4a4f5e] mt-1.5">
                {isVi
                  ? 'Bấm "Nghe nốt" để đoán tên nốt (hoặc tập nhận diện cao độ theo quãng tám)'
                  : 'Click "Hear it" and pick the matching note name below'}
              </p>
            </div>

            {/* Accidental Toggle */}
            <div className="flex items-center justify-center gap-2">
              {([
                { val: -1 as const, label: '♭ Giáng' },
                { val: 0 as const, label: '♮ Thường' },
                { val: 1 as const, label: '♯ Thăng' },
              ]).map((a) => (
                <button
                  key={a.val}
                  type="button"
                  onClick={() => setAccidental(a.val)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition ${
                    accidental === a.val
                      ? 'bg-[#4f46e5] border-[#4f46e5] text-white'
                      : 'bg-[#faf8f4] border-[#e7e3d9] text-[#4a4f5e]'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>

            {/* 7 Big Note Buttons */}
            <div className="grid grid-cols-7 gap-2 max-w-lg mx-auto">
              {LETTERS.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  onClick={() => handleGuess(letter)}
                  className="py-3.5 rounded-xl bg-white hover:bg-[#eceefe] border-2 border-[#e7e3d9] hover:border-[#4f46e5] font-bold text-base text-[#14151c] transition shadow-sm"
                >
                  {letter}
                  {accidental === 1 ? '♯' : accidental === -1 ? '♭' : ''}
                </button>
              ))}
            </div>

            {lastResult === 'wrong' && (
              <div className="text-xs font-semibold text-[#d4545a]">
                {isVi ? 'Chưa đúng — nghe lại và thử nốt khác nhé!' : 'Not quite — hear it again and try another note!'}
              </div>
            )}

            {/* Utility Controls */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-[#f0ede6]">
              <button
                type="button"
                onClick={playCurrentNote}
                className="px-4 py-2 rounded-full bg-[#14151c] hover:bg-[#2a2d3d] text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Volume2 className="w-3.5 h-3.5" />
                {isVi ? 'Nghe nốt' : 'Hear it'}
              </button>
              <button
                type="button"
                onClick={() => setRevealed((r) => !r)}
                className="px-3.5 py-2 rounded-full bg-[#f3f0e8] hover:bg-[#e7e3d9] text-[#14151c] text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                {isVi ? 'Xem đáp án' : 'Show answer'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRevealed(false);
                  setLastResult(null);
                  setNoteIdx((i) => (i + 1) % quizNotes.length);
                }}
                className="px-3.5 py-2 rounded-full bg-[#f3f0e8] hover:bg-[#e7e3d9] text-[#14151c] text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <SkipForward className="w-3.5 h-3.5" />
                {isVi ? 'Bỏ qua' : 'Skip'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
