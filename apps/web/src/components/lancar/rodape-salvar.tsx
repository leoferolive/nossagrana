import { useId } from 'react';

interface RodapeSalvarProps {
  rotulo: string;
  /** Por que o botão está desabilitado, escrito logo acima dele; `null` com tudo preenchido. */
  motivo: string | null;
  gravando: boolean;
  erro?: string | null;
  onSalvar: () => void;
}

/** Conteúdo do rodapé fixo do painel de lançar: o motivo do bloqueio, o erro e o botão primário. */
export const RodapeSalvar = ({ rotulo, motivo, gravando, erro, onSalvar }: RodapeSalvarProps) => {
  const idMotivo = useId();
  return (
    <>
      {motivo && (
        <p id={idMotivo} className="mb-2 text-center text-xs font-semibold text-text-dim">
          {motivo}
        </p>
      )}
      {erro && (
        <p role="alert" className="mb-2 text-center text-sm font-semibold text-danger">
          {erro}
        </p>
      )}
      <button
        type="button"
        onClick={onSalvar}
        disabled={motivo !== null || gravando}
        aria-describedby={motivo ? idMotivo : undefined}
        className="h-14 w-full rounded-2xl bg-success text-base font-extrabold text-white transition hover:bg-success-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        {gravando ? 'Salvando...' : rotulo}
      </button>
    </>
  );
};
