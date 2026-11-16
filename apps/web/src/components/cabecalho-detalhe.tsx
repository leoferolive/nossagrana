import type { ReactNode } from 'react';

import { useNavegacao } from '../routes/use-navegacao';

import { IconVoltar } from './icons';
import { ALVO_TOQUE_CLASSES } from './ui/campo-classes';

interface CabecalhoDetalheProps {
  titulo: string;
  /** Endereço da tela de origem no mapa; usado quando a tela foi aberta por link direto. */
  origem: string;
  subtitulo?: string;
  /** Ação à direita do título (ex.: "Nova categoria", pílula de mês). */
  acao?: ReactNode;
}

/**
 * Cabeçalho das telas de segundo nível: voltar de 44x44, título 20/800 e, se houver, uma ação à
 * direita. O voltar retorna à tela anterior do app, ou à origem do mapa em link direto.
 */
export const CabecalhoDetalhe = ({ titulo, origem, subtitulo, acao }: CabecalhoDetalheProps) => {
  const { voltarPara } = useNavegacao();
  return (
    <header className="flex items-center gap-1 px-2 pb-2 pt-3 md:px-4">
      <button
        type="button"
        aria-label="Voltar"
        onClick={() => voltarPara(origem)}
        className={`${ALVO_TOQUE_CLASSES} shrink-0 rounded-full text-text hover:bg-surface`}
      >
        <IconVoltar size={22} aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="break-words text-xl font-extrabold leading-tight tracking-[-0.02em] text-text">
          {titulo}
        </h1>
        {subtitulo && <p className="text-[13px] font-semibold text-text-dim">{subtitulo}</p>}
      </div>
      {acao && <div className="shrink-0 pr-3">{acao}</div>}
    </header>
  );
};
