# Piano Waterfall Practice App — Design Document

**Date:** 2026-11-19  
**Status:** Draft (Pending User Approval)  
**Target Platforms:** Android (`.apk` via Capacitor) & iOS (PWA via Safari "Add to Home Screen"), plus Desktop Web Browser.

---

## 1. Intent & Why

The user practices piano primarily on a phone (Android or iOS) placed on a digital piano music stand, rarely using a PC during practice. Currently, they learn songs by watching Synthesia-style falling-notes tutorial videos on YouTube (e.g., *Weight of the World* piano tutorials), pausing frequently to learn note-by-note and phrase-by-phrase on their physical digital piano until fluent before moving on.

YouTube videos are passive and rigid: you cannot easily loop exact measures, mute one hand, transpose, slow down cleanly without audio distortion, or load your own sheet music. This app gives the user a MuseScore-inspired falling-notes practice player on their phone where they can import their own **MusicXML** and **PDF** sheet music, see clear **note names (`C, D, E, F...`) directly on each falling bar**, and control playback precisely for phrase-by-phrase practice.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
1. **Direct Sheet Music Import:**
   - **MusicXML (`.musicxml`, `.xml`, `.mxl`)** and **MIDI (`.mid`, `.midi`)** parsed 100% locally on the phone, offline and instantly.
   - **PDF (`.pdf`)** converted to MusicXML via a decoupled Python OMR backend service (deployable to cloud e.g. Hugging Face Spaces, or run temporarily on PC), then cached permanently on-device for offline practice.
2. **MuseScore-Style Waterfall Visualization:**
   - Dark-mode UI inspired by MuseScore's piano-roll view.
   - 60fps HTML5 Canvas waterfall with measure lines/numbers, distinct Left Hand (green) & Right Hand (cyan/blue) colors, and toggleable glow/particle effects when notes hit the keys.
   - Interactive piano keyboard docked at the bottom, lighting up in the matching hand color as notes play.
3. **Clear Note Names on Falling Bars:**
   - Every falling note bar displays its note name (`C, D, E, F...`, including sharps/flats like `F#`, `Bb`) clearly inside or above the bar.
   - User-toggleable label mode: `C D E` (default), `Do Re Mi`, or `Off`, plus optional labels on the piano keys themselves.
4. **Phrase-by-Phrase Practice Controls (Mobile Landscape First):**
   - Touch-friendly controls sized for landscape phones: Play/Pause, Restart, BPM / Speed control (`- / +` and quick presets like `50%`, `75%`, `100%`), A–B Measure Loop, Step Backward/Forward by measure, and drag-to-scrub directly on the timeline or waterfall.
   - Left Hand / Right Hand independent mute & visibility toggles.
   - Transpose (`-12` to `+12` semitones), updating both audio pitch and displayed note names/positions.
   - **Auto-fit / Zoomable Keyboard Range:** Automatically fits or lets the user zoom the visible piano range (e.g. 2–5 octaves instead of squeezing all 88 keys) so falling bars and note names remain large and readable on a phone screen.
5. **Realistic Offline Piano Audio:**
   - Sampled piano playback via Web Audio API with bundled/cached samples so playback works completely offline on Android `.apk` and iOS PWA (including proper iOS Safari audio unlock on first user tap).
6. **On-Device Song Library:**
   - Imported songs (including converted PDFs) saved locally in IndexedDB so the user never needs a PC or internet connection once a song is added.
   - Includes 1–2 small built-in demo pieces so the user can test the waterfall immediately on first launch.
7. **Android `.apk` + iOS PWA Packaging:**
   - Packaged via **Capacitor** for Android `.apk`, with an automated **GitHub Actions** workflow to build the `.apk` in the cloud (since the local Windows machine has no JDK/Android SDK).
   - Configured as an offline-capable **PWA** (`vite-plugin-pwa`) for iOS Safari "Add to Home Screen".

