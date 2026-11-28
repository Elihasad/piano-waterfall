import React, { useState } from 'react';
import { Palette, Sparkles, Usb, X } from 'lucide-react';
import { t } from '../core/i18n';
import type {
  AppSettings,
  HandSplitMode,
  KeyboardLabelMode,
  Language,
  SoundPreset,
} from '../core/types';

interface SettingsModalProps {
  settings: AppSettings;
  midiDevices: string[];
  midiSupported: boolean;
  onReconnectMidi: () => void;
  onSave: (partial: Partial<AppSettings>) => void;
  onClose: () => void;
}

const COLOR_PRESETS: Array<{ name: string; left: string; right: string }> = [
  { name: 'Classic', left: '#4ade80', right: '#22d3ee' },
  { name: 'Synthesia', left: '#fb923c', right: '#38bdf8' },
  { name: 'Neon', left: '#f472b6', right: '#2dd4bf' },
  { name: 'Royal', left: '#a78bfa', right: '#fbbf24' },
];

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
  const [effectsEnabled, setEffectsEnabled] = useState(settings.effectsEnabled);
  const [showFallingNoteLabels, setShowFallingNoteLabels] = useState(
    settings.showFallingNoteLabels ?? true,
  );
  const [keyboardLabelMode, setKeyboardLabelMode] = useState<KeyboardLabelMode>(
    settings.keyboardLabelMode ?? (settings.showKeyLabels ? 'c-only' : 'off'),
  );
  const [leftHandColor, setLeftHandColor] = useState(settings.leftHandColor ?? '#4ade80');
  const [rightHandColor, setRightHandColor] = useState(settings.rightHandColor ?? '#22d3ee');
  const [handSplitMode, setHandSplitMode] = useState<HandSplitMode>(
    settings.handSplitMode ?? 'auto',
  );

  const isVi = language === 'vi';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      language,
      soundPreset,
      effectsEnabled,
      showFallingNoteLabels,
      keyboardLabelMode,
      showKeyLabels: keyboardLabelMode !== 'off',
      leftHandColor,
      rightHandColor,
      handSplitMode,
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
            <span className="font-sans text-[11px] font-normal text-[#888d9c]">v1.3.31</span>
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
          {/* Visual & Display Customization */}
          <div className="rounded-xl bg-white border border-[#e7e3d9] p-3.5 space-y-3">
            <div className="font-bold text-[#14151c] flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-[#4f46e5]" />
              <span>{isVi ? 'Màu sắc, Hiệu ứng & Hiển thị nốt' : 'Colors, Effects & Note Labels'}</span>
            </div>

            {/* Hand Colors Presets + Custom Pickers */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-[#4a4f5e]">
                {isVi ? 'Màu tay trái & tay phải' : 'Left & Right Hand Colors'}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {COLOR_PRESETS.map((p) => {
                  const active = leftHandColor === p.left && rightHandColor === p.right;
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => {
                        setLeftHandColor(p.left);
                        setRightHandColor(p.right);
                      }}
                      className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold flex flex-col items-center gap-1 transition ${
                        active
                          ? 'border-[#4f46e5] bg-[#eceefe] text-[#14151c]'
                          : 'border-[#e7e3d9] bg-[#f8f6f1] text-[#4a4f5e]'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full" style={{ background: p.left }} />
                        <span className="w-3 h-3 rounded-full" style={{ background: p.right }} />
                      </span>
                      <span>{p.name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <label className="flex items-center justify-between bg-[#f8f6f1] rounded-lg px-2.5 py-1.5 border border-[#e7e3d9] cursor-pointer">
                  <span className="font-medium text-[#14151c]">
                    {isVi ? 'Tay trái (LH)' : 'Left Hand'}
                  </span>
                  <input
                    type="color"
                    value={leftHandColor}
                    onChange={(e) => setLeftHandColor(e.target.value)}
                    className="w-6 h-5 rounded cursor-pointer border-0 bg-transparent"
                  />
                </label>
                <label className="flex items-center justify-between bg-[#f8f6f1] rounded-lg px-2.5 py-1.5 border border-[#e7e3d9] cursor-pointer">
                  <span className="font-medium text-[#14151c]">
                    {isVi ? 'Tay phải (RH)' : 'Right Hand'}
                  </span>
                  <input
                    type="color"
                    value={rightHandColor}
                    onChange={(e) => setRightHandColor(e.target.value)}
                    className="w-6 h-5 rounded cursor-pointer border-0 bg-transparent"
                  />
                </label>
              </div>
            </div>

            {/* Hand Split Mode */}
            <div className="space-y-1.5 pt-2 border-t border-[#e7e3d9]">
              <div className="text-[11px] font-semibold text-[#4a4f5e]">
                {isVi ? 'Chế độ chia tay trái / tay phải' : 'Left / Right Hand Separation'}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['auto', isVi ? 'Tự động' : 'Auto'],
                    ['pitch', isVi ? 'Chia tại C4' : 'Split at C4'],
                    ['swap', isVi ? 'Đảo tay' : 'Swap Hands'],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setHandSplitMode(mode)}
                    className={`py-1.5 rounded-lg font-semibold border transition ${
                      handSplitMode === mode
                        ? 'bg-[#4f46e5] text-white border-[#4f46e5]'
                        : 'bg-[#f8f6f1] text-[#4a4f5e] border-[#e7e3d9]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Piano Keyboard Note Labels (C-only default!) */}
            <div className="space-y-1.5 pt-2 border-t border-[#e7e3d9]">
              <div className="text-[11px] font-semibold text-[#4a4f5e]">
                {isVi ? 'Tên nốt trên phím đàn piano' : 'Piano Keyboard Labels'}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['c-only', isVi ? 'Chỉ nốt C' : 'C Notes Only'],
                    ['all', isVi ? 'Tất cả phím' : 'All Keys'],
                    ['off', isVi ? 'Ẩn' : 'Hidden'],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setKeyboardLabelMode(mode)}
                    className={`py-1.5 rounded-lg font-semibold border transition ${
                      keyboardLabelMode === mode
                        ? 'bg-[#4f46e5] text-white border-[#4f46e5]'
                        : 'bg-[#f8f6f1] text-[#4a4f5e] border-[#e7e3d9]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Falling Note Labels Toggle */}
            <label className="flex items-center justify-between pt-2 border-t border-[#e7e3d9] cursor-pointer">
              <span className="font-semibold text-[#14151c]">
                {isVi ? 'Tên nốt trên thanh nhạc rơi xuống' : 'Labels on falling notes'}
              </span>
              <input
                type="checkbox"
                checked={showFallingNoteLabels}
                onChange={(e) => setShowFallingNoteLabels(e.target.checked)}
                className="w-4 h-4 accent-[#4f46e5]"
              />
            </label>

            {/* Visual Effects Toggle */}
            <label className="flex items-center justify-between pt-2 border-t border-[#e7e3d9] cursor-pointer">
              <span className="font-semibold text-[#14151c] inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#4f46e5]" />
                {isVi ? 'Hiệu ứng phát sáng & tia lửa khi chạm phím' : 'Glow & hit spark effects'}
              </span>
              <input
                type="checkbox"
                checked={effectsEnabled}
                onChange={(e) => setEffectsEnabled(e.target.checked)}
                className="w-4 h-4 accent-[#4f46e5]"
              />
            </label>
          </div>

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
            className="px-4 py-1.5 rounded-full bg-[#14151c] hover:bg-[#2a2d3d] text-xs font-semibold text-white"
          >
            {t(language, 'save')}
          </button>
        </div>
      </form>
    </div>
  );
};
