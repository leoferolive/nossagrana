import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VoiceRecordingSheet } from './voice-recording-sheet';

describe('VoiceRecordingSheet', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    isListening: true,
    transcript: '',
    onStop: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders when isListening is true', () => {
    render(<VoiceRecordingSheet {...defaultProps} />);
    expect(screen.getByText('Ouvindo...')).toBeInTheDocument();
  });

  it('shows transcript text when provided', () => {
    render(<VoiceRecordingSheet {...defaultProps} transcript="gastei 50 no mercado" />);
    expect(screen.getByText('gastei 50 no mercado')).toBeInTheDocument();
  });

  it('does NOT render when isListening is false', () => {
    const { container } = render(<VoiceRecordingSheet {...defaultProps} isListening={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('calls onStop when stop button is clicked', () => {
    const onStop = vi.fn();
    render(<VoiceRecordingSheet {...defaultProps} onStop={onStop} />);

    fireEvent.click(screen.getByRole('button', { name: 'Parar gravação' }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<VoiceRecordingSheet {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('voice-sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows placeholder when transcript is empty', () => {
    render(<VoiceRecordingSheet {...defaultProps} transcript="" />);
    expect(screen.getByText('Diga algo como "gastei 50 no mercado"')).toBeInTheDocument();
  });
});
