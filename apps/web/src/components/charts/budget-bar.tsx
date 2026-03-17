interface BudgetBarProps {
  category: string;
  spent: number;
  limit: number;
  compact?: boolean;
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const BudgetBar = ({ category, spent, limit, compact = false }: BudgetBarProps) => {
  const pct = limit > 0 ? (spent / limit) * 100 : 0;
  const barColor = pct >= 100 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-success';

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
        <span>{category}</span>
        {!compact && (
          <span className="tabular-nums">
            <span>{pct.toFixed(0)}%</span>
            {' — '}
            <span>{formatBRL(spent)}</span>
            {'/'}
            <span>{formatBRL(limit)}</span>
          </span>
        )}
        {compact && <span className="tabular-nums font-semibold">{pct.toFixed(0)}%</span>}
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface">
        <div
          className={`h-1.5 rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
};