### Non-Goals (v1)
- Physical USB/Bluetooth MIDI keyboard input and "Wait Mode" (user explicitly deferred this for v1; architecture stays compatible with Web MIDI / Capacitor MIDI later).
- Traditional 5-line sheet music editor or score engraving.
- User accounts, cloud sync, or built-in online sheet music marketplace.
- Audio/MP3/YouTube-to-MIDI AI transcription.
- Running OMR AI locally inside the mobile browser/WebView.

### Anti-Goals
- **Unreadable note names on a phone:** Squeezing 88 tiny keys onto a phone screen so `C, D, E` labels become microscopic or overlap is a failure. Smart range zooming + readable typography on mobile landscape is mandatory.
- **Audio/visual desync or jank:** Falling notes must stay tightly synced to the Web Audio clock (`AudioContext.currentTime`) at 60fps.
- **Requiring the PC during practice:** Once installed and songs are imported, practicing on Android/iOS must work 100% offline.
- **Silent/confusing PDF errors:** If the OMR backend URL is not configured or unreachable when uploading a PDF, the app must clearly explain the status and let the user configure the OMR server URL in Settings.

---

## 3. Constraints

- **Local Development Environment:** Windows, Node.js `v18.20.0`, Python `3.12.10`. **No Java / JDK / Android SDK** installed locally.
- **Primary Practice Device:** Android & iOS smartphones in **landscape orientation** resting on a piano stand.
- **Offline Storage:** Must persist converted songs and audio samples locally on the phone.
- **iOS Safari Audio & Viewport Quirks:** Must unlock Web Audio on a user gesture, handle safe-area insets (notch/home indicator), and support fullscreen PWA meta tags.

---

## 4. Approaches Considered

| Approach | Summary | Trade-offs |
|---|---|---|
| **1. Mobile-First React + Canvas + Capacitor (`.apk` + iOS PWA) + Decoupled Python OMR Backend** *(Selected)* | Single React/TypeScript/Canvas web app packaged into an Android `.apk` via Capacitor (built via GitHub Actions or local Android SDK) and installable as an offline PWA on iOS. MusicXML/MIDI parse offline on-device; PDF calls a separate deployable Python FastAPI OMR service and caches the result locally. | Best cross-platform coverage (Android `.apk` + iOS PWA) from one codebase; smooth 60fps waterfall; works offline once songs are imported. Requires deploying the Python OMR backend (e.g., Hugging Face Spaces) for anytime mobile PDF uploads. |
| **2. Pure Offline PWA (No PDF OMR Backend)** | Same frontend/Capacitor app, but drops built-in PDF conversion; user converts PDFs externally (MuseScore/Audiveris) to MusicXML. | Simpler and zero backend hosting, but does not satisfy the user's request to upload PDFs directly in the app. |
| **3. Native Mobile App (Flutter / React Native)** | Native mobile codebase for Android/iOS. | Cannot build iOS on Windows without a Mac + Apple Developer account; higher complexity for custom Canvas particle effects; still needs a Python backend for PDF OMR. |
| **4. Fork Existing GitHub Repo (`MIDIano`, `sightread`, `noterain`)** | Modify an existing open-source MIDI falling-notes web app. | Existing web repos are mostly MIDI-only, PC-layout focused, lack MusicXML + PDF OMR + prominent mobile note-name rendering, and would require heavy retrofitting. |

**User Decision:** Selected **Approach 1** (build fresh with React + Canvas + Capacitor for Android `.apk` & iOS PWA, plus decoupled Python OMR backend for PDF).

---

## 5. System Architecture & Key Decisions

