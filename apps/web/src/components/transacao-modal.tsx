import type { TransacaoCreateRequest, TransacaoUpdateRequest } from '@nossagrana/types';
import { useEffect, useId, useRef, useState } from 'react';

import { useCategoriasMaisUsadas } from '@/hooks/use-categorias-mais-usadas';
import {
  montarCriacao,
  montarEdicao,
  useFormularioLancamento,
} from '@/hooks/use-formulario-lancamento';
import { useViewportVisivel } from '@/hooks/use-viewport-visivel';
import { categoriaService, metodoPagamentoService } from '@/services/core-financeiro.service';
import {
  categoriaIdCompativel,
  categoriasParaSelecao,
  useCategoriaStore,
} from '@/stores/categoria.store';
import { useMetodoPagamentoStore } from '@/stores/metodo-pagamento.store';
import { IconFechar } from './icons';
import { ChipsDeCategoria } from './lancar/chips-de-categoria';
import { ChipsDeData } from './lancar/chips-de-data';
import { ChipsDePagamento } from './lancar/chips-de-pagamento';
import { MaisOpcoes } from './lancar/mais-opcoes';
import { RodapeSalvar } from './lancar/rodape-salvar';
import type { DadosVoz, TransacaoParaEditar } from './lancar/tipos-lancar';
import { ValorDoLancamento } from './lancar/valor-do-lancamento';
import { TipoLancamentoToggle } from './tipo-lancamento-toggle';
import { ALVO_TOQUE_CLASSES } from './ui/campo-classes';

export type { DadosVoz } from './lancar/tipos-lancar';

interface TransacaoModalProps {
  open: boolean;
  familiaId: string;
  onClose: () => void;
  /** Quem chama fecha o painel quando a gravação dá certo; se rejeitar, o painel segue aberto. */
  onSubmit: (payload: TransacaoCreateRequest) => void | Promise<void>;
  transacaoParaEditar?: TransacaoParaEditar | null;
  onUpdate?: (id: string, payload: TransacaoUpdateRequest) => void | Promise<void>;
  onDelete?: (id: string) => void;
  dadosVoz?: DadosVoz | null;
  onVoiceActivate?: () => void;
}

const ERRO_AO_SALVAR = 'Não foi possível salvar. Tente de novo.';

/** Carrega categorias e formas de pagamento da família se as stores ainda estão vazias. */
const useReferenciasDaFamilia = (familiaId: string) => {
  const categorias = useCategoriaStore((s) => s.categorias);
  const setCategorias = useCategoriaStore((s) => s.setCategorias);
  const metodos = useMetodoPagamentoStore((s) => s.metodos);
  const setMetodos = useMetodoPagamentoStore((s) => s.setMetodos);

  useEffect(() => {
    if (!familiaId) return;
    if (categorias.length === 0) {
      categoriaService
        .listar(familiaId)
        .then((res) => setCategorias(res.categorias))
        .catch(() => {});
    }
    if (metodos.length === 0) {
      metodoPagamentoService
        .listar(familiaId)
        .then((res) => setMetodos(res.metodosPagamento))
        .catch(() => {});
    }
  }, [familiaId, categorias.length, metodos.length, setCategorias, setMetodos]);

  return { categorias, metodos };
};

const motivoDoBloqueio = (
  tipo: 'receita' | 'despesa',
  valor: string,
  categoriaId: string,
): string | null => {
  const faltas: string[] = [];
  if (!(Number(valor) > 0)) faltas.push('digite o valor');
  if (!categoriaId) faltas.push(`escolha uma categoria de ${tipo}`);
  if (faltas.length === 0) return null;
  const frase = faltas.join(' e ');
  return frase.charAt(0).toUpperCase() + frase.slice(1);
};

/**
 * Estado da gravação: `salvar` roda uma gravação por vez (o ref barra o segundo toque que chega
 * antes de o botão desabilitar na tela) e, se ela rejeitar, guarda o aviso e libera tentar de novo.
 */
