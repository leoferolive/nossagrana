import type { ReactNode } from 'react';

import { IconFechar } from '../icons';
import { TipoLancamentoToggle } from '../tipo-lancamento-toggle';
import { ALVO_TOQUE_CLASSES } from '../ui/campo-classes';

interface CabecalhoDoPainelProps {
  idTitulo: string;
  editando: boolean;
  tipo: 'receita' | 'despesa';
  onTrocarTipo: (tipo: 'receita' | 'despesa') => void;
  onFechar: () => void;
  /** Durante a gravação o X fica desabilitado, para não descartar o resultado em silêncio. */
  fecharBloqueado: boolean;
}

/** Topo do painel: alça, título só para leitor de tela, alternador Despesa/Receita e fechar. */
export const CabecalhoDoPainel = ({
  idTitulo,
  editando,
  tipo,
  onTrocarTipo,
  onFechar,
  fecharBloqueado,
}: CabecalhoDoPainelProps): ReactNode => (
  <>
    <div className="mb-3 flex justify-center md:hidden">
      <div className="h-1 w-10 rounded-full bg-border-strong" />
    </div>
    <h2 id={idTitulo} className="sr-only">
      {editando ? 'Editar Transação' : 'Nova Transação'}
    </h2>
    <div className="mb-3 flex items-center justify-between">
      <TipoLancamentoToggle tipo={tipo} onChange={onTrocarTipo} />
      <button
        type="button"
        aria-label="Fechar modal"
        onClick={onFechar}
        disabled={fecharBloqueado}
        className={`${ALVO_TOQUE_CLASSES} text-text-muted hover:text-text disabled:opacity-50`}
      >
        <IconFechar size={20} aria-hidden="true" />
      </button>
    </div>
  </>
);
