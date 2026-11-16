import { formatMesTitulo } from '../utils/date';

import { ALVO_TOQUE_CLASSES } from './ui/campo-classes';
import { IconMesAnterior, IconProximoMes } from './icons';

interface MonthNavProps {
  mesReferencia: string;
  onMesAnterior: () => void;
  onMesProximo: () => void;
  isCurrentMonth: boolean;
}

/** Pílula de mês: dois botões de 44x44 com seta e o mês em 14/700, anel de 1px na cor da borda. */
export const MonthNav = ({
  mesReferencia,
  onMesAnterior,
  onMesProximo,
  isCurrentMonth,
}: MonthNavProps) => (
  <div className="inline-flex items-center rounded-full bg-panel shadow-soft">
    <button
      type="button"
      onClick={onMesAnterior}
      className={`${ALVO_TOQUE_CLASSES} rounded-full text-text-muted hover:bg-surface hover:text-text`}
      aria-label="Mês anterior"
    >
      <IconMesAnterior size={18} aria-hidden="true" />
    </button>
    <span className="text-center text-sm font-bold tabular-nums text-text">
      {formatMesTitulo(mesReferencia)}
    </span>
    <button
      type="button"
      onClick={onMesProximo}
      disabled={isCurrentMonth}
      className={`${ALVO_TOQUE_CLASSES} rounded-full text-text-muted hover:bg-surface hover:text-text disabled:cursor-not-allowed disabled:opacity-30`}
      aria-label="Próximo mês"
    >
      <IconProximoMes size={18} aria-hidden="true" />
    </button>
  </div>
);
