import { clampMidi, midiToNoteLabel } from '../core/noteNames';
import type { Hand, HandControlState, NoteLabelMode, Song } from '../core/types';
import type { KeyboardLayout } from './keyboardLayout';

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
  effectsEnabled: boolean;
  loopEnabled: boolean;
  loopStartMeasure: number;
  loopEndMeasure: number;
  particles: Particle[];
  manualPressedMidis: Set<number>;
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
    effectsEnabled,
    loopEnabled,
    loopStartMeasure,
    loopEndMeasure,
    particles,
    manualPressedMidis,
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

  for (const note of song.notes) {
    if (note.startTimeSec > windowEnd) break;
    const noteEnd = note.startTimeSec + note.durationSec;
    if (noteEnd < windowStart) continue;

    const visible = note.hand === 'left' ? hands.left.visual : hands.right.visual;
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
      activeKeyHands.set(pitchedMidi, note.hand);
      if (effectsEnabled && isPlaying && particles.length < 180 && Math.random() < 0.45) {
        const color = note.hand === 'left' ? '#4ade80' : '#22d3ee';
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

    const padX = keyRect.isBlack ? 1 : 2;
    const barX = keyRect.x + padX;
    const barW = Math.max(4, keyRect.width - padX * 2);

    const fill =
      note.hand === 'left'
        ? keyRect.isBlack
          ? '#16a34a'
          : '#4ade80'
        : keyRect.isBlack
          ? '#0891b2'
          : '#22d3ee';

    ctx.save();
    if (effectsEnabled && isHit) {
      ctx.shadowColor = note.hand === 'left' ? '#4ade80' : '#22d3ee';
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = fill;
    drawRoundedRect(ctx, barX, barTop, barW, barHeight, 5);
    ctx.fill();

    // Subtle top highlight edge
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Note Name label on each falling bar
    if (noteLabelMode !== 'off' && barHeight >= 15 && barW >= 12) {
      const label = midiToNoteLabel(pitchedMidi, noteLabelMode, false);
      const fontSize = Math.max(10, Math.min(14, Math.floor(barW * 0.52)));
      ctx.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labelY = barHeight > 28 ? barBottom - 12 : barTop + barHeight / 2;

      ctx.fillStyle = keyRect.isBlack ? '#ffffff' : '#082026';
      ctx.fillText(label, barX + barW / 2, labelY, barW - 2);
    }
  }

  // 6. Hit glow & rising spark particles
  if (effectsEnabled) {
    for (const [midi, hand] of activeKeyHands.entries()) {
      const keyRect = layout.byMidi.get(midi);
      if (!keyRect) continue;
      const cx = keyRect.x + keyRect.width / 2;
      const grad = ctx.createRadialGradient(cx, waterfallHeight, 1, cx, waterfallHeight, keyRect.width * 1.1);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      grad.addColorStop(0.4, hand === 'left' ? 'rgba(74, 222, 128, 0.65)' : 'rgba(34, 211, 238, 0.65)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - keyRect.width * 1.2, waterfallHeight - keyRect.width * 1.2, keyRect.width * 2.4, keyRect.width * 1.2);
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

    if (activeHand === 'left') {
      ctx.fillStyle = '#4ade80';
    } else if (activeHand === 'right') {
      ctx.fillStyle = '#22d3ee';
    } else if (manual) {
      ctx.fillStyle = '#a78bfa';
    } else {
      ctx.fillStyle = '#f8fafc';
    }

    ctx.fillRect(key.x + 0.5, 0, key.width - 1, key.height - 2);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(key.x + 0.5, 0, key.width - 1, key.height - 2);

    if (showKeyLabels && key.width >= 16) {
      const isC = key.midi % 12 === 0;
      const text = midiToNoteLabel(key.midi, noteLabelMode === 'off' ? 'letters' : noteLabelMode, isC);
      const fontSize = Math.max(9, Math.min(12, Math.floor(key.width * 0.42)));
      ctx.font = `${isC ? '700' : '500'} ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = activeHand || manual ? '#0f172a' : isC ? '#0f172a' : '#64748b';
      ctx.fillText(text, key.x + key.width / 2, key.height - 6, key.width - 2);
    }
  }

  for (const key of layout.keys) {
    if (!key.isBlack) continue;
    const activeHand = activeKeyHands.get(key.midi);
    const manual = manualPressedMidis.has(key.midi);

    if (activeHand === 'left') {
      ctx.fillStyle = '#16a34a';
    } else if (activeHand === 'right') {
      ctx.fillStyle = '#0891b2';
    } else if (manual) {
      ctx.fillStyle = '#7c3aed';
    } else {
      ctx.fillStyle = '#18181f';
    }

    drawRoundedRect(ctx, key.x, 0, key.width, key.height, 3);
    ctx.fill();
    ctx.strokeStyle = '#09090d';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}
