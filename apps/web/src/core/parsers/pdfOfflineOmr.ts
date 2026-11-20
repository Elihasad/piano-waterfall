import { clampMidi } from '../noteNames';
import type { Hand, MeasureEvent, NoteEvent, Song } from '../types';

export interface DetectedStaff {
  linesY: [number, number, number, number, number];
  spacing: number;
  topY: number;
  bottomY: number;
  clef: 'treble' | 'bass';
  hand: Hand;
}

// Diatonic pitch tables indexed by half-staff-step above bottom line (step 0 = bottom line)
// Treble bottom line = E4 (64): E4, F4, G4, A4, B4, C5, D5, E5, F5 ...
// Bass bottom line = G2 (43): G2, A2, B2, C3, D3, E3, F3, G3, A3 ...
const MAJOR_SCALE_OFFSETS = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B

export function diatonicStepToMidi(clef: 'treble' | 'bass', stepsFromBottomLine: number): number {
  // Represent pitch as diatonic index where C0 = 0
  // Treble bottom line E4 = 4*7 + 2 = 30
  // Bass bottom line G2 = 2*7 + 4 = 18
  const baseDiatonic = clef === 'treble' ? 30 : 18;
  const diatonic = baseDiatonic + stepsFromBottomLine;
  const octave = Math.floor(diatonic / 7);
  const degree = ((diatonic % 7) + 7) % 7;
  const midi = (octave + 1) * 12 + MAJOR_SCALE_OFFSETS[degree];
  return clampMidi(midi);
}

export function detectStavesFromGrayscale(
  gray: Uint8Array,
  width: number,
  height: number,
): DetectedStaff[] {
  const darkThreshold = 175;
  const rowDarkCounts = new Int32Array(height);
  for (let y = 0; y < height; y++) {
    let count = 0;
    const rowOff = y * width;
    for (let x = 0; x < width; x++) {
      if (gray[rowOff + x] < darkThreshold) count++;
    }
    rowDarkCounts[y] = count;
  }

  // Staff lines typically span at least 32% of page width
  const minLinePixels = Math.floor(width * 0.32);
  const candidateRows: number[] = [];
  let y = 0;
  while (y < height) {
    if (rowDarkCounts[y] >= minLinePixels) {
      let bestY = y;
      let bestCount = rowDarkCounts[y];
      let endY = y;
      while (endY + 1 < height && rowDarkCounts[endY + 1] >= minLinePixels) {
        endY++;
        if (rowDarkCounts[endY] > bestCount) {
          bestCount = rowDarkCounts[endY];
          bestY = endY;
        }
      }
      candidateRows.push(bestY);
      y = endY + 1;
    } else {
      y++;
    }
  }

  // Group into 5-line staves with consistent spacing
  const rawStaves: Array<{ linesY: [number, number, number, number, number]; spacing: number }> = [];
  let idx = 0;
  while (idx + 4 < candidateRows.length) {
    const g = candidateRows.slice(idx, idx + 5);
    const diffs = [g[1] - g[0], g[2] - g[1], g[3] - g[2], g[4] - g[3]];
    const avg = (diffs[0] + diffs[1] + diffs[2] + diffs[3]) / 4;
    const validSpacing =
      avg >= 4 &&
      avg <= 36 &&
      diffs.every((d) => Math.abs(d - avg) <= Math.max(2.5, avg * 0.25));

    if (validSpacing) {
      rawStaves.push({
        linesY: [g[0], g[1], g[2], g[3], g[4]],
        spacing: avg,
      });
      idx += 5;
    } else {
      idx += 1;
    }
  }

  // Pair staves into grand-staff systems (treble = right, bass = left)
  const staves: DetectedStaff[] = [];
  let sIdx = 0;
  while (sIdx < rawStaves.length) {
    const current = rawStaves[sIdx];
    const next = rawStaves[sIdx + 1];
    const currentHeight = current.linesY[4] - current.linesY[0];
    const isGrandStaffPair =
      next !== undefined && next.linesY[0] - current.linesY[4] < currentHeight * 2.8;

    if (isGrandStaffPair && next) {
      staves.push({
        linesY: current.linesY,
        spacing: current.spacing,
        topY: current.linesY[0],
        bottomY: current.linesY[4],
        clef: 'treble',
        hand: 'right',
      });
      staves.push({
        linesY: next.linesY,
        spacing: next.spacing,
        topY: next.linesY[0],
        bottomY: next.linesY[4],
        clef: 'bass',
        hand: 'left',
      });
      sIdx += 2;
    } else {
      staves.push({
        linesY: current.linesY,
        spacing: current.spacing,
        topY: current.linesY[0],
        bottomY: current.linesY[4],
        clef: 'treble',
        hand: 'right',
      });
      sIdx += 1;
    }
  }

  return staves;
}

