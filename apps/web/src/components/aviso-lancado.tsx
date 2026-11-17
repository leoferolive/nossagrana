import { useState } from 'react';

import { useAvisoStore, type Aviso } from '@/stores/aviso.store';

const TOM_DE_SUCESSO = 'bg-accent-soft text-success';
const TOM_DE_ERRO = 'bg-danger-soft text-danger';

const AvisoNaTela = ({ aviso }: { aviso: Aviso }) => {
  const [desfeito, setDesfeito] = useState(false);
  const { desfazer } = aviso;

  const desfazerUmaVez = () => {
    if (desfeito || !desfazer) return;
    setDesfeito(true);
    void desfazer();
  };

  return (
    <div
      role="status"
      className={`fixed inset-x-4 bottom-[calc(120px+env(safe-area-inset-bottom))] z-aviso mx-auto flex min-h-12 max-w-[420px] items-center justify-between gap-3 rounded-[14px] px-4 text-sm font-bold md:bottom-6 ${
        aviso.tom === 'erro' ? TOM_DE_ERRO : TOM_DE_SUCESSO
      }`}
    >
      <span>{aviso.mensagem}</span>
      {desfazer && (
        <button
          type="button"
          onClick={desfazerUmaVez}
          disabled={desfeito}
          className="inline-flex min-h-11 items-center rounded-full px-3 font-extrabold underline disabled:no-underline disabled:opacity-60"
        >
          Desfazer
        </button>
      )}
    </div>
  );
};

/** Aviso de baixo, acima da barra: "Despesa lançada" com "Desfazer", "Alterações salvas" e afins. */
export const AvisoLancado = () => {
  const aviso = useAvisoStore((s) => s.aviso);
  // `key` por aviso: um aviso novo começa com o "Desfazer" habilitado.
  return aviso ? <AvisoNaTela key={aviso.id} aviso={aviso} /> : null;
};
