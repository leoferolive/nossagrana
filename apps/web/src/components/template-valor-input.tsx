import { CAMPO_CLASSES } from './ui/campo-classes';

interface TemplateValorInputProps {
  nome: string;
  valor: string;
  onChange: (valor: string) => void;
  cofrinhoEmoji?: string | null;
}

export function TemplateValorInput({
  nome,
  valor,
  onChange,
  cofrinhoEmoji,
}: TemplateValorInputProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-sm text-text">
        {cofrinhoEmoji && <span>{cofrinhoEmoji}</span>}
        {nome}
      </span>
      <div className="flex items-center gap-1">
        <span className="text-xs text-text-muted">R$</span>
        <input
          type="text"
          inputMode="decimal"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0,00"
          className={`${CAMPO_CLASSES} !w-[124px] text-right font-bold`}
          aria-label={`Valor para ${nome}`}
        />
      </div>
    </div>
  );
}