export function extractNotesFromGrayscalePage(
  gray: Uint8Array,
  width: number,
  height: number,
  startMeasureNumber: number,
  startTimeSec: number,
  bpm = 100,
): { notes: NoteEvent[]; measures: MeasureEvent[]; nextMeasureNumber: number; endTimeSec: number } {
  const staves = detectStavesFromGrayscale(gray, width, height);
  if (staves.length === 0) {
    return { notes: [], measures: [], nextMeasureNumber: startMeasureNumber, endTimeSec: startTimeSec };
  }

  // Group staves into horizontal systems (1 or 2 staves per system)
  const systems: DetectedStaff[][] = [];
  for (let i = 0; i < staves.length; i++) {
    const s = staves[i];
    if (s.clef === 'treble' && staves[i + 1]?.clef === 'bass') {
      systems.push([s, staves[i + 1]]);
      i++;
    } else {
      systems.push([s]);
    }
  }

  const darkThreshold = 150;
  const secPerBeat = 60 / bpm;
  const notes: NoteEvent[] = [];
  const measures: MeasureEvent[] = [];
  let curTime = startTimeSec;
  let curMeasure = startMeasureNumber;
  let idCounter = 0;

  for (const system of systems) {
    const systemNotes: Array<{ x: number; midi: number; hand: Hand }> = [];

    for (const staff of system) {
      const sp = staff.spacing;
      const headW = Math.max(4, Math.round(sp * 1.15));
      const headH = Math.max(4, Math.round(sp * 0.92));
      const scanTop = Math.max(0, Math.floor(staff.topY - sp * 3.5));
      const scanBot = Math.min(height - headH, Math.ceil(staff.bottomY + sp * 3.5));
      // Skip left margin where clef/key signature live (~11% of width)
      const scanLeft = Math.floor(width * 0.11);
      const scanRight = Math.floor(width * 0.96);

      // Build integral image of dark pixels excluding thin 1-2px staff lines
      const stepX = Math.max(2, Math.floor(headW / 3));
      const stepY = Math.max(1, Math.floor(headH / 3));
      const candidates: Array<{ x: number; y: number; score: number }> = [];

      for (let y = scanTop; y <= scanBot - headH; y += stepY) {
        for (let x = scanLeft; x <= scanRight - headW; x += stepX) {
          let dark = 0;
          const total = headW * headH;
          for (let dy = 0; dy < headH; dy++) {
            const py = y + dy;
            const onStaffLine = staff.linesY.some((ly) => Math.abs(py - ly) <= 1);
            if (onStaffLine) continue;
            const rowOff = py * width;
            for (let dx = 0; dx < headW; dx++) {
              if (gray[rowOff + x + dx] < darkThreshold) dark++;
            }
          }
          const density = dark / Math.max(1, total * 0.8);
          if (density >= 0.52) {
            candidates.push({ x: x + headW / 2, y: y + headH / 2, score: density });
          }
        }
      }

      // Non-maximum suppression to keep 1 center per notehead
      candidates.sort((a, b) => b.score - a.score);
      const picked: Array<{ x: number; y: number }> = [];
      for (const c of candidates) {
        const tooClose = picked.some(
          (p) => Math.abs(p.x - c.x) < headW * 0.85 && Math.abs(p.y - c.y) < headH * 0.85,
        );
        if (!tooClose) {
          picked.push({ x: c.x, y: c.y });
          // Compute diatonic half-steps from bottom line (linesY[4]) upward
          const halfStepPx = sp / 2;
          const stepsUp = Math.round((staff.bottomY - c.y) / halfStepPx);
          const midi = diatonicStepToMidi(staff.clef, stepsUp);
          systemNotes.push({ x: c.x, midi, hand: staff.hand });
        }
      }
    }

    if (systemNotes.length === 0) continue;

    // Sort by X and cluster simultaneous notes into chords
    systemNotes.sort((a, b) => a.x - b.x);
    const clusterTol = Math.max(8, system[0].spacing * 1.1);
    const clusters: Array<Array<{ x: number; midi: number; hand: Hand }>> = [];

    for (const n of systemNotes) {
      const last = clusters[clusters.length - 1];
      if (last && Math.abs(n.x - last[0].x) <= clusterTol) {
        last.push(n);
      } else {
        clusters.push([n]);
      }
    }

    // Assign clean rhythmic grid (4 beats per measure, ~4 measures per system)
    const beatsPerStep = 0.5; // eighth-note visual rhythm grid
    const systemDurationSec = Math.max(4 * secPerBeat, clusters.length * beatsPerStep * secPerBeat);
    const systemMeasures = Math.max(1, Math.round(systemDurationSec / (4 * secPerBeat)));

    for (let m = 0; m < systemMeasures; m++) {
      measures.push({
        number: curMeasure + m,
        startTimeSec: curTime + m * 4 * secPerBeat,
        endTimeSec: curTime + (m + 1) * 4 * secPerBeat,
        beats: 4,
        beatType: 4,
      });
    }

    clusters.forEach((cluster, cIdx) => {
      const noteStart = curTime + cIdx * beatsPerStep * secPerBeat;
      const measureOffset = Math.floor((cIdx * beatsPerStep) / 4);
      const seenMidis = new Set<number>();
      for (const item of cluster) {
        if (seenMidis.has(item.midi)) continue;
        seenMidis.add(item.midi);
        notes.push({
          id: `pdf-n-${curMeasure}-${idCounter++}`,
          midi: item.midi,
          startTimeSec: noteStart,
          durationSec: beatsPerStep * secPerBeat * 0.95,
          velocity: item.hand === 'left' ? 0.68 : 0.82,
          hand: item.hand,
          measureNumber: curMeasure + measureOffset,
        });
      }
    });

    curTime += systemMeasures * 4 * secPerBeat;
    curMeasure += systemMeasures;
  }

  return { notes, measures, nextMeasureNumber: curMeasure, endTimeSec: curTime };
}

