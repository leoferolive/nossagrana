import { IconMicrofone } from './icons';

interface VoiceRecordingSheetProps {
  open: boolean;
  isListening: boolean;
  transcript: string;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
  onClose: () => void;
}

export function VoiceRecordingSheet({
  open,
  isListening,
  transcript,
  error,
  onStart,
  onStop,
  onClose,
}: VoiceRecordingSheetProps) {
  if (!open) {
    return null;
  }

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
        {/* Waveform bars — only animate when listening */}
        <div className="mb-4 flex items-center justify-center gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-6 w-1 rounded-full ${isListening ? 'animate-pulse bg-danger' : 'bg-border'}`}
              style={isListening ? { animationDelay: `${i * 150}ms` } : undefined}
            />
          ))}
        </div>

        {/* Status text */}
        <p
          className={`mb-4 text-center text-lg font-semibold ${isListening ? 'text-danger' : 'text-text-muted'}`}
        >
          {isListening ? 'Ouvindo...' : 'Toque no microfone para falar'}
        </p>

        {/* Transcript area */}
        <div
          aria-live="polite"
          className="mb-6 min-h-[3rem] rounded-lg bg-surface px-4 py-3 text-center"
        >
          {transcript ? (
            <p className="text-text">{transcript}</p>
          ) : error ? (
            <p className="text-danger">
              Erro de conexão. Toque no microfone para tentar novamente.
            </p>
          ) : (
            <p className="text-text-muted">
              {isListening
                ? 'Diga algo como "gastei 50 no mercado"'
                : 'Toque no botão abaixo e fale sua transação'}
            </p>
          )}
        </div>

        {/* Toggle mic button */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            aria-label={isListening ? 'Parar gravação' : 'Iniciar gravação'}
            onClick={isListening ? onStop : onStart}
            className={`flex h-16 w-16 items-center justify-center rounded-full transition-all select-none ${
              isListening
                ? 'scale-110 bg-danger text-white shadow-lg shadow-danger/30'
                : 'bg-surface text-text-muted hover:bg-danger hover:text-white'
            }`}
          >
            <IconMicrofone className="h-7 w-7" />
          </button>
          <span className="text-sm text-text-muted">
            {isListening ? 'Toque para parar' : 'Toque para falar'}
          </span>
        </div>
      </div>
    </div>
  );
}
