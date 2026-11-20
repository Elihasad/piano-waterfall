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

export interface SmuflTextItem {
  str: string;
  x: number;
  y: number;
  fontSize: number;
}

const MAJOR_SCALE_OFFSETS = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
const FLAT_ORDER_DEGREES = [6, 2, 5, 1, 4, 0, 3]; // B E A D G C F
const SHARP_ORDER_DEGREES = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B

// SMuFL Unicode code points (Bravura / Leland / Petaluma — MuseScore, Dorico, Sibelius)
const SMUFL_G_CLEF = '\uE050';
const SMUFL_F_CLEF = '\uE062';
const SMUFL_NOTE_BLACK = '\uE0A4';
const SMUFL_NOTE_HALF = '\uE0A3';
const SMUFL_NOTE_WHOLE = '\uE0A2';
const SMUFL_FLAT = '\uE260';
const SMUFL_NATURAL = '\uE261';
const SMUFL_SHARP = '\uE262';
const SMUFL_AUG_DOT = '\uE1E7';
const SMUFL_RESTS = new Set(['\uE4E3', '\uE4E4', '\uE4E5', '\uE4E6', '\uE4E7']);

function diatonicWithAccidentalToMidi(diatonic: number, accidentalOffset: number): number {
  const octave = Math.floor(diatonic / 7);
  const degree = ((diatonic % 7) + 7) % 7;
  return clampMidi((octave + 1) * 12 + MAJOR_SCALE_OFFSETS[degree] + accidentalOffset);
}

/**
 * High-precision offline extractor for SMuFL vector PDFs (MuseScore, Dorico, Sibelius, etc.).
 * Reads exact glyph coordinates (clefs, key signatures, accidentals, noteheads, tempo)
 * directly from pdf.js text items with zero image noise.
 */