### 5.1 Repository Layout (Builder Call)
```text
├── apps/
│   └── web/                  # React + TypeScript + Vite + Tailwind + Capacitor
│       ├── src/
│       │   ├── core/         # Song model, MusicXML parser, MIDI parser, storage (IndexedDB)
│       │   ├── audio/        # Web Audio sampled piano engine & scheduler
│       │   ├── renderer/     # 60fps Canvas waterfall, note labels, particles, keyboard
│       │   ├── components/   # Top bar, Library modal, Upload/PDF flow, Settings, Practice controls
│       │   └── data/         # Built-in demo songs
│       ├── android/          # Capacitor Android project
│       └── capacitor.config.ts
├── services/
│   └── omr-backend/          # Python 3.12 FastAPI service for PDF -> MusicXML
│       ├── app.py            # /api/health, /api/jobs (async PDF conversion + progress)
│       ├── requirements.txt
│       └── Dockerfile        # Ready for Hugging Face Spaces / Railway / Render
└── .github/
    └── workflows/
        ├── build-apk.yml     # Automated Android APK build on GitHub Actions
        └── deploy-pwa.yml    # Automated HTTPS PWA deploy to GitHub Pages (for iOS/Android)
```

### 5.2 Core Data Model (`Song`)
All input formats (MusicXML, `.mxl`, MIDI, and OMR-converted PDF) normalize into one format stored in IndexedDB:
- `id`, `title`, `composer`, `sourceFormat` (`musicxml` | `midi` | `pdf`), `createdAt`
- `tempoEvents`: list of `{ timeSec, bpm }` + `defaultBpm`
- `measures`: list of `{ number, startTimeSec, endTimeSec, beats, beatType }`
- `notes`: list of `{ id, midi: number (21–108), startTimeSec, durationSec, velocity, hand: 'left' | 'right', measureNumber }`
- `minMidi`, `maxMidi`: computed pitch span for smart keyboard auto-zoom.

### 5.3 Parsing Strategy (Builder Calls)
- **MusicXML (`.xml`, `.musicxml`, `.mxl`):** Client-side parser using `jszip` (for compressed `.mxl`) and browser `DOMParser`. Extracts tempo, time signatures, measures, ties (merging tied notes into a single continuous falling bar), chords, and `<staff>` assignment (`staff 1` → right hand, `staff 2` → left hand; fallback to split point `C4 / MIDI 60` for single-staff scores).
- **MIDI (`.mid`, `.midi`):** Client-side parser via `@tonejs/midi`. Assigns hands by track when 2 piano tracks exist, or splits at `C4 (MIDI 60)` when single-track.
- **PDF (`.pdf`):** Multi-page piano scores (typically 3–15 pages) take 15–45s per page on CPU OMR, which would exceed standard HTTP timeouts if run synchronously. Therefore, the Python backend exposes an **asynchronous job API** (Builder Call):
  - `POST {omrServerUrl}/api/jobs` (multipart PDF upload) → returns `{ jobId, totalPages }`.
  - `GET {omrServerUrl}/api/jobs/{jobId}` → returns `{ status: 'queued' | 'processing' | 'done' | 'error', currentPage, totalPages, musicxml?, error? }`.
  - `DELETE {omrServerUrl}/api/jobs/{jobId}` → cancels an in-flight job.
  - The backend renders PDF pages to images (`pypdfium2`), runs Python OMR (`homr` or `oemer`, chosen by builder based on Python 3.12 reliability), and stitches multi-page MusicXML output sequentially (preserving measure numbers and carrying forward key/time signatures across page breaks).
  - The app polls progress (showing `Converting page 2 / 6...`), parses the resulting MusicXML, and saves the normalized `Song` into IndexedDB so it never needs conversion again.

