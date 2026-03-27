import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VoiceRecordingSheet } from './voice-recording-sheet';

describe('VoiceRecordingSheet', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    open: true,
    isListening: false,
    transcript: '',
    error: null,
    onStart: vi.fn(),
    onStop: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders when open is true', () => {
    render(<VoiceRecordingSheet {...defaultProps} />);
    expect(screen.getByText('Toque no microfone para falar')).toBeInTheDocument();
  });

  it('does NOT render when open is false', () => {
    const { container } = render(<VoiceRecordingSheet {...defaultProps} open={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows "Ouvindo..." when isListening is true', () => {
    render(<VoiceRecordingSheet {...defaultProps} isListening={true} />);
    expect(screen.getByText('Ouvindo...')).toBeInTheDocument();
  });

  it('shows transcript text when provided', () => {
    render(
      <VoiceRecordingSheet
        {...defaultProps}
        isListening={true}
        transcript="gastei 50 no mercado"
      />,
    );
    expect(screen.getByText('gastei 50 no mercado')).toBeInTheDocument();
  });

  it('shows placeholder when listening and no transcript', () => {
    render(<VoiceRecordingSheet {...defaultProps} isListening={true} transcript="" />);
    expect(screen.getByText('Diga algo como "gastei 50 no mercado"')).toBeInTheDocument();
  });

  it('shows idle placeholder when not listening', () => {
    render(<VoiceRecordingSheet {...defaultProps} />);
    expect(screen.getByText('Toque no botão abaixo e fale sua transação')).toBeInTheDocument();
  });

  it('calls onStart when mic button clicked while not listening', () => {
    const onStart = vi.fn();
    render(<VoiceRecordingSheet {...defaultProps} onStart={onStart} />);
    fireEvent.click(screen.getByLabelText('Iniciar gravação'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('calls onStop when mic button clicked while listening', () => {
    const onStop = vi.fn();
    render(<VoiceRecordingSheet {...defaultProps} isListening={true} onStop={onStop} />);
    fireEvent.click(screen.getByLabelText('Parar gravação'));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<VoiceRecordingSheet {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('voice-sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows error message', () => {
    render(<VoiceRecordingSheet {...defaultProps} error="no-permission" />);
    expect(screen.getByText(/Erro de conexão/)).toBeInTheDocument();
  });
});
