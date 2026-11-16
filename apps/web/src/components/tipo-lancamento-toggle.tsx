import type { LucideIcon } from 'lucide-react';

import { IconEntrada, IconSaida } from './icons';

type TipoLancamento = 'receita' | 'despesa';

interface TipoLancamentoToggleProps {
  tipo: TipoLancamento;
  onChange: (tipo: TipoLancamento) => void;
}

const BOTOES: { tipo: TipoLancamento; nome: string; icone: LucideIcon; ativo: string }[] = [
  { tipo: 'receita', nome: 'Receita', icone: IconEntrada, ativo: 'bg-success text-white' },
  { tipo: 'despesa', nome: 'Despesa', icone: IconSaida, ativo: 'bg-success text-white' },
];

/** Toggle Receita/Despesa do formulário de lançamento. */
export const TipoLancamentoToggle = ({ tipo, onChange }: TipoLancamentoToggleProps) => (
  <div className="mb-5 flex gap-2">
    {BOTOES.map((b) => (
      <button
        key={b.tipo}
        type="button"
        aria-label={b.nome}
        onClick={() => onChange(b.tipo)}
        className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg text-sm font-semibold transition ${
          tipo === b.tipo ? b.ativo : 'border border-border text-text-muted hover:text-text'
        }`}
      >
        <b.icone size={16} aria-hidden="true" />
        {b.nome}
      </button>
    ))}
  </div>
);
