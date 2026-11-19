import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import { __resetStorageForTests } from '../core/storage';

describe('App integration', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetStorageForTests();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  it('loads demo song, cycles note label modes, toggles independent hand controls, and opens library', async () => {
    render(<App />);

    // Demo song loads automatically
    await waitFor(() => {
      expect(screen.getByText(/Ode to Joy/i)).toBeInTheDocument();
    });

    // Cycle Note Labels: C D E -> Đô Rê Mi -> Tắt
    const labelBtn = screen.getByRole('button', { name: /Tên nốt/i });
    expect(labelBtn).toHaveTextContent('C D E');
    fireEvent.click(labelBtn);
    expect(labelBtn).toHaveTextContent('Đô Rê');
    fireEvent.click(labelBtn);
    expect(labelBtn).toHaveTextContent('Tắt');

    // Open Hands popover and toggle Right Hand audio mute independently of visual
    const handsBtn = screen.getByRole('button', { name: /Tay trái \/ phải/i });
    fireEvent.click(handsBtn);
    const rhAudioBtn = screen.getByRole('button', { name: /Âm thanh tay phải/i });
    const rhVisualBtn = screen.getByRole('button', { name: /Hiển thị tay phải/i });
    expect(rhAudioBtn).toHaveAttribute('aria-pressed', 'true');
    expect(rhVisualBtn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(rhAudioBtn);
    expect(rhAudioBtn).toHaveAttribute('aria-pressed', 'false');
    expect(rhVisualBtn).toHaveAttribute('aria-pressed', 'true');

    // Open Library modal & check file input accepts MusicXML, MIDI, and PDF
    fireEvent.click(screen.getByRole('button', { name: /Thư viện/i }));
    await waitFor(() => {
      expect(screen.getByText(/Für Elise/i)).toBeInTheDocument();
    });
    const fileInput = screen.getByLabelText(/Tải bản nhạc lên/i) as HTMLInputElement;
    expect(fileInput.accept).toContain('.musicxml');
    expect(fileInput.accept).toContain('.pdf');
    expect(fileInput.accept).toContain('*/*');
  });
});
