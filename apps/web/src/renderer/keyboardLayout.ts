import { clampMidi, isBlackKey } from '../core/noteNames';

export interface KeyRect {
  midi: number;
  isBlack: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface KeyboardLayout {
  startMidi: number;
  endMidi: number;
  whiteKeyWidth: number;
  keys: KeyRect[];
  byMidi: Map<number, KeyRect>;
}

export function buildKeyboardLayout(
  startMidi: number,
  endMidi: number,
  width: number,
  height: number,
): KeyboardLayout {
  const start = clampMidi(Math.min(startMidi, endMidi));
  const end = clampMidi(Math.max(startMidi, endMidi));

  const whiteMidis: number[] = [];
  for (let m = start; m <= end; m++) {
    if (!isBlackKey(m)) whiteMidis.push(m);
  }

  const whiteCount = Math.max(1, whiteMidis.length);
  const whiteKeyWidth = width / whiteCount;
  const blackKeyWidth = whiteKeyWidth * 0.62;
  const blackKeyHeight = height * 0.62;

  const keys: KeyRect[] = [];
  const byMidi = new Map<number, KeyRect>();

  let whiteIdx = 0;
  for (let m = start; m <= end; m++) {
    if (!isBlackKey(m)) {
      const rect: KeyRect = {
        midi: m,
        isBlack: false,
        x: whiteIdx * whiteKeyWidth,
        y: 0,
        width: whiteKeyWidth,
        height,
      };
      keys.push(rect);
      byMidi.set(m, rect);
      whiteIdx++;
    }
  }

  for (let m = start; m <= end; m++) {
    if (isBlackKey(m)) {
      const prevWhite = byMidi.get(m - 1);
      const nextWhite = byMidi.get(m + 1);
      const centerX = prevWhite
        ? prevWhite.x + prevWhite.width
        : nextWhite
          ? nextWhite.x
          : 0;
      const rect: KeyRect = {
        midi: m,
        isBlack: true,
        x: centerX - blackKeyWidth / 2,
        y: 0,
        width: blackKeyWidth,
        height: blackKeyHeight,
      };
      keys.push(rect);
      byMidi.set(m, rect);
    }
  }

  return { startMidi: start, endMidi: end, whiteKeyWidth, keys, byMidi };
}

export function hitTestKey(layout: KeyboardLayout, x: number, y: number): number | null {
  // Check black keys first because they overlap white keys visually
  for (const key of layout.keys) {
    if (!key.isBlack) continue;
    if (x >= key.x && x <= key.x + key.width && y >= key.y && y <= key.y + key.height) {
      return key.midi;
    }
  }
  for (const key of layout.keys) {
    if (key.isBlack) continue;
    if (x >= key.x && x <= key.x + key.width && y >= key.y && y <= key.y + key.height) {
      return key.midi;
    }
  }
  return null;
}
