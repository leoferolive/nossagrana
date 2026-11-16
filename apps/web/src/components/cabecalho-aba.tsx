import type { ReactNode } from 'react';

import { getCurrentMonth, shiftMonth } from '../utils/date';

import { MonthNav } from './month-nav';

interface CabecalhoAbaProps {
  titulo: string;
  /** Mês em foco (AAAA-MM). Com ele e `onMesChange`, a pílula de mês aparece à direita. */
  mes?: string;
  onMesChange?: (mes: string) => void;
  /** Botões à direita do título, antes da pílula de mês. */
  acoes?: ReactNode;
}

/**
 * Cabeçalho das quatro abas (Início, Extrato, Planejar, Mais): título 26/800 à esquerda e a
 * pílula de mês à direita nas telas que têm mês. No desktop a TopBar já mostra o título, então
 * ele some e o resto vai para a direita.
 */
export const CabecalhoAba = ({ titulo, mes, onMesChange, acoes }: CabecalhoAbaProps) => (
  <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 pb-3 pt-5 md:justify-end md:px-6">
    <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-text md:hidden">
      {titulo}
    </h1>
    <div className="flex items-center gap-2">
      {acoes}
      {mes !== undefined && onMesChange && (
        <MonthNav
          mesReferencia={mes}
          onMesAnterior={() => onMesChange(shiftMonth(mes, -1))}
          onMesProximo={() => onMesChange(shiftMonth(mes, 1))}
          isCurrentMonth={mes === getCurrentMonth()}
        />
      )}
    </div>
  </header>
);
