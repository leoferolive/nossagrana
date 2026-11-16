import { useCallback, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

import { IconAvancar, IconVoltar } from './icons';

interface TourStep {
  title: string;
  description: string;
  icon?: LucideIcon;
}

interface FirstTimeTourProps {
  tourKey: string;
  steps: TourStep[];
}

const STORAGE_PREFIX = 'tour-';

function hasSeen(tourKey: string): boolean {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${tourKey}`) === 'true';
  } catch {
    return false;
  }
}

function markSeen(tourKey: string): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${tourKey}`, 'true');
  } catch {
    // ignore
  }
}

export const FirstTimeTour = ({ tourKey, steps }: FirstTimeTourProps) => {
  const [visible, setVisible] = useState(() => !hasSeen(tourKey));
  const [step, setStep] = useState(0);

  const close = useCallback(() => {
    markSeen(tourKey);
    setVisible(false);
  }, [tourKey]);

  if (!visible || steps.length === 0) return null;

  const current = steps[step];
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;
  const total = steps.length;
  const Icone = current.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-painel flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-panel p-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: progress dots + pular */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: total }, (_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step
                    ? 'w-5 bg-success'
                    : i < step
                      ? 'w-1.5 bg-success/40'
                      : 'w-1.5 bg-border'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="pular"
            onClick={close}
            className="text-xs text-text-muted transition hover:text-text"
          >
            Pular
          </button>
        </div>

        {/* Icon */}
        {Icone && <Icone size={32} aria-hidden="true" className="mb-3 text-success" />}

        {/* Content */}
        <h2 className="mb-2 text-lg font-bold text-text">{current.title}</h2>
        <p className="mb-6 text-sm leading-relaxed text-text-muted">{current.description}</p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          {!isFirst ? (
            <button
              type="button"
              aria-label="voltar"
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex items-center gap-1 text-sm text-text-muted transition hover:text-text"
            >
              <IconVoltar size={16} aria-hidden="true" />
              Voltar
            </button>
          ) : (
            <span />
          )}
          {!isLast ? (
            <button
              type="button"
              aria-label="próximo"
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex items-center gap-1 rounded-lg bg-success px-5 py-2 text-sm font-semibold text-white transition hover:bg-success-strong"
            >
              Próximo
              <IconAvancar size={16} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="concluir"
              onClick={close}
              className="rounded-lg bg-success px-5 py-2 text-sm font-semibold text-white transition hover:bg-success-strong"
            >
              Entendi!
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
