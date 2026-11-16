import { useCallback, useEffect, useState } from 'react';

import type { DadosVoz } from '@/components/transacao-modal';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { categoriaService } from '@/services/core-financeiro.service';
import { useCategoriaStore } from '@/stores/categoria.store';
import { matchCategory } from '@/utils/category-matcher';
import { parseVoiceInput } from '@/utils/voice-parser';

interface OpcoesLancarPorVoz {
  familiaId: string;
  /** Chamado quando a fala termina e o painel de lançar deve abrir com os dados reconhecidos. */
  abrirPainel: () => void;
}

/**
 * Fluxo de lançar por voz: folha de gravação, reconhecimento e interpretação da fala.
 * `ativar` é `undefined` quando o navegador não reconhece voz, e os botões usam isso para
 * esconder o microfone.
 */
export const useLancarPorVoz = ({ familiaId, abrirPainel }: OpcoesLancarPorVoz) => {
  const categorias = useCategoriaStore((s) => s.categorias);
  const setCategorias = useCategoriaStore((s) => s.setCategorias);
  const speech = useSpeechRecognition();
  const [dadosVoz, setDadosVoz] = useState<DadosVoz | null>(null);
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [gravou, setGravou] = useState(false);

  // Pre-load categories so voice matching works even before modal is opened
  useEffect(() => {
    if (familiaId && categorias.length === 0) {
      categoriaService
        .listar(familiaId)
        .then((res) => setCategorias(res.categorias))
        .catch(() => {});
    }
  }, [familiaId, categorias.length, setCategorias]);

  useEffect(() => {
    if (!folhaAberta || !gravou || speech.isListening || !speech.finalTranscript) return;
    const parsed = parseVoiceInput(speech.finalTranscript);
    const casada = parsed.descricao
      ? matchCategory(
          parsed.descricao,
          categorias.map((c) => ({ id: c.id, nome: c.nome })),
        )
      : null;
    setDadosVoz({
      tipo: parsed.tipo,
      valor: parsed.valor,
      categoriaId: casada?.categoriaId ?? null,
      descricao: parsed.descricao,
      data: parsed.data,
    });
    setFolhaAberta(false);
    abrirPainel();
  }, [folhaAberta, gravou, speech.isListening, speech.finalTranscript, categorias, abrirPainel]);

  const ativar = useCallback(() => {
    setFolhaAberta(true);
    setGravou(false);
  }, []);

  const limparDados = useCallback(() => setDadosVoz(null), []);

  const folha = {
    open: folhaAberta,
    isListening: speech.isListening,
    transcript: speech.transcript,
    error: speech.error,
    onPressStart: () => {
      speech.start();
      setGravou(true);
    },
    onPressEnd: () => speech.stop(),
    onClose: () => {
      speech.stop();
      setFolhaAberta(false);
    },
  };

  return { ativar: speech.isSupported ? ativar : undefined, dadosVoz, limparDados, folha };
};
