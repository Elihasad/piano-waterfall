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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[1px] p-3">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl bg-[#f8f6f1] text-[#14151c] border border-[#e7e3d9] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#e7e3d9]">
          <h2 className="display-serif text-base font-bold text-[#14151c]">
            {t(language, 'settingsTitle')}{' '}
            <span className="font-sans text-[11px] font-normal text-[#888d9c]">v1.3.9</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(language, 'close')}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f3f0e8] text-[#4a4f5e]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Language Switcher */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-[#14151c]">{t(language, 'languageLabel')}</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`py-2 rounded-xl font-semibold border transition ${
                  language === 'en'
                    ? 'bg-[#4f46e5] text-white border-[#4f46e5]'
                    : 'bg-white text-[#4a4f5e] border-[#e7e3d9]'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage('vi')}
                className={`py-2 rounded-xl font-semibold border transition ${
                  language === 'vi'
                    ? 'bg-[#4f46e5] text-white border-[#4f46e5]'
                    : 'bg-white text-[#4a4f5e] border-[#e7e3d9]'
                }`}
              >
                Tiếng Việt
              </button>
            </div>
          </div>

          {/* Piano Sound Preset */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-[#14151c]">{t(language, 'soundPreset')}</label>
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
                  className={`py-2 px-2 rounded-xl font-semibold border transition ${
                    soundPreset === id
                      ? 'bg-[#4f46e5] text-white border-[#4f46e5]'
                      : 'bg-white text-[#4a4f5e] border-[#e7e3d9]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* USB / Bluetooth MIDI Status */}
          <div className="rounded-xl bg-white border border-[#e7e3d9] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#14151c] flex items-center gap-1.5">
                <Usb className="w-4 h-4 text-[#4f46e5]" />
                USB / Bluetooth MIDI
              </span>
              <button
                type="button"
                onClick={onReconnectMidi}
                className="px-2.5 py-1 rounded-full bg-[#eceefe] hover:bg-[#dfe2fd] text-[#4f46e5] font-semibold"
              >
                Scan MIDI
              </button>
            </div>
            {midiDevices.length > 0 ? (
              <div className="text-[#2f9e6c] font-medium">
                Connected: {midiDevices.join(', ')}
              </div>
            ) : (
              <div className="text-[#4a4f5e]">
                {midiSupported ? t(language, 'midiConnectHint') : 'Web MIDI not supported on this browser.'}
              </div>
            )}
          </div>

          {/* Show key labels */}
          <label className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-[#e7e3d9] cursor-pointer">
            <span className="font-semibold text-[#14151c]">{t(language, 'showKeyLabelsLabel')}</span>
            <input
              type="checkbox"
              checked={showKeyLabels}
              onChange={(e) => setShowKeyLabels(e.target.checked)}
              className="w-4 h-4 accent-[#4f46e5]"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 bg-white border-t border-[#e7e3d9]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-full bg-[#f3f0e8] text-xs font-semibold text-[#4a4f5e]"
          >
            {t(language, 'cancel')}
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 rounded-full bg-[#14151c] hover:bg-[#2a2d3d] text-xs font-bold text-white"
          >
            {t(language, 'save')}
          </button>
        </div>
      </form>
    </div>
  );
};
