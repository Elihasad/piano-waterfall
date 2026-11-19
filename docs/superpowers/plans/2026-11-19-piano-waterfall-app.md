# Piano Waterfall Practice App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a MuseScore-inspired falling-notes piano practice app packaged as an Android `.apk` (Capacitor) and iOS offline PWA, supporting MusicXML/MIDI offline on-device and multi-page PDF sheet music via a decoupled Python OMR backend.

**Architecture:** A React + TypeScript + HTML5 Canvas frontend (`apps/web`) parses MusicXML/MIDI into a unified `Song` model stored in IndexedDB, drives 60fps falling notes with readable note names (`C, D, E...`) synced to a Web Audio piano engine, and packages into Android via Capacitor + GitHub Actions and iOS via GitHub Pages HTTPS PWA. A standalone Python 3.12 FastAPI service (`services/omr-backend`) converts multi-page PDFs asynchronously via `POST /api/jobs` + polling and stitches multi-page MusicXML.

**Tech Stack:** React 18, TypeScript, Vite 5, Tailwind CSS 3, Vitest 2, `vite-plugin-pwa`, `@capacitor/android` 6, `jszip`, `@tonejs/midi`, `idb`, `lucide-react`, Python 3.12, FastAPI, `pypdfium2`, `homr`, `pytest`.

**Spec:** `docs/superpowers/specs/2026-11-19-piano-waterfall-app-design.md`

## Global Constraints

- Local machine runs Windows, Node.js `v18.20.0`, Python `3.12.10`, and has NO Java/JDK/Android SDK installed — pin Vite 5 (`^5.4.0`), Vitest 2 (`^2.1.0`), and Capacitor 6 (`^6.1.0`) for Node 18 compatibility.
- Primary viewport is mobile smartphone **landscape**; note labels (`C, D, E...`, `Đô, Rê, Mi`, `Off`) must stay readable via smart keyboard auto-fit range (`minMidi..maxMidi` padded).
- All imported songs (including OMR-converted PDFs) and piano audio must work **100% offline** on Android `.apk` and iOS PWA once imported.
- Left Hand color is green (`#22c55e` / `#4ade80`), Right Hand color is cyan (`#06b6d4` / `#22d3ee`), dark canvas `#121216`.
- Left/Right Hand audio mute and visual visibility must be **independent** per hand.
- PDF conversion uses an asynchronous job API (`POST /api/jobs`, `GET /api/jobs/{jobId}`, `DELETE /api/jobs/{jobId}`) to prevent HTTP timeouts on multi-page scores.
- Every task must end with passing tests and a clean git commit.

## Review Focus

1. **Tied notes & multi-voice chords in MusicXML:** Tied notes across beats/measures must merge into one continuous falling bar instead of re-triggering audio; simultaneous chord notes must share `startTimeSec` without advancing the cursor prematurely (pinned in Task 2).
2. **Transpose out-of-range clamping:** Transposing a piece with very low/high notes by `±12` semitones must clamp rendered/played MIDI pitch to valid piano bounds `21..108` without crashing layout or audio (pinned in Task 1 & Task 4).
3. **A–B Loop boundary wrap-around:** Looping measures `A..B` must wrap cleanly to `A`'s start time without double-triggering notes at the exact loop end or skipping notes at the exact loop start (pinned in Task 4).
4. **Black-key vs white-key touch hit-testing:** Tapping the upper portion of a black key on the piano keyboard must trigger the black key rather than the underlying white key (pinned in Task 5).
5. **Unconfigured / unreachable / Mixed-Content OMR server on PDF upload:** Uploading a PDF when `omrServerUrl` is blank, unreachable, or `http://` from an `https://` iOS PWA must surface an actionable error message and never hang or crash (pinned in Task 3).

---

### Task 1: Project Scaffolding, Core Song Model, Note Naming & Demo Songs

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tailwind.config.js`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/index.html`
- Create: `apps/web/src/index.css`
- Create: `apps/web/src/core/types.ts`
- Create: `apps/web/src/core/noteNames.ts`
- Create: `apps/web/src/data/demoSongs.ts`
- Test: `apps/web/src/core/__tests__/noteNames.test.ts`

