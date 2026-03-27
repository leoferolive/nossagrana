import { Square } from 'lucide-react';

interface VoiceRecordingSheetProps {
  isListening: boolean;
  isConnected: boolean;
  transcript: string;
  onStop: () => void;
  onClose: () => void;
  onRetry?: () => void;
}

export function VoiceRecordingSheet({
  isListening,
  isConnected,
  transcript,
  onStop,
  onClose,
  onRetry,
}: VoiceRecordingSheetProps) {
  if (!isListening) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60"
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
              className="h-6 w-1 animate-pulse rounded-full bg-danger"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>

        {/* Status text */}
        <p className="mb-4 text-center text-lg font-semibold text-danger">
          {isConnected ? 'Ouvindo...' : 'Conectando...'}
        </p>

        {/* Transcript area */}
        <div
          aria-live="polite"
          className="mb-6 min-h-[3rem] rounded-lg bg-surface px-4 py-3 text-center"
          onClick={!isConnected && onRetry ? onRetry : undefined}
          role={!isConnected && onRetry ? 'button' : undefined}
        >
          {transcript ? (
            <p className="text-text">{transcript}</p>
          ) : isConnected ? (
            <p className="text-text-muted">Diga algo como &quot;gastei 50 no mercado&quot;</p>
          ) : (
            <p className="text-text-muted cursor-pointer">
              Conectando ao serviço de voz...
              <br />
              <span className="text-danger underline">Toque aqui para reconectar</span>
            </p>
          )}
        </div>

        {/* Stop button */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            aria-label="Parar gravação"
            onClick={onStop}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-danger text-white"
          >
            <Square className="h-5 w-5 fill-current" />
          </button>
          <span className="text-sm text-text-muted">Toque para parar</span>
        </div>
      </div>
    </div>
  );
}
