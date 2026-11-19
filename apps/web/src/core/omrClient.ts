export interface OmrProgress {
  status: 'queued' | 'processing' | 'done' | 'error';
  currentPage: number;
  totalPages: number;
  message?: string;
}

export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function validateOmrUrl(
  url: string,
  pageProtocol: string = typeof window !== 'undefined' ? window.location.protocol : 'http:',
): { ok: boolean; error?: string } {
  const clean = normalizeBaseUrl(url);
  if (!clean) {
    return {
      ok: false,
      error:
        'Chưa cấu hình địa chỉ máy chủ OMR để đọc PDF. Hãy mở Cài đặt (⚙️) và nhập URL máy chủ OMR (ví dụ Hugging Face Spaces).',
    };
  }
  if (!/^https?:\/\//i.test(clean)) {
    return {
      ok: false,
      error: 'URL máy chủ OMR phải bắt đầu bằng https:// hoặc http://',
    };
  }
  if (pageProtocol === 'https:' && clean.startsWith('http://')) {
    return {
      ok: false,
      error:
        'Trình duyệt HTTPS (đặc biệt iOS Safari) chặn kết nối http:// không bảo mật. Hãy dùng địa chỉ HTTPS (như Hugging Face Spaces hoặc Cloudflare Tunnel).',
    };
  }
  return { ok: true };
}

export async function checkOmrHealth(
  baseUrl: string,
): Promise<{ ok: boolean; engine?: string; error?: string }> {
  const check = validateOmrUrl(baseUrl);
  if (!check.ok) return { ok: false, error: check.error };
  const clean = normalizeBaseUrl(baseUrl);
  try {
    const res = await fetch(`${clean}/api/health`);
    if (!res.ok) {
      return { ok: false, error: `Máy chủ phản hồi lỗi HTTP ${res.status}` };
    }
    const data = (await res.json()) as { status?: string; engine?: string };
    return { ok: data.status === 'ok', engine: data.engine };
  } catch (err) {
    return {
      ok: false,
      error: `Không thể kết nối tới máy chủ OMR (${err instanceof Error ? err.message : 'Network error'}).`,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function convertPdfWithProgress(
  baseUrl: string,
  file: File,
  onProgress: (progress: OmrProgress) => void,
  signal?: AbortSignal,
  pollIntervalMs = 1000,
): Promise<string> {
  const check = validateOmrUrl(baseUrl);
  if (!check.ok) {
    throw new Error(check.error);
  }
  const clean = normalizeBaseUrl(baseUrl);

  const formData = new FormData();
  formData.append('file', file);

  const startRes = await fetch(`${clean}/api/jobs`, {
    method: 'POST',
    body: formData,
    signal,
  });
  if (!startRes.ok) {
    const text = await startRes.text().catch(() => '');
    throw new Error(`Không thể tải PDF lên máy chủ OMR (HTTP ${startRes.status}): ${text}`);
  }

  const { jobId, totalPages } = (await startRes.json()) as {
    jobId: string;
    totalPages: number;
  };
  onProgress({ status: 'queued', currentPage: 0, totalPages });

  const cancelRemote = async () => {
    try {
      await fetch(`${clean}/api/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
    } catch {
      // Best-effort cancellation
    }
  };

  while (true) {
    if (signal?.aborted) {
      await cancelRemote();
      throw new Error('Đã hủy chuyển đổi PDF.');
    }

    const pollRes = await fetch(`${clean}/api/jobs/${encodeURIComponent(jobId)}`, { signal });
    if (!pollRes.ok) {
      throw new Error(`Lỗi kiểm tra tiến độ OMR (HTTP ${pollRes.status})`);
    }
    const data = (await pollRes.json()) as {
      status: 'queued' | 'processing' | 'done' | 'error';
      currentPage: number;
      totalPages: number;
      musicxml?: string;
      error?: string;
    };

    onProgress({
      status: data.status,
      currentPage: data.currentPage ?? 0,
      totalPages: data.totalPages ?? totalPages,
      message: data.error,
    });

    if (data.status === 'done') {
      if (!data.musicxml) {
        throw new Error('Máy chủ OMR hoàn tất nhưng không trả về dữ liệu MusicXML.');
      }
      return data.musicxml;
    }

    if (data.status === 'error') {
      throw new Error(data.error || 'Chuyển đổi PDF thất bại.');
    }

    if (signal?.aborted) {
      await cancelRemote();
      throw new Error('Đã hủy chuyển đổi PDF.');
    }

    await sleep(pollIntervalMs);
  }
}
