import { clampMidi, midiToNoteLabel } from '../core/noteNames';
import { resolveEffectiveHand } from '../core/parsers/handSeparation';
import type {
  Hand,
  HandControlState,
  HandSplitMode,
  KeyboardLabelMode,
  NoteLabelMode,
  Song,
} from '../core/types';
import type { KeyboardLayout } from './keyboardLayout';

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16) || 0,
      parseInt(clean[1] + clean[1], 16) || 0,
      parseInt(clean[2] + clean[2], 16) || 0,
    ];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16) || 0,
      parseInt(clean.slice(2, 4), 16) || 0,
      parseInt(clean.slice(4, 6), 16) || 0,
    ];
  }
  return [34, 211, 238];
}

function darkenHex(hex: string, factor = 0.56): string {
  const [r, g, b] = parseHexRgb(hex);
  const dr = Math.max(0, Math.min(255, Math.round(r * factor)));
  const dg = Math.max(0, Math.min(255, Math.round(g * factor)));
  const db = Math.max(0, Math.min(255, Math.round(b * factor)));
  return `rgb(${dr}, ${dg}, ${db})`;
}

function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHexRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  size: number;
}

export interface WaterfallFrameParams {
  song: Song;
  layout: KeyboardLayout;
  width: number;
  waterfallHeight: number;
  keyboardHeight: number;
  currentTimeSec: number;
  lookAheadSec: number;
  transpose: number;
  hands: HandControlState;
  noteLabelMode: NoteLabelMode;
  showKeyLabels: boolean;
  showFallingNoteLabels?: boolean;
  keyboardLabelMode?: KeyboardLabelMode;
  leftHandColor?: string;
  rightHandColor?: string;
  handSplitMode?: HandSplitMode;
  effectsEnabled: boolean;
  loopEnabled: boolean;
  loopStartMeasure: number;
  loopEndMeasure: number;
  particles: Particle[];
  manualPressedMidis: Set<number>;
  waitingMidis: Set<number>;
  isPlaying: boolean;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function renderWaterfallFrame(
  ctx: CanvasRenderingContext2D,
  params: WaterfallFrameParams,
): void {
  const {
    song,
    layout,
    width,
    waterfallHeight,
    keyboardHeight,
    currentTimeSec,
    lookAheadSec,
    transpose,
    hands,
    noteLabelMode,
    showKeyLabels,
    showFallingNoteLabels = true,
    keyboardLabelMode = showKeyLabels ? 'c-only' : 'off',
    leftHandColor = '#4ade80',
    rightHandColor = '#22d3ee',
    handSplitMode = 'auto',
    effectsEnabled,
    loopEnabled,
    loopStartMeasure,
    loopEndMeasure,
    particles,
    manualPressedMidis,
    waitingMidis,
    isPlaying,
  } = params;

  const pxPerSec = waterfallHeight / Math.max(0.5, lookAheadSec);

  // 1. Background
  ctx.fillStyle = '#121216';
  ctx.fillRect(0, 0, width, waterfallHeight + keyboardHeight);

  // 2. Subtle vertical guides for C keys and black key columns
  for (const key of layout.keys) {
    if (key.isBlack) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
      ctx.fillRect(key.x, 0, key.width, waterfallHeight);
    } else if (key.midi % 12 === 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(key.x, 0);
      ctx.lineTo(key.x, waterfallHeight);
      ctx.stroke();
    }
  }

  // 3. Loop highlight band
  if (loopEnabled && song.measures.length > 0) {
    const startM = song.measures[loopStartMeasure - 1];
    const endM = song.measures[loopEndMeasure - 1];
    if (startM && endM) {
      const yBottom = waterfallHeight - (startM.startTimeSec - currentTimeSec) * pxPerSec;
      const yTop = waterfallHeight - (endM.endTimeSec - currentTimeSec) * pxPerSec;
      const clampedTop = Math.max(0, yTop);
      const clampedBottom = Math.min(waterfallHeight, yBottom);
      if (clampedBottom > clampedTop) {
        ctx.fillStyle = 'rgba(139, 92, 246, 0.09)';
        ctx.fillRect(0, clampedTop, width, clampedBottom - clampedTop);
      }
    }
  }

