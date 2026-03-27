import { IconMicrofone } from './icons';

interface VoiceRecordingSheetProps {
  open: boolean;
  isRecording: boolean;
  isProcessing: boolean;
  isModelLoading: boolean;
  modelProgress: number;
  transcript: string;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
  onClose: () => void;
}

export function VoiceRecordingSheet({
  open,
  isRecording,
  isProcessing,
  isModelLoading,
  modelProgress,
  transcript,
  error,
  onStart,
  onStop,
  onClose,
}: VoiceRecordingSheetProps) {
  if (!open) {
    return null;
  }

  const isBusy = isProcessing || isModelLoading;

  const statusText = isRecording
    ? 'Gravando...'
    : isModelLoading
      ? `Baixando modelo de voz... ${modelProgress}%`
      : isProcessing
        ? 'Transcrevendo...'
        : 'Toque no microfone para falar';

  const hintText = isRecording
    ? 'Diga algo como "gastei 50 no mercado"'
    : isBusy
      ? 'Aguarde o processamento...'
      : 'Toque no botão abaixo e fale sua transação';

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60"
      data-testid="voice-sheet-backdrop"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-bg px-6 pb-8 pt-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Waveform bars */}
        <div className="mb-4 flex items-center justify-center gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-6 w-1 rounded-full ${isRecording ? 'animate-pulse bg-danger' : 'bg-border'}`}
              style={isRecording ? { animationDelay: `${i * 150}ms` } : undefined}
            />
          ))}
        </div>

        {/* Status text */}
        <p
          className={`mb-4 text-center text-lg font-semibold ${isRecording ? 'text-danger' : 'text-text-muted'}`}
        >
          {statusText}
        </p>

        {/* Progress bar for model download */}
        {isModelLoading && (
          <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{ width: `${modelProgress}%` }}
            />
          </div>
        )}

        {/* Transcript / hint area */}
        <div
          aria-live="polite"
          className="mb-6 min-h-[3rem] rounded-lg bg-surface px-4 py-3 text-center"
        >
          {transcript ? (
            <p className="text-text">{transcript}</p>
          ) : error ? (
            <p className="text-danger">
              Erro ao transcrever. Toque no microfone para tentar novamente.
            </p>
          ) : (
            <p className="text-text-muted">{hintText}</p>
          )}
        </div>

        {/* Mic button */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            aria-label={
              isBusy
                ? 'Aguarde o processamento'
                : isRecording
                  ? 'Parar gravação'
                  : 'Iniciar gravação'
            }
            disabled={isBusy}
            onClick={isRecording ? onStop : onStart}
            className={`flex h-16 w-16 items-center justify-center rounded-full transition-all select-none ${
              isBusy
                ? 'cursor-not-allowed bg-border text-text-muted'
                : isRecording
                  ? 'scale-110 bg-danger text-white shadow-lg shadow-danger/30'
                  : 'bg-surface text-text-muted hover:bg-danger hover:text-white'
            }`}
          >
            <IconMicrofone className="h-7 w-7" />
          </button>
          <span className="text-sm text-text-muted">
            {isBusy ? 'Processando...' : isRecording ? 'Toque para parar' : 'Toque para falar'}
          </span>
        </div>
      </div>
    </div>
  );
}
