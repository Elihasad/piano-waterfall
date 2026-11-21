import React from 'react';
import {
  BookOpen,
  GraduationCap,
  Home,
  Library,
  Moon,
  Piano,
  Settings,
  Sparkles,
  Sun,
  Usb,
} from 'lucide-react';
import type { Language } from '../core/types';

export type AppView = 'home' | 'player' | 'library' | 'arrange' | 'theory' | 'quiz';

interface AppShellProps {
  activeView: AppView;
  language: Language;
  darkTheme: boolean;
  midiDevices: string[];
  onNavigate: (view: AppView) => void;
  onToggleLanguage: () => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeView,
  language,
  darkTheme,
  midiDevices,
  onNavigate,
  onToggleLanguage,
  onToggleTheme,
  onOpenSettings,
  children,
}) => {
  const isVi = language === 'vi';

  const navItems: Array<{
    id: AppView;
    labelVi: string;
    labelEn: string;
    icon: React.ReactNode;
  }> = [
    { id: 'home', labelVi: 'Trang Chủ', labelEn: 'Home', icon: <Home className="w-4 h-4" /> },
    { id: 'player', labelVi: 'Phòng Tập', labelEn: 'Player', icon: <Piano className="w-4 h-4" /> },
    { id: 'library', labelVi: 'Thư Viện', labelEn: 'Library', icon: <Library className="w-4 h-4" /> },
    { id: 'arrange', labelVi: 'Đệm Hát', labelEn: 'Arrange', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'theory', labelVi: 'Lý Thuyết', labelEn: 'Theory', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'quiz', labelVi: 'Đọc Nốt', labelEn: 'Note Quiz', icon: <GraduationCap className="w-4 h-4" /> },
  ];

  // Player drops the desktop sidebar for full-bleed 88-key studio workspace (just like MuseKey!)
  const showSidebar = activeView !== 'player';

  return (
    <div className="flex w-full h-full bg-[#f8f6f1] text-[#14151c] overflow-hidden">
      {/* Desktop Left Sidebar (MuseKey Shell) */}
      {showSidebar && (
        <aside className="hidden md:flex flex-col w-60 shrink-0 bg-white border-r border-[#e7e3d9] p-4 justify-between">
          <div className="space-y-5">
            {/* Brand */}
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="w-9 h-9 rounded-xl bg-[#14151c] flex items-center justify-center shadow-sm">
                <Piano className="w-5 h-5 text-[#7a93ff]" />
              </div>
              <div>
                <div className="display-serif font-bold text-lg leading-none text-[#14151c]">
                  Piano Waterfall
                </div>
                <div className="text-[10px] text-[#888d9c] font-medium mt-0.5">
                  Studio · v1.3.24
                </div>
              </div>
            </button>

            {/* Navigation */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const active = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                      active
                        ? 'bg-[#eceefe] text-[#4f46e5]'
                        : 'text-[#4a4f5e] hover:bg-[#f8f6f1] hover:text-[#14151c]'
                    }`}
                  >
                    {item.icon}
                    <span>{isVi ? item.labelVi : item.labelEn}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer: MIDI + EN/VI + Settings */}
          <div className="space-y-2 pt-4 border-t border-[#e7e3d9]">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#f8f6f1] border border-[#e7e3d9] text-[11px]">
              <Usb
                className={`w-3.5 h-3.5 shrink-0 ${
                  midiDevices.length > 0 ? 'text-[#2f9e6c]' : 'text-[#888d9c]'
                }`}
              />
              <span className="truncate text-[#4a4f5e] font-medium">
                {midiDevices.length > 0
                  ? midiDevices[0]
                  : isVi
                    ? 'Chưa nối đàn MIDI'
                    : 'No MIDI keyboard'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center bg-[#edeae2] p-0.5 rounded-full text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => language !== 'en' && onToggleLanguage()}
                  className={`px-2.5 py-1 rounded-full transition ${
                    language === 'en' ? 'bg-white text-[#14151c] shadow-sm' : 'text-[#4a4f5e]'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => language !== 'vi' && onToggleLanguage()}
                  className={`px-2.5 py-1 rounded-full transition ${
                    language === 'vi' ? 'bg-white text-[#14151c] shadow-sm' : 'text-[#4a4f5e]'
                  }`}
                >
                  VI
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="p-2 rounded-xl bg-[#f8f6f1] hover:bg-[#edeae2] border border-[#e7e3d9] text-[#4a4f5e]"
                  aria-label={darkTheme ? 'Switch to Soft Paper theme' : 'Switch to Dark Studio theme'}
                  title={darkTheme ? (isVi ? 'Nền giấy dịu mắt' : 'Soft Paper') : (isVi ? 'Nền tối Studio' : 'Dark Studio')}
                >
                  {darkTheme ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="p-2 rounded-xl bg-[#f8f6f1] hover:bg-[#edeae2] border border-[#e7e3d9] text-[#4a4f5e]"
                  aria-label="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {children}

        {/* Mobile Bottom Sticky Dock (when not in full-bleed Player) */}
        {showSidebar && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-[#e7e3d9] px-2 py-1.5 flex items-center justify-around">
            {navItems.map((item) => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl text-[10px] font-semibold transition ${
                    active ? 'text-[#4f46e5]' : 'text-[#888d9c]'
                  }`}
                >
                  {item.icon}
                  <span>{isVi ? item.labelVi : item.labelEn}</span>
                </button>
              );
            })}
          </nav>
        )}
      </main>
    </div>
  );
};
