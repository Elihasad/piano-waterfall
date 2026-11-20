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

  it('defaults to English, cycles note labels, toggles MIDI wait mode, sound preset, hands, and library', async () => {
    render(<App />);

    // Demo song loads automatically
    await waitFor(() => {
      expect(screen.getByText(/Ode to Joy/i)).toBeInTheDocument();
    });

    // Cycle Note Labels: C D E -> Do Re -> Off
    const labelBtn = screen.getByRole('button', { name: /Note Labels/i });
    expect(labelBtn).toHaveTextContent('C D E');
    fireEvent.click(labelBtn);
    expect(labelBtn).toHaveTextContent('Do Re');
    fireEvent.click(labelBtn);
    expect(labelBtn).toHaveTextContent('Off');

    // Toggle Practice Mode: Listen -> Wait (MIDI)
    const practiceBtn = screen.getByRole('button', { name: /Practice Mode/i });
    expect(practiceBtn).toHaveTextContent('Listen');
    fireEvent.click(practiceBtn);
    expect(practiceBtn).toHaveTextContent('Wait (MIDI)');

    // Open Sound Preset popover and switch to Studio Piano
    fireEvent.click(screen.getByRole('button', { name: /Piano Sound/i }));
    fireEvent.click(screen.getByRole('button', { name: /Studio Piano/i }));
    expect(screen.getByRole('button', { name: /Piano Sound/i })).toHaveTextContent('Studio');

    // Open Hands popover and toggle Right Hand audio mute independently of visual
    fireEvent.click(screen.getByRole('button', { name: /Left \/ Right Hand/i }));
    const rhAudioBtn = screen.getByRole('button', { name: /Right hand audio/i });
    const rhVisualBtn = screen.getByRole('button', { name: /Right hand visual/i });
    expect(rhAudioBtn).toHaveAttribute('aria-pressed', 'true');
    expect(rhVisualBtn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(rhAudioBtn);
    expect(rhAudioBtn).toHaveAttribute('aria-pressed', 'false');
    expect(rhVisualBtn).toHaveAttribute('aria-pressed', 'true');

    // Open Library modal & verify file input accepts MusicXML, PDF, and */* for Android
    fireEvent.click(screen.getByRole('button', { name: /Library/i }));
    await waitFor(() => {
      expect(screen.getByText(/Für Elise/i)).toBeInTheDocument();
    });
    const fileInput = screen.getByLabelText(/Import Sheet Music/i) as HTMLInputElement;
    expect(fileInput.accept).toContain('.musicxml');
    expect(fileInput.accept).toContain('.pdf');
    expect(fileInput.accept).toContain('*/*');
  });
});
