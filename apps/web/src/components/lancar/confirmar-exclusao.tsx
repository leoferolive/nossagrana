import { useId } from 'react';

import { useArmadilhaDeFoco } from '@/hooks/use-armadilha-de-foco';
import { formatBRL } from '@/utils/formatting';

interface ConfirmarExclusaoProps {
  /** Descrição do lançamento, ou o nome da categoria quando não há descrição. */
  nome: string;
  /** Valor como a API devolve (`'129.90'`). */
  valor: string;
  excluindo: boolean;
  erro?: string | null;
  onCancelar: () => void;
  onConfirmar: () => void;
  /** O botão que abriu a confirmação: o foco volta a ele ao fechar. */
  devolverFocoPara?: HTMLElement | null;
}

/** Painel de confirmação de exclusão, no lugar do `window.confirm`; aparece acima do painel de lançar. */
export const ConfirmarExclusao = ({
  nome,
  valor,
  excluindo,
  erro,
  onCancelar,
  onConfirmar,
  devolverFocoPara,
}: ConfirmarExclusaoProps) => {
  const idTitulo = useId();
  const raiz = useArmadilhaDeFoco<HTMLDivElement>({
    aoEscape: excluindo ? undefined : onCancelar,
    devolverPara: devolverFocoPara,
  });
  return (
    <div
      ref={raiz}
      role="dialog"
      aria-modal="true"
      aria-labelledby={idTitulo}
      className="fixed inset-0 z-painel flex items-end justify-center bg-black/60 md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !excluindo) onCancelar();
      }}
    >
      <div className="w-full max-w-[520px] rounded-t-[28px] bg-panel px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2.5 md:rounded-[28px] md:pb-5">
        <div className="mb-3 flex justify-center md:hidden">
          <div className="h-1 w-10 rounded-full bg-border-strong" />
        </div>
        <h2 id={idTitulo} className="text-xl font-extrabold tracking-tight text-text">
          Excluir lançamento?
        </h2>
        <p className="mt-2 text-[15px] text-text-muted">
          <span className="font-semibold text-text">{nome}</span>
          {' · '}
          <span className="tabular-nums">{formatBRL(valor)}</span>
        </p>
        {erro && (
          <p role="alert" className="mt-3 text-sm font-semibold text-danger">
            {erro}
          </p>
        )}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancelar}
            disabled={excluindo}
            className="h-14 flex-1 rounded-2xl border border-border-strong text-base font-bold text-text transition hover:bg-surface disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={excluindo}
            className="h-14 flex-1 rounded-2xl bg-danger text-base font-extrabold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {excluindo ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
};