export function extractNotesFromSmuflItems(
  items: SmuflTextItem[],
  startMeasureNumber: number,
  startTimeSec: number,
  defaultBpm = 100,
): {
  notes: NoteEvent[];
  measures: MeasureEvent[];
  nextMeasureNumber: number;
  endTimeSec: number;
  detectedBpm?: number;
} {
  let detectedBpm: number | undefined;
  for (const item of items) {
    const m = item.str.match(/=\s*(\d{2,3})\b/);
    if (m) {
      const val = Number.parseInt(m[1], 10);
      if (val >= 30 && val <= 260) {
        detectedBpm = val;
        break;
      }
    }
  }
  const bpm = detectedBpm ?? defaultBpm;
  const secPerBeat = 60 / bpm;

  // Flatten multi-glyph runs into individual glyph items
  const glyphs: Array<{ ch: string; x: number; y: number; fontSize: number }> = [];
  for (const item of items) {
    if (!item.str) continue;
    const chars = Array.from(item.str);
    chars.forEach((ch, idx) => {
      glyphs.push({
        ch,
        x: item.x + idx * (item.fontSize * 0.35),
        y: item.y,
        fontSize: item.fontSize || 20,
      });
    });
  }

  interface SmuflStaff {
    clef: 'treble' | 'bass';
    hand: Hand;
    x: number;
    anchorY: number; // G4 line for treble, F3 line for bass
    fontSize: number;
    stepPx: number; // 1 diatonic half-step = fontSize / 8
    keyAccidentals: Map<number, number>; // degree (0..6) -> -1 | +1
  }

  const clefs = glyphs
    .filter((g) => g.ch === SMUFL_G_CLEF || g.ch === SMUFL_F_CLEF)
    .sort((a, b) => b.y - a.y); // Top of page (higher PDF Y) to bottom

  if (clefs.length === 0) {
    return {
      notes: [],
      measures: [],
      nextMeasureNumber: startMeasureNumber,
      endTimeSec: startTimeSec,
      detectedBpm,
    };
  }

  // Deduplicate clefs that are mid-line clef changes (keep leftmost clef per staff row)
  const rowClefs: typeof clefs = [];
  for (const c of clefs) {
    const sameRow = rowClefs.find((rc) => Math.abs(rc.y - c.y) < c.fontSize * 0.7);
    if (!sameRow) {
      rowClefs.push(c);
    } else if (c.x < sameRow.x) {
      sameRow.x = c.x;
      sameRow.ch = c.ch;
      sameRow.y = c.y;
    }
  }

  const accidentals = glyphs.filter(
    (g) => g.ch === SMUFL_FLAT || g.ch === SMUFL_SHARP || g.ch === SMUFL_NATURAL,
  );
  const augDots = glyphs.filter((g) => g.ch === SMUFL_AUG_DOT);
  const restGlyphs = glyphs.filter((g) => SMUFL_RESTS.has(g.ch));
  const noteGlyphs = glyphs.filter(
    (g) => g.ch === SMUFL_NOTE_BLACK || g.ch === SMUFL_NOTE_HALF || g.ch === SMUFL_NOTE_WHOLE,
  );

  if (noteGlyphs.length === 0) {
    return {
      notes: [],
      measures: [],
      nextMeasureNumber: startMeasureNumber,
      endTimeSec: startTimeSec,
      detectedBpm,
    };
  }

  const staves: SmuflStaff[] = rowClefs.map((c) => {
    const clef: 'treble' | 'bass' = c.ch === SMUFL_F_CLEF ? 'bass' : 'treble';
    const fontSize = c.fontSize > 4 ? c.fontSize : 20;
    const stepPx = fontSize / 8;

    // Detect key signature accidentals immediately to the right of the clef
    const keyFlats = accidentals.filter(
      (a) =>
        a.ch === SMUFL_FLAT &&
        a.x > c.x &&
        a.x - c.x < fontSize * 3.2 &&
        Math.abs(a.y - c.y) < fontSize * 1.1,
    );
    const keySharps = accidentals.filter(
      (a) =>
        a.ch === SMUFL_SHARP &&
        a.x > c.x &&
        a.x - c.x < fontSize * 3.2 &&
        Math.abs(a.y - c.y) < fontSize * 1.1,
    );

    const keyAccidentals = new Map<number, number>();
    if (keyFlats.length >= keySharps.length && keyFlats.length > 0) {
      const count = Math.min(7, keyFlats.length);
      for (let i = 0; i < count; i++) keyAccidentals.set(FLAT_ORDER_DEGREES[i], -1);
    } else if (keySharps.length > 0) {
      const count = Math.min(7, keySharps.length);
      for (let i = 0; i < count; i++) keyAccidentals.set(SHARP_ORDER_DEGREES[i], 1);
    }

    return {
      clef,
      hand: clef === 'bass' ? 'left' : 'right',
      x: c.x,
      anchorY: c.y,
      fontSize,
      stepPx,
      keyAccidentals,
    };
  });

  // Group staves into grand-staff systems (treble + bass pairs top-to-bottom)
  const systems: SmuflStaff[][] = [];
  for (let i = 0; i < staves.length; i++) {
    const cur = staves[i];
    const next = staves[i + 1];
    if (cur.clef === 'treble' && next?.clef === 'bass' && cur.anchorY - next.anchorY < cur.fontSize * 5.5) {
      systems.push([cur, next]);
      i++;
    } else {
      systems.push([cur]);
    }
  }

  // Assign each notehead and rest to its closest staff vertically
  interface SmuflParsedNote {
    x: number;
    midi: number;
    hand: Hand;
    kind: 'whole' | 'half' | 'black';
    hasDot: boolean;
  }
  const systemNotesMap = new Map<number, SmuflParsedNote[]>();
  const systemRestsMap = new Map<number, Array<{ x: number; hand: Hand; beats: number }>>();

  for (const rg of restGlyphs) {
    let bestSysIdx = -1;
    let bestStaff: SmuflStaff | null = null;
    let bestDist = Infinity;
    systems.forEach((sys, sIdx) => {
      for (const st of sys) {
        const dist = Math.abs(rg.y - st.anchorY);
        if (dist < bestDist && dist < st.fontSize * 2.0) {
          bestDist = dist;
          bestSysIdx = sIdx;
          bestStaff = st;
        }
      }
    });
    if (bestSysIdx < 0 || !bestStaff) continue;
    const st: SmuflStaff = bestStaff;
    if (rg.x < st.x + st.fontSize * 0.5) continue;
    const restBeats =
      rg.ch === '\uE4E3' ? 4 : rg.ch === '\uE4E4' ? 2 : rg.ch === '\uE4E5' ? 1 : rg.ch === '\uE4E6' ? 0.5 : 0.25;
    const arr = systemRestsMap.get(bestSysIdx) ?? [];
    arr.push({ x: rg.x, hand: st.hand, beats: restBeats });
    systemRestsMap.set(bestSysIdx, arr);
  }

  for (const ng of noteGlyphs) {
    let bestSysIdx = -1;
    let bestStaff: SmuflStaff | null = null;
    let bestDist = Infinity;

    systems.forEach((sys, sIdx) => {
      for (const st of sys) {
        const dist = Math.abs(ng.y - st.anchorY);
        if (dist < bestDist && dist < st.fontSize * 2.4) {
          bestDist = dist;
          bestSysIdx = sIdx;
          bestStaff = st;
        }
      }
    });

    if (bestSysIdx < 0 || !bestStaff) continue;
    const st: SmuflStaff = bestStaff;

    // Ignore noteheads left of clef
    if (ng.x < st.x + st.fontSize * 0.5) continue;

    const stepsFromAnchor = Math.round((ng.y - st.anchorY) / st.stepPx);
    const anchorDiatonic = st.clef === 'treble' ? 32 : 24; // G4 = 32, F3 = 24
    const diatonic = anchorDiatonic + stepsFromAnchor;
    const degree = ((diatonic % 7) + 7) % 7;

    // Check for inline accidental immediately left of notehead
    let accOffset = st.keyAccidentals.get(degree) ?? 0;
    const inlineAcc = accidentals.find(
      (a) =>
        a.x < ng.x &&
        ng.x - a.x < st.fontSize * 0.85 &&
        Math.abs(a.y - ng.y) < st.stepPx * 1.4 &&
        a.x > st.x + st.fontSize * 1.2,
    );
    if (inlineAcc) {
      accOffset =
        inlineAcc.ch === SMUFL_FLAT ? -1 : inlineAcc.ch === SMUFL_SHARP ? 1 : 0;
    }

    // Check for augmentation dot immediately right of notehead
    const hasDot = augDots.some(
      (d) =>
        d.x > ng.x &&
        d.x - ng.x < st.fontSize * 0.95 &&
        Math.abs(d.y - ng.y) < st.stepPx * 1.6,
    );

    const midi = diatonicWithAccidentalToMidi(diatonic, accOffset);
    const kind: SmuflParsedNote['kind'] =
      ng.ch === SMUFL_NOTE_WHOLE ? 'whole' : ng.ch === SMUFL_NOTE_HALF ? 'half' : 'black';

    const arr = systemNotesMap.get(bestSysIdx) ?? [];
    arr.push({ x: ng.x, midi, hand: st.hand, kind, hasDot });
    systemNotesMap.set(bestSysIdx, arr);
  }

  const notes: NoteEvent[] = [];
  const measures: MeasureEvent[] = [];
  let curTime = startTimeSec;
  let curMeasure = startMeasureNumber;
  let idCounter = 0;

  systems.forEach((sys, sIdx) => {
    const sysNotes = systemNotesMap.get(sIdx);
    if (!sysNotes || sysNotes.length === 0) return;
    const sysRests = systemRestsMap.get(sIdx) ?? [];

    sysNotes.sort((a, b) => a.x - b.x);
    const fontSize = sys[0].fontSize;
    const clusterTol = Math.max(4, fontSize * 0.32);

    const clusters: Array<{ x: number; items: SmuflParsedNote[] }> = [];
    for (const n of sysNotes) {
      const last = clusters[clusters.length - 1];
      if (last && Math.abs(n.x - last.x) <= clusterTol) {
        last.items.push(n);
      } else {
        clusters.push({ x: n.x, items: [n] });
      }
    }

    // Calibrate pxPerBeat from lower-quartile positive X gap between consecutive note clusters
    const positiveGaps: number[] = [];
    for (let i = 1; i < clusters.length; i++) {
      const dx = clusters[i].x - clusters[i - 1].x;
      if (dx > clusterTol) positiveGaps.push(dx);
    }
    positiveGaps.sort((a, b) => a - b);
    const refDx =
      positiveGaps.length > 0
        ? positiveGaps[Math.floor(positiveGaps.length * 0.3)]
        : fontSize * 0.9;
    // Common fast subdivision in piano music is an eighth note (0.5 beat)
    const pxPerBeat = Math.max(fontSize * 0.85, Math.min(fontSize * 3.2, refDx * 2));

    // Anchor system start at earliest event (note or rest)
    const firstEventX = Math.min(
      clusters[0].x,
      ...sysRests.map((r) => r.x),
    );

    const quantizeBeat = (x: number) => Math.max(0, Math.round(((x - firstEventX) / pxPerBeat) * 4) / 4);

    // Precompute quantized beat positions for all clusters & rests per hand
    const clusterBeats = clusters.map((c) => quantizeBeat(c.x));
    const handEvents: Record<Hand, number[]> = { left: [], right: [] };
    clusters.forEach((c, idx) => {
      const b = clusterBeats[idx];
      if (c.items.some((it) => it.hand === 'left')) handEvents.left.push(b);
      if (c.items.some((it) => it.hand === 'right')) handEvents.right.push(b);
    });
    for (const r of sysRests) {
      handEvents[r.hand].push(quantizeBeat(r.x));
    }
    handEvents.left.sort((a, b) => a - b);
    handEvents.right.sort((a, b) => a - b);

    const findNextSameHandBeat = (hand: Hand, currentBeat: number): number | null => {
      const list = handEvents[hand];
      for (const b of list) {
        if (b > currentBeat + 0.05) return b;
      }
      return null;
    };

    let maxEndBeat = 4;

    clusters.forEach((cluster, cIdx) => {
      const beatStart = clusterBeats[cIdx];
      const noteStart = curTime + beatStart * secPerBeat;
      const measureOffset = Math.floor(beatStart / 4);
      const seenMidis = new Set<number>();

      for (const item of cluster.items) {
        if (seenMidis.has(item.midi)) continue;
        seenMidis.add(item.midi);

        const nextSameHand = findNextSameHandBeat(item.hand, beatStart);
        const gapBeats = nextSameHand !== null ? nextSameHand - beatStart : 1.0;

        let durBeats: number;
        if (item.kind === 'whole') {
          durBeats = item.hasDot ? 6.0 : 4.0;
        } else if (item.kind === 'half') {
          durBeats = item.hasDot ? 3.0 : 2.0;
        } else {
          // Black notehead: respect dot (1.5 beats) or natural gap until next same-hand note/rest
          if (item.hasDot) {
            durBeats = Math.max(0.75, Math.min(1.5, gapBeats * 0.95));
          } else {
            durBeats = Math.max(0.35, Math.min(1.5, gapBeats * 0.92));
          }
        }

        maxEndBeat = Math.max(maxEndBeat, beatStart + durBeats);
        notes.push({
          id: `smufl-${curMeasure}-${idCounter++}`,
          midi: item.midi,
          startTimeSec: noteStart,
          durationSec: durBeats * secPerBeat,
          velocity: item.hand === 'left' ? 0.68 : 0.82,
          hand: item.hand,
          measureNumber: curMeasure + measureOffset,
        });
      }
    });

    // Include trailing rests in system length
    for (const r of sysRests) {
      maxEndBeat = Math.max(maxEndBeat, quantizeBeat(r.x) + r.beats);
    }

    const systemMeasures = Math.max(1, Math.ceil(maxEndBeat / 4));
    for (let m = 0; m < systemMeasures; m++) {
      measures.push({
        number: curMeasure + m,
        startTimeSec: curTime + m * 4 * secPerBeat,
        endTimeSec: curTime + (m + 1) * 4 * secPerBeat,
        beats: 4,
        beatType: 4,
      });
    }

    curTime += systemMeasures * 4 * secPerBeat;
    curMeasure += systemMeasures;
  });

  return { notes, measures, nextMeasureNumber: curMeasure, endTimeSec: curTime, detectedBpm };
}

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
  let bpm = 100;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.({ currentPage: pageNum, totalPages });
    const page = await pdf.getPage(pageNum);

    // 1. Try high-precision SMuFL vector text extraction first (MuseScore, Dorico, Sibelius PDFs)
    let pageExtracted = false;
    try {
      const textContent = await page.getTextContent();
      const smuflItems: SmuflTextItem[] = [];
      for (const raw of textContent.items) {
        if (!('str' in raw) || !raw.str) continue;
        const tr = raw.transform as number[];
        const fontSize = Math.hypot(tr[0], tr[1]) || Math.abs(tr[3]) || 20;
        smuflItems.push({
          str: raw.str,
          x: tr[4],
          y: tr[5],
          fontSize,
        });
      }
      const smuflRes = extractNotesFromSmuflItems(smuflItems, nextMeasure, currentTime, bpm);
      if (smuflRes.detectedBpm && pageNum === 1) {
        bpm = smuflRes.detectedBpm;
      }
      if (smuflRes.notes.length > 0) {
        allNotes.push(...smuflRes.notes);
        allMeasures.push(...smuflRes.measures);
        nextMeasure = smuflRes.nextMeasureNumber;
        currentTime = smuflRes.endTimeSec;
        pageExtracted = true;
      }
    } catch {
      // Fall through to raster OMR
    }

    if (pageExtracted) continue;

    // 2. Fallback: Canvas grayscale raster OMR for scanned / non-SMuFL PDFs
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