**Interfaces:**
- Produces in `src/core/types.ts`:
  - `Hand = 'left' | 'right'`
  - `NoteLabelMode = 'letters' | 'solfege' | 'off'`
  - `NoteEvent { id: string; midi: number; startTimeSec: number; durationSec: number; velocity: number; hand: Hand; measureNumber: number }`
  - `MeasureEvent { number: number; startTimeSec: number; endTimeSec: number; beats: number; beatType: number }`
  - `TempoEvent { timeSec: number; bpm: number }`
  - `Song { id: string; title: string; composer: string; sourceFormat: 'musicxml' | 'midi' | 'pdf'; createdAt: number; defaultBpm: number; durationSec: number; tempoEvents: TempoEvent[]; measures: MeasureEvent[]; notes: NoteEvent[]; minMidi: number; maxMidi: number }`
  - `HandControlState { left: { audio: boolean; visual: boolean }; right: { audio: boolean; visual: boolean } }`
  - `AppSettings { omrServerUrl: string; noteLabelMode: NoteLabelMode; showKeyLabels: boolean; effectsEnabled: boolean }`
- Produces in `src/core/noteNames.ts`:
  - `clampMidi(midi: number): number` (clamps to `21..108`)
  - `isBlackKey(midi: number): boolean`
  - `midiToNoteLabel(midi: number, mode: NoteLabelMode, includeOctave?: boolean): string`
  - `computeAutoKeyRange(minMidi: number, maxMidi: number): { startMidi: number; endMidi: number }`
- Produces in `src/data/demoSongs.ts`:
  - `DEMO_SONGS: Song[]` (2 public-domain pieces: *Ode to Joy* & *Für Elise (Opening)* with both hands and measures)

- [ ] **Step 1: Initialize git repo and scaffold `apps/web` Vite 5 + React 18 + TypeScript + Tailwind + Vitest + PWA**
  - Run `git init` at repo root and create `.gitignore` (ignoring `node_modules`, `dist`, `.venv`, `__pycache__`, `*.apk`).
  - Create `apps/web/package.json` with React 18, Vite `^5.4.0`, Vitest `^2.1.0`, `jsdom`, `@testing-library/react`, `tailwindcss@^3.4.14`, `vite-plugin-pwa@^0.20.5`, `jszip@^3.10.1`, `@tonejs/midi@^2.0.28`, `idb@^8.0.0`, `lucide-react@^0.453.0`.
  - Run `npm install` in `apps/web`.
- [ ] **Step 2: Write the failing test in `apps/web/src/core/__tests__/noteNames.test.ts`**
  ```ts
  import { describe, it, expect } from 'vitest';
  import { clampMidi, isBlackKey, midiToNoteLabel, computeAutoKeyRange } from '../noteNames';

  describe('noteNames', () => {
    it('formats letters and solfege labels accurately', () => {
      expect(midiToNoteLabel(60, 'letters')).toBe('C');
      expect(midiToNoteLabel(60, 'letters', true)).toBe('C4');
      expect(midiToNoteLabel(61, 'letters')).toBe('C#');
      expect(midiToNoteLabel(62, 'solfege')).toBe('Rê');
      expect(midiToNoteLabel(64, 'off')).toBe('');
    });

    it('identifies black keys and clamps out-of-range MIDI pitches', () => {
      expect(isBlackKey(60)).toBe(false);
      expect(isBlackKey(61)).toBe(true);
      expect(clampMidi(10)).toBe(21);
      expect(clampMidi(120)).toBe(108);
      expect(midiToNoteLabel(120, 'letters', true)).toBe('C8');
    });

    it('computes padded readable auto key range ending on white keys', () => {
      const range = computeAutoKeyRange(60, 72);
      expect(range.startMidi).toBeLessThanOrEqual(55);
      expect(range.endMidi).toBeGreaterThanOrEqual(77);
      expect(isBlackKey(range.startMidi)).toBe(false);
      expect(isBlackKey(range.endMidi)).toBe(false);
      expect(range.endMidi - range.startMidi).toBeGreaterThanOrEqual(24);
    });
  });
  ```
- [ ] **Step 3: Run test to verify it fails**
  - Run: `npm test -- --run src/core/__tests__/noteNames.test.ts` in `apps/web`
  - Expected: FAIL (`Cannot find module '../noteNames'`)
- [ ] **Step 4: Implement `src/core/types.ts`, `src/core/noteNames.ts`, and `src/data/demoSongs.ts`**
  - `computeAutoKeyRange`: pad by 4 semitones on each side, enforce minimum span of 24 semitones (2 octaves) centered on the song's range, clamp to `21..108`, and expand start/end by 1 semitone if landing on a black key so the keyboard edges are always clean white keys.
  - `DEMO_SONGS`: include *Ode to Joy* (Beethoven, C major, 8 measures, RH+LH) and *Für Elise (Opening)* (Beethoven, A minor, 8 measures, RH+LH).
- [ ] **Step 5: Run test to verify it passes**
  - Run: `npm test -- --run src/core/__tests__/noteNames.test.ts`
  - Expected: PASS (all assertions green)
- [ ] **Step 6: Commit**
  - `git add . && git commit -m "feat: scaffold web app, core song model, note naming, and demo songs"`

