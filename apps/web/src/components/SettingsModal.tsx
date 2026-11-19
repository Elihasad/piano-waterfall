import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { checkOmrHealth } from '../core/omrClient';
import type { AppSettings } from '../core/types';

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (partial: Partial<AppSettings>) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave, onClose }) => {
  const [omrUrl, setOmrUrl] = useState(settings.omrServerUrl);
  const [showKeyLabels, setShowKeyLabels] = useState(settings.showKeyLabels);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await checkOmrHealth(omrUrl);
    setTesting(false);
    if (res.ok) {
      setTestResult({
        ok: true,
        text: `Kết nối thành công! (Engine: ${res.engine || 'homr'})`,
      });
    } else {
      setTestResult({ ok: false, text: res.error || 'Kết nối thất bại.' });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ omrServerUrl: omrUrl.trim(), showKeyLabels });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-[#1a1b22] border border-[#2c2e3b] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2c2e3b]">
          <h2 className="text-sm font-bold text-slate-100">Cài đặt</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cài đặt"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#242632] text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-200">
              Địa chỉ máy chủ chuyển đổi PDF (OMR Server URL)
            </label>
            <input
              type="url"
              value={omrUrl}
              onChange={(e) => setOmrUrl(e.target.value)}
              placeholder="https://ten-space.hf.space"
              className="w-full rounded-lg bg-[#121216] border border-[#2c2e3b] px-3 py-2 text-slate-100 placeholder:text-slate-500"
            />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              MusicXML & MIDI chạy 100% offline không cần máy chủ. Để tải file PDF từ điện thoại, hãy
              deploy thư mục <code className="text-cyan-300">services/omr-backend</code> lên Hugging
              Face Spaces (HTTPS miễn phí) rồi dán đường dẫn vào đây.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="px-3 py-1.5 rounded-lg bg-[#242632] hover:bg-[#2f3242] text-slate-200 font-semibold flex items-center gap-1.5"
              >
                {testing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Kiểm tra kết nối
              </button>
            </div>

            {testResult && (
              <div
                className={`flex items-start gap-1.5 p-2 rounded-lg text-[11px] ${
                  testResult.ok
                    ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-950/50 text-rose-300 border border-rose-500/30'
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                )}
                <span>{testResult.text}</span>
              </div>
            )}
          </div>

          <label className="flex items-center justify-between bg-[#14151c] rounded-xl px-3 py-2.5 border border-[#262836] cursor-pointer">
            <span className="font-semibold text-slate-200">Hiện tên nốt trên phím đàn piano</span>
            <input
              type="checkbox"
              checked={showKeyLabels}
              onChange={(e) => setShowKeyLabels(e.target.checked)}
              className="w-4 h-4 accent-violet-500"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#2c2e3b]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-[#242632] text-xs text-slate-300"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white"
          >
            Lưu cài đặt
          </button>
        </div>
      </form>
    </div>
  );
};
