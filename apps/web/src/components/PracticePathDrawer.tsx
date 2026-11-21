import React, { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Compass, Play, RotateCcw, X } from 'lucide-react';
import type { HandControlState, Language, PracticeMode, Song } from '../core/types';

export interface PracticeStepConfig {
  startMeasure: number;
  endMeasure: number;
  speedRatio: number;
  hands: HandControlState;
  practiceMode: PracticeMode;
  loopEnabled: boolean;
}

interface PracticePathDrawerProps {
  language: Language;
  song: Song;
  onApplyStep: (cfg: PracticeStepConfig) => void;
  onClose: () => void;
}

interface StepDef {
  key: string;
  labelVi: string;
  labelEn: string;
  badge: string;
  speedRatio: number;
  practiceMode: PracticeMode;
  hands: HandControlState;
}

const SECTION_STEPS: ReadonlyArray<StepDef> = [
  {
    key: 'listen',
    labelVi: 'Nghe mẫu trước',
    labelEn: 'Listen first',
    badge: '100%',
    speedRatio: 1.0,
    practiceMode: 'listen',
    hands: { left: { audio: true, visual: true }, right: { audio: true, visual: true } },
  },
  {
    key: 'rh-slow',
    labelVi: 'Tay phải chậm',
    labelEn: 'Right hand, slowly',
    badge: '70%',
    speedRatio: 0.7,
    practiceMode: 'wait',
    hands: { left: { audio: false, visual: false }, right: { audio: true, visual: true } },
  },
  {
    key: 'lh-slow',
    labelVi: 'Tay trái chậm',
    labelEn: 'Left hand, slowly',
    badge: '70%',
    speedRatio: 0.7,
    practiceMode: 'wait',
    hands: { left: { audio: true, visual: true }, right: { audio: false, visual: false } },
  },
  {
    key: 'both-slow',
    labelVi: 'Ghép 2 tay chậm',
    labelEn: 'Both hands, slowly',
    badge: '85%',
    speedRatio: 0.85,
    practiceMode: 'wait',
    hands: { left: { audio: true, visual: true }, right: { audio: true, visual: true } },
  },
  {
    key: 'both-full',
    labelVi: '2 tay tốc độ chuẩn',
    labelEn: 'Both hands, full speed',
    badge: '100%',
    speedRatio: 1.0,
    practiceMode: 'listen',
    hands: { left: { audio: true, visual: true }, right: { audio: true, visual: true } },
  },
];

