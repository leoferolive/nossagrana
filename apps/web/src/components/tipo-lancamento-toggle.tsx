import type { LucideIcon } from 'lucide-react';

import { IconEntrada, IconSaida } from './icons';

type TipoLancamento = 'receita' | 'despesa';

interface TipoLancamentoToggleProps {
  tipo: TipoLancamento;
  onChange: (tipo: TipoLancamento) => void;
}

const BOTOES: { tipo: TipoLancamento; nome: string; icone: LucideIcon }[] = [
  { tipo: 'despesa', nome: 'Despesa', icone: IconSaida },
  { tipo: 'receita', nome: 'Receita', icone: IconEntrada },
];

/** Alternador Despesa/Receita do painel de lançar: pílula com a opção ativa em verde. */
export const TipoLancamentoToggle = ({ tipo, onChange }: TipoLancamentoToggleProps) => (
  <div className="inline-flex gap-1 rounded-full bg-surface p-1">
    {BOTOES.map((b) => (
      <button
        key={b.tipo}
        type="button"
        aria-label={b.nome}
        aria-pressed={tipo === b.tipo}
        onClick={() => onChange(b.tipo)}
        className={`inline-flex min-h-11 items-center justify-center gap-1 rounded-full px-4 text-sm font-semibold transition ${
          tipo === b.tipo ? 'bg-success text-white' : 'text-text-muted hover:text-text'
        }`}
      >
        <b.icone size={16} aria-hidden="true" />
        {b.nome}
      </button>
    ))}
  </div>
);
