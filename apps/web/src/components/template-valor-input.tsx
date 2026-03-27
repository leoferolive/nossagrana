interface TemplateValorInputProps {
  nome: string;
  valor: string;
  onChange: (valor: string) => void;
  cofrinhoEmoji?: string | null;
}

export function TemplateValorInput({ nome, valor, onChange, cofrinhoEmoji }: TemplateValorInputProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-sm text-text">
        {cofrinhoEmoji && <span>{cofrinhoEmoji}</span>}
        {nome}
      </span>
      <div className="flex items-center gap-1 rounded-md border border-border bg-bg px-2 py-1">
        <span className="text-xs text-text-muted">R$</span>
        <input
          type="text"
          inputMode="decimal"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0,00"
          className="w-24 bg-transparent text-right text-sm text-text outline-none placeholder:text-text-muted"
          aria-label={`Valor para ${nome}`}
        />
      </div>
    </div>
  );
}
