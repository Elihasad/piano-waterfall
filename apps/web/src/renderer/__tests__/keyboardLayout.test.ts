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
    const belowHit = hitTestKey(layout, cSharp.x + 1, cSharp.height + 10);
    expect(belowHit === 60 || belowHit === 62).toBe(true);
  });
});
