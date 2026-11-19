import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateOmrUrl, convertPdfWithProgress, type OmrProgress } from '../omrClient';

describe('omrClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('validates missing URL and HTTPS mixed-content URLs clearly', () => {
    const empty = validateOmrUrl('', 'https:');
    expect(empty.ok).toBe(false);
    expect(empty.error).toMatch(/Cài đặt|OMR/i);

    const mixed = validateOmrUrl('http://192.168.1.5:8000', 'https:');
    expect(mixed.ok).toBe(false);
    expect(mixed.error).toMatch(/HTTPS/i);

    expect(validateOmrUrl('https://my-omr.hf.space', 'https:').ok).toBe(true);
    expect(validateOmrUrl('http://192.168.1.5:8000', 'http:').ok).toBe(true);
  });

  it('polls async job progress and returns stitched MusicXML', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jobId: 'job-1', totalPages: 2 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jobId: 'job-1',
            status: 'processing',
            currentPage: 1,
            totalPages: 2,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jobId: 'job-1',
            status: 'done',
            currentPage: 2,
            totalPages: 2,
            musicxml: '<score-partwise/>',
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const updates: OmrProgress[] = [];
    const file = new File(['%PDF-1.4'], 'piece.pdf', { type: 'application/pdf' });
    const xml = await convertPdfWithProgress(
      'https://omr.example.com/',
      file,
      (p) => updates.push(p),
      undefined,
      10,
    );

    expect(xml).toBe('<score-partwise/>');
    expect(updates.some((u) => u.status === 'processing' && u.currentPage === 1)).toBe(true);
    expect(updates[updates.length - 1].status).toBe('done');
  });

  it('sends DELETE cancel request when aborted during polling', async () => {
    const controller = new AbortController();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jobId: 'job-99', totalPages: 4 }), { status: 200 }),
      )
      .mockImplementationOnce(async () => {
        controller.abort();
        return new Response(
          JSON.stringify({
            jobId: 'job-99',
            status: 'processing',
            currentPage: 1,
            totalPages: 4,
          }),
          { status: 200 },
        );
      })
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'cancelled' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const file = new File(['%PDF-1.4'], 'long.pdf', { type: 'application/pdf' });
    await expect(
      convertPdfWithProgress('https://omr.example.com', file, () => {}, controller.signal, 10),
    ).rejects.toThrow(/hủy|abort/i);

    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).includes('/api/jobs/job-99') && (init as RequestInit)?.method === 'DELETE',
      ),
    ).toBe(true);
  });
});
