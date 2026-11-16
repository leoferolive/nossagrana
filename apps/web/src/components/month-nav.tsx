import { formatMesLabel } from '../utils/date';

import { ALVO_TOQUE_CLASSES } from './ui/campo-classes';

interface MonthNavProps {
  mesReferencia: string;
  onMesAnterior: () => void;
  onMesProximo: () => void;
  isCurrentMonth: boolean;
}

export const MonthNav = ({
  mesReferencia,
  onMesAnterior,
  onMesProximo,
  isCurrentMonth,
}: MonthNavProps) => (
  <div className="flex items-center gap-3">
    <button
      type="button"
      onClick={onMesAnterior}
      className={`${ALVO_TOQUE_CLASSES} rounded-lg text-text-muted hover:bg-surface hover:text-text`}
      aria-label="Mês anterior"
    >
      ◀
    </button>
    <span className="min-w-[140px] text-center text-sm capitalize text-text-muted">
      {formatMesLabel(mesReferencia)}
    </span>
    <button
      type="button"
      onClick={onMesProximo}
      disabled={isCurrentMonth}
      className={`${ALVO_TOQUE_CLASSES} rounded-lg text-text-muted hover:bg-surface hover:text-text disabled:cursor-not-allowed disabled:opacity-30`}
      aria-label="Próximo mês"
    >
      ▶
    </button>
  </div>
);
