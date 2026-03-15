import { useState } from 'react';

interface TourStep {
  title: string;
  description: string;
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

  const close = () => {
    markSeen(tourKey);
    setVisible(false);
  };

  if (!visible || steps.length === 0) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {step + 1} de {steps.length}
          </span>
          <button
            type="button"
            aria-label="pular"
            onClick={close}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Pular
          </button>
        </div>

        <h2 className="mb-2 text-lg font-bold">{current.title}</h2>
        <p className="mb-6 text-sm text-muted-foreground">{current.description}</p>

        <div className="flex justify-end gap-2">
          {!isLast && (
            <button
              type="button"
              aria-label="próximo"
              onClick={() => setStep((s) => s + 1)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Próximo
            </button>
          )}
          {isLast && (
            <button
              type="button"
              aria-label="concluir"
              onClick={close}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Concluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
