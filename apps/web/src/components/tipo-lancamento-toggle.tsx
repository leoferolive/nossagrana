type TipoLancamento = 'receita' | 'despesa';

interface TipoLancamentoToggleProps {
  tipo: TipoLancamento;
  onChange: (tipo: TipoLancamento) => void;
}

const BOTOES: { tipo: TipoLancamento; nome: string; label: string; ativo: string }[] = [
  { tipo: 'receita', nome: 'Receita', label: '↑ Receita', ativo: 'bg-success text-white' },
  { tipo: 'despesa', nome: 'Despesa', label: '↓ Despesa', ativo: 'bg-danger text-white' },
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
        className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
          tipo === b.tipo ? b.ativo : 'border border-border text-text-muted hover:text-text'
        }`}
      >
        {b.label}
      </button>
    ))}
  </div>
);
