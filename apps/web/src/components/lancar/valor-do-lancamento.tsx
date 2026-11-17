import { useEffect, useRef } from 'react';

import { IconMicrofone } from '../icons';

interface ValorDoLancamentoProps {
  valor: string;
  onChange: (valor: string) => void;
  /** Ausente quando o navegador não reconhece voz ou na edição: o microfone some. */
  onVoz?: () => void;
  focarAoAbrir: boolean;
}

/** Valor do lançamento: "R$" e campo de 56/800 sem borda, com o microfone circular ao lado. */
export const ValorDoLancamento = ({
  valor,
  onChange,
  onVoz,
  focarAoAbrir,
}: ValorDoLancamentoProps) => {
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focarAoAbrir) campo.current?.focus();
  }, [focarAoAbrir]);

  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="text-[22px] font-bold text-text-dim">
        R$
      </span>
      <input
        ref={campo}
        aria-label="Valor"
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0,00"
        className="h-16 min-w-0 flex-1 bg-transparent text-[56px] font-extrabold leading-none tracking-tight tabular-nums text-text placeholder:text-text-dim focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {onVoz && (
        <button
          type="button"
          aria-label="Preencher por voz"
          onClick={onVoz}
          className="inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-accent-soft text-success transition hover:bg-surface-hover"
        >
          <IconMicrofone size={24} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
