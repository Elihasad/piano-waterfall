import { describe, it, expect } from 'vitest';
import {
  diatonicStepToMidi,
  detectStavesFromGrayscale,
  extractNotesFromGrayscalePage,
} from '../parsers/pdfOfflineOmr';

describe('pdfOfflineOmr', () => {
  it('maps treble and bass staff diatonic steps accurately to MIDI', () => {
    // Treble bottom line = E4 (64), 2nd line = G4 (67), top line = F5 (77)
    expect(diatonicStepToMidi('treble', 0)).toBe(64);
    expect(diatonicStepToMidi('treble', 2)).toBe(67);
    expect(diatonicStepToMidi('treble', 8)).toBe(77);
    // Bass bottom line = G2 (43), top line = A3 (57)
    expect(diatonicStepToMidi('bass', 0)).toBe(43);
    expect(diatonicStepToMidi('bass', 8)).toBe(57);
  });

  it('detects a grand staff (treble + bass) and extracts noteheads from grayscale raster', () => {
    const width = 400;
    const height = 260;
    const gray = new Uint8Array(width * height).fill(255);

    const drawStaff = (topY: number, spacing: number) => {
      for (let line = 0; line < 5; line++) {
        const y = topY + line * spacing;
        for (let x = 20; x < 380; x++) {
          gray[y * width + x] = 20;
        }
      }
    };

    const drawNotehead = (cx: number, cy: number, rx: number, ry: number) => {
      for (let dy = -ry; dy <= ry; dy++) {
        for (let dx = -rx; dx <= rx; dx++) {
          if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
            const x = Math.round(cx + dx);
            const y = Math.round(cy + dy);
            if (x >= 0 && x < width && y >= 0 && y < height) {
              gray[y * width + x] = 10;
            }
          }
        }
      }
    };

    // Treble staff: lines at 40, 50, 60, 70, 80 (spacing = 10, bottom line = 80 = E4)
    drawStaff(40, 10);
    // Bass staff: lines at 130, 140, 150, 160, 170 (bottom line = 170 = G2)
    drawStaff(130, 10);

    const staves = detectStavesFromGrayscale(gray, width, height);
    expect(staves).toHaveLength(2);
    expect(staves[0].clef).toBe('treble');
    expect(staves[1].clef).toBe('bass');

    // Draw E4 on treble bottom line (y=80) and G2 on bass bottom line (y=170)
    drawNotehead(120, 80, 6, 5);
    drawNotehead(120, 170, 6, 5);
    // Draw G4 on treble 2nd line (y=70) later in X
    drawNotehead(200, 70, 6, 5);

    const extracted = extractNotesFromGrayscalePage(gray, width, height, 1, 0, 100);
    expect(extracted.notes.length).toBeGreaterThanOrEqual(3);
    expect(extracted.notes.some((n) => n.hand === 'right' && n.midi === 64)).toBe(true);
    expect(extracted.notes.some((n) => n.hand === 'left' && n.midi === 43)).toBe(true);
    expect(extracted.notes.some((n) => n.hand === 'right' && n.midi === 67)).toBe(true);
  });

  it('detects thin anti-aliased light-gray staff lines and rejects vertical barlines', () => {
    const width = 400;
    const height = 160;
    const gray = new Uint8Array(width * height).fill(255);

    // Draw thin anti-aliased light-gray staff lines (gray = 205 on white 255)
    for (let line = 0; line < 5; line++) {
      const y = 40 + line * 10;
      for (let x = 40; x < 360; x++) {
        gray[y * width + x] = 205;
      }
    }
    // Draw a thin vertical barline at x = 180 (must NOT be misread as a notehead)
    for (let y = 40; y <= 80; y++) {
      gray[y * width + 180] = 20;
    }
    // Draw a real filled notehead at x = 120, y = 70 (G4 = MIDI 67)
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        if ((dx * dx) / 36 + (dy * dy) / 25 <= 1) {
          gray[(70 + dy) * width + (120 + dx)] = 15;
        }
      }
    }

    const staves = detectStavesFromGrayscale(gray, width, height);
    expect(staves).toHaveLength(1);

    const extracted = extractNotesFromGrayscalePage(gray, width, height, 1, 0, 100);
    expect(extracted.notes).toHaveLength(1);
    expect(extracted.notes[0].midi).toBe(67);
  });
});
