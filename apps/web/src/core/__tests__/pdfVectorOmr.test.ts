import { describe, it, expect } from 'vitest';
import { extractVectorGeometryFromOps, type VectorGeometry } from '../parsers/pdfVectorExtractor';
import { extractNotesFromSmuflItems, type SmuflTextItem } from '../parsers/pdfOfflineOmr';

const FAKE_OPS = {
  save: 10,
  restore: 11,
  transform: 12,
  moveTo: 13,
  lineTo: 14,
  curveTo: 15,
  closePath: 18,
  rectangle: 19,
  constructPath: 91,
};

describe('pdfVectorExtractor & vector-assisted SMuFL OMR', () => {
  it('extracts barlines, beams, and ties from pdfjs-dist constructPath TypedArrays (Float32Array/Int32Array)', () => {
    const subOps = new Int32Array([
      FAKE_OPS.moveTo,
      FAKE_OPS.lineTo,
      FAKE_OPS.rectangle,
      FAKE_OPS.moveTo,
      FAKE_OPS.curveTo,
    ]);
    const subCoords = new Float32Array([
      250, 600,
      250, 710,
      100, 725, 60, 4,
      180, 700,
      190, 692, 205, 692, 215, 700,
    ]);

    const geom = extractVectorGeometryFromOps(
      [FAKE_OPS.constructPath],
      [[subOps, subCoords]],
      FAKE_OPS,
    );
    expect(geom.barlines.some((b) => Math.abs(b.x - 250) < 1 && b.yMax - b.yMin >= 100)).toBe(true);
    expect(geom.beams.some((b) => Math.abs(b.x1 - 100) < 1 && Math.abs(b.x2 - 160) < 1)).toBe(true);
    expect(geom.ties.some((t) => Math.abs(t.x1 - 180) < 1 && Math.abs(t.x2 - 215) < 1)).toBe(true);
  });
  it('extracts barlines, horizontal beams, and curved ties from PDF operator lists', () => {
    const fnArray = [
      FAKE_OPS.save,
      FAKE_OPS.transform,
      // Vertical barline at x=250 spanning y=600..710 (height 110)
      FAKE_OPS.moveTo,
      FAKE_OPS.lineTo,
      // Horizontal beam rectangle from x=100..160, y=725, h=4
      FAKE_OPS.rectangle,
      // Curved tie arc from (180, 700) to (215, 700)
      FAKE_OPS.moveTo,
      FAKE_OPS.curveTo,
      FAKE_OPS.restore,
    ];
    const argsArray = [
      [],
      [1, 0, 0, 1, 0, 0],
      [250, 600],
      [250, 710],
      [100, 725, 60, 4],
      [180, 700],
      [190, 692, 205, 692, 215, 700],
      [],
    ];

    const geom = extractVectorGeometryFromOps(fnArray, argsArray, FAKE_OPS);
    expect(geom.barlines.some((b) => Math.abs(b.x - 250) < 1 && b.yMax - b.yMin >= 100)).toBe(true);
    expect(geom.beams.some((b) => Math.abs(b.x1 - 100) < 1 && Math.abs(b.x2 - 160) < 1)).toBe(true);
    expect(geom.ties.some((t) => Math.abs(t.x1 - 180) < 1 && Math.abs(t.x2 - 215) < 1)).toBe(true);
  });

  it('reconstructs exact measure rhythms from barlines, 1-beam eighths, 2-beam sixteenths, ties, and Ped.', () => {
    // 4/4 measure at 60 BPM (1 beat = 1.0s), fontSize = 24
    // Measure 1 (x: 90..260):
    //   RH: 2 beamed eighth notes (0.5 + 0.5), 2 beamed sixteenth notes (0.25 + 0.25),
    //       1 quarter note (1.0), 1 dotted quarter note (1.5) -> total = 4.0 beats!
    //   LH: 1 dotted half note (3.0) + 1 quarter rest (1.0) -> total = 4.0 beats!
    // Measure 2 (x: 260..420):
    //   RH: G4 tied from Measure 1's last note (merged!) + half note A4
    const items: SmuflTextItem[] = [
      { str: '\uE050', x: 50, y: 700, fontSize: 24 },
      { str: '\uE062', x: 50, y: 620, fontSize: 24 },
      { str: '\uE084', x: 75, y: 706, fontSize: 24 }, // 4/4 top
      { str: '\uE084', x: 75, y: 694, fontSize: 24 }, // 4/4 bottom
      // RH Measure 1
      { str: '\uE0A4', x: 105, y: 700, fontSize: 24 }, // G4 (eighth, 1 beam)
      { str: '\uE0A4', x: 125, y: 703, fontSize: 24 }, // A4 (eighth, 1 beam)
      { str: '\uE0A4', x: 145, y: 706, fontSize: 24 }, // B4 (16th, 2 beams)
      { str: '\uE0A4', x: 160, y: 709, fontSize: 24 }, // C5 (16th, 2 beams)
      { str: '\uE0A4', x: 180, y: 703, fontSize: 24 }, // A4 (quarter, 0 beams)
      { str: '\uE0A4', x: 215, y: 700, fontSize: 24 }, // G4 (dotted quarter, 0 beams + dot, tied into M2)
      { str: '\uE1E7', x: 225, y: 700, fontSize: 24 }, // dot
      // LH Measure 1
      { str: '\uE0A3', x: 105, y: 620, fontSize: 24 }, // F3 dotted half
      { str: '\uE1E7', x: 115, y: 620, fontSize: 24 }, // dot
      { str: '\uE4E5', x: 215, y: 620, fontSize: 24 }, // quarter rest
      // RH Measure 2
      { str: '\uE0A4', x: 275, y: 700, fontSize: 24 }, // G4 tied from M1 (quarter)
      { str: '\uE0A3', x: 315, y: 703, fontSize: 24 }, // A4 half
      // Pedal mark under M1
      { str: '\uE650', x: 105, y: 585, fontSize: 20 },
    ];

    const geometry: VectorGeometry = {
      barlines: [
        // Real grand-staff barlines spanning Treble (700) down to Bass (620)
        { x: 260, yMin: 605, yMax: 715 },
        { x: 420, yMin: 605, yMax: 715 },
        // Note stems inside Treble & Bass (height ~24-30px) — MUST NOT be treated as barlines!
        { x: 112, yMin: 700, yMax: 726 },
        { x: 132, yMin: 703, yMax: 726 },
        { x: 152, yMin: 706, yMax: 726 },
        { x: 187, yMin: 703, yMax: 728 },
        { x: 112, yMin: 594, yMax: 620 },
      ],
      beams: [
        // 1 beam over eighths (105..125)
        { x1: 104, x2: 128, y: 726 },
        // 2 stacked beams over sixteenths (145..160)
        { x1: 144, x2: 163, y: 726 },
        { x1: 144, x2: 163, y: 721 },
      ],
      ties: [
        // Tie connecting G4 at x=215 (M1) to G4 at x=275 (M2)
        { x1: 218, x2: 274, y: 696 },
      ],
    };

    const res = extractNotesFromSmuflItems(items, 1, 0, 60, geometry);
    expect(res.measures).toHaveLength(2);
    expect(res.measures[1].startTimeSec).toBeCloseTo(4.0, 2);

    const rh = res.notes.filter((n) => n.hand === 'right').sort((a, b) => a.startTimeSec - b.startTimeSec);
    // 6 RH notes in M1 + 2 in M2, minus 1 merged tied G4 = 7 RH notes
    expect(rh).toHaveLength(7);
    expect(rh[0].startTimeSec).toBeCloseTo(0.0, 2);
    expect(rh[0].durationSec).toBeCloseTo(0.5, 2); // eighth
    expect(rh[1].startTimeSec).toBeCloseTo(0.5, 2);
    expect(rh[2].startTimeSec).toBeCloseTo(1.0, 2);
    expect(rh[2].durationSec).toBeCloseTo(0.25, 2); // sixteenth
    expect(rh[3].startTimeSec).toBeCloseTo(1.25, 2);
    expect(rh[4].startTimeSec).toBeCloseTo(1.5, 2);
    expect(rh[4].durationSec).toBeCloseTo(1.0, 2); // quarter
    // Tied dotted-quarter (1.5) + quarter (1.0) = 2.5s sustained G4 starting at beat 2.5!
    expect(rh[5].startTimeSec).toBeCloseTo(2.5, 2);
    expect(rh[5].durationSec).toBeCloseTo(2.5, 2);
    // Measure 2 A4 starts at beat 5.0 (4.0 + 1.0)
    expect(rh[6].startTimeSec).toBeCloseTo(5.0, 2);
  });

  it('handles 5-flat key signature (Cage), 3/4 time carryover (Idea 22), and dual-treble grand staff', () => {
    // 5 flats (Bb, Eb, Ab, Db, Gb) + two treble staves paired together + carried-over 3/4 time
    const items: SmuflTextItem[] = [
      { str: '\uE050', x: 50, y: 700, fontSize: 24 },
      { str: '\uE260', x: 66, y: 706, fontSize: 24 },
      { str: '\uE260', x: 75, y: 712, fontSize: 24 },
      { str: '\uE260', x: 84, y: 703, fontSize: 24 },
      { str: '\uE260', x: 93, y: 709, fontSize: 24 },
      { str: '\uE260', x: 102, y: 700, fontSize: 24 }, // 5th flat (Gb) at x=102 (> 3.2*24!)
      // Bottom staff ALSO uses treble clef (like Cage M94)
      { str: '\uE050', x: 50, y: 620, fontSize: 24 },
      // Note G4 on RH (y=700) -> flatted to Gb4 = MIDI 66!
      { str: '\uE0A4', x: 140, y: 700, fontSize: 24 },
      // Note G4 on LH (y=620) -> paired into same grand staff at t=0!
      { str: '\uE0A4', x: 140, y: 620, fontSize: 24 },
    ];
    const geom: VectorGeometry = {
      barlines: [{ x: 260, yMin: 605, yMax: 715 }],
      beams: [],
      ties: [],
    };
    const res = extractNotesFromSmuflItems(items, 1, 0, 60, geom, { beats: 3, beatType: 4 });
    expect(res.measures).toHaveLength(1);
    expect(res.measures[0].beats).toBe(3);
    expect(res.measures[0].endTimeSec).toBeCloseTo(3.0, 2);
    expect(res.notes.find((n) => n.hand === 'right')?.midi).toBe(66); // Gb4!
    expect(res.notes.find((n) => n.hand === 'left')?.startTimeSec).toBeCloseTo(0, 2);
  });
});
