import { useEffect, useRef, useState } from 'react';

import { useAvisoStore } from '@/stores/aviso.store';

/**
 * Estado da gravação: `salvar` roda uma gravação por vez. No sucesso o botão segue travado até o
 * painel fechar (o voltar do histórico é assíncrono, e um toque nessa janela gravaria de novo);
 * só a falha libera de novo. Falha com o painel já fechado (voltar durante a gravação) vira aviso,
 * porque o erro no painel ninguém mais veria.
 */
export const useGravacao = (
  podeGravar: boolean,
  gravar: () => void | Promise<void>,
  mensagemDeErro: string,
) => {
  const emAndamento = useRef(false);
  const montado = useRef(true);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const salvar = async () => {
    if (!podeGravar || emAndamento.current) return;
    emAndamento.current = true;
    setGravando(true);
    setErro(null);
    try {
      await gravar();
    } catch {
      emAndamento.current = false;
      setGravando(false);
      if (montado.current) setErro(mensagemDeErro);
      else useAvisoStore.getState().mostrar({ mensagem: mensagemDeErro, tom: 'erro' });
    }
  };

  return { gravando, erro, salvar };
};
