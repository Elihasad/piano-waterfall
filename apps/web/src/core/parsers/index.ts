import type { Song } from '../types';
import { parseMusicXml, parseMxlBuffer } from './musicXmlParser';
import { parseMidiBuffer } from './midiParser';

export { parseMusicXml, parseMxlBuffer, parseMidiBuffer };

export async function parseSongFile(file: File): Promise<Song> {
  const name = file.name || 'Untitled';
  const lower = name.toLowerCase();

  if (lower.endsWith('.xml') || lower.endsWith('.musicxml')) {
    const text = await file.text();
    return parseMusicXml(text, name, 'musicxml');
  }
  if (lower.endsWith('.mxl')) {
    const buffer = await file.arrayBuffer();
    return parseMxlBuffer(buffer, name);
  }
  if (lower.endsWith('.mid') || lower.endsWith('.midi')) {
    const buffer = await file.arrayBuffer();
    return parseMidiBuffer(buffer, name);
  }

  throw new Error(
    `Không hỗ trợ định dạng file "${name}". Vui lòng chọn .musicxml, .xml, .mxl, .mid hoặc .pdf.`,
  );
}
