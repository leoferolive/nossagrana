export { getCurrentMonth, shiftMonth } from '../utils/date';

function formatMesLabel(mesReferencia: string): string {
  return new Date(`${mesReferencia}-01`).toLocaleString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
}

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
      className="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text"
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
      className="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
      aria-label="Próximo mês"
    >
      ▶
    </button>
  </div>
);
