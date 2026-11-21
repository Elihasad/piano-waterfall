import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  Globe,
  Loader2,
  Music,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { enrichSongMetadata } from '../core/accompaniment/difficultyClassifier';
import { t } from '../core/i18n';
import { parseSongFile } from '../core/parsers';
import { parsePdfOffline } from '../core/parsers/pdfOfflineOmr';
import type { DifficultyTier, Language, PianoGrade, Song, SourceFormat } from '../core/types';
import {
  loadFullPublicDomainCatalog,
  PUBLIC_DOMAIN_CATALOG,
  type PublicDomainCatalogEntry,
} from '../data/publicDomainCatalog';

interface LibraryViewProps {
  language: Language;
  songs: Song[];
  currentSongId: string;
  onSelectSong: (song: Song) => void;
  onArrangeSong: (song: Song) => void;
  onImportSong: (song: Song) => Promise<void>;
  onDeleteSong: (id: string) => Promise<void>;
}

type SortKey = 'newest' | 'title-asc' | 'grade-asc' | 'grade-desc' | 'bpm-asc' | 'dur-asc';

const PAGE_SIZE = 24;

const ALL_GRADES: PianoGrade[] = [
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Diploma',
];

const DIFF_BADGE: Record<DifficultyTier, { labelVi: string; labelEn: string; cls: string }> = {
  beginner: { labelVi: 'Cơ bản', labelEn: 'Beginner', cls: 'bg-[#e1f4ea] text-[#2f9e6c]' },
  intermediate: { labelVi: 'Trung cấp', labelEn: 'Intermediate', cls: 'bg-[#eceefe] text-[#4f46e5]' },
  advanced: { labelVi: 'Nâng cao', labelEn: 'Advanced', cls: 'bg-[#faefdb] text-[#c0822a]' },
};

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
  const [activeTab, setActiveTab] = useState<'my' | 'catalog'>('my');
  const [query, setQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | DifficultyTier>('all');
  const [gradeFilter, setGradeFilter] = useState<'all' | PianoGrade>('all');
  const [keyFilter, setKeyFilter] = useState<string>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | SourceFormat>('all');
  const [eraFilter, setEraFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [page, setPage] = useState(1);
  const [catalogEntries, setCatalogEntries] = useState<PublicDomainCatalogEntry[]>(() => [
    ...PUBLIC_DOMAIN_CATALOG,
  ]);

  useEffect(() => {
    let active = true;
    void loadFullPublicDomainCatalog().then((full) => {
      if (active && full.length > 0) setCatalogEntries(full);
    });
    return () => {
      active = false;
    };
  }, []);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{
    fileIndex: number;
    totalFiles: number;
    fileName: string;
    currentPage?: number;
    totalPages?: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  // Enrich songs once in memo (instant if metadata already persisted on import!)
  const enrichedSongs = useMemo(() => songs.map(enrichSongMetadata), [songs]);

  const availableKeys = useMemo(() => {
    const set = new Set<string>();
    if (activeTab === 'my') {
      for (const s of enrichedSongs) {
        if (s.detectedKey?.label) set.add(s.detectedKey.label);
      }
    } else {
      for (const c of catalogEntries) set.add(c.keyLabel);
    }
    return Array.from(set).sort();
  }, [activeTab, enrichedSongs, catalogEntries]);

  const availableSources = useMemo(() => {
    const set = new Set<string>();
    for (const c of catalogEntries) {
      if (c.source) set.add(c.source);
    }
    return Array.from(set).sort();
  }, [catalogEntries]);

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
          const enriched = enrichSongMetadata(song);
          await onImportSong(enriched);
          importedSongs.push(enriched);
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
        setActiveTab('my');
        setPage(1);
        setSuccessMsg(
          isVi
            ? `Đã nhập thành công ${importedSongs.length}/${files.length} bản nhạc và tự động phân cấp độ!`
            : `Imported ${importedSongs.length} of ${files.length} scores with automatic grading!`,
        );
      }
      if (failedMessages.length > 0) {
        setError(failedMessages.slice(0, 5).join(' · '));
      }
    } finally {
      setImportStatus(null);
      setBusy(false);
    }
  };

  const handleOpenCatalogEntry = async (entry: PublicDomainCatalogEntry) => {
    const existing = songs.find((s) => s.id === entry.id);
    if (existing) {
      onSelectSong(existing);
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setDownloadingId(entry.id);
    try {
      const res = await fetch(entry.rawUrl);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const file = new File([blob], entry.fileName, {
        type: entry.format === 'mid' ? 'audio/midi' : 'application/vnd.recordare.musicxml',
      });
      const parsed = await parseSongFile(file);
      const song: Song = enrichSongMetadata({
        ...parsed,
        id: entry.id,
        title: entry.title,
        composer: entry.composer,
        difficulty: entry.difficulty,
        grade: entry.grade,
        gradeNum: entry.gradeNum,
      });
      await onImportSong(song);
      onSelectSong(song);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Open failed';
      setError(
        isVi
          ? `Không mở được "${entry.title}" (${msg}).`
          : `Could not open "${entry.title}" (${msg}).`,
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const resetFilters = () => {
    setQuery('');
    setDifficultyFilter('all');
    setGradeFilter('all');
    setKeyFilter('all');
    setFormatFilter('all');
    setEraFilter('all');
    setSourceFilter('all');
    setSortBy('newest');
    setPage(1);
  };

  const hasActiveFilters =
    query.trim() !== '' ||
    difficultyFilter !== 'all' ||
    gradeFilter !== 'all' ||
    keyFilter !== 'all' ||
    formatFilter !== 'all' ||
    eraFilter !== 'all' ||
    sourceFilter !== 'all';

  // Filtered & sorted My Library (fast O(N) for 10,000+ songs!)
  const filteredMySongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = enrichedSongs.filter((s) => {
      if (difficultyFilter !== 'all' && s.difficulty !== difficultyFilter) return false;
      if (gradeFilter !== 'all' && s.grade !== gradeFilter) return false;
      if (formatFilter !== 'all' && s.sourceFormat !== formatFilter) return false;
      if (keyFilter !== 'all' && s.detectedKey?.label !== keyFilter) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.composer.toLowerCase().includes(q) ||
        (s.grade?.toLowerCase().includes(q) ?? false)
      );
    });

    const sorted = [...list];
    if (sortBy === 'title-asc') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortBy === 'grade-asc') sorted.sort((a, b) => (a.gradeNum ?? 1) - (b.gradeNum ?? 1));
    else if (sortBy === 'grade-desc') sorted.sort((a, b) => (b.gradeNum ?? 1) - (a.gradeNum ?? 1));
    else if (sortBy === 'bpm-asc') sorted.sort((a, b) => a.defaultBpm - b.defaultBpm);
    else if (sortBy === 'dur-asc') sorted.sort((a, b) => a.durationSec - b.durationSec);
    else sorted.sort((a, b) => b.createdAt - a.createdAt);
    return sorted;
  }, [enrichedSongs, query, difficultyFilter, gradeFilter, formatFilter, keyFilter, sortBy]);

  // Filtered & sorted Public Domain Catalog (supports 3,190+ deduplicated scores instantly!)
  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = catalogEntries.filter((c) => {
      if (difficultyFilter !== 'all' && c.difficulty !== difficultyFilter) return false;
      if (gradeFilter !== 'all' && c.grade !== gradeFilter) return false;
      if (keyFilter !== 'all' && c.keyLabel !== keyFilter) return false;
      if (eraFilter !== 'all' && c.era !== eraFilter) return false;
      if (sourceFilter !== 'all' && c.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.composer.toLowerCase().includes(q) ||
        c.era.toLowerCase().includes(q) ||
        (c.source?.toLowerCase().includes(q) ?? false)
      );
    });

    const sorted = [...list];
    if (sortBy === 'title-asc') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortBy === 'grade-desc') sorted.sort((a, b) => b.gradeNum - a.gradeNum);
    else sorted.sort((a, b) => a.gradeNum - b.gradeNum);
    return sorted;
  }, [catalogEntries, query, difficultyFilter, gradeFilter, keyFilter, eraFilter, sourceFilter, sortBy]);

  const totalItems = activeTab === 'my' ? filteredMySongs.length : filteredCatalog.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedMySongs = filteredMySongs.slice(pageStart, pageStart + PAGE_SIZE);
  const pagedCatalog = filteredCatalog.slice(pageStart, pageStart + PAGE_SIZE);

  const savedIds = useMemo(() => new Set(songs.map((s) => s.id)), [songs]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8f6f1] px-4 sm:px-6 py-5 pb-24 md:pb-8">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* MuseKey Dark Staff-Lined Hero */}
        <div className="staff-hero rounded-[1.75rem] p-5 sm:p-7 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-teal-200/90">
                {isVi
                  ? 'Thư viện quy mô lớn (hỗ trợ 10.000+ bài) · Tự động phân Grade 1–8'
                  : 'Scalable Library (10,000+ scores) · Auto Grade 1–8 Classification'}
              </div>
              <h1 className="display-serif text-3xl sm:text-4xl font-semibold tracking-tight">
                {isVi ? 'Thư viện & Kho Nhạc Miễn Phí' : 'Library & Free Public Domain'}
              </h1>
              <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
                {isVi
                  ? 'Nhập hàng loạt MIDI / MusicXML / PDF hoặc tải trực tiếp các tác phẩm cổ điển 100% Public Domain đã phân cấp Beginner · Intermediate · Advanced.'
                  : 'Batch-import MIDI, MusicXML, or PDF files, or browse 100% Public Domain classical MusicXML scores graded Beginner to Diploma.'}
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

          {/* Segmented Tab Bar inside Hero */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
            <div className="flex items-center gap-1 bg-black/30 p-1 rounded-full border border-white/15">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('my');
                  setPage(1);
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition ${
                  activeTab === 'my'
                    ? 'bg-white text-[#14151c] shadow-sm'
                    : 'text-white/85 hover:text-white'
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                {isVi ? `Thư viện của tôi (${songs.length})` : `My Library (${songs.length})`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('catalog');
                  setPage(1);
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition ${
                  activeTab === 'catalog'
                    ? 'bg-white text-[#14151c] shadow-sm'
                    : 'text-white/85 hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                {isVi
                  ? `Kho Nhạc Miễn Phí (${catalogEntries.length.toLocaleString()})`
                  : `Public Domain (${catalogEntries.length.toLocaleString()})`}
              </button>
            </div>
          </div>
        </div>

        {/* Progress / Success / Error banners */}
        {importStatus && (
          <div className="paper-card rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#4f46e5]">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span className="truncate">
                {isVi ? 'Đang nhập' : 'Importing'} {importStatus.fileIndex}/{importStatus.totalFiles}:{' '}
                {importStatus.fileName}
                {importStatus.totalPages
                  ? ` (${t(language, 'pdfPageProgress')} ${importStatus.currentPage}/${importStatus.totalPages})`
                  : ''}
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

        {/* Pro Multi-Filter Bar (Built for 10,000+ scores!) */}
        <div className="paper-card rounded-2xl p-3.5 space-y-3">
          {/* Row 1: Search + Difficulty Pills */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#888d9c] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={
                  isVi
                    ? 'Tìm nhanh tên bài, nhạc sĩ, cấp độ (vd: Chopin, Bach, Grade 3)...'
                    : 'Search title, composer, or grade (e.g. Chopin, Bach, Grade 3)...'
                }
                className="w-full pl-9 pr-4 py-2 rounded-full bg-[#f8f6f1] border border-[#e7e3d9] text-xs text-[#14151c] placeholder:text-[#888d9c] focus:outline-none focus:border-[#4f46e5]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-[#edeae2] p-1 rounded-full">
              {(['all', 'beginner', 'intermediate', 'advanced'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => {
                    setDifficultyFilter(tier);
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                    difficultyFilter === tier
                      ? 'bg-white text-[#14151c] shadow-sm'
                      : 'text-[#4a4f5e] hover:text-[#14151c]'
                  }`}
                >
                  {tier === 'all'
                    ? isVi
                      ? 'Mọi cấp'
                      : 'All levels'
                    : isVi
                      ? DIFF_BADGE[tier].labelVi
                      : DIFF_BADGE[tier].labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: Grade + Key + Format/Era + Sort + Reset */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-[#888d9c] font-semibold">
              <Filter className="w-3.5 h-3.5" />
              {isVi ? 'Lọc:' : 'Filter:'}
            </span>

            <select
              aria-label="Filter by Grade"
              value={gradeFilter}
              onChange={(e) => {
                setGradeFilter(e.target.value as 'all' | PianoGrade);
                setPage(1);
              }}
              className="rounded-full bg-[#f8f6f1] border border-[#e7e3d9] px-3 py-1.5 text-xs font-semibold text-[#14151c]"
            >
              <option value="all">{isVi ? 'Tất cả Grade (1–8)' : 'All Grades (1–8)'}</option>
              {ALL_GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by Key"
              value={keyFilter}
              onChange={(e) => {
                setKeyFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-full bg-[#f8f6f1] border border-[#e7e3d9] px-3 py-1.5 text-xs font-semibold text-[#14151c]"
            >
              <option value="all">{isVi ? 'Tất cả Gam/Tông' : 'All Keys'}</option>
              {availableKeys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>

            {activeTab === 'my' ? (
              <select
                aria-label="Filter by Format"
                value={formatFilter}
                onChange={(e) => {
                  setFormatFilter(e.target.value as 'all' | SourceFormat);
                  setPage(1);
                }}
                className="rounded-full bg-[#f8f6f1] border border-[#e7e3d9] px-3 py-1.5 text-xs font-semibold text-[#14151c]"
              >
                <option value="all">{isVi ? 'Mọi định dạng' : 'All Formats'}</option>
                <option value="midi">MIDI</option>
                <option value="musicxml">MusicXML</option>
                <option value="pdf">PDF</option>
              </select>
            ) : (
              <>
                <select
                  aria-label="Filter by Era"
                  value={eraFilter}
                  onChange={(e) => {
                    setEraFilter(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-full bg-[#f8f6f1] border border-[#e7e3d9] px-3 py-1.5 text-xs font-semibold text-[#14151c]"
                >
                  <option value="all">{isVi ? 'Mọi thời kỳ' : 'All Eras'}</option>
                  {['Baroque', 'Classical', 'Romantic', 'Impressionist', 'Ragtime', 'Traditional'].map(
                    (era) => (
                      <option key={era} value={era}>
                        {era}
                      </option>
                    ),
                  )}
                </select>
                {availableSources.length > 0 && (
                  <select
                    aria-label="Filter by Source"
                    value={sourceFilter}
                    onChange={(e) => {
                      setSourceFilter(e.target.value);
                      setPage(1);
                    }}
                    className="rounded-full bg-[#f8f6f1] border border-[#e7e3d9] px-3 py-1.5 text-xs font-semibold text-[#14151c]"
                  >
                    <option value="all">{isVi ? 'Mọi kho nguồn' : 'All Sources'}</option>
                    {availableSources.map((src) => (
                      <option key={src} value={src}>
                        {src}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}

            <select
              aria-label="Sort songs"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortKey);
                setPage(1);
              }}
              className="rounded-full bg-[#f8f6f1] border border-[#e7e3d9] px-3 py-1.5 text-xs font-semibold text-[#14151c]"
            >
              {activeTab === 'my' && (
                <option value="newest">{isVi ? 'Sắp xếp: Mới nhất' : 'Sort: Newest'}</option>
              )}
              <option value="grade-asc">{isVi ? 'Cấp độ: Dễ → Khó' : 'Grade: Easy → Hard'}</option>
              <option value="grade-desc">{isVi ? 'Cấp độ: Khó → Dễ' : 'Grade: Hard → Easy'}</option>
              <option value="title-asc">{isVi ? 'Tên: A → Z' : 'Title: A → Z'}</option>
              {activeTab === 'my' && (
                <>
                  <option value="bpm-asc">{isVi ? 'Tốc độ: BPM ↑' : 'Tempo: BPM ↑'}</option>
                  <option value="dur-asc">{isVi ? 'Độ dài: Ngắn → Dài' : 'Duration: Short → Long'}</option>
                </>
              )}
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-2.5 py-1.5 rounded-full text-xs font-semibold text-[#d4545a] hover:bg-[#fbe6e7] inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                {isVi ? 'Xóa lọc' : 'Reset'}
              </button>
            )}

            <span className="ml-auto text-[11px] font-mono text-[#888d9c]">
              {totalItems.toLocaleString()} {isVi ? 'kết quả' : 'matches'}
            </span>
          </div>
        </div>

        {/* MY LIBRARY GRID (Paginated 24/page for 10,000+ song speed) */}
        {activeTab === 'my' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {pagedMySongs.map((s) => {
              const active = s.id === currentSongId;
              const diff = s.difficulty ?? 'beginner';
              const badge = DIFF_BADGE[diff];
              return (
                <div
                  key={s.id}
                  className={`paper-card rounded-2xl p-4 flex flex-col justify-between gap-3 transition ${
                    active ? 'ring-2 ring-[#4f46e5]' : 'hover:border-[#b9b2a4]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.cls}`}>
                          {isVi ? badge.labelVi : badge.labelEn} · {s.grade ?? 'Grade 1'}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f3f0e8] text-[#4a4f5e] text-[10px] font-bold uppercase">
                          <FileText className="w-2.5 h-2.5" />
                          {s.sourceFormat}
                        </span>
                        {s.detectedKey && (
                          <span className="px-2 py-0.5 rounded-full bg-[#f3f0e8] text-[#4a4f5e] text-[10px] font-semibold">
                            {s.detectedKey.label}
                          </span>
                        )}
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

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#e7e3d9]">
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
        )}

        {/* PUBLIC DOMAIN CATALOG GRID */}
        {activeTab === 'catalog' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {pagedCatalog.map((entry) => {
              const badge = DIFF_BADGE[entry.difficulty];
              const isDownloading = downloadingId === entry.id;
              const alreadySaved = savedIds.has(entry.id);
              return (
                <div
                  key={entry.id}
                  className="paper-card rounded-2xl p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.cls}`}>
                        {isVi ? badge.labelVi : badge.labelEn} · {entry.grade}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#f3f0e8] text-[#4a4f5e] text-[10px] font-semibold">
                        {entry.keyLabel}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#f3f0e8] text-[#888d9c] text-[10px] font-semibold">
                        {entry.era}
                      </span>
                    </div>
                    <h3 className="font-bold text-base text-[#14151c] leading-snug pt-0.5">
                      {entry.title}
                    </h3>
                    <div className="text-xs text-[#4a4f5e]">
                      {entry.composer} ·{' '}
                      <span className="font-mono uppercase text-[10px]">
                        {entry.source || 'Public Domain'} · {entry.format}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#e7e3d9]">
                    <span className="text-[11px] text-[#2f9e6c] font-semibold">
                      {alreadySaved || entry.bundled
                        ? isVi
                          ? '✓ Sẵn có Offline'
                          : '✓ Built-in Offline'
                        : isVi
                          ? 'Miễn phí · Public Domain'
                          : 'Free · Public Domain'}
                    </span>
                    <button
                      type="button"
                      disabled={Boolean(downloadingId)}
                      onClick={() => void handleOpenCatalogEntry(entry)}
                      className="px-4 py-1.5 rounded-full bg-[#14151c] hover:bg-[#2a2d3d] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
                    >
                      {isDownloading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      )}
                      {isDownloading
                        ? isVi
                          ? 'Đang mở...'
                          : 'Opening...'
                        : isVi
                          ? 'Tập ngay'
                          : 'Practice'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {totalItems === 0 && (
          <div className="paper-card rounded-2xl p-8 text-center space-y-2">
            <Music className="w-8 h-8 text-[#888d9c] mx-auto" />
            <div className="font-semibold text-sm text-[#14151c]">
              {isVi ? 'Không tìm thấy bản nhạc phù hợp với bộ lọc' : 'No scores match your filters'}
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-3.5 py-1.5 rounded-full bg-[#eceefe] text-[#4f46e5] text-xs font-semibold"
              >
                {isVi ? 'Xóa toàn bộ bộ lọc' : 'Clear all filters'}
              </button>
            )}
          </div>
        )}

        {/* Pagination Controls (Supports 10,000+ scores effortlessly!) */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3.5 py-1.5 rounded-full paper-card text-xs font-semibold text-[#14151c] disabled:opacity-40 inline-flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              {isVi ? 'Trang trước' : 'Previous'}
            </button>
            <span className="text-xs font-mono font-semibold text-[#4a4f5e]">
              {isVi ? 'Trang' : 'Page'} {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3.5 py-1.5 rounded-full paper-card text-xs font-semibold text-[#14151c] disabled:opacity-40 inline-flex items-center gap-1"
            >
              {isVi ? 'Trang sau' : 'Next'}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
