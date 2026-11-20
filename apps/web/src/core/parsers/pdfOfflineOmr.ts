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

const MAJOR_SCALE_OFFSETS = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B

export function diatonicStepToMidi(clef: 'treble' | 'bass', stepsFromBottomLine: number): number {
  const baseDiatonic = clef === 'treble' ? 30 : 18; // E4 = 30, G2 = 18
  const diatonic = baseDiatonic + stepsFromBottomLine;
  const octave = Math.floor(diatonic / 7);
  const degree = ((diatonic % 7) + 7) % 7;
  const midi = (octave + 1) * 12 + MAJOR_SCALE_OFFSETS[degree];
  return clampMidi(midi);
}

function estimateBackgroundBrightness(gray: Uint8Array): number {
  // Sample every 16th pixel to estimate 85th percentile background brightness (fast)
  const hist = new Uint32Array(256);
  let total = 0;
  for (let i = 0; i < gray.length; i += 16) {
    hist[gray[i]]++;
    total++;
  }
  const target = Math.floor(total * 0.85);
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= target) return Math.max(180, v);
  }
  return 245;
}

export function detectStavesFromGrayscale(
  gray: Uint8Array,
  width: number,
  height: number,
): DetectedStaff[] {
  const bg = estimateBackgroundBrightness(gray);
  // Adaptive threshold catches even thin anti-aliased gray staff lines (~205-220 on white 255)
  const staffThreshold = Math.max(140, bg - 32);

  const rowDarkCounts = new Int32Array(height);
  for (let y = 0; y < height; y++) {
    let count = 0;
    const rowOff = y * width;
    for (let x = 0; x < width; x++) {
      if (gray[rowOff + x] < staffThreshold) count++;
    }
    rowDarkCounts[y] = count;
  }

  // Staff lines typically span at least 22% of page width (handles indented first systems)
  const minLinePixels = Math.floor(width * 0.22);
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
      // Reject thick solid horizontal bands (e.g., headers/borders > 6px thick)
      if (endY - y <= 6) {
        candidateRows.push(bestY);
      }
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
      avg <= 42 &&
      diffs.every((d) => Math.abs(d - avg) <= Math.max(2.5, avg * 0.28));

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
      next !== undefined && next.linesY[0] - current.linesY[4] < currentHeight * 3.0;

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

  const bg = estimateBackgroundBrightness(gray);
  const noteThreshold = Math.max(120, bg - 65);

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

  const secPerBeat = 60 / bpm;
  const notes: NoteEvent[] = [];
  const measures: MeasureEvent[] = [];
  let curTime = startTimeSec;
  let curMeasure = startMeasureNumber;
  let idCounter = 0;

  for (const system of systems) {
    const systemNotes: Array<{ x: number; midi: number; hand: Hand; durationBeats: number }> = [];

    for (const staff of system) {
      const sp = staff.spacing;
      const headW = Math.max(5, Math.round(sp * 1.15));
      const headH = Math.max(4, Math.round(sp * 0.9));
      const scanTop = Math.max(0, Math.floor(staff.topY - sp * 3.5));
      const scanBot = Math.min(height - headH, Math.ceil(staff.bottomY + sp * 3.5));
      // Skip left clef/time-signature region (~10% of width)
      const scanLeft = Math.floor(width * 0.1);
      const scanRight = Math.floor(width * 0.97);

      const stepX = Math.max(2, Math.floor(headW / 3));
      const stepY = Math.max(1, Math.floor(headH / 3));
      const candidates: Array<{ x: number; y: number; score: number; hollow: boolean }> = [];

      for (let y = scanTop; y <= scanBot - headH; y += stepY) {
        for (let x = scanLeft; x <= scanRight - headW; x += stepX) {
          let totalDark = 0;
          let totalChecked = 0;
          let borderDark = 0;
          let borderChecked = 0;
          let centerDark = 0;
          let centerChecked = 0;
          let colHits = 0;

          for (let dx = 0; dx < headW; dx++) {
            let colHasDark = false;
            for (let dy = 0; dy < headH; dy++) {
              const py = y + dy;
              const onStaffLine = staff.linesY.some((ly) => Math.abs(py - ly) <= 1);
              if (onStaffLine) continue;

              const isDark = gray[py * width + x + dx] < noteThreshold;
              totalChecked++;
              if (isDark) {
                totalDark++;
                colHasDark = true;
              }

              const isBorder =
                dx === 0 || dx === headW - 1 || dy === 0 || dy === headH - 1 ||
                dx === 1 || dx === headW - 2;
              if (isBorder) {
                borderChecked++;
                if (isDark) borderDark++;
              } else {
                centerChecked++;
                if (isDark) centerDark++;
              }
            }
            if (colHasDark) colHits++;
          }

          if (totalChecked === 0) continue;
          // Reject thin vertical barlines/stems (must span at least 65% of notehead width horizontally)
          if (colHits < headW * 0.65) continue;

          const density = totalDark / totalChecked;
          const borderDensity = borderChecked > 0 ? borderDark / borderChecked : 0;
          const centerDensity = centerChecked > 0 ? centerDark / centerChecked : 0;

          // Filled notehead (quarter / eighth / sixteenth)
          if (density >= 0.42) {
            candidates.push({
              x: x + headW / 2,
              y: y + headH / 2,
              score: density,
              hollow: false,
            });
          } else if (borderDensity >= 0.42 && centerDensity <= 0.3 && density >= 0.24) {
            // Hollow notehead (half / whole note)
            candidates.push({
              x: x + headW / 2,
              y: y + headH / 2,
              score: borderDensity * 0.9,
              hollow: true,
            });
          }
        }
      }

      // Non-maximum suppression
      candidates.sort((a, b) => b.score - a.score);
      const picked: Array<{ x: number; y: number }> = [];
      for (const c of candidates) {
        const tooClose = picked.some(
          (p) => Math.abs(p.x - c.x) < headW * 0.85 && Math.abs(p.y - c.y) < headH * 0.85,
        );
        if (!tooClose) {
          picked.push({ x: c.x, y: c.y });
          const halfStepPx = sp / 2;
          const stepsUp = Math.round((staff.bottomY - c.y) / halfStepPx);
          const midi = diatonicStepToMidi(staff.clef, stepsUp);
          systemNotes.push({
            x: c.x,
            midi,
            hand: staff.hand,
            durationBeats: c.hollow ? 2.0 : 0.75,
          });
        }
      }
    }

    if (systemNotes.length === 0) continue;

    // Sort by X and cluster simultaneous chord notes
    systemNotes.sort((a, b) => a.x - b.x);
    const clusterTol = Math.max(8, system[0].spacing * 1.15);
    const clusters: Array<Array<{ x: number; midi: number; hand: Hand; durationBeats: number }>> = [];

    for (const n of systemNotes) {
      const last = clusters[clusters.length - 1];
      if (last && Math.abs(n.x - last[0].x) <= clusterTol) {
        last.push(n);
      } else {
        clusters.push([n]);
      }
    }

    const beatsPerStep = 0.5;
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
          durationSec: item.durationBeats * secPerBeat,
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
  // Load legacy pdf.js + in-process worker so it runs 100% offline inside Android WebView & iOS Safari
  const [pdfjsLib, workerMod] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.mjs'),
  ]);
  (globalThis as unknown as { pdfjsWorker?: unknown }).pdfjsWorker = workerMod;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
    isEvalSupported: false,
  });
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
    const viewport = page.getViewport({ scale: 2.2 });
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
      'No sheet music staves or notes detected in this PDF. Please try a clearer digital piano sheet PDF, MusicXML (.musicxml/.mxl), or MIDI (.mid) file.',
    );
  }

  allNotes.sort((a, b) => a.startTimeSec - b.startTimeSec || a.midi - b.midi);
  const minMidi = allNotes.reduce((acc, n) => Math.min(acc, n.midi), 108);
  const maxMidi = allNotes.reduce((acc, n) => Math.max(acc, n.midi), 21);

  return {
    id: `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: file.name.replace(/\.pdf$/i, '') || 'PDF Score',
    composer: 'Offline PDF',
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
