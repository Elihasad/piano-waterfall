import React, { useRef, useState } from 'react';
import { Upload, Music, Trash2, X, FileText, Loader2, AlertCircle, Settings } from 'lucide-react';
import { convertPdfWithProgress, type OmrProgress } from '../core/omrClient';
import { parseMusicXml, parseSongFile } from '../core/parsers';
import type { Song } from '../core/types';

interface LibraryModalProps {
  songs: Song[];
  currentSongId: string;
  omrServerUrl: string;
  onSelectSong: (song: Song) => void;
  onImportSong: (song: Song) => Promise<void>;
  onDeleteSong: (id: string) => Promise<void>;
  onOpenSettings: () => void;
  onClose: () => void;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({
  songs,
  currentSongId,
  omrServerUrl,
  onSelectSong,
  onImportSong,
  onDeleteSong,
  onOpenSettings,
  onClose,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [omrProgress, setOmrProgress] = useState<OmrProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setBusy(true);
    try {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const controller = new AbortController();
        abortRef.current = controller;
        setOmrProgress({ status: 'queued', currentPage: 0, totalPages: 0 });
        const xmlText = await convertPdfWithProgress(
          omrServerUrl,
          file,
          (p) => setOmrProgress(p),
          controller.signal,
        );
        const song = parseMusicXml(xmlText, file.name, 'pdf');
        await onImportSong(song);
        onSelectSong(song);
        onClose();
      } else {
        const song = await parseSongFile(file);
        await onImportSong(song);
        onSelectSong(song);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể nhập bản nhạc.');
    } finally {
      abortRef.current = null;
      setOmrProgress(null);
      setBusy(false);
    }
  };

  const handleCancelPdf = () => {
    abortRef.current?.abort();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3">
      <div className="w-full max-w-lg max-h-[88vh] flex flex-col rounded-2xl bg-[#1a1b22] border border-[#2c2e3b] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2c2e3b]">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-violet-400" />
            <h2 className="text-sm font-bold text-slate-100">Thư viện bản nhạc (Offline)</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thư viện"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#242632] text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Upload Zone */}
        <div className="p-3 border-b border-[#2c2e3b] space-y-2">
          <label className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl border-2 border-dashed border-violet-500/50 bg-violet-950/20 hover:bg-violet-950/35 cursor-pointer transition">
            <Upload className="w-4 h-4 text-violet-300" />
            <span className="text-xs font-semibold text-violet-200">
              Tải bản nhạc lên (.musicxml, .xml, .mxl, .mid, .pdf)
            </span>
            <input
              type="file"
              aria-label="Tải bản nhạc lên"
              accept=".musicxml,.xml,.mxl,.mid,.midi,.pdf,*/*"
              disabled={busy}
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {omrProgress && (
            <div className="rounded-xl bg-[#121216] border border-[#2c2e3b] p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-cyan-300">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {omrProgress.totalPages > 0
                    ? `Đang nhận diện PDF: trang ${omrProgress.currentPage}/${omrProgress.totalPages}...`
                    : 'Đang gửi file PDF lên máy chủ OMR...'}
                </span>
                <button
                  type="button"
                  onClick={handleCancelPdf}
                  className="text-rose-400 hover:underline font-semibold"
                >
                  Hủy
                </button>
              </div>
              {omrProgress.totalPages > 0 && (
                <div className="w-full h-1.5 bg-[#242632] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all"
                    style={{
                      width: `${Math.min(100, Math.round((omrProgress.currentPage / omrProgress.totalPages) * 100))}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-rose-950/40 border border-rose-500/40 p-2.5 text-xs text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="space-y-1 flex-1">
                <p>{error}</p>
                {error.includes('OMR') && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSettings();
                    }}
                    className="inline-flex items-center gap-1 text-cyan-300 underline font-semibold"
                  >
                    <Settings className="w-3 h-3" /> Mở Cài đặt OMR
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Song List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {songs.map((s) => {
            const active = s.id === currentSongId;
            return (
              <div
                key={s.id}
                className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 border transition ${
                  active
                    ? 'bg-violet-600/20 border-violet-500/60'
                    : 'bg-[#14151c] border-[#262836] hover:bg-[#1e202b]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectSong(s);
                    onClose();
                  }}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="text-xs font-bold text-slate-100 truncate">{s.title}</div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                    <span className="uppercase px-1.5 py-0.5 rounded bg-[#242632] text-[10px] font-semibold text-cyan-300 flex items-center gap-1">
                      <FileText className="w-2.5 h-2.5" />
                      {s.sourceFormat}
                    </span>
                    <span>{s.measures.length} ô nhịp</span>
                    <span>{s.defaultBpm} BPM</span>
                  </div>
                </button>
                {songs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void onDeleteSong(s.id)}
                    aria-label={`Xóa ${s.title}`}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-950/50 text-slate-400 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
