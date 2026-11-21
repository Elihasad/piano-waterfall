import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  FileText,
  Loader2,
  Music,
  Play,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { analyzeSongHarmony } from '../core/accompaniment/harmonyAnalyzer';
import { t } from '../core/i18n';
import { parseSongFile } from '../core/parsers';
import { parsePdfOffline } from '../core/parsers/pdfOfflineOmr';
import type { Language, Song, SourceFormat } from '../core/types';

interface LibraryViewProps {
  language: Language;
  songs: Song[];
  currentSongId: string;
  onSelectSong: (song: Song) => void;
  onArrangeSong: (song: Song) => void;
  onImportSong: (song: Song) => Promise<void>;
  onDeleteSong: (id: string) => Promise<void>;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  language,
  songs,
  currentSongId,
  onSelectSong,
  onArrangeSong,
  onImportSong,
  onDeleteSong,
}) => {
  const isVi = language === 'vi';
  const [query, setQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<'all' | SourceFormat>('all');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{
    fileIndex: number;
    totalFiles: number;
    fileName: string;
    currentPage?: number;
    totalPages?: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    setError(null);
    setSuccessMsg(null);
    setBusy(true);

    const importedSongs: Song[] = [];
    const failedMessages: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setImportStatus({
          fileIndex: i + 1,
          totalFiles: files.length,
          fileName: file.name,
        });
        try {
          let song: Song;
          if (file.name.toLowerCase().endsWith('.pdf')) {
            song = await parsePdfOffline(file, (p) =>
              setImportStatus({
                fileIndex: i + 1,
                totalFiles: files.length,
                fileName: file.name,
                currentPage: p.currentPage,
                totalPages: p.totalPages,
              }),
            );
          } else {
            song = await parseSongFile(file);
          }
          await onImportSong(song);
          importedSongs.push(song);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to import.';
          if (msg.includes('dynamically imported module')) {
            failedMessages.push(
              `${file.name}: A new version was deployed. Please refresh (F5) and try again.`,
            );
          } else {
            failedMessages.push(`${file.name}: ${msg}`);
          }
        }
      }

      if (importedSongs.length === 1 && files.length === 1) {
        onSelectSong(importedSongs[0]);
      } else if (importedSongs.length > 0) {
        setSuccessMsg(
          isVi
            ? `Đã nhập thành công ${importedSongs.length}/${files.length} bản nhạc vào thư viện!`
            : `Successfully imported ${importedSongs.length} of ${files.length} scores!`,
        );
      }
      if (failedMessages.length > 0) {
        setError(failedMessages.join(' · '));
      }
    } finally {
      setImportStatus(null);
      setBusy(false);
    }
  };

  const filteredSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return songs.filter((s) => {
      if (formatFilter !== 'all' && s.sourceFormat !== formatFilter) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.composer.toLowerCase().includes(q)
      );
    });
  }, [songs, query, formatFilter]);

  const totalBars = useMemo(
    () => songs.reduce((sum, s) => sum + s.measures.length, 0),
    [songs],
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8f6f1] px-4 sm:px-6 py-5 pb-24 md:pb-8">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* MuseKey-style Dark Staff-Lined Hero Banner */}
        <div className="staff-hero rounded-[1.75rem] p-5 sm:p-7 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-teal-200/90">
                {isVi ? 'Phòng nhạc cá nhân · 100% Offline' : 'Personal Studio · 100% Offline'}
              </div>
              <h1 className="display-serif text-3xl sm:text-4xl font-semibold tracking-tight">
                {isVi ? 'Thư viện bản nhạc' : 'Your library'}
              </h1>
              <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
                {isVi
                  ? 'Mở file MIDI, MusicXML hoặc PDF để tập nốt rơi 60fps, tự nhận diện Gam & Hợp âm, hoặc chuyển sang Đệm Hát Studio.'
                  : 'Open any MIDI, MusicXML, or PDF score to practice with 60fps falling notes, automatic Key/Chord detection, and Accompaniment Studio.'}
              </p>
            </div>

            <label className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#f0ece3] hover:bg-[#e5e0d5] text-[#14151c] font-semibold text-sm cursor-pointer shadow-md transition shrink-0">
              <Upload className="w-4 h-4 text-[#4f46e5]" />
              <span>{isVi ? 'Nhập nhiều bản nhạc' : 'Import scores'}</span>
              <input
                type="file"
                multiple
                aria-label={t(language, 'uploadLabel')}
                accept=".musicxml,.xml,.mxl,.mid,.midi,.pdf,*/*"
                disabled={busy}
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* 3 Glass KPI Tiles */}
          <div className="grid grid-cols-3 gap-2.5 mt-5 max-w-md">
            <div className="rounded-2xl bg-white/10 border border-white/15 px-3 py-2 backdrop-blur-sm">
              <div className="display-serif text-xl font-semibold">{songs.length}</div>
              <div className="text-[11px] text-slate-300">{isVi ? 'Bản nhạc' : 'Songs'}</div>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/15 px-3 py-2 backdrop-blur-sm">
              <div className="display-serif text-xl font-semibold">{totalBars}</div>
              <div className="text-[11px] text-slate-300">{isVi ? 'Ô nhịp' : 'Measures'}</div>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/15 px-3 py-2 backdrop-blur-sm">
              <div className="display-serif text-xl font-semibold">11</div>
              <div className="text-[11px] text-slate-300">{isVi ? 'Style Đệm' : 'Styles'}</div>
            </div>
          </div>
        </div>

        {/* Progress / Success / Error banners */}
        {importStatus && (
          <div className="paper-card rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#4f46e5]">
              <span className="flex items-center gap-2 truncate">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span className="truncate">
                  {isVi ? 'Đang nhập' : 'Importing'} {importStatus.fileIndex}/{importStatus.totalFiles}:{' '}
                  {importStatus.fileName}
                  {importStatus.totalPages
                    ? ` (${t(language, 'pdfPageProgress')} ${importStatus.currentPage}/${importStatus.totalPages})`
                    : ''}
                </span>
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#d6d0c4] overflow-hidden">
              <div
                className="h-full bg-[#4f46e5] transition-all"
                style={{
                  width: `${Math.min(100, Math.round((importStatus.fileIndex / Math.max(1, importStatus.totalFiles)) * 100))}%`,
                }}
              />
            </div>
          </div>
        )}

        {successMsg && (
          <div className="rounded-2xl bg-[#e1f4ea] border border-[#2f9e6c]/40 p-3 text-xs font-semibold text-[#1e6f4a]">
            ✓ {successMsg}
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-[#fbe6e7] border border-[#d4545a]/40 p-3 text-xs text-[#9b232a] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Search & Filter Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#888d9c] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isVi ? 'Tìm tên bài hát hoặc tác giả...' : 'Search title or composer...'}
              className="w-full pl-9 pr-4 py-2 rounded-full bg-white border border-[#e7e3d9] text-sm text-[#14151c] placeholder:text-[#888d9c] focus:outline-none focus:border-[#4f46e5]"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[#edeae2] p-1 rounded-full self-start">
            {(['all', 'midi', 'musicxml', 'pdf'] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setFormatFilter(fmt)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  formatFilter === fmt
                    ? 'bg-white text-[#14151c] shadow-sm'
                    : 'text-[#4a4f5e] hover:text-[#14151c]'
                }`}
              >
                {fmt === 'all' ? (isVi ? 'Tất cả' : 'All') : fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Song Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredSongs.map((s) => {
            const active = s.id === currentSongId;
            const keyInfo = s.detectedKey ?? analyzeSongHarmony(s).key;
            return (
              <div
                key={s.id}
                className={`paper-card rounded-2xl p-4 flex flex-col justify-between gap-3 transition ${
                  active ? 'ring-2 ring-[#4f46e5]' : 'hover:border-[#cfc9bb]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#eceefe] text-[#4f46e5] text-[10px] font-bold uppercase">
                        <FileText className="w-3 h-3" />
                        {s.sourceFormat}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#f3f0e8] text-[#4a4f5e] text-[10px] font-semibold">
                        {keyInfo.label}
                      </span>
                    </div>
                    <h3 className="font-bold text-base text-[#14151c] truncate mt-1.5">
                      {s.title}
                    </h3>
                    <div className="text-xs text-[#4a4f5e] mt-0.5 flex items-center gap-2">
                      <span>{s.measures.length} {isVi ? 'ô nhịp' : 'bars'}</span>
                      <span>·</span>
                      <span className="font-mono">{Math.round(s.defaultBpm)} BPM</span>
                      <span>·</span>
                      <span>{s.notes.length} {isVi ? 'nốt' : 'notes'}</span>
                    </div>
                  </div>

                  {songs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => void onDeleteSong(s.id)}
                      aria-label={`Delete ${s.title}`}
                      className="p-1.5 rounded-lg text-[#888d9c] hover:text-[#d4545a] hover:bg-[#fbe6e7]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#f0ede6]">
                  <button
                    type="button"
                    onClick={() => onArrangeSong(s)}
                    className="px-3 py-1.5 rounded-full bg-[#eceefe] hover:bg-[#dfe2fd] text-[#4f46e5] text-xs font-semibold inline-flex items-center gap-1.5 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isVi ? 'Đệm Hát' : 'Arrange'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectSong(s)}
                    className="px-4 py-1.5 rounded-full bg-[#14151c] hover:bg-[#2a2d3d] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {isVi ? 'Tập ngay' : 'Practice'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredSongs.length === 0 && (
          <div className="paper-card rounded-2xl p-8 text-center space-y-2">
            <Music className="w-8 h-8 text-[#888d9c] mx-auto" />
            <div className="font-semibold text-sm text-[#14151c]">
              {isVi ? 'Không tìm thấy bản nhạc phù hợp' : 'No matching scores found'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
