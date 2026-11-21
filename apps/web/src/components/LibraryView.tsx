import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  FileText,
  Globe,
  Loader2,
  Music,
  Play,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { enrichSongMetadata } from '../core/accompaniment/difficultyClassifier';
import { t } from '../core/i18n';
import { parseSongFile } from '../core/parsers';
import { parsePdfOffline } from '../core/parsers/pdfOfflineOmr';
import type { DifficultyTier, Language, PianoGrade, Song, SourceFormat } from '../core/types';
import {
  inferMusicGenre,
  loadFullPublicDomainCatalog,
  MUSESCORE_GENRES,
  PUBLIC_DOMAIN_CATALOG,
  type MusicGenre,
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
const INITIAL_GENRES_SHOWN = 8;

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

const DIFF_ORDER: DifficultyTier[] = ['beginner', 'intermediate', 'advanced'];

const DIFF_BADGE: Record<DifficultyTier, { labelVi: string; labelEn: string; cls: string }> = {
  beginner: { labelVi: 'Cơ bản', labelEn: 'Beginner', cls: 'bg-[#e1f4ea] text-[#2f9e6c]' },
  intermediate: { labelVi: 'Trung cấp', labelEn: 'Intermediate', cls: 'bg-[#eceefe] text-[#4f46e5]' },
  advanced: { labelVi: 'Nâng cao', labelEn: 'Advanced', cls: 'bg-[#faefdb] text-[#c0822a]' },
};

function toggleItem<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function formatDuration(sec?: number): string | null {
  if (!sec || !Number.isFinite(sec) || sec <= 0) return null;
  const total = Math.max(1, Math.round(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
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
  const [activeTab, setActiveTab] = useState<'my' | 'catalog'>('my');
  const [query, setQuery] = useState('');
  const [selectedDifficulties, setSelectedDifficulties] = useState<DifficultyTier[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<MusicGenre[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<SourceFormat[]>([]);
  const [gradeFilter, setGradeFilter] = useState<'all' | PianoGrade>('all');
  const [keyFilter, setKeyFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [showAllGenres, setShowAllGenres] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
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

  // Enrich user library songs with auto grade + inferred MuseScore genre
  const enrichedSongs = useMemo(
    () =>
      songs.map((s) => {
        const enriched = enrichSongMetadata(s);
        return {
          ...enriched,
          genre: inferMusicGenre(enriched.title, enriched.composer),
        };
      }),
    [songs],
  );

  // Facet counts for the active tab (MuseScore-style live counts!)
  const facetCounts = useMemo(() => {
    const diff: Record<DifficultyTier, number> = { beginner: 0, intermediate: 0, advanced: 0 };
    const genre: Record<string, number> = {};
    const format: Record<SourceFormat, number> = { musicxml: 0, midi: 0, pdf: 0 };
    const keys = new Set<string>();

    if (activeTab === 'my') {
      for (const s of enrichedSongs) {
        const d = s.difficulty ?? 'beginner';
        diff[d] = (diff[d] ?? 0) + 1;
        genre[s.genre] = (genre[s.genre] ?? 0) + 1;
        format[s.sourceFormat] = (format[s.sourceFormat] ?? 0) + 1;
        if (s.detectedKey?.label) keys.add(s.detectedKey.label);
      }
    } else {
      for (const c of catalogEntries) {
        diff[c.difficulty] = (diff[c.difficulty] ?? 0) + 1;
        genre[c.genre] = (genre[c.genre] ?? 0) + 1;
        const fmt: SourceFormat = c.format === 'mid' ? 'midi' : 'musicxml';
        format[fmt] = (format[fmt] ?? 0) + 1;
        keys.add(c.keyLabel);
      }
    }

    return {
      diff,
      genre,
      format,
      keys: Array.from(keys).sort(),
    };
  }, [activeTab, enrichedSongs, catalogEntries]);

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
    setSelectedDifficulties([]);
    setSelectedGenres([]);
    setSelectedFormats([]);
    setGradeFilter('all');
    setKeyFilter('all');
    setSortBy(activeTab === 'my' ? 'newest' : 'grade-asc');
    setPage(1);
  };

  const activeFilterCount =
    selectedDifficulties.length +
    selectedGenres.length +
    selectedFormats.length +
    (gradeFilter !== 'all' ? 1 : 0) +
    (keyFilter !== 'all' ? 1 : 0);

  const hasActiveFilters = query.trim() !== '' || activeFilterCount > 0;

  // Filtered & sorted My Library
  const filteredMySongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = enrichedSongs.filter((s) => {
      const d = s.difficulty ?? 'beginner';
      if (selectedDifficulties.length > 0 && !selectedDifficulties.includes(d)) return false;
      if (selectedGenres.length > 0 && !selectedGenres.includes(s.genre)) return false;
      if (selectedFormats.length > 0 && !selectedFormats.includes(s.sourceFormat)) return false;
      if (gradeFilter !== 'all' && s.grade !== gradeFilter) return false;
      if (keyFilter !== 'all' && s.detectedKey?.label !== keyFilter) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.composer.toLowerCase().includes(q) ||
        s.genre.toLowerCase().includes(q) ||
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
  }, [
    enrichedSongs,
    query,
    selectedDifficulties,
    selectedGenres,
    selectedFormats,
    gradeFilter,
    keyFilter,
    sortBy,
  ]);

  // Filtered & sorted Public Domain Catalog (3,190 scores built-in offline!)
  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = catalogEntries.filter((c) => {
      if (selectedDifficulties.length > 0 && !selectedDifficulties.includes(c.difficulty)) return false;
      if (selectedGenres.length > 0 && !selectedGenres.includes(c.genre)) return false;
      if (selectedFormats.length > 0) {
        const fmt: SourceFormat = c.format === 'mid' ? 'midi' : 'musicxml';
        if (!selectedFormats.includes(fmt)) return false;
      }
      if (gradeFilter !== 'all' && c.grade !== gradeFilter) return false;
      if (keyFilter !== 'all' && c.keyLabel !== keyFilter) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.composer.toLowerCase().includes(q) ||
        c.genre.toLowerCase().includes(q) ||
        c.era.toLowerCase().includes(q)
      );
    });

    const sorted = [...list];
    if (sortBy === 'title-asc') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortBy === 'grade-desc') sorted.sort((a, b) => b.gradeNum - a.gradeNum);
    else if (sortBy === 'dur-asc')
      sorted.sort((a, b) => (a.durationSec ?? 9999) - (b.durationSec ?? 9999));
    else if (sortBy === 'grade-asc') sorted.sort((a, b) => a.gradeNum - b.gradeNum);
    return sorted;
  }, [
    catalogEntries,
    query,
    selectedDifficulties,
    selectedGenres,
    selectedFormats,
    gradeFilter,
    keyFilter,
    sortBy,
  ]);

  const totalItems = activeTab === 'my' ? filteredMySongs.length : filteredCatalog.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedMySongs = filteredMySongs.slice(pageStart, pageStart + PAGE_SIZE);
  const pagedCatalog = filteredCatalog.slice(pageStart, pageStart + PAGE_SIZE);

  const savedIds = useMemo(() => new Set(songs.map((s) => s.id)), [songs]);

  const visibleGenres = showAllGenres
    ? MUSESCORE_GENRES
    : MUSESCORE_GENRES.slice(0, INITIAL_GENRES_SHOWN);

  const availableFormats: Array<{ id: SourceFormat; label: string }> =
    activeTab === 'my'
      ? [
          { id: 'musicxml', label: 'MusicXML (.mxl)' },
          { id: 'midi', label: 'MIDI (.mid)' },
          { id: 'pdf', label: 'PDF' },
        ]
      : [
          { id: 'musicxml', label: 'MusicXML (.mxl)' },
          { id: 'midi', label: 'MIDI (.mid)' },
        ];

  const renderFilterSidebar = () => (
    <aside className="paper-card rounded-2xl p-4 space-y-5 h-fit">
      <div className="flex items-center justify-between pb-2.5 border-b border-[#e7e3d9]">
        <div className="flex items-center gap-1.5 text-sm font-bold text-[#14151c]">
          <SlidersHorizontal className="w-4 h-4 text-[#4f46e5]" />
          <span>{isVi ? 'Bộ lọc' : 'Filters'}</span>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-[11px] font-semibold text-[#4f46e5] hover:underline inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            {isVi ? 'Xóa lọc' : 'Clear'}
          </button>
        )}
      </div>

      {/* 1. Difficulty level (MuseScore style) */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-[#14151c]">
          {isVi ? 'Cấp độ (Difficulty level)' : 'Difficulty level'}
        </div>
        <div className="space-y-1.5">
          {DIFF_ORDER.map((tier) => {
            const checked = selectedDifficulties.includes(tier);
            const count = facetCounts.diff[tier] ?? 0;
            return (
              <label
                key={tier}
                className="flex items-center justify-between gap-2 text-xs cursor-pointer group py-0.5"
              >
                <span className="flex items-center gap-2 text-[#2d3142] group-hover:text-[#14151c]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedDifficulties((prev) => toggleItem(prev, tier));
                      setPage(1);
                    }}
                    className="w-3.5 h-3.5 rounded accent-[#4f46e5] cursor-pointer"
                  />
                  <span className={checked ? 'font-semibold text-[#14151c]' : ''}>
                    {isVi ? DIFF_BADGE[tier].labelVi : DIFF_BADGE[tier].labelEn}
                  </span>
                </span>
                <span className="text-[11px] font-mono text-[#888d9c]">
                  {count.toLocaleString()}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 2. Genre (Full 20 MuseScore genres + Show all toggle) */}
      <div className="space-y-2 pt-3 border-t border-[#e7e3d9]">
        <div className="text-xs font-bold text-[#14151c]">
          {isVi ? 'Thể loại (Genre)' : 'Genre'}
        </div>
        <div className="space-y-1.5">
          {visibleGenres.map((g) => {
            const checked = selectedGenres.includes(g);
            const count = facetCounts.genre[g] ?? 0;
            return (
              <label
                key={g}
                className="flex items-center justify-between gap-2 text-xs cursor-pointer group py-0.5"
              >
                <span className="flex items-center gap-2 text-[#2d3142] group-hover:text-[#14151c] min-w-0">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedGenres((prev) => toggleItem(prev, g));
                      setPage(1);
                    }}
                    className="w-3.5 h-3.5 rounded accent-[#4f46e5] cursor-pointer shrink-0"
                  />
                  <span className={`truncate ${checked ? 'font-semibold text-[#14151c]' : ''}`}>
                    {g}
                  </span>
                </span>
                <span className="text-[11px] font-mono text-[#888d9c] shrink-0">
                  {count.toLocaleString()}
                </span>
              </label>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setShowAllGenres((v) => !v)}
          className="text-xs font-semibold text-[#4f46e5] hover:underline inline-flex items-center gap-1 pt-0.5"
        >
          {showAllGenres ? (
            <>
              {isVi ? 'Thu gọn' : 'Show less'}
              <ChevronUp className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              {isVi ? `Xem tất cả (${MUSESCORE_GENRES.length})` : `Show all (${MUSESCORE_GENRES.length})`}
              <ChevronDown className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {/* 3. Format */}
      <div className="space-y-2 pt-3 border-t border-[#e7e3d9]">
        <div className="text-xs font-bold text-[#14151c]">
          {isVi ? 'Định dạng (Format)' : 'Format'}
        </div>
        <div className="space-y-1.5">
          {availableFormats.map((fmt) => {
            const checked = selectedFormats.includes(fmt.id);
            const count = facetCounts.format[fmt.id] ?? 0;
            return (
              <label
                key={fmt.id}
                className="flex items-center justify-between gap-2 text-xs cursor-pointer group py-0.5"
              >
                <span className="flex items-center gap-2 text-[#2d3142] group-hover:text-[#14151c]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedFormats((prev) => toggleItem(prev, fmt.id));
                      setPage(1);
                    }}
                    className="w-3.5 h-3.5 rounded accent-[#4f46e5] cursor-pointer"
                  />
                  <span className={checked ? 'font-semibold text-[#14151c]' : ''}>
                    {fmt.label}
                  </span>
                </span>
                <span className="text-[11px] font-mono text-[#888d9c]">
                  {count.toLocaleString()}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 4. Grade (ABRSM / RCM) */}
      <div className="space-y-1.5 pt-3 border-t border-[#e7e3d9]">
        <label className="block text-xs font-bold text-[#14151c]" htmlFor="library-grade-select">
          {isVi ? 'Trình độ (Grade 1–8)' : 'Piano Grade'}
        </label>
        <select
          id="library-grade-select"
          aria-label="Filter by Grade"
          value={gradeFilter}
          onChange={(e) => {
            setGradeFilter(e.target.value as 'all' | PianoGrade);
            setPage(1);
          }}
          className="w-full rounded-xl bg-[#f8f6f1] border border-[#e7e3d9] px-3 py-1.5 text-xs font-semibold text-[#14151c]"
        >
          <option value="all">{isVi ? 'Tất cả Grade (1–8)' : 'All Grades (1–8)'}</option>
          {ALL_GRADES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      {/* 5. Key / Tông */}
      <div className="space-y-1.5 pt-3 border-t border-[#e7e3d9]">
        <label className="block text-xs font-bold text-[#14151c]" htmlFor="library-key-select">
          {isVi ? 'Giọng / Gam (Key)' : 'Key Signature'}
        </label>
        <select
          id="library-key-select"
          aria-label="Filter by Key"
          value={keyFilter}
          onChange={(e) => {
            setKeyFilter(e.target.value);
            setPage(1);
          }}
          className="w-full rounded-xl bg-[#f8f6f1] border border-[#e7e3d9] px-3 py-1.5 text-xs font-semibold text-[#14151c]"
        >
          <option value="all">{isVi ? 'Tất cả Gam / Tông' : 'All Keys'}</option>
          {facetCounts.keys.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
    </aside>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8f6f1] px-4 sm:px-6 py-5 pb-24 md:pb-8">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* MuseKey Dark Staff-Lined Hero */}
        <div className="staff-hero rounded-[1.75rem] p-5 sm:p-7 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-teal-200/90">
                {isVi
                  ? '100% Sẵn có Offline · Tự động phân cấp Grade 1–8 & 20 thể loại nhạc'
                  : '100% Built-in Offline · Auto Grade 1–8 & 20 Music Genres'}
              </div>
              <h1 className="display-serif text-3xl sm:text-4xl font-semibold tracking-tight">
                {isVi ? 'Thư viện & Kho Nhạc Offline' : 'Library & Built-in Scores'}
              </h1>
              <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
                {isVi
                  ? 'Nhập hàng loạt MIDI / MusicXML / PDF hoặc mở tập ngay hơn 5.120 bản nhạc tích hợp sẵn đủ 20 thể loại — 100% offline.'
                  : 'Batch-import MIDI, MusicXML, or PDF files, or instantly practice 5,120+ built-in offline scores across all 20 music genres.'}
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
                  ? `Kho Nhạc Offline (${catalogEntries.length.toLocaleString()})`
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

        {/* MuseScore-Style 2-Column Layout: Left Filter Sidebar + Right Search & Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[256px_minmax(0,1fr)] gap-5 items-start">
          {/* Desktop Left Filter Sidebar */}
          <div className="hidden lg:block sticky top-4">{renderFilterSidebar()}</div>

          {/* Right Main Content */}
          <div className="space-y-4 min-w-0">
            {/* Search + Mobile Filter Toggle + Sort Bar */}
            <div className="paper-card rounded-2xl p-3 space-y-2.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
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
                        ? 'Tìm nhanh tên bài, nhạc sĩ, thể loại (vd: Chopin, Bach, Jazz)...'
                        : 'Search title, composer, or genre (e.g. Chopin, Bach, Jazz)...'
                    }
                    className="w-full pl-9 pr-4 py-2 rounded-full bg-[#f8f6f1] border border-[#e7e3d9] text-xs text-[#14151c] placeholder:text-[#888d9c] focus:outline-none focus:border-[#4f46e5]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen((v) => !v)}
                    className="lg:hidden inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#f8f6f1] border border-[#e7e3d9] text-xs font-semibold text-[#14151c]"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#4f46e5]" />
                    <span>{isVi ? 'Bộ lọc' : 'Filters'}</span>
                    {activeFilterCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-[#4f46e5] text-white text-[10px]">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  <select
                    aria-label="Sort songs"
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value as SortKey);
                      setPage(1);
                    }}
                    className="rounded-full bg-[#f8f6f1] border border-[#e7e3d9] px-3 py-2 text-xs font-semibold text-[#14151c]"
                  >
                    {activeTab === 'my' && (
                      <option value="newest">{isVi ? 'Sắp xếp: Mới nhất' : 'Sort: Newest'}</option>
                    )}
                    {activeTab === 'catalog' && (
                      <option value="newest">{isVi ? 'Sắp xếp: Đề xuất' : 'Sort: Featured'}</option>
                    )}
                    <option value="grade-asc">{isVi ? 'Cấp độ: Dễ → Khó' : 'Grade: Easy → Hard'}</option>
                    <option value="grade-desc">{isVi ? 'Cấp độ: Khó → Dễ' : 'Grade: Hard → Easy'}</option>
                    <option value="title-asc">{isVi ? 'Tên: A → Z' : 'Title: A → Z'}</option>
                    <option value="dur-asc">{isVi ? 'Thời lượng: Ngắn → Dài' : 'Duration: Short → Long'}</option>
                    {activeTab === 'my' && (
                      <option value="bpm-asc">{isVi ? 'Tốc độ: BPM ↑' : 'Tempo: BPM ↑'}</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Active Filter Chips + Count */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="font-mono text-[#888d9c] mr-1">
                  {totalItems.toLocaleString()} {isVi ? 'bản nhạc' : 'scores'}
                </span>

                {selectedDifficulties.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setSelectedDifficulties((prev) => prev.filter((x) => x !== d));
                      setPage(1);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#eceefe] text-[#4f46e5] font-semibold"
                  >
                    {isVi ? DIFF_BADGE[d].labelVi : DIFF_BADGE[d].labelEn}
                    <X className="w-3 h-3" />
                  </button>
                ))}

                {selectedGenres.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      setSelectedGenres((prev) => prev.filter((x) => x !== g));
                      setPage(1);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#eceefe] text-[#4f46e5] font-semibold"
                  >
                    {g}
                    <X className="w-3 h-3" />
                  </button>
                ))}

                {selectedFormats.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setSelectedFormats((prev) => prev.filter((x) => x !== f));
                      setPage(1);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#eceefe] text-[#4f46e5] font-semibold uppercase"
                  >
                    {f}
                    <X className="w-3 h-3" />
                  </button>
                ))}

                {gradeFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => {
                      setGradeFilter('all');
                      setPage(1);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#eceefe] text-[#4f46e5] font-semibold"
                  >
                    {gradeFilter}
                    <X className="w-3 h-3" />
                  </button>
                )}

                {keyFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => {
                      setKeyFilter('all');
                      setPage(1);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#eceefe] text-[#4f46e5] font-semibold"
                  >
                    {keyFilter}
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Collapsible Filter Panel */}
            {mobileFiltersOpen && <div className="lg:hidden">{renderFilterSidebar()}</div>}

            {/* MY LIBRARY GRID */}
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
                            <span className="px-2 py-0.5 rounded-full bg-[#f3f0e8] text-[#4a4f5e] text-[10px] font-semibold">
                              {s.genre}
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
                          <div className="text-xs text-[#4a4f5e] mt-0.5 flex flex-wrap items-center gap-2">
                            {formatDuration(s.durationSec) && (
                              <>
                                <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#14151c]">
                                  <Clock className="w-3 h-3 text-[#4f46e5]" />
                                  {formatDuration(s.durationSec)}
                                </span>
                                <span>·</span>
                              </>
                            )}
                            <span>
                              {s.measures.length} {isVi ? 'ô nhịp' : 'bars'}
                            </span>
                            <span>·</span>
                            <span className="font-mono">{Math.round(s.defaultBpm)} BPM</span>
                            <span>·</span>
                            <span>
                              {s.notes.length} {isVi ? 'nốt' : 'notes'}
                            </span>
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
                            {entry.genre}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-[#f3f0e8] text-[#4a4f5e] text-[10px] font-semibold">
                            {entry.keyLabel}
                          </span>
                        </div>
                        <h3 className="font-bold text-base text-[#14151c] leading-snug pt-0.5">
                          {entry.title}
                        </h3>
                        <div className="text-xs text-[#4a4f5e] flex flex-wrap items-center gap-1.5">
                          <span className="truncate">{entry.composer}</span>
                          <span>·</span>
                          <span className="font-mono uppercase text-[10px]">
                            {entry.format === 'mid' ? 'MIDI' : 'MusicXML'}
                          </span>
                          {formatDuration(entry.durationSec) && (
                            <>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#14151c]">
                                <Clock className="w-3 h-3 text-[#4f46e5]" />
                                {formatDuration(entry.durationSec)}
                              </span>
                            </>
                          )}
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

            {/* Pagination Controls */}
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
      </div>
    </div>
  );
};
