import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** `undefined` para chip que abre algo em vez de marcar uma escolha (sem `aria-pressed`). */
  selecionado?: boolean;
}

/** Chip de escolha: 44px, anel `border-strong`; selecionado vira verde com texto branco. */
export const Chip = ({ selecionado, className = '', ...resto }: ChipProps) => (
  <button
    type="button"
    aria-pressed={selecionado}
    className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm transition ${
      selecionado
        ? 'border-success bg-success font-bold text-white'
        : 'border-border-strong font-semibold text-text hover:bg-surface'
    } ${className}`}
    {...resto}
  />
);

interface GrupoDeChipsProps {
  titulo: string;
  children: ReactNode;
}

/** Bloco do painel de lançar: rótulo de 12px e a fila de chips, ligados por `aria-labelledby`. */
export const GrupoDeChips = ({ titulo, children }: GrupoDeChipsProps) => {
  const idTitulo = useId();
  return (
    <section className="flex flex-col gap-2">
      <h3 id={idTitulo} className="text-xs font-bold text-text-dim">
        {titulo}
      </h3>
      <div role="group" aria-labelledby={idTitulo} className="flex flex-wrap gap-2">
        {children}
      </div>
    </section>
  );
};
