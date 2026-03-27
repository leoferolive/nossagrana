import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VoiceRecordingSheet } from './voice-recording-sheet';

describe('VoiceRecordingSheet', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    open: true,
    isRecording: false,
    isProcessing: false,
    isModelLoading: false,
    modelProgress: 0,
    transcript: '',
    error: null,
    onStart: vi.fn(),
    onStop: vi.fn(),
    onClose: vi.fn(),
  };

  it('shows idle text when not recording or processing', () => {
    render(<VoiceRecordingSheet {...defaultProps} />);
    expect(screen.getByText('Toque no microfone para falar')).toBeInTheDocument();
  });

  it('does NOT render when open is false', () => {
    const { container } = render(<VoiceRecordingSheet {...defaultProps} open={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows "Gravando..." when isRecording is true', () => {
    render(<VoiceRecordingSheet {...defaultProps} isRecording={true} />);
    expect(screen.getByText('Gravando...')).toBeInTheDocument();
  });

  it('shows model loading progress', () => {
    render(<VoiceRecordingSheet {...defaultProps} isModelLoading={true} modelProgress={45} />);
    expect(screen.getByText('Baixando modelo de voz... 45%')).toBeInTheDocument();
  });

  it('shows "Transcrevendo..." when processing', () => {
    render(<VoiceRecordingSheet {...defaultProps} isProcessing={true} />);
    expect(screen.getByText('Transcrevendo...')).toBeInTheDocument();
  });

  it('shows transcript text when provided', () => {
    render(<VoiceRecordingSheet {...defaultProps} transcript="gastei 50 no mercado" />);
    expect(screen.getByText('gastei 50 no mercado')).toBeInTheDocument();
  });

  it('shows error message', () => {
    render(<VoiceRecordingSheet {...defaultProps} error="transcription-failed" />);
    expect(screen.getByText(/Erro ao transcrever/)).toBeInTheDocument();
  });

  it('calls onStart when mic button clicked in idle state', () => {
    const onStart = vi.fn();
    render(<VoiceRecordingSheet {...defaultProps} onStart={onStart} />);
    fireEvent.click(screen.getByLabelText('Iniciar gravação'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('calls onStop when mic button clicked while recording', () => {
    const onStop = vi.fn();
    render(<VoiceRecordingSheet {...defaultProps} isRecording={true} onStop={onStop} />);
    fireEvent.click(screen.getByLabelText('Parar gravação'));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('disables button during processing', () => {
    render(<VoiceRecordingSheet {...defaultProps} isProcessing={true} />);
    const button = screen.getByLabelText('Aguarde o processamento');
    expect(button).toBeDisabled();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<VoiceRecordingSheet {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('voice-sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
