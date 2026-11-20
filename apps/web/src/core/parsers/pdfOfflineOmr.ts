import { clampMidi } from '../noteNames';
import type { Hand, MeasureEvent, NoteEvent, Song } from '../types';
import { extractVectorGeometryFromOps, type VectorGeometry } from './pdfVectorExtractor';

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
const SMUFL_PEDAL = '\uE650';
const SMUFL_RESTS = new Set(['\uE4E3', '\uE4E4', '\uE4E5', '\uE4E6', '\uE4E7']);
const SMUFL_FLAGS_8TH = new Set(['\uE240', '\uE241']);
const SMUFL_FLAGS_16TH = new Set(['\uE242', '\uE243']);
const SMUFL_FLAGS_32ND = new Set(['\uE244', '\uE245']);
const SMUFL_TIME_DIGITS: Record<string, number> = {
  '\uE082': 2,
  '\uE083': 3,
  '\uE084': 4,
  '\uE085': 5,
  '\uE086': 6,
  '\uE087': 7,
  '\uE088': 8,
  '\uE089': 9,
};

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
  geometry?: VectorGeometry,
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
  const flagGlyphs = glyphs.filter(
    (g) => SMUFL_FLAGS_8TH.has(g.ch) || SMUFL_FLAGS_16TH.has(g.ch) || SMUFL_FLAGS_32ND.has(g.ch),
  );
  const pedalGlyphs = glyphs.filter((g) => g.ch === SMUFL_PEDAL);
  const timeDigitGlyphs = glyphs.filter((g) => g.ch in SMUFL_TIME_DIGITS);
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

  // Detect time signature (default 4/4) from stacked SMuFL digits near first clef
  let timeBeats = 4;
  let timeBeatType = 4;
  if (staves.length > 0 && timeDigitGlyphs.length >= 2) {
    const firstStaff = staves[0];
    const nearClefDigits = timeDigitGlyphs
      .filter(
        (d) =>
          d.x > firstStaff.x &&
          d.x - firstStaff.x < firstStaff.fontSize * 4.2 &&
          Math.abs(d.y - firstStaff.anchorY) < firstStaff.fontSize * 1.1,
      )
      .sort((a, b) => b.y - a.y); // higher Y = numerator, lower Y = denominator
    if (nearClefDigits.length >= 2) {
      const num = SMUFL_TIME_DIGITS[nearClefDigits[0].ch];
      const den = SMUFL_TIME_DIGITS[nearClefDigits[1].ch];
      if (num && den) {
        timeBeats = num;
        timeBeatType = den;
      }
    }
  }
  const beatsPerMeasure = timeBeats * (4 / timeBeatType);

  // Assign each notehead and rest to its closest staff vertically
  interface SmuflParsedNote {
    x: number;
    y: number;
    midi: number;
    hand: Hand;
    kind: 'whole' | 'half' | 'black';
    hasDot: boolean;
    exactBeats: number; // exact rhythmic duration from head + beams/flags + dot
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
    const restHasDot = augDots.some(
      (d) => d.x > rg.x && d.x - rg.x < st.fontSize * 0.9 && Math.abs(d.y - rg.y) < st.stepPx * 2.0,
    );
    const baseRest =
      rg.ch === '\uE4E3' ? beatsPerMeasure : rg.ch === '\uE4E4' ? 2 : rg.ch === '\uE4E5' ? 1 : rg.ch === '\uE4E6' ? 0.5 : 0.25;
    const arr = systemRestsMap.get(bestSysIdx) ?? [];
    arr.push({ x: rg.x, hand: st.hand, beats: restHasDot ? baseRest * 1.5 : baseRest });
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

    if (ng.x < st.x + st.fontSize * 0.5) continue;

    const stepsFromAnchor = Math.round((ng.y - st.anchorY) / st.stepPx);
    const anchorDiatonic = st.clef === 'treble' ? 32 : 24;
    const diatonic = anchorDiatonic + stepsFromAnchor;
    const degree = ((diatonic % 7) + 7) % 7;

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

    const hasDot = augDots.some(
      (d) =>
        d.x > ng.x &&
        d.x - ng.x < st.fontSize * 0.95 &&
        Math.abs(d.y - ng.y) < st.stepPx * 1.6,
    );

    const midi = diatonicWithAccidentalToMidi(diatonic, accOffset);
    const kind: SmuflParsedNote['kind'] =
      ng.ch === SMUFL_NOTE_WHOLE ? 'whole' : ng.ch === SMUFL_NOTE_HALF ? 'half' : 'black';

    // Determine exact rhythmic duration from notehead + SMuFL flag + PDF vector beam count + dot
    let baseBeats = 1.0;
    if (kind === 'whole') {
      baseBeats = 4.0;
    } else if (kind === 'half') {
      baseBeats = 2.0;
    } else {
      // Check SMuFL flag attached to this note's stem
      const nearFlag = flagGlyphs.find(
        (f) => Math.abs(f.x - ng.x) < st.fontSize * 0.55 && Math.abs(f.y - ng.y) < st.fontSize * 1.8,
      );
      if (nearFlag) {
        baseBeats = SMUFL_FLAGS_32ND.has(nearFlag.ch)
          ? 0.125
          : SMUFL_FLAGS_16TH.has(nearFlag.ch)
            ? 0.25
            : 0.5;
      } else if (geometry && geometry.beams.length > 0) {
        // Count stacked vector beams intersecting this note's stem X within this staff's vertical reach
        const matchingBeams = geometry.beams.filter(
          (b) =>
            ng.x >= b.x1 - st.fontSize * 0.28 &&
            ng.x <= b.x2 + st.fontSize * 0.28 &&
            Math.abs(b.y - ng.y) <= st.fontSize * 2.1,
        );
        // Deduplicate beam Y levels within 2.5px
        const distinctLevels: number[] = [];
        for (const b of matchingBeams) {
          if (!distinctLevels.some((ly) => Math.abs(ly - b.y) < 2.5)) {
            distinctLevels.push(b.y);
          }
        }
        const beamCount = Math.min(3, distinctLevels.length);
        baseBeats = beamCount === 0 ? 1.0 : beamCount === 1 ? 0.5 : beamCount === 2 ? 0.25 : 0.125;
      }
    }
    const exactBeats = hasDot ? baseBeats * 1.5 : baseBeats;

    const arr = systemNotesMap.get(bestSysIdx) ?? [];
    arr.push({ x: ng.x, y: ng.y, midi, hand: st.hand, kind, hasDot, exactBeats });
    systemNotesMap.set(bestSysIdx, arr);
  }

  interface EmittedNote extends NoteEvent {
    pdfX: number;
    pdfY: number;
    sysIdx: number;
  }
  const emittedNotes: EmittedNote[] = [];
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

    // Determine system vertical bounds to match vector barlines & pedal marks
    const sysTopY = Math.max(...sys.map((st) => st.anchorY)) + fontSize * 0.8;
    const sysBotY = Math.min(...sys.map((st) => st.anchorY)) - fontSize * 0.8;
    const firstContentX = Math.min(
      sysNotes[0].x,
      ...sysRests.map((r) => r.x),
    );
    const lastContentX = Math.max(
      sysNotes[sysNotes.length - 1].x,
      ...sysRests.map((r) => r.x),
    );

    const sysPedals = pedalGlyphs
      .filter((p) => p.y < sysBotY + fontSize * 0.5 && p.y > sysBotY - fontSize * 2.5)
      .sort((a, b) => a.x - b.x);

    // Find vertical barlines belonging to this system (to partition into exact measures!)
    const rawBarXs: number[] = [];
    if (geometry && geometry.barlines.length > 0) {
      for (const bl of geometry.barlines) {
        const overlapsY = bl.yMax >= sysBotY && bl.yMin <= sysTopY;
        const tallEnough = bl.yMax - bl.yMin >= fontSize * 0.9;
        if (overlapsY && tallEnough && bl.x > firstContentX + fontSize * 0.5) {
          rawBarXs.push(bl.x);
        }
      }
    }
    rawBarXs.sort((a, b) => a - b);
    // Deduplicate double barlines (within 8px)
    const barXs: number[] = [];
    for (const bx of rawBarXs) {
      if (barXs.length === 0 || bx - barXs[barXs.length - 1] > Math.max(8, fontSize * 0.45)) {
        barXs.push(bx);
      }
    }

    if (barXs.length >= 1) {
      // VECTOR MEASURE-BY-MEASURE RECONSTRUCTION (exact barline lock!)
      const measureBounds: Array<{ xStart: number; xEnd: number }> = [];
      let prevX = firstContentX - fontSize * 0.4;
      for (const bx of barXs) {
        if (bx > prevX + fontSize * 0.8) {
          measureBounds.push({ xStart: prevX, xEnd: bx });
          prevX = bx;
        }
      }
      if (lastContentX > prevX + fontSize * 0.4) {
        measureBounds.push({ xStart: prevX, xEnd: lastContentX + fontSize * 0.8 });
      }

      measureBounds.forEach((mb) => {
        const mStartSec = curTime;
        const mDurSec = beatsPerMeasure * secPerBeat;
        const mEndSec = mStartSec + mDurSec;
        const hasPedalInMeasure = sysPedals.some((p) => p.x >= mb.xStart - fontSize && p.x <= mb.xEnd);

        measures.push({
          number: curMeasure,
          startTimeSec: mStartSec,
          endTimeSec: mEndSec,
          beats: timeBeats,
          beatType: timeBeatType,
        });

        for (const hand of ['right', 'left'] as const) {
          const mNotes = sysNotes.filter(
            (n) => n.hand === hand && n.x >= mb.xStart && n.x < mb.xEnd,
          );
          const mRests = sysRests.filter(
            (r) => r.hand === hand && r.x >= mb.xStart && r.x < mb.xEnd,
          );
          if (mNotes.length === 0) continue;

          // Build ordered events (note chords + rests) in this measure for this hand
          type MeasureEventItem =
            | { type: 'chord'; x: number; notes: SmuflParsedNote[]; beats: number }
            | { type: 'rest'; x: number; beats: number };

          const events: MeasureEventItem[] = [];
          for (const n of mNotes) {
            const last = events[events.length - 1];
            if (last && last.type === 'chord' && Math.abs(n.x - last.x) <= clusterTol) {
              last.notes.push(n);
              last.beats = Math.min(last.beats, n.exactBeats);
            } else {
              events.push({ type: 'chord', x: n.x, notes: [n], beats: n.exactBeats });
            }
          }
          for (const r of mRests) {
            events.push({ type: 'rest', x: r.x, beats: r.beats });
          }
          events.sort((a, b) => a.x - b.x);

          const totalEventBeats = events.reduce((acc, ev) => acc + ev.beats, 0);
          const exactFit = totalEventBeats <= beatsPerMeasure + 0.51;
          const mWidth = Math.max(1, mb.xEnd - mb.xStart);

          let cumBeat = 0;
          events.forEach((ev) => {
            let beatOffset: number;
            if (exactFit) {
              beatOffset = cumBeat;
              cumBeat += ev.beats;
            } else {
              const normX = Math.max(0, Math.min(0.95, (ev.x - mb.xStart) / mWidth));
              beatOffset = Math.round(normX * beatsPerMeasure * 4) / 4;
            }

            if (ev.type === 'chord') {
              const seenMidis = new Set<number>();
              for (const item of ev.notes) {
                if (seenMidis.has(item.midi)) continue;
                seenMidis.add(item.midi);
                let durBeats = item.exactBeats;
                // When Ped. is active in this measure, allow left-hand bass notes to ring smoothly
                if (hasPedalInMeasure && hand === 'left' && durBeats < 1.5) {
                  durBeats = Math.min(beatsPerMeasure - beatOffset, Math.max(durBeats, 1.5));
                }
                emittedNotes.push({
                  id: `smufl-${curMeasure}-${idCounter++}`,
                  midi: item.midi,
                  startTimeSec: mStartSec + beatOffset * secPerBeat,
                  durationSec: Math.max(0.15, durBeats * secPerBeat),
                  velocity: hand === 'left' ? 0.68 : 0.82,
                  hand,
                  measureNumber: curMeasure,
                  pdfX: item.x,
                  pdfY: item.y,
                  sysIdx: sIdx,
                });
              }
            }
          });
        }

        curTime = mEndSec;
        curMeasure += 1;
      });
    } else {
      // FALLBACK (no vector barlines): proportional X-to-beat timing
      const clusters: Array<{ x: number; items: SmuflParsedNote[] }> = [];
      for (const n of sysNotes) {
        const last = clusters[clusters.length - 1];
        if (last && Math.abs(n.x - last.x) <= clusterTol) {
          last.items.push(n);
        } else {
          clusters.push({ x: n.x, items: [n] });
        }
      }

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
      const pxPerBeat = Math.max(fontSize * 0.85, Math.min(fontSize * 3.2, refDx * 2));
      const quantizeBeat = (x: number) =>
        Math.max(0, Math.round(((x - firstContentX) / pxPerBeat) * 4) / 4);

      const clusterBeats = clusters.map((c) => quantizeBeat(c.x));
      let maxEndBeat = beatsPerMeasure;

      clusters.forEach((cluster, cIdx) => {
        const beatStart = clusterBeats[cIdx];
        const noteStart = curTime + beatStart * secPerBeat;
        const measureOffset = Math.floor(beatStart / beatsPerMeasure);
        const seenMidis = new Set<number>();

        for (const item of cluster.items) {
          if (seenMidis.has(item.midi)) continue;
          seenMidis.add(item.midi);
          maxEndBeat = Math.max(maxEndBeat, beatStart + item.exactBeats);
          emittedNotes.push({
            id: `smufl-${curMeasure}-${idCounter++}`,
            midi: item.midi,
            startTimeSec: noteStart,
            durationSec: item.exactBeats * secPerBeat,
            velocity: item.hand === 'left' ? 0.68 : 0.82,
            hand: item.hand,
            measureNumber: curMeasure + measureOffset,
            pdfX: item.x,
            pdfY: item.y,
            sysIdx: sIdx,
          });
        }
      });

      for (const r of sysRests) {
        maxEndBeat = Math.max(maxEndBeat, quantizeBeat(r.x) + r.beats);
      }

      const systemMeasures = Math.max(1, Math.ceil(maxEndBeat / beatsPerMeasure));
      for (let m = 0; m < systemMeasures; m++) {
        measures.push({
          number: curMeasure + m,
          startTimeSec: curTime + m * beatsPerMeasure * secPerBeat,
          endTimeSec: curTime + (m + 1) * beatsPerMeasure * secPerBeat,
          beats: timeBeats,
          beatType: timeBeatType,
        });
      }

      curTime += systemMeasures * beatsPerMeasure * secPerBeat;
      curMeasure += systemMeasures;
    }
  });

  // Merge tied notes using PDF vector tie arcs!
  const removedIndices = new Set<number>();
  if (geometry && geometry.ties.length > 0 && emittedNotes.length > 1) {
    for (const tie of geometry.ties) {
      let startIdx = -1;
      let endIdx = -1;
      for (let i = 0; i < emittedNotes.length; i++) {
        if (removedIndices.has(i)) continue;
        const n = emittedNotes[i];
        const fontSize = 24;
        if (Math.abs(n.pdfY - tie.y) > fontSize * 0.75) continue;
        if (Math.abs(n.pdfX - tie.x1) <= fontSize * 0.65) {
          startIdx = i;
        } else if (
          startIdx >= 0 &&
          n.midi === emittedNotes[startIdx].midi &&
          n.hand === emittedNotes[startIdx].hand &&
          n.sysIdx === emittedNotes[startIdx].sysIdx &&
          Math.abs(n.pdfX - tie.x2) <= fontSize * 0.65
        ) {
          endIdx = i;
          break;
        }
      }
      if (startIdx >= 0 && endIdx >= 0) {
        const a = emittedNotes[startIdx];
        const b = emittedNotes[endIdx];
        const mergedEnd = Math.max(a.startTimeSec + a.durationSec, b.startTimeSec + b.durationSec);
        a.durationSec = mergedEnd - a.startTimeSec;
        removedIndices.add(endIdx);
      }
    }
  }

  const notes: NoteEvent[] = emittedNotes
    .filter((_, idx) => !removedIndices.has(idx))
    .map(({ pdfX: _x, pdfY: _y, sysIdx: _s, ...note }) => note)
    .sort((a, b) => a.startTimeSec - b.startTimeSec || a.midi - b.midi);

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

    // 1. Try high-precision SMuFL + Vector OperatorList extraction first (MuseScore, Dorico, Sibelius PDFs)
    let pageExtracted = false;
    try {
      const [textContent, opList] = await Promise.all([
        page.getTextContent(),
        page.getOperatorList(),
      ]);
      const geometry = extractVectorGeometryFromOps(
        opList.fnArray,
        opList.argsArray,
        pdfjsLib.OPS as unknown as Record<string, number>,
      );
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
      const smuflRes = extractNotesFromSmuflItems(
        smuflItems,
        nextMeasure,
        currentTime,
        bpm,
        geometry,
      );
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