export async function parsePdfOffline(
  file: File,
  onProgress?: (progress: { currentPage: number; totalPages: number }) => void,
): Promise<Song> {
  const [pdfjsLib, workerMod] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerMod.default;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  const totalPages = pdf.numPages;
  const allNotes: NoteEvent[] = [];
  const allMeasures: MeasureEvent[] = [];
  let nextMeasure = 1;
  let currentTime = 0;
  const bpm = 100;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.({ currentPage: pageNum, totalPages });
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.8 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const rgba = imageData.data;
    const gray = new Uint8Array(canvas.width * canvas.height);
    for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
      gray[i] = (rgba[p] * 77 + rgba[p + 1] * 150 + rgba[p + 2] * 29) >> 8;
    }

    const res = extractNotesFromGrayscalePage(
      gray,
      canvas.width,
      canvas.height,
      nextMeasure,
      currentTime,
      bpm,
    );
    allNotes.push(...res.notes);
    allMeasures.push(...res.measures);
    nextMeasure = res.nextMeasureNumber;
    currentTime = res.endTimeSec;
  }

  if (allNotes.length === 0) {
    throw new Error(
      'Could not detect sheet music staves/notes in this PDF offline. Try a clearer engraved PDF or configure an optional Cloud OMR server in Settings.',
    );
  }

  allNotes.sort((a, b) => a.startTimeSec - b.startTimeSec || a.midi - b.midi);
  const minMidi = allNotes.reduce((acc, n) => Math.min(acc, n.midi), 108);
  const maxMidi = allNotes.reduce((acc, n) => Math.max(acc, n.midi), 21);

  return {
    id: `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: file.name.replace(/\.pdf$/i, '') || 'PDF Score',
    composer: 'Offline PDF (Beta)',
    sourceFormat: 'pdf',
    createdAt: Date.now(),
    defaultBpm: bpm,
    durationSec: Math.max(currentTime, 2),
    tempoEvents: [{ timeSec: 0, bpm }],
    measures: allMeasures,
    notes: allNotes,
    minMidi,
    maxMidi,
  };
}
