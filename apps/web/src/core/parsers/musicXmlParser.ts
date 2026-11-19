import JSZip from 'jszip';
import { clampMidi } from '../noteNames';
import type { Hand, MeasureEvent, NoteEvent, Song, SourceFormat, TempoEvent } from '../types';

const STEP_TO_SEMITONE: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getChildText(parent: Element | Document, tag: string): string {
  const el = parent.getElementsByTagName(tag)[0];
  return el?.textContent?.trim() ?? '';
}

function pitchToMidi(pitchEl: Element): number {
  const step = getChildText(pitchEl, 'step').toUpperCase();
  const alter = Number.parseFloat(getChildText(pitchEl, 'alter') || '0');
  const octave = Number.parseInt(getChildText(pitchEl, 'octave') || '4', 10);
  const semitone = STEP_TO_SEMITONE[step] ?? 0;
  return clampMidi((octave + 1) * 12 + semitone + Math.round(alter));
}

export function parseMusicXml(
  xmlText: string,
  fallbackTitle: string,
  sourceFormat: SourceFormat = 'musicxml',
): Song {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Invalid MusicXML: không thể đọc cấu trúc XML.');
  }

  const root = doc.documentElement;
  if (!root || (root.tagName !== 'score-partwise' && root.tagName !== 'score-timewise')) {
    throw new Error('Invalid MusicXML: thiếu thẻ gốc score-partwise.');
  }

  const title =
    getChildText(doc, 'work-title') ||
    getChildText(doc, 'movement-title') ||
    fallbackTitle.replace(/\.(musicxml|xml|mxl|pdf)$/i, '') ||
    'Untitled';
  const composer = getChildText(doc, 'creator') || '';

  const parts = Array.from(doc.getElementsByTagName('part'));
  if (parts.length === 0) {
    throw new Error('Invalid MusicXML: không tìm thấy part nào.');
  }

  // Prefer the first part (typically Piano grand staff); also merge extra parts if multi-part
  const notes: NoteEvent[] = [];
  const measures: MeasureEvent[] = [];
  const tempoEvents: TempoEvent[] = [];

  let defaultBpm = 120;
  let foundTempo = false;
  let noteCounter = 0;

  parts.forEach((partEl, partIndex) => {
    let divisions = 1;
    let currentBpm = defaultBpm;
    let beats = 4;
    let beatType = 4;
    let stavesCount = 1;
    let measureStartSec = 0;

    const openTies = new Map<string, NoteEvent>();
    const measureEls = Array.from(partEl.getElementsByTagName('measure'));

    measureEls.forEach((measureEl, mIdx) => {
      const measureNum = mIdx + 1;
      let cursorTicks = 0;
      let lastNoteStartTicks = 0;
      let maxTicksInMeasure = 0;

      for (const child of Array.from(measureEl.children)) {
        const tag = child.tagName;

        if (tag === 'attributes') {
          const divText = getChildText(child, 'divisions');
          if (divText) {
            const parsed = Number.parseFloat(divText);
            if (parsed > 0) divisions = parsed;
          }
          const stavesText = getChildText(child, 'staves');
          if (stavesText) {
            const parsed = Number.parseInt(stavesText, 10);
            if (parsed > 0) stavesCount = parsed;
          }
          const timeEl = child.getElementsByTagName('time')[0];
          if (timeEl) {
            const b = Number.parseInt(getChildText(timeEl, 'beats'), 10);
            const bt = Number.parseInt(getChildText(timeEl, 'beat-type'), 10);
            if (b > 0 && bt > 0) {
              beats = b;
              beatType = bt;
            }
          }
        } else if (tag === 'direction' || tag === 'sound') {
          const soundEl = tag === 'sound' ? child : child.getElementsByTagName('sound')[0];
          const tempoAttr = soundEl?.getAttribute('tempo');
          if (tempoAttr) {
            const bpm = Number.parseFloat(tempoAttr);
            if (Number.isFinite(bpm) && bpm > 10 && bpm < 400) {
              currentBpm = bpm;
              if (!foundTempo) {
                defaultBpm = bpm;
                foundTempo = true;
              }
              if (partIndex === 0) {
                const secPerQuarter = 60 / currentBpm;
                const timeSec = measureStartSec + (cursorTicks / divisions) * secPerQuarter;
                tempoEvents.push({ timeSec, bpm });
              }
            }
          }
        } else if (tag === 'backup') {
          const dur = Number.parseFloat(getChildText(child, 'duration') || '0');
          cursorTicks = Math.max(0, cursorTicks - dur);
        } else if (tag === 'forward') {
          const dur = Number.parseFloat(getChildText(child, 'duration') || '0');
          cursorTicks += dur;
          maxTicksInMeasure = Math.max(maxTicksInMeasure, cursorTicks);
        } else if (tag === 'note') {
          // Skip grace notes with no duration
          if (child.getElementsByTagName('grace').length > 0) {
            continue;
          }
          const isChord = child.getElementsByTagName('chord').length > 0;
          const isRest = child.getElementsByTagName('rest').length > 0;
          const durTicks = Number.parseFloat(getChildText(child, 'duration') || '0');

          const noteStartTicks = isChord ? lastNoteStartTicks : cursorTicks;
          if (!isChord) {
            lastNoteStartTicks = cursorTicks;
            cursorTicks += durTicks;
            maxTicksInMeasure = Math.max(maxTicksInMeasure, cursorTicks);
          }

          if (isRest || durTicks <= 0) continue;

          const pitchEl = child.getElementsByTagName('pitch')[0];
          if (!pitchEl) continue;

          const midi = pitchToMidi(pitchEl);
          const secPerQuarter = 60 / currentBpm;
          const startTimeSec = measureStartSec + (noteStartTicks / divisions) * secPerQuarter;
          const durationSec = (durTicks / divisions) * secPerQuarter;

          const staffNum = Number.parseInt(getChildText(child, 'staff') || '0', 10);
          let hand: Hand;
          if (stavesCount >= 2 && staffNum > 0) {
            hand = staffNum === 2 ? 'left' : 'right';
          } else if (parts.length >= 2) {
            hand = partIndex >= 1 ? 'left' : 'right';
          } else {
            hand = midi < 60 ? 'left' : 'right';
          }

          const tieEls = Array.from(child.getElementsByTagName('tie'));
          const hasTieStart = tieEls.some((el) => el.getAttribute('type') === 'start');
          const hasTieStop = tieEls.some((el) => el.getAttribute('type') === 'stop');
          const tieKey = `${partIndex}:${staffNum || hand}:${midi}`;

          if (hasTieStop && openTies.has(tieKey)) {
            const existing = openTies.get(tieKey)!;
            existing.durationSec += durationSec;
            if (!hasTieStart) {
              openTies.delete(tieKey);
            }
            continue;
          }

          const note: NoteEvent = {
            id: `n-${noteCounter++}`,
            midi,
            startTimeSec,
            durationSec,
            velocity: 0.8,
            hand,
            measureNumber: measureNum,
          };
          notes.push(note);
          if (hasTieStart) {
            openTies.set(tieKey, note);
          }
        }
      }

      const secPerQuarter = 60 / currentBpm;
      const expectedMeasureQuarters = beats * (4 / beatType);
      const actualMeasureQuarters = maxTicksInMeasure > 0 ? maxTicksInMeasure / divisions : expectedMeasureQuarters;
      const measureDurationSec = Math.max(actualMeasureQuarters, expectedMeasureQuarters) * secPerQuarter;

      if (partIndex === 0) {
        measures.push({
          number: measureNum,
          startTimeSec: measureStartSec,
          endTimeSec: measureStartSec + measureDurationSec,
          beats,
          beatType,
        });
      }
      measureStartSec += measureDurationSec;
    });
  });

  notes.sort((a, b) => a.startTimeSec - b.startTimeSec || a.midi - b.midi);

  const lastNoteEnd = notes.reduce((acc, n) => Math.max(acc, n.startTimeSec + n.durationSec), 0);
  const lastMeasureEnd = measures.length > 0 ? measures[measures.length - 1].endTimeSec : 0;
  const durationSec = Math.max(lastNoteEnd, lastMeasureEnd, 1);

  const minMidi = notes.length > 0 ? notes.reduce((acc, n) => Math.min(acc, n.midi), 108) : 60;
  const maxMidi = notes.length > 0 ? notes.reduce((acc, n) => Math.max(acc, n.midi), 21) : 72;

  return {
    id: generateId('song'),
    title,
    composer,
    sourceFormat,
    createdAt: Date.now(),
    defaultBpm,
    durationSec,
    tempoEvents: tempoEvents.length > 0 ? tempoEvents : [{ timeSec: 0, bpm: defaultBpm }],
    measures:
      measures.length > 0
        ? measures
        : [{ number: 1, startTimeSec: 0, endTimeSec: durationSec, beats: 4, beatType: 4 }],
    notes,
    minMidi,
    maxMidi,
  };
}

export async function parseMxlBuffer(buffer: ArrayBuffer, fallbackTitle: string): Promise<Song> {
  const zip = await JSZip.loadAsync(buffer);
  let targetPath: string | null = null;

  const containerEntry = zip.file('META-INF/container.xml');
  if (containerEntry) {
    const containerXml = await containerEntry.async('text');
    const doc = new DOMParser().parseFromString(containerXml, 'application/xml');
    const rootfile = doc.getElementsByTagName('rootfile')[0];
    targetPath = rootfile?.getAttribute('full-path') ?? null;
  }

  if (!targetPath) {
    const xmlEntry = Object.keys(zip.files).find(
      (name) => /\.(musicxml|xml)$/i.test(name) && !name.startsWith('META-INF/'),
    );
    targetPath = xmlEntry ?? null;
  }

  if (!targetPath || !zip.file(targetPath)) {
    throw new Error('Invalid MXL: không tìm thấy file MusicXML bên trong.');
  }

  const xmlText = await zip.file(targetPath)!.async('text');
  return parseMusicXml(xmlText, fallbackTitle, 'musicxml');
}
