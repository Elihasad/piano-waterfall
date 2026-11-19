import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { Midi } from '@tonejs/midi';
import { parseMusicXml, parseMxlBuffer, parseMidiBuffer, parseSongFile } from '../parsers';

const GRAND_STAFF_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Test Sonata</work-title></work>
  <identification><creator type="composer">Test Composer</creator></identification>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <staves>2</staves>
      </attributes>
      <direction><sound tempo="120"/></direction>
      <!-- Chord C4 + E4 at beat 0 on staff 1 (right hand), duration 4 ticks = 0.5s -->
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>4</duration><staff>1</staff>
      </note>
      <note>
        <chord/>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>4</duration><staff>1</staff>
      </note>
      <!-- Tied G4 starting at beat 1 (0.5s), duration 12 ticks (1.5s) tied into measure 2 -->
      <note>
        <pitch><step>G</step><octave>4</octave></pitch>
        <duration>12</duration><tie type="start"/><staff>1</staff>
      </note>
      <backup><duration>16</duration></backup>
      <!-- Left hand C3 on staff 2 at beat 0, duration 16 ticks (2.0s) -->
      <note>
        <pitch><step>C</step><octave>3</octave></pitch>
        <duration>16</duration><staff>2</staff>
      </note>
    </measure>
    <measure number="2">
      <!-- Continuation of tied G4: duration 4 ticks (0.5s) -> total 2.0s -->
      <note>
        <pitch><step>G</step><octave>4</octave></pitch>
        <duration>4</duration><tie type="stop"/><staff>1</staff>
      </note>
      <note><rest/><duration>12</duration><staff>1</staff></note>
    </measure>
  </part>
</score-partwise>`;

describe('MusicXML & MIDI parsers', () => {
  it('parses grand-staff MusicXML with chords, ties across measures, and left/right hands', () => {
    const song = parseMusicXml(GRAND_STAFF_XML, 'Fallback');
    expect(song.title).toBe('Test Sonata');
    expect(song.composer).toBe('Test Composer');
    expect(song.defaultBpm).toBe(120);
    expect(song.measures).toHaveLength(2);
    expect(song.measures[0].startTimeSec).toBeCloseTo(0, 3);
    expect(song.measures[1].startTimeSec).toBeCloseTo(2.0, 3);

    // Chord C4 (60) and E4 (64) share startTimeSec = 0 on right hand
    const c4 = song.notes.find((n) => n.midi === 60 && n.hand === 'right');
    const e4 = song.notes.find((n) => n.midi === 64 && n.hand === 'right');
    expect(c4?.startTimeSec).toBeCloseTo(0, 3);
    expect(e4?.startTimeSec).toBeCloseTo(0, 3);
    expect(c4?.durationSec).toBeCloseTo(0.5, 3);

    // Tied G4 (67) merged into a single note of duration 2.0s
    const g4Notes = song.notes.filter((n) => n.midi === 67);
    expect(g4Notes).toHaveLength(1);
    expect(g4Notes[0].startTimeSec).toBeCloseTo(0.5, 3);
    expect(g4Notes[0].durationSec).toBeCloseTo(2.0, 3);

    // Left hand C3 (48) from staff 2
    const c3 = song.notes.find((n) => n.midi === 48);
    expect(c3?.hand).toBe('left');
    expect(c3?.startTimeSec).toBeCloseTo(0, 3);
    expect(c3?.durationSec).toBeCloseTo(2.0, 3);
  });

  it('splits single-staff MusicXML at C4 (MIDI 60)', () => {
    const singleStaff = `<?xml version="1.0"?>
      <score-partwise>
        <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <note><pitch><step>G</step><octave>3</octave></pitch><duration>1</duration></note>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;
    const song = parseMusicXml(singleStaff, 'Single');
    expect(song.notes.find((n) => n.midi === 55)?.hand).toBe('left');
    expect(song.notes.find((n) => n.midi === 60)?.hand).toBe('right');
  });

  it('throws descriptive error on malformed XML', () => {
    expect(() => parseMusicXml('<score-partwise><broken', 'Bad')).toThrow(/Invalid MusicXML/i);
  });

  it('parses compressed .mxl buffer via container.xml', async () => {
    const zip = new JSZip();
    zip.file(
      'META-INF/container.xml',
      `<?xml version="1.0"?><container><rootfiles><rootfile full-path="score.musicxml"/></rootfiles></container>`,
    );
    zip.file('score.musicxml', GRAND_STAFF_XML);
    const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    const song = await parseMxlBuffer(arrayBuffer, 'Zipped');
    expect(song.title).toBe('Test Sonata');
    expect(song.notes.length).toBeGreaterThanOrEqual(4);
  });

  it('parses 2-track MIDI buffer into left and right hands', () => {
    const midi = new Midi();
    midi.header.setTempo(100);
    const rh = midi.addTrack();
    rh.addNote({ midi: 64, time: 0, duration: 0.5, velocity: 0.8 });
    const lh = midi.addTrack();
    lh.addNote({ midi: 48, time: 0, duration: 1.0, velocity: 0.7 });

    const bytes = midi.toArray();
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const song = parseMidiBuffer(buffer, 'My Midi');
    expect(song.title).toBe('My Midi');
    expect(song.sourceFormat).toBe('midi');
    expect(song.notes.find((n) => n.midi === 64)?.hand).toBe('right');
    expect(song.notes.find((n) => n.midi === 48)?.hand).toBe('left');
  });

  it('rejects unsupported file extensions in parseSongFile', async () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    await expect(parseSongFile(file)).rejects.toThrow(/Không hỗ trợ|Unsupported/i);
  });
});
