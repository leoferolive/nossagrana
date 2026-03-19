export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(mesReferencia: string, delta: number): string {
  const [year, month] = mesReferencia.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

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
