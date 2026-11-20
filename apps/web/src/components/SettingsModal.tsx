import React, { useState } from 'react';
import { X, Usb } from 'lucide-react';
import { t } from '../core/i18n';
import type { AppSettings, Language, SoundPreset } from '../core/types';

interface SettingsModalProps {
  settings: AppSettings;
  midiDevices: string[];
  midiSupported: boolean;
  onReconnectMidi: () => void;
  onSave: (partial: Partial<AppSettings>) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  midiDevices,
  midiSupported,
  onReconnectMidi,
  onSave,
  onClose,
}) => {
  const [language, setLanguage] = useState<Language>(settings.language);
  const [soundPreset, setSoundPreset] = useState<SoundPreset>(settings.soundPreset);
  const [showKeyLabels, setShowKeyLabels] = useState(settings.showKeyLabels);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      language,
      soundPreset,
      showKeyLabels,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl bg-[#1a1b22] border border-[#2c2e3b] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2c2e3b]">
          <h2 className="text-sm font-bold text-slate-100">
            {t(language, 'settingsTitle')}{' '}
            <span className="text-[11px] font-normal text-slate-400">v2.11</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(language, 'close')}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#242632] text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Language Switcher */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-200">{t(language, 'languageLabel')}</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`py-2 rounded-lg font-semibold border transition ${
                  language === 'en'
                    ? 'bg-violet-600 text-white border-violet-500'
                    : 'bg-[#121216] text-slate-300 border-[#2c2e3b]'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage('vi')}
                className={`py-2 rounded-lg font-semibold border transition ${
                  language === 'vi'
                    ? 'bg-violet-600 text-white border-violet-500'
                    : 'bg-[#121216] text-slate-300 border-[#2c2e3b]'
                }`}
              >
                Tiếng Việt
              </button>
            </div>
          </div>

          {/* Piano Sound Preset */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-200">{t(language, 'soundPreset')}</label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['grand', t(language, 'soundGrand')],
                  ['studio', t(language, 'soundStudio')],
                  ['bright', t(language, 'soundBright')],
                  ['electric', t(language, 'soundElectric')],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSoundPreset(id)}
                  className={`py-2 px-2 rounded-lg font-semibold border transition ${
                    soundPreset === id
                      ? 'bg-violet-600 text-white border-violet-500'
                      : 'bg-[#121216] text-slate-300 border-[#2c2e3b]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* USB / Bluetooth MIDI Status */}
          <div className="rounded-xl bg-[#14151c] border border-[#262836] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Usb className="w-4 h-4 text-cyan-400" />
                USB / Bluetooth MIDI
              </span>
              <button
                type="button"
                onClick={onReconnectMidi}
                className="px-2.5 py-1 rounded-lg bg-[#242632] hover:bg-[#2f3242] text-cyan-300 font-semibold"
              >
                Scan MIDI
              </button>
            </div>
            {midiDevices.length > 0 ? (
              <div className="text-emerald-400 font-medium">
                Connected: {midiDevices.join(', ')}
              </div>
            ) : (
              <div className="text-slate-400">
                {midiSupported ? t(language, 'midiConnectHint') : 'Web MIDI not supported on this browser.'}
              </div>
            )}
          </div>

          {/* Show key labels */}
          <label className="flex items-center justify-between bg-[#14151c] rounded-xl px-3 py-2.5 border border-[#262836] cursor-pointer">
            <span className="font-semibold text-slate-200">{t(language, 'showKeyLabelsLabel')}</span>
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
            {t(language, 'cancel')}
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white"
          >
            {t(language, 'save')}
          </button>
        </div>
      </form>
    </div>
  );
};
