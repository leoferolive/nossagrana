import type { TemplateTransacaoListItem } from '@nossagrana/types';

interface LancamentosResumoProps {
  templates: TemplateTransacaoListItem[];
  valores: Record<string, string>;
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function LancamentosResumo({ templates, valores }: LancamentosResumoProps) {
  let receitas = 0;
  let despesas = 0;

  for (const template of templates) {
    const rawValor = valores[template.id];
    const valor = rawValor ? parseFloat(rawValor.replace(',', '.')) : 0;
    if (isNaN(valor) || valor <= 0) continue;

    if (template.tipo === 'receita') {
      receitas += valor;
    } else {
      despesas += valor;
    }
  }

  const saldo = receitas - despesas;

  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <h2 className="mb-3 text-sm font-semibold text-text">Resumo</h2>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-muted">Total Receitas</span>
          <span className="text-sm font-semibold text-success">{formatBRL(receitas)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-muted">Total Despesas</span>
          <span className="text-sm font-semibold text-danger">{formatBRL(despesas)}</span>
        </div>
        <div className="mt-1 border-t border-border pt-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-text">Saldo</span>
          <span
            className={`text-sm font-bold ${saldo >= 0 ? 'text-success' : 'text-danger'}`}
          >
            {formatBRL(saldo)}
          </span>
        </div>
      </div>
    </div>
  );
}
