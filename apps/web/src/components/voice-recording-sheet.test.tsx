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
    onPressStart: vi.fn(),
    onPressEnd: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders when open is true', () => {
    render(<VoiceRecordingSheet {...defaultProps} />);
    expect(screen.getByText('Segure o botão para falar')).toBeInTheDocument();
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
    expect(screen.getByText('Segure o botão abaixo e fale sua transação')).toBeInTheDocument();
  });

  it('calls onPressStart on pointerDown', () => {
    const onPressStart = vi.fn();
    render(<VoiceRecordingSheet {...defaultProps} onPressStart={onPressStart} />);
    fireEvent.pointerDown(screen.getByLabelText('Segure para falar'));
    expect(onPressStart).toHaveBeenCalledTimes(1);
  });

  it('calls onPressEnd on pointerUp', () => {
    const onPressEnd = vi.fn();
    render(<VoiceRecordingSheet {...defaultProps} isListening={true} onPressEnd={onPressEnd} />);
    fireEvent.pointerUp(screen.getByLabelText('Gravando — solte para parar'));
    expect(onPressEnd).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<VoiceRecordingSheet {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('voice-sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows error message', () => {
    render(<VoiceRecordingSheet {...defaultProps} error="no-permission" />);
    expect(screen.getByText(/no-permission/)).toBeInTheDocument();
  });
});