  // 4. Horizontal measure lines & measure numbers
  ctx.font = '600 11px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  for (const m of song.measures) {
    const dt = m.startTimeSec - currentTimeSec;
    if (dt < -0.5 || dt > lookAheadSec + 0.5) continue;
    const y = waterfallHeight - dt * pxPerSec;
    if (y < 0 || y > waterfallHeight) continue;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
    ctx.fillText(String(m.number), 6, y - 3);
  }

  // 5. Falling notes + active key tracking
  const activeKeyHands = new Map<number, Hand>();
  const windowStart = currentTimeSec - 0.05;
  const windowEnd = currentTimeSec + lookAheadSec + 0.2;

  const leftBlackColor = darkenHex(leftHandColor, 0.56);
  const rightBlackColor = darkenHex(rightHandColor, 0.56);

  // Draw white-key bars first, then black-key bars on top so black-key labels never get obscured
  const visibleNotes: Array<{
    note: Song['notes'][number];
    effectiveHand: Hand;
    pitchedMidi: number;
    keyRect: NonNullable<ReturnType<KeyboardLayout['byMidi']['get']>>;
    barTop: number;
    barBottom: number;
    barHeight: number;
    isHit: boolean;
  }> = [];

  for (const note of song.notes) {
    if (note.startTimeSec > windowEnd) break;
    const noteEnd = note.startTimeSec + note.durationSec;
    if (noteEnd < windowStart) continue;

    const effectiveHand = resolveEffectiveHand(note, handSplitMode);
    const visible = effectiveHand === 'left' ? hands.left.visual : hands.right.visual;
    if (!visible) continue;

    const pitchedMidi = clampMidi(note.midi + transpose);
    const keyRect = layout.byMidi.get(pitchedMidi);
    if (!keyRect) continue;

    const yBottom = waterfallHeight - (note.startTimeSec - currentTimeSec) * pxPerSec;
    const yTop = waterfallHeight - (noteEnd - currentTimeSec) * pxPerSec;

    const barTop = Math.max(0, yTop);
    const barBottom = Math.min(waterfallHeight, yBottom);
    const barHeight = barBottom - barTop;

    const isHit = note.startTimeSec <= currentTimeSec && noteEnd > currentTimeSec;
    if (isHit) {
      activeKeyHands.set(pitchedMidi, effectiveHand);
      if (effectsEnabled && isPlaying && particles.length < 180 && Math.random() < 0.45) {
        const color = effectiveHand === 'left' ? leftHandColor : rightHandColor;
        particles.push({
          x: keyRect.x + keyRect.width / 2 + (Math.random() - 0.5) * keyRect.width * 0.6,
          y: waterfallHeight - 2,
          vx: (Math.random() - 0.5) * 2.2,
          vy: -(1.2 + Math.random() * 2.8),
          alpha: 0.95,
          color,
          size: 1.5 + Math.random() * 2.5,
        });
      }
    }

    if (barHeight <= 1) continue;
    visibleNotes.push({ note, effectiveHand, pitchedMidi, keyRect, barTop, barBottom, barHeight, isHit });
  }

  visibleNotes.sort((a, b) => Number(a.keyRect.isBlack) - Number(b.keyRect.isBlack));

  for (const item of visibleNotes) {
    const { note, effectiveHand, pitchedMidi, keyRect, barTop, barBottom, barHeight, isHit } = item;
    const padX = keyRect.isBlack ? 0.5 : 1.5;
    const barX = keyRect.x + padX;
    const barW = Math.max(6, keyRect.width - padX * 2);

    const isWaiting = waitingMidis.has(pitchedMidi) && Math.abs(note.startTimeSec - currentTimeSec) < 0.08;

    const fill =
      effectiveHand === 'left'
        ? keyRect.isBlack
          ? leftBlackColor
          : leftHandColor
        : keyRect.isBlack
          ? rightBlackColor
          : rightHandColor;

    ctx.save();
    if (effectsEnabled && (isHit || isWaiting)) {
      ctx.shadowColor = isWaiting ? '#fbbf24' : effectiveHand === 'left' ? leftHandColor : rightHandColor;
      ctx.shadowBlur = isWaiting ? 18 : 14;
    }
    ctx.fillStyle = fill;
    drawRoundedRect(ctx, barX, barTop, barW, barHeight, 5);
    ctx.fill();

    ctx.strokeStyle = isWaiting ? '#fbbf24' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = isWaiting ? 2 : 1;
    ctx.stroke();
    ctx.restore();

    // Render crisp note name on falling bars when enabled
    if (showFallingNoteLabels && noteLabelMode !== 'off' && barHeight >= 4) {
      const label = midiToNoteLabel(pitchedMidi, noteLabelMode, false);
      const isSharp = label.length >= 2;
      const fontSize = keyRect.isBlack
        ? Math.max(8, Math.min(11, Math.floor(barW * (isSharp ? 0.58 : 0.72))))
        : Math.max(9, Math.min(13, Math.floor(barW * 0.56)));
      ctx.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const centerX = barX + barW / 2;
      const labelY = barHeight > 24 ? barBottom - 10 : barTop + barHeight / 2;

      if (keyRect.isBlack) {
        // High-contrast dark outline + bright white text so sharps like C#, F# pop cleanly even on narrow bars
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(9, 9, 13, 0.85)';
        ctx.strokeText(label, centerX, labelY);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, centerX, labelY);
      } else {
        ctx.fillStyle = '#062026';
        ctx.fillText(label, centerX, labelY, Math.max(barW - 1, 14));
      }
    }
  }

  // 6. Hit glow & rising spark particles
  if (effectsEnabled) {
    for (const [midi, hand] of activeKeyHands.entries()) {
      const keyRect = layout.byMidi.get(midi);
      if (!keyRect) continue;
      const cx = keyRect.x + keyRect.width / 2;
      const grad = ctx.createRadialGradient(
        cx,
        waterfallHeight,
        1,
        cx,
        waterfallHeight,
        keyRect.width * 1.1,
      );
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      grad.addColorStop(
        0.4,
        hexToRgba(hand === 'left' ? leftHandColor : rightHandColor, 0.65),
      );
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(
        cx - keyRect.width * 1.2,
        waterfallHeight - keyRect.width * 1.2,
        keyRect.width * 2.4,
        keyRect.width * 1.2,
      );
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.025;
      if (p.alpha <= 0 || p.y < 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // 6b. Subtle lead-in countdown pill (when song starts with 2–3s preparation buffer)
  if (currentTimeSec < -0.05 && isPlaying) {
    const remaining = Math.ceil(-currentTimeSec);
    ctx.save();
    const cx = width / 2;
    const cy = Math.min(waterfallHeight * 0.42, waterfallHeight - 40);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, cx - 34, cy - 26, 68, 52, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(remaining), cx, cy + 1);
    ctx.restore();
  }

  // 7. Key contact divider line
  ctx.fillStyle = '#09090d';
  ctx.fillRect(0, waterfallHeight, width, 3);

  // 8. Piano Keyboard (White keys first, then Black keys)
  ctx.save();
  ctx.translate(0, waterfallHeight + 2);

  for (const key of layout.keys) {
    if (key.isBlack) continue;
    const activeHand = activeKeyHands.get(key.midi);
    const manual = manualPressedMidis.has(key.midi);
    const waiting = waitingMidis.has(key.midi);

    if (manual) {
      ctx.fillStyle = '#a78bfa';
    } else if (waiting) {
      ctx.fillStyle = '#fde047';
    } else if (activeHand === 'left') {
      ctx.fillStyle = leftHandColor;
    } else if (activeHand === 'right') {
      ctx.fillStyle = rightHandColor;
    } else {
      ctx.fillStyle = '#f8fafc';
    }

    ctx.fillRect(key.x + 0.5, 0, key.width - 1, key.height - 2);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(key.x + 0.5, 0, key.width - 1, key.height - 2);

    const isC = key.midi % 12 === 0;
    const shouldDrawWhiteLabel =
      keyboardLabelMode === 'all' || (keyboardLabelMode === 'c-only' && isC);
    if (shouldDrawWhiteLabel && key.width >= 10) {
      const text = midiToNoteLabel(key.midi, noteLabelMode === 'off' ? 'letters' : noteLabelMode, isC);
      const fontSize = Math.max(8, Math.min(12, Math.floor(key.width * 0.44)));
      ctx.font = `${isC ? '700' : '500'} ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = activeHand || manual || waiting ? '#0f172a' : isC ? '#0f172a' : '#64748b';
      ctx.fillText(text, key.x + key.width / 2, key.height - 5, key.width - 1);
    }
  }

  for (const key of layout.keys) {
    if (!key.isBlack) continue;
    const activeHand = activeKeyHands.get(key.midi);
    const manual = manualPressedMidis.has(key.midi);
    const waiting = waitingMidis.has(key.midi);

    if (manual) {
      ctx.fillStyle = '#7c3aed';
    } else if (waiting) {
      ctx.fillStyle = '#eab308';
    } else if (activeHand === 'left') {
      ctx.fillStyle = leftBlackColor;
    } else if (activeHand === 'right') {
      ctx.fillStyle = rightBlackColor;
    } else {
      ctx.fillStyle = '#18181f';
    }

    drawRoundedRect(ctx, key.x, 0, key.width, key.height, 3);
    ctx.fill();
    ctx.strokeStyle = '#09090d';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw crisp note labels on BLACK keys only when keyboardLabelMode === 'all'
    if (keyboardLabelMode === 'all' && key.width >= 9) {
      const text = midiToNoteLabel(key.midi, noteLabelMode === 'off' ? 'letters' : noteLabelMode, false);
      const fontSize = Math.max(7, Math.min(10, Math.floor(key.width * 0.55)));
      ctx.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = waiting ? '#0f172a' : '#e2e8f0';
      ctx.fillText(text, key.x + key.width / 2, key.height - 4, key.width + 2);
    }
  }

  ctx.restore();
}