const useGravacao = (podeGravar: boolean, gravar: () => void | Promise<void>) => {
  const emAndamento = useRef(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async () => {
    if (!podeGravar || emAndamento.current) return;
    emAndamento.current = true;
    setGravando(true);
    setErro(null);
    try {
      await gravar();
    } catch {
      setErro(ERRO_AO_SALVAR);
    } finally {
      emAndamento.current = false;
      setGravando(false);
    }
  };

  return { gravando, erro, salvar };
};

const PainelDeLancar = ({
  familiaId,
  onClose,
  onSubmit,
  transacaoParaEditar,
  onUpdate,
  onDelete,
  dadosVoz,
  onVoiceActivate,
}: TransacaoModalProps) => {
  const { categorias, metodos } = useReferenciasDaFamilia(familiaId);
  const { campos, mudar, maisAberto, alternarMais } = useFormularioLancamento(
    transacaoParaEditar,
    dadosVoz,
  );
  const maisUsadas = useCategoriasMaisUsadas(familiaId, campos.tipo);
  const areaVisivel = useViewportVisivel();
  const idTitulo = useId();
  const editando = !!transacaoParaEditar;
  // Derivado para cobrir voz/edição preenchidas antes das categorias carregarem.
  const categoriaIdValido = categoriaIdCompativel(categorias, campos.tipo, campos.categoriaId);
  const motivo = motivoDoBloqueio(campos.tipo, campos.valor, categoriaIdValido);
  const ehCredito = metodos.some((m) => m.id === campos.metodoPagamentoId && m.tipo === 'credito');
  const tipoOriginal = transacaoParaEditar?.tipo;

  // Troca de tipo só preserva categoria ativa do novo tipo: uma inativa (fora
  // da lista) tem tipo desconhecido e a API rejeitaria a combinação.
  const trocarTipo = (novoTipo: 'receita' | 'despesa') => {
    if (novoTipo === campos.tipo) return;
    const serve = categorias.some((c) => c.id === campos.categoriaId && c.tipo === novoTipo);
    mudar({ tipo: novoTipo, categoriaId: serve ? campos.categoriaId : '' });
  };

  const gravar = async () => {
    const entrada = { campos, categoriaId: categoriaIdValido, ehCredito };
    if (editando && onUpdate) return onUpdate(transacaoParaEditar.id, montarEdicao(entrada));
    return onSubmit(montarCriacao(entrada));
  };

  const { gravando, erro, salvar } = useGravacao(motivo === null, gravar);

  const excluir = () => {
    if (!transacaoParaEditar || !onDelete) return;
    if (!window.confirm('Tem certeza que deseja excluir esta transação?')) return;
    onDelete(transacaoParaEditar.id);
    onClose();
  };

  const opcoesDeCategoria = categoriasParaSelecao(categorias, campos.tipo, {
    id: campos.tipo === tipoOriginal ? (transacaoParaEditar?.categoriaId ?? null) : null,
  });
  const rotuloDoBotao = editando ? 'Salvar alterações' : `Salvar ${campos.tipo}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={idTitulo}
      style={areaVisivel ? { top: areaVisivel.top, height: areaVisivel.height } : undefined}
      className="fixed inset-x-0 top-0 z-painel flex h-dvh items-end justify-center bg-black/60 md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Painel de baixo para cima no celular, centrado no desktop; só o miolo rola, o rodapé fica. */}
      <div className="flex max-h-full w-full max-w-[520px] flex-col overflow-hidden rounded-t-[28px] bg-panel md:rounded-[28px] md:border md:border-border">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-2.5">
          <div className="mb-3 flex justify-center md:hidden">
            <div className="h-1 w-10 rounded-full bg-border-strong" />
          </div>
          <h2 id={idTitulo} className="sr-only">
            {editando ? 'Editar Transação' : 'Nova Transação'}
          </h2>

          <div className="mb-3 flex items-center justify-between">
            <TipoLancamentoToggle tipo={campos.tipo} onChange={trocarTipo} />
            <button
              type="button"
              aria-label="Fechar modal"
              onClick={onClose}
              className={`${ALVO_TOQUE_CLASSES} text-text-muted hover:text-text`}
            >
              <IconFechar size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <ValorDoLancamento
              valor={campos.valor}
              onChange={(valor) => mudar({ valor })}
              onVoz={editando ? undefined : onVoiceActivate}
              focarAoAbrir={!editando}
            />
            <ChipsDeCategoria
              tipo={campos.tipo}
              maisUsadas={maisUsadas}
              todas={opcoesDeCategoria}
              selecionadaId={categoriaIdValido}
              onEscolher={(categoriaId) => mudar({ categoriaId })}
            />
            <ChipsDeData data={campos.data} onChange={(data) => mudar({ data })} />
            <ChipsDePagamento
              metodos={metodos.filter((m) => m.ativo)}
              selecionadoId={campos.metodoPagamentoId}
              onEscolher={(metodoPagamentoId) => mudar({ metodoPagamentoId })}
            />
            <MaisOpcoes
              aberto={maisAberto}
              onAlternar={alternarMais}
              campos={campos}
              mudar={mudar}
              editando={editando}
              ehCredito={ehCredito}
              onExcluir={onDelete ? excluir : undefined}
            />
          </div>
        </div>

        <footer className="shrink-0 border-t border-border bg-panel px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">
          <RodapeSalvar
            rotulo={rotuloDoBotao}
            motivo={motivo}
            gravando={gravando}
            erro={erro}
            onSalvar={() => void salvar()}
          />
        </footer>
      </div>
    </div>
  );
};

/**
 * Painel de lançar (nova transação ou edição). Só monta o painel quando aberto, então os campos
 * começam limpos a cada abertura e as buscas dele (categorias mais usadas) só rodam com ele aberto.
 */
export const TransacaoModal = (props: TransacaoModalProps) =>
  props.open ? <PainelDeLancar {...props} /> : null;