export const PracticePathDrawer: React.FC<PracticePathDrawerProps> = ({
  language,
  song,
  onApplyStep,
  onClose,
}) => {
  const isVi = language === 'vi';
  const totalMeasures = Math.max(1, song.measures.length);

  const sections = useMemo(() => {
    const out: Array<{ index: number; start: number; end: number }> = [];
    for (let start = 1; start <= totalMeasures; start += 4) {
      out.push({
        index: out.length + 1,
        start,
        end: Math.min(totalMeasures, start + 3),
      });
    }
    return out;
  }, [totalMeasures]);

  const storageKey = `pw-path-${song.id}`;
  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [activeStepId, setActiveStepId] = useState<string | null>(null);

  const totalSteps = sections.length * SECTION_STEPS.length + 1;
  const pct = Math.min(100, Math.round((completedIds.length / Math.max(1, totalSteps)) * 100));

  const toggleDone = (id: string) => {
    setCompletedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  const resetPath = () => {
    setCompletedIds([]);
    setActiveStepId(null);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-[1px]">
      <div className="w-[min(23.5rem,100vw)] h-full bg-[#f8f6f1] text-[#14151c] shadow-2xl flex flex-col border-l border-[#e7e3d9]">
        {/* Teal-to-Indigo MuseKey Header */}
        <div
          className="px-4 py-4 text-white space-y-2.5 shrink-0"
          style={{ background: 'linear-gradient(135deg, #0f766e 0%, #4338ca 100%)' }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-teal-100/90 font-semibold flex items-center gap-1">
                <Compass className="w-3.5 h-3.5" />
                {isVi ? 'Lộ trình tập 4 ô nhịp' : '4-Bar Practice Path'}
              </div>
              <h2 className="display-serif text-lg font-semibold leading-tight mt-0.5 truncate max-w-[260px]">
                {song.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-white/90">
              <span>
                {completedIds.length} / {totalSteps} {isVi ? 'bước hoàn thành' : 'steps completed'}
              </span>
              <span className="font-mono font-bold">{pct}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full bg-emerald-300 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Section List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {sections.map((sec) => (
            <div key={sec.index} className="paper-card rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-bold text-xs text-[#14151c]">
                  {isVi ? `Đoạn ${sec.index}` : `Section ${sec.index}`}{' '}
                  <span className="font-normal text-[#4a4f5e]">
                    ({isVi ? `ô nhịp ${sec.start}–${sec.end}` : `bars ${sec.start}–${sec.end}`})
                  </span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#eceefe] text-[#4f46e5] font-semibold">
                  {sec.end - sec.start + 1} {isVi ? 'ô' : 'bars'}
                </span>
              </div>

              <div className="space-y-1">
                {SECTION_STEPS.map((st) => {
                  const id = `s${sec.index}-${st.key}`;
                  const done = completedIds.includes(id);
                  const active = activeStepId === id;
                  return (
                    <div
                      key={id}
                      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border transition ${
                        active
                          ? 'bg-[#eceefe] border-[#4f46e5]/50'
                          : 'bg-[#faf8f4] border-[#e7e3d9] hover:border-[#c8c3b6]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleDone(id)}
                        className="shrink-0 text-[#4f46e5]"
                        aria-label="Toggle step done"
                      >
                        {done ? (
                          <CheckCircle2 className="w-4 h-4 text-[#2f9e6c]" />
                        ) : (
                          <Circle className="w-4 h-4 text-[#888d9c]" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveStepId(id);
                          onApplyStep({
                            startMeasure: sec.start,
                            endMeasure: sec.end,
                            speedRatio: st.speedRatio,
                            hands: st.hands,
                            practiceMode: st.practiceMode,
                            loopEnabled: true,
                          });
                        }}
                        className="flex-1 text-left flex items-center justify-between gap-1 text-xs"
                      >
                        <span className={done ? 'line-through text-[#888d9c]' : 'font-medium text-[#14151c]'}>
                          {isVi ? st.labelVi : st.labelEn}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#4a4f5e]">
                          <span>{st.badge}</span>
                          <Play className="w-3 h-3 text-[#4f46e5]" />
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Whole Song Final Run */}
          <div className="paper-card rounded-2xl p-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleDone('whole-song')}
                aria-label="Toggle whole song complete"
              >
                {completedIds.includes('whole-song') ? (
                  <CheckCircle2 className="w-4 h-4 text-[#2f9e6c]" />
                ) : (
                  <Circle className="w-4 h-4 text-[#888d9c]" />
                )}
              </button>
              <div>
                <div className="font-bold text-xs text-[#14151c]">
                  {isVi ? 'Chạy trọn bài (100%)' : 'The whole song (100%)'}
                </div>
                <div className="text-[11px] text-[#4a4f5e]">
                  {isVi ? `Tất cả ${totalMeasures} ô nhịp, 2 tay` : `All ${totalMeasures} bars, both hands`}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveStepId('whole-song');
                onApplyStep({
                  startMeasure: 1,
                  endMeasure: totalMeasures,
                  speedRatio: 1.0,
                  hands: {
                    left: { audio: true, visual: true },
                    right: { audio: true, visual: true },
                  },
                  practiceMode: 'listen',
                  loopEnabled: false,
                });
              }}
              className="px-3 py-1.5 rounded-full bg-[#14151c] hover:bg-[#2a2d3d] text-white text-xs font-semibold inline-flex items-center gap-1"
            >
              <Play className="w-3 h-3" />
              {isVi ? 'Chạy' : 'Run'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#e7e3d9] bg-white flex items-center justify-between">
          <button
            type="button"
            onClick={resetPath}
            className="text-xs font-semibold text-[#4a4f5e] hover:text-[#14151c] inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {isVi ? 'Tập lại từ đầu' : 'Start path again'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-full bg-[#14151c] text-white text-xs font-semibold"
          >
            {isVi ? 'Đóng' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