### 5.4 Mobile Landscape UI & Practice UX
- **Top Control Bar (compact, touch-friendly):**
  - Library / Upload button (opens song drawer & file picker for `.musicxml`, `.xml`, `.mxl`, `.mid`, `.pdf`)
  - Transport: Restart, Step Back (1 measure), Play/Pause, Step Forward (1 measure), A–B Loop toggle (with quick measure range selector)
  - Progress bar with current time / total time & current measure number
  - BPM control (`- 115 +` + speed % presets)
  - Quick toggles: **Hands popover** (independent Sound Mute + Visual Show/Hide per hand, plus 1-tap `Both` / `Right Only` / `Left Only` presets so the user can mute a hand's audio while still watching its falling notes), Note Labels (`C D E` / `Do Re Mi` / `Off`), Transpose (`- / +`), Effects (`On/Off`), Keyboard Zoom (`Auto` / `Full 88` / manual `- / +`), Settings (OMR Server URL).
- **Center Waterfall Canvas:**
  - Dark background (`#121216`) with subtle vertical octave guides and horizontal measure lines with measure numbers on the left (matching MuseScore screenshot).
  - Left hand bars in vibrant green (`#4ade80` / `#22c55e`), right hand bars in cyan/blue (`#22d3ee` / `#06b6d4`), with slightly darker shade for black-key notes so accidentals are distinguishable at a glance.
  - **Note Name Rendering:** Bold, high-contrast note name (`C`, `D`, `F#`, `Bb`...) anchored cleanly near the bottom of each falling bar (and centered for short notes) so the user reads the exact key as it approaches the keyboard.
  - Touch-drag vertically on the waterfall canvas to scrub time forward/backward (like rewinding a video frame-by-frame to inspect a chord!).
  - Toggleable hit-glow & spark particles at the key contact line.
- **Bottom Piano Keyboard:**
  - Drawn cleanly with white and black keys, lighting up in the active hand's color on contact.
  - Supports **Auto-Fit Range** (pads the song's `minMidi..maxMidi` by a few keys, clamped to comfortable readability on phone width) and **Full 88-key** toggle.
  - Tapping a piano key plays its sound so the user can check pitch by ear.

### 5.5 Audio Engine (Builder Call)
- Uses Web Audio API with a bundled lightweight multi-sampled acoustic piano (e.g., sampled every 3 semitones in compact `.mp3`/`.ogg` format bundled in `public/samples/` so it works 100% offline inside both the Android `.apk` and iOS PWA).
- Lookahead scheduler synced to `AudioContext.currentTime` so visual waterfall position and audio triggers stay locked even when changing BPM, looping A–B, or scrubbing.

### 5.6 Packaging, Hosting & Build Pipeline (Builder Calls)
- **Capacitor (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`)** configured with landscape orientation preference, splash/status-bar settings, and cleartext HTTP allowed for local-network OMR testing on Android.
- **GitHub Actions — Android APK (`.github/workflows/build-apk.yml`):** Installs Node 18 + JDK 17 + Android SDK, builds the Vite bundle, runs `npx cap sync android`, builds `app-debug.apk` with Gradle, and uploads the `.apk` as a downloadable workflow artifact.
- **PWA & HTTPS Hosting for iOS (`.github/workflows/deploy-pwa.yml` + `vite-plugin-pwa`):** Manifest (`display: "standalone"`, `orientation: "landscape"`) + Service Worker precaching app shell and piano samples for iOS Safari offline use, with a GitHub Actions workflow to deploy automatically to **GitHub Pages over HTTPS** (required by iOS Safari for offline Service Workers).
- **OMR HTTPS Compatibility:** Because an HTTPS iOS PWA blocks Mixed Content (`http://` LAN IPs), the primary mobile PDF workflow targets the Python OMR backend deployed over **HTTPS** (e.g., Hugging Face Spaces with the included `Dockerfile`). Local PC HTTP OMR is supported from desktop browsers and the Android `.apk` (and from iOS if exposed via an HTTPS tunnel such as Cloudflare Tunnel).

---

## 6. Left to the Builder

The following implementation details are intentionally left to the builder's discretion:
- Exact CSS/Tailwind styling tokens, icon set (`lucide-react`), and particle animation tuning.
- Choosing between `homr` and `oemer` (or an adapter supporting both) in `services/omr-backend/` based on clean installation and reliability on Python 3.12 + Linux Docker.
- Exact MusicXML edge-case handling (grace notes, arpeggios, repeat barlines/voltas — handle standard repeats cleanly if straightforward, otherwise linear measure playback with clear documentation).
- Exact sample set compression/size (target < 5 MB total so the `.apk` and PWA cache stay fast).
- Choice of 1–2 public-domain demo songs (e.g., *Ode to Joy* / *Für Elise* opening / *Twinkle Twinkle*) bundled as MusicXML for immediate testing.
