import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VoiceRecordingSheet } from './voice-recording-sheet';

describe('VoiceRecordingSheet', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    isListening: true,
    isConnected: true,
    transcript: '',
    onStop: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders "Ouvindo..." when connected', () => {
    render(<VoiceRecordingSheet {...defaultProps} />);
    expect(screen.getByText('Ouvindo...')).toBeInTheDocument();
  });

  it('renders "Conectando..." when not yet connected', () => {
    render(<VoiceRecordingSheet {...defaultProps} isConnected={false} />);
    expect(screen.getByText('Conectando...')).toBeInTheDocument();
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

  it('shows voice placeholder when connected and transcript is empty', () => {
    render(<VoiceRecordingSheet {...defaultProps} isConnected={true} transcript="" />);
    expect(screen.getByText('Diga algo como "gastei 50 no mercado"')).toBeInTheDocument();
  });

  it('shows connecting message with retry link when not connected', () => {
    render(
      <VoiceRecordingSheet {...defaultProps} isConnected={false} transcript="" onRetry={vi.fn()} />,
    );
    expect(screen.getByText('Toque aqui para reconectar')).toBeInTheDocument();
  });

  it('calls onRetry when retry link is clicked', () => {
    const onRetry = vi.fn();
    render(
      <VoiceRecordingSheet {...defaultProps} isConnected={false} transcript="" onRetry={onRetry} />,
    );
    fireEvent.click(screen.getByText('Toque aqui para reconectar'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