---

### Task 2: MusicXML (`.xml`, `.musicxml`, `.mxl`) & MIDI (`.mid`) Parsers

**Files:**
- Create: `apps/web/src/core/parsers/musicXmlParser.ts`
- Create: `apps/web/src/core/parsers/midiParser.ts`
- Create: `apps/web/src/core/parsers/index.ts`
- Test: `apps/web/src/core/__tests__/parsers.test.ts`

**Interfaces:**
- Consumes: `Song`, `NoteEvent`, `MeasureEvent`, `TempoEvent`, `Hand` from `src/core/types.ts`; `clampMidi` from `src/core/noteNames.ts`.
- Produces in `src/core/parsers/index.ts`:
  - `parseMusicXml(xmlText: string, fallbackTitle: string, sourceFormat?: 'musicxml' | 'pdf'): Song`
  - `parseMxlBuffer(buffer: ArrayBuffer, fallbackTitle: string): Promise<Song>`
  - `parseMidiBuffer(buffer: ArrayBuffer, fallbackTitle: string): Song`
  - `parseSongFile(file: File): Promise<Song>` (dispatches `.xml`/`.musicxml`, `.mxl`, `.mid`/`.midi`; rejects unsupported extensions with a clear error).

- [ ] **Step 1: Write the failing tests in `apps/web/src/core/__tests__/parsers.test.ts`**
  - Test `parseMusicXml` on a 2-measure grand-staff (`<staff>1</staff>` and `<staff>2</staff>`) MusicXML string containing:
    - `<sound tempo="120"/>`, `<divisions>4</divisions>`, `<time><beats>4</beats><beat-type>4</beat-type></time>`.
    - A simultaneous chord (`<chord/>`) verifying both notes share exact `startTimeSec` and cursor only advances once.
    - A tied note (`<tie type="start"/>` + `<tie type="stop"/>` across a measure boundary) verifying it merges into **one** `NoteEvent` with combined `durationSec`.
    - Right hand (`staff 1`) and left hand (`staff 2`) assignment via `<backup>`.
  - Test single-staff MusicXML falls back to `C4` (`midi < 60` → `'left'`, `midi >= 60` → `'right'`).
  - Test malformed XML throws a descriptive error (`Invalid MusicXML`).
  - Test `parseMxlBuffer` extracts the root XML from a `META-INF/container.xml` ZIP created in-test with `JSZip`.
  - Test `parseMidiBuffer` parses a 2-track MIDI (created via `@tonejs/midi`'s `Midi` builder) into `Song` with `left`/`right` hands, measures, and `minMidi`/`maxMidi`.
- [ ] **Step 2: Run test to verify it fails**
  - Run: `npm test -- --run src/core/__tests__/parsers.test.ts`
  - Expected: FAIL
- [ ] **Step 3: Implement `musicXmlParser.ts`, `midiParser.ts`, and `index.ts`**
  - `musicXmlParser.ts`: use `DOMParser` (`application/xml`), check `parsererror`, iterate `<part>` → `<measure>` tracking `divisions`, `currentBpm` (default 120), `beats`/`beatType` (default 4/4), measure cursor in ticks, `<backup>`/`<forward>`, `<chord/>` (reuse `lastNoteStartTick`), and open ties map keyed by `${staff}:${midi}` to merge tied notes. Sort resulting notes by `startTimeSec` ascending.
  - `parseMxlBuffer`: unzip with `JSZip`, read `META-INF/container.xml` to locate `rootfile full-path` (fallback to first `.xml`/`.musicxml` entry), then delegate to `parseMusicXml`.
  - `midiParser.ts`: parse via `new Midi(buffer)`, extract tempo events and time signatures, build `MeasureEvent[]`, assign hands by track index if 2+ non-empty tracks exist else split at MIDI `60`.
- [ ] **Step 4: Run test to verify it passes**
  - Run: `npm test -- --run src/core/__tests__/parsers.test.ts`
  - Expected: PASS
- [ ] **Step 5: Commit**
  - `git add apps/web/src/core/parsers apps/web/src/core/__tests__/parsers.test.ts && git commit -m "feat: add MusicXML, MXL, and MIDI client-side parsers"`

---

### Task 3: On-Device Song Library Storage (IndexedDB) & Async OMR Client

**Files:**
- Create: `apps/web/src/core/storage.ts`
- Create: `apps/web/src/core/omrClient.ts`
- Test: `apps/web/src/core/__tests__/omrClient.test.ts`
- Test: `apps/web/src/core/__tests__/storage.test.ts`

**Interfaces:**
- Consumes: `Song`, `AppSettings` from `src/core/types.ts`; `DEMO_SONGS` from `src/data/demoSongs.ts`.
- Produces in `src/core/storage.ts`:
  - `listSongs(): Promise<Song[]>` (sorted by `createdAt` desc)
  - `getSong(id: string): Promise<Song | undefined>`
  - `saveSong(song: Song): Promise<void>`
  - `deleteSong(id: string): Promise<void>`
  - `seedDemoSongsIfEmpty(): Promise<Song[]>`
  - `getSettings(): AppSettings`
  - `saveSettings(partial: Partial<AppSettings>): AppSettings`
- Produces in `src/core/omrClient.ts`:
  - `OmrProgress { status: 'queued' | 'processing' | 'done' | 'error'; currentPage: number; totalPages: number; message?: string }`
  - `validateOmrUrl(url: string, pageProtocol?: string): { ok: boolean; error?: string }`
  - `checkOmrHealth(baseUrl: string): Promise<{ ok: boolean; engine?: string; error?: string }>`
  - `convertPdfWithProgress(baseUrl: string, file: File, onProgress: (p: OmrProgress) => void, signal?: AbortSignal): Promise<string>` (returns MusicXML string)

- [ ] **Step 1: Write the failing tests in `omrClient.test.ts` and `storage.test.ts`**
  - `omrClient.test.ts`:
    - `validateOmrUrl('', 'https:')` returns `{ ok: false }` with setup guidance.
    - `validateOmrUrl('http://192.168.1.5:8000', 'https:')` returns `{ ok: false }` explaining HTTPS Mixed Content on iOS/HTTPS PWA.
    - `convertPdfWithProgress` mocks `fetch` for `POST /api/jobs` → `GET /api/jobs/job-1` (processing page 1/2, then done with `<score-partwise/>`) and asserts `onProgress` receives progress updates and resolves MusicXML.
    - Aborting via `AbortController` triggers `DELETE /api/jobs/job-1` and rejects with AbortError.
  - `storage.test.ts`:
    - `seedDemoSongsIfEmpty()` populates demo songs once, `saveSong` persists and `listSongs` returns it, `deleteSong` removes it, and `saveSettings`/`getSettings` round-trip `omrServerUrl` and `noteLabelMode`.
- [ ] **Step 2: Run tests to verify they fail**
  - Run: `npm test -- --run src/core/__tests__/omrClient.test.ts src/core/__tests__/storage.test.ts`
  - Expected: FAIL
- [ ] **Step 3: Implement `storage.ts` and `omrClient.ts`**
  - `storage.ts`: use `idb` (`openDB('piano-waterfall-db', 1)`) with a clean in-memory fallback when `indexedDB` is unavailable (e.g., jsdom tests). Store settings in `localStorage` under `piano-waterfall-settings`.
  - `omrClient.ts`: strip trailing slashes from `baseUrl`, poll every 1000ms (configurable `pollIntervalMs` for fast tests), catch network errors with clear Vietnamese/English user-friendly error messages.
- [ ] **Step 4: Run tests to verify they pass**
  - Run: `npm test -- --run src/core/__tests__/omrClient.test.ts src/core/__tests__/storage.test.ts`
  - Expected: PASS
- [ ] **Step 5: Commit**
  - `git add apps/web/src/core/storage.ts apps/web/src/core/omrClient.ts apps/web/src/core/__tests__/ && git commit -m "feat: add IndexedDB song library storage and async PDF OMR client"`

---

### Task 4: Offline Web Audio Piano Engine & Playback Clock Scheduler

**Files:**
- Create: `apps/web/src/audio/pianoSynth.ts`
- Create: `apps/web/src/audio/playbackClock.ts`
- Test: `apps/web/src/audio/__tests__/playbackClock.test.ts`

**Interfaces:**
- Consumes: `Song`, `NoteEvent`, `HandControlState` from `src/core/types.ts`; `clampMidi` from `src/core/noteNames.ts`.
- Produces in `src/audio/pianoSynth.ts`:
  - `interface NotePlayer { unlock(): Promise<void>; playNote(midi: number, durationSec: number, velocity?: number, startAtAudioTime?: number): void; stopAll(): void }`
  - `class PianoSynth implements NotePlayer` (Web Audio warm acoustic piano synth using layered fundamental + harmonics + percussive hammer transient + natural piano decay envelope — 100% offline, zero network dependency, instant load on Android `.apk` & iOS Safari, proper `ctx.resume()` unlock).
- Produces in `src/audio/playbackClock.ts`:
  - `interface PlaybackSnapshot { isPlaying: boolean; currentTimeSec: number; speedRatio: number; transpose: number; loopEnabled: boolean; loopStartMeasure: number; loopEndMeasure: number; hands: HandControlState; activeNotes: NoteEvent[] }`
  - `class PlaybackClock`:
    - `constructor(player: NotePlayer)`
    - `loadSong(song: Song): void`
    - `play(): void`, `pause(): void`, `togglePlay(): void`, `restart(): void`
    - `seek(timeSec: number): void`
    - `stepMeasure(delta: -1 | 1): void`
    - `setSpeedRatio(ratio: number): void` (clamped `0.25..2.0`)
    - `setTranspose(semitones: number): void` (clamped `-12..12`)
    - `setLoop(enabled: boolean, startMeasure?: number, endMeasure?: number): void`
    - `setHands(hands: HandControlState): void`
    - `advance(deltaRealSec: number): PlaybackSnapshot` (called per animation frame; schedules newly crossed notes on `player` respecting hand audio mute, transpose clamping, and A–B loop boundaries)
    - `getSnapshot(): PlaybackSnapshot`

- [ ] **Step 1: Write the failing tests in `apps/web/src/audio/__tests__/playbackClock.test.ts`**
  - Use a fake `NotePlayer` recording `{ midi, durationSec }` calls.
  - Test speed scaling: at `speedRatio = 0.5`, advancing `1.0s` real time advances `currentTimeSec` by `0.5s` and scales `durationSec` by `1 / 0.5`.
  - Test A–B loop boundary: with loop on measures `1..1` (`0..2s`), advancing across `2.0s` wraps cleanly to `0s`, does NOT double-trigger notes at `2.0s`, and triggers notes at `0.0s` on the new loop pass.
  - Test hand audio mute: with `hands.right.audio = false` and `hands.right.visual = true`, right-hand notes still appear in `activeNotes` for rendering, while `player.playNote` is ONLY called for left-hand notes.
  - Test transpose clamping: note MIDI `105` transposed `+12` calls `player.playNote` with `108` (clamped).
  - Test `stepMeasure(1)` and `stepMeasure(-1)` jump to exact measure `startTimeSec`.
- [ ] **Step 2: Run test to verify it fails**
  - Run: `npm test -- --run src/audio/__tests__/playbackClock.test.ts`
  - Expected: FAIL
- [ ] **Step 3: Implement `pianoSynth.ts` and `playbackClock.ts`**
  - In `pianoSynth.ts`: cap max simultaneous voices (e.g. 24) with oldest-voice stealing so fast passages never distort on mobile CPUs; release active oscillators cleanly on `stopAll()`.
  - In `playbackClock.ts`: track `lastProcessedTimeSec` so advancing `[prev, next)` triggers notes with `startTimeSec >= prev && startTimeSec < next` (and handles `prev === 0` cleanly on first play/loop wrap).
- [ ] **Step 4: Run test to verify it passes**
  - Run: `npm test -- --run src/audio/__tests__/playbackClock.test.ts`
  - Expected: PASS
- [ ] **Step 5: Commit**
  - `git add apps/web/src/audio && git commit -m "feat: add offline Web Audio piano synth and playback clock"`

---

### Task 5: 60fps MuseScore-Style Waterfall Canvas & Interactive Piano Keyboard

**Files:**
- Create: `apps/web/src/renderer/keyboardLayout.ts`
- Create: `apps/web/src/renderer/waterfallRenderer.ts`
- Create: `apps/web/src/components/PianoStage.tsx`
- Test: `apps/web/src/renderer/__tests__/keyboardLayout.test.ts`

**Interfaces:**
- Consumes: `Song`, `NoteEvent`, `NoteLabelMode`, `HandControlState` from `src/core/types.ts`; `isBlackKey`, `midiToNoteLabel`, `clampMidi` from `src/core/noteNames.ts`; `PlaybackClock`, `NotePlayer` from `src/audio/`.
- Produces in `src/renderer/keyboardLayout.ts`:
  - `KeyRect { midi: number; isBlack: boolean; x: number; y: number; width: number; height: number }`
  - `KeyboardLayout { startMidi: number; endMidi: number; whiteKeyWidth: number; keys: KeyRect[]; byMidi: Map<number, KeyRect> }`
  - `buildKeyboardLayout(startMidi: number, endMidi: number, width: number, height: number): KeyboardLayout`
  - `hitTestKey(layout: KeyboardLayout, x: number, y: number): number | null` (checks black keys first, then white keys)
- Produces in `src/renderer/waterfallRenderer.ts`:
  - `Particle { x: number; y: number; vx: number; vy: number; alpha: number; color: string; size: number }`
  - `renderWaterfallFrame(ctx: CanvasRenderingContext2D, params: WaterfallFrameParams): void`
- Produces in `src/components/PianoStage.tsx`:
  - `<PianoStage song={song} clock={clock} player={player} ... />`: combines the 60fps waterfall Canvas (with vertical touch/mouse drag scrubbing) and bottom interactive piano keyboard (touch/click to hear key, lights up active notes in hand colors).

- [ ] **Step 1: Write the failing test in `apps/web/src/renderer/__tests__/keyboardLayout.test.ts`**
  ```ts
  import { describe, it, expect } from 'vitest';
  import { buildKeyboardLayout, hitTestKey } from '../keyboardLayout';

  describe('keyboardLayout', () => {
    it('places white keys edge-to-edge and black keys between them', () => {
      const layout = buildKeyboardLayout(60, 72, 800, 120); // C4..C5 = 8 white keys
      const whites = layout.keys.filter((k) => !k.isBlack);
      expect(whites).toHaveLength(8);
      expect(whites[0].x).toBe(0);
      expect(whites[whites.length - 1].x + whites[whites.length - 1].width).toBeCloseTo(800, 1);
    });

    it('prioritizes black keys over underlying white keys during hit-testing', () => {
      const layout = buildKeyboardLayout(60, 72, 800, 120);
      const cSharp = layout.byMidi.get(61)!;
      expect(hitTestKey(layout, cSharp.x + cSharp.width / 2, cSharp.height / 2)).toBe(61);
      // Below the black key height, the same x hits a white key (C4 or D4)
      const belowHit = hitTestKey(layout, cSharp.x + 1, cSharp.height + 10);
      expect(belowHit === 60 || belowHit === 62).toBe(true);
    });
  });
  ```
- [ ] **Step 2: Run test to verify it fails**
  - Run: `npm test -- --run src/renderer/__tests__/keyboardLayout.test.ts`
  - Expected: FAIL
- [ ] **Step 3: Implement `keyboardLayout.ts`, `waterfallRenderer.ts`, and `PianoStage.tsx`**
  - `waterfallRenderer.ts`:
    - Dark `#121216` background, subtle vertical octave divider lines (`C` boundaries), horizontal measure grid lines with measure numbers on the left (MuseScore style).
    - Loop region highlight band when A–B loop is active.
    - Falling rounded bars colored by hand (`left`: `#22c55e` white key / `#16a34a` black key; `right`: `#22d3ee` white key / `#0891b2` black key), filtered by `hands.left.visual` / `hands.right.visual` and transposed by `transpose`.
    - **Note Name Labels:** Draw bold high-contrast text (`#0a0a0f` or `#ffffff` with subtle outline) inside the bottom of each bar (clamped to bar width, minimum 11px font, or centered if short bar) using `midiToNoteLabel(transposedMidi, noteLabelMode)`.
    - Toggleable glow & spark particles emitted at the key contact line (`y = waterfallHeight`) when a note is actively playing.
  - `PianoStage.tsx`:
    - High-DPI (`devicePixelRatio`) canvas sizing via `ResizeObserver`.
    - Vertical pointer drag on waterfall scrubs `clock.seek(...)` smoothly (pausing during drag, resuming if it was playing).
    - Pointer down on piano keyboard calls `hitTestKey`, unlocks audio, and plays that key via `player.playNote`.
- [ ] **Step 4: Run test to verify it passes**
  - Run: `npm test -- --run src/renderer/__tests__/keyboardLayout.test.ts`
  - Expected: PASS
- [ ] **Step 5: Commit**
  - `git add apps/web/src/renderer apps/web/src/components/PianoStage.tsx && git commit -m "feat: add 60fps MuseScore-style waterfall canvas and interactive keyboard"`

---

### Task 6: Mobile-Landscape Practice UI, Library, PDF Upload & App Integration

**Files:**
- Create: `apps/web/src/components/TopBar.tsx`
- Create: `apps/web/src/components/LibraryModal.tsx`
- Create: `apps/web/src/components/SettingsModal.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/index.html`
- Test: `apps/web/src/__tests__/App.test.tsx`

**Interfaces:**
- Consumes: all core parsers, storage, `omrClient`, `PlaybackClock`, `PianoSynth`, and `PianoStage`.
- Produces: Complete interactive application in `App.tsx` with:
  - Compact MuseScore-style dark top bar optimized for landscape phones (44px touch targets, non-crowded popovers for **Hands** and **Loop A–B**).
  - Independent Left/Right Hand **Audio** & **Visual** toggles inside the Hands popover + 1-tap `Cả 2 tay` / `Tay phải` / `Tay trái` presets.
  - BPM `- / +` + speed presets (`50%`, `75%`, `100%`), Transpose `- / +`, Note Labels cycle (`C D E` / `Đô Rê Mi` / `Tắt`), Effects `On/Off`, Keyboard Zoom (`Auto` / `88 phím`).
  - Library modal: browse saved songs, delete songs, upload `.musicxml`/`.xml`/`.mxl`/`.mid`/`.pdf` with multi-page PDF progress bar + Cancel button + clear link to Settings when OMR Server URL is unset.
  - Settings modal: configure OMR Server URL + "Kiểm tra kết nối" (Health Check) + toggle note labels on piano keys.
  - Portrait-mode gentle hint banner on narrow portrait viewports suggesting rotating the phone to landscape.
  - Keyboard shortcuts on desktop: `Space` (play/pause), `ArrowLeft`/`ArrowRight` (step measure), `R` (restart), `L` (toggle loop).

- [ ] **Step 1: Write the failing integration test in `apps/web/src/__tests__/App.test.tsx`**
  - Render `<App />` (mocking `ResizeObserver` and canvas 2D context in jsdom).
  - Assert first demo song title (*Ode to Joy*) is loaded and displayed.
  - Click the Note Labels button and verify it cycles `C D E` → `Đô Rê Mi` → `Tắt`.
  - Click the Hands button, open the popover, toggle Right Hand audio mute independently while verifying Right Hand visual stays enabled.
  - Click Library button, verify demo songs list appears and file input accepts `.musicxml,.xml,.mxl,.mid,.midi,.pdf`.
- [ ] **Step 2: Run test to verify it fails**
  - Run: `npm test -- --run src/__tests__/App.test.tsx`
  - Expected: FAIL
- [ ] **Step 3: Implement `TopBar.tsx`, `LibraryModal.tsx`, `SettingsModal.tsx`, `App.tsx`, and PWA meta tags in `index.html`**
  - Include iOS PWA meta tags (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `viewport-fit=cover`) in `index.html`.
- [ ] **Step 4: Run all frontend tests & production build**
  - Run: `npm test -- --run && npm run build` in `apps/web`
  - Expected: All tests PASS and `dist/` builds cleanly with zero TypeScript errors.
- [ ] **Step 5: Commit**
  - `git add apps/web/src apps/web/index.html && git commit -m "feat: add mobile-landscape practice UI, song library, and PDF upload flow"`

---

### Task 7: Python FastAPI Multi-Page PDF OMR Backend (`services/omr-backend/`)

**Files:**
- Create: `services/omr-backend/musicxml_stitcher.py`
- Create: `services/omr-backend/omr_engine.py`
- Create: `services/omr-backend/app.py`
- Create: `services/omr-backend/requirements.txt`
- Create: `services/omr-backend/Dockerfile`
- Create: `services/omr-backend/README.md`
- Test: `services/omr-backend/tests/test_stitcher.py`
- Test: `services/omr-backend/tests/test_api.py`

**Interfaces:**
- Produces HTTP API matching `apps/web/src/core/omrClient.ts`:
  - `GET /api/health` → `{ status: "ok", engine: string, available: boolean }`
  - `POST /api/jobs` (multipart `file`: `.pdf`) → `{ jobId: string, totalPages: number }`
  - `GET /api/jobs/{jobId}` → `{ jobId, status: "queued"|"processing"|"done"|"error", currentPage, totalPages, musicxml?: string, error?: string }`
  - `DELETE /api/jobs/{jobId}` → `{ status: "cancelled" }`
- Produces in `musicxml_stitcher.py`:
  - `stitch_musicxml_pages(page_xmls: list[str], title: str) -> str`

- [ ] **Step 1: Set up Python virtual environment in `services/omr-backend/.venv` and install lightweight core/test deps (`fastapi`, `uvicorn`, `python-multipart`, `pypdfium2`, `pytest`, `httpx`)**
  - Keep `homr` listed in `requirements.txt` and `Dockerfile` (installed in container or on demand so local test runs don't download gigabytes of ML weights).
- [ ] **Step 2: Write the failing tests in `services/omr-backend/tests/test_stitcher.py` and `test_api.py`**
  - `test_stitcher.py`: given two single-page `<score-partwise>` MusicXML strings (each with measures `1..2`), `stitch_musicxml_pages` returns one valid `<score-partwise>` with measures renumbered sequentially `1, 2, 3, 4` and preserves `<part-list>` and `<attributes>`.
  - `test_api.py`: using FastAPI `TestClient` with an injected fake OMR page converter:
    - `GET /api/health` returns `200` and `{ status: "ok" }`.
    - `POST /api/jobs` rejects non-PDF files with `400`.
    - `POST /api/jobs` with a minimal valid 2-page PDF returns `jobId` & `totalPages: 2`, and polling `GET /api/jobs/{jobId}` reaches `status: "done"` with stitched `musicxml`.
    - `DELETE /api/jobs/{jobId}` cancels/removes a job cleanly.
- [ ] **Step 3: Run tests to verify they fail**
  - Run: `.venv\Scripts\pytest -v` in `services/omr-backend`
  - Expected: FAIL
- [ ] **Step 4: Implement `musicxml_stitcher.py`, `omr_engine.py`, `app.py`, `Dockerfile`, and `README.md`**
  - `omr_engine.py`: renders each PDF page to PNG via `pypdfium2` at 200 DPI, runs `homr` subprocess on each page image to produce `.musicxml`, and supports dependency injection for tests.
  - `app.py`: enables CORS (`allow_origins=["*"]`) so GitHub Pages HTTPS PWA and Android Capacitor `.apk` can call it directly; runs jobs in a background thread pool with cancellation check between pages.
  - `Dockerfile`: Python 3.12-slim + system libs + `pip install -r requirements.txt` + exposes port `7860` (Hugging Face Spaces default) via `uvicorn app:app --host 0.0.0.0 --port 7860`.
- [ ] **Step 5: Run tests to verify they pass**
  - Run: `.venv\Scripts\pytest -v` in `services/omr-backend`
  - Expected: PASS
- [ ] **Step 6: Commit**
  - `git add services/omr-backend && git commit -m "feat: add async multi-page Python FastAPI OMR backend and Dockerfile"`

---

### Task 8: Capacitor Android `.apk` Packaging & GitHub Actions Workflows (APK + iOS HTTPS PWA)

**Files:**
- Create: `apps/web/capacitor.config.ts`
- Create: `apps/web/android/` (generated via `npx cap add android`, customized `AndroidManifest.xml` for landscape & `network_security_config.xml` for optional local HTTP OMR)
- Create: `.github/workflows/build-apk.yml`
- Create: `.github/workflows/deploy-pwa.yml`
- Create: `README.md` (Vietnamese user guide: how to run locally, how to download `.apk` from GitHub Actions, how to install PWA on iOS Safari, and how to deploy the free PDF OMR backend to Hugging Face Spaces)

**Interfaces:**
- Consumes: `apps/web/dist` production bundle.
- Produces: Ready-to-build Capacitor Android project + automated CI workflows for `.apk` and HTTPS iOS PWA.

- [ ] **Step 1: Install Capacitor 6 packages in `apps/web` and create `capacitor.config.ts`**
  - Install `@capacitor/core@^6.1.0`, `@capacitor/cli@^6.1.0`, `@capacitor/android@^6.1.0`.
  - Configure `appId: 'com.pianowaterfall.app'`, `appName: 'Piano Waterfall'`, `webDir: 'dist'`, `server: { androidScheme: 'http', cleartext: true }`.
- [ ] **Step 2: Generate Android project & configure landscape + network security**
  - Run `npm run build && npx cap add android && npx cap sync android` in `apps/web`.
  - Update `apps/web/android/app/src/main/AndroidManifest.xml` to prefer `sensorLandscape` and reference `network_security_config.xml` (permitting cleartext HTTP for optional LAN OMR testing).
- [ ] **Step 3: Create `.github/workflows/build-apk.yml` and `.github/workflows/deploy-pwa.yml`**
  - `build-apk.yml`: triggers on push to `main` and `workflow_dispatch`; sets up Node 18 + Java 17 (Temurin) + Android SDK; runs `npm ci`, `npm run build`, `npx cap sync android`, `./gradlew assembleDebug` in `apps/web/android`, and uploads `app-debug.apk` via `actions/upload-artifact@v4`.
  - `deploy-pwa.yml`: triggers on push to `main` and `workflow_dispatch`; builds `apps/web` with `VITE_BASE_PATH` set to `/${{ github.event.repository.name }}/` and deploys `apps/web/dist` to GitHub Pages via `actions/deploy-pages@v4`.
- [ ] **Step 4: Write root `README.md` in Vietnamese**
  - Clear step-by-step instructions for: (1) testing on PC, (2) getting the `.apk` from GitHub Actions, (3) installing on iPhone/iPad via GitHub Pages HTTPS PWA, (4) deploying `services/omr-backend` to Hugging Face Spaces for PDF conversion.
- [ ] **Step 5: Run full verification suite**
  - Run `npm test -- --run && npm run build && npx cap sync android` in `apps/web`.
  - Run `.venv\Scripts\pytest -v` in `services/omr-backend`.
  - Expected: All frontend tests, production build, Capacitor sync, and backend tests PASS.
- [ ] **Step 6: Commit**
  - `git add . && git commit -m "feat: add Capacitor Android project, GitHub Actions APK/PWA workflows, and guide"`
