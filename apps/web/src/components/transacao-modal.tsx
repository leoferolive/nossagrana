import type { TransacaoCreateRequest, TransacaoUpdateRequest } from '@nossagrana/types';
import { useEffect, useId, useState } from 'react';

import { useArmadilhaDeFoco } from '@/hooks/use-armadilha-de-foco';
import { useDadosDoPainel } from '@/hooks/use-dados-do-painel';
import { useGravacao } from '@/hooks/use-gravacao';
import { useViewportVisivel } from '@/hooks/use-viewport-visivel';
import { useAvisoStore } from '@/stores/aviso.store';
import { CabecalhoDoPainel } from './lancar/cabecalho-do-painel';
import { CamposDoLancamento } from './lancar/campos-do-lancamento';
import { ConfirmarExclusao } from './lancar/confirmar-exclusao';
import { RodapeSalvar } from './lancar/rodape-salvar';
import type { DadosVoz, TransacaoParaEditar } from './lancar/tipos-lancar';

export type { DadosVoz } from './lancar/tipos-lancar';

interface TransacaoModalProps {
  open: boolean;
  familiaId: string;
  onClose: () => void;
  /** Quem chama fecha o painel quando a gravação dá certo; se rejeitar, o painel segue aberto. */
  onSubmit: (payload: TransacaoCreateRequest) => void | Promise<void>;
  transacaoParaEditar?: TransacaoParaEditar | null;
  onUpdate?: (id: string, payload: TransacaoUpdateRequest) => void | Promise<void>;
  /** Como `onSubmit`: quem chama fecha o painel quando a exclusão dá certo. */
  onDelete?: (id: string) => void | Promise<void>;
  dadosVoz?: DadosVoz | null;
  onVoiceActivate?: () => void;
}

const ERRO_AO_SALVAR = 'Não foi possível salvar. Tente de novo.';
const ERRO_AO_EXCLUIR = 'Não foi possível excluir. Tente de novo.';

const useExclusao = (
  transacaoParaEditar: TransacaoParaEditar | null | undefined,
  onDelete: TransacaoModalProps['onDelete'],
) =>
  useGravacao(
    true,
    async () => {
      if (transacaoParaEditar && onDelete) await onDelete(transacaoParaEditar.id);
    },
    ERRO_AO_EXCLUIR,
  );

const PainelDeLancar = (props: TransacaoModalProps) => {
  const { onClose, transacaoParaEditar, onDelete } = props;
  const dados = useDadosDoPainel(props);
  const areaVisivel = useViewportVisivel();
  const idTitulo = useId();
  const [confirmando, setConfirmando] = useState(false);
  const [botaoExcluir, setBotaoExcluir] = useState<HTMLElement | null>(null);
  const gravacao = useGravacao(dados.motivo === null, dados.gravar, ERRO_AO_SALVAR);
  const exclusao = useExclusao(transacaoParaEditar, onDelete);
  // Fechar durante a gravação descartaria o resultado em silêncio.
  const ocupado = gravacao.gravando || exclusao.gravando;
  const painel = useArmadilhaDeFoco<HTMLDivElement>({ aoEscape: ocupado ? undefined : onClose });

  // O aviso de 6 s (z-aviso) ficaria por cima do painel e interceptaria toques nele.
  useEffect(() => useAvisoStore.getState().fechar(), []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={idTitulo}
      style={areaVisivel ? { top: areaVisivel.top, height: areaVisivel.height } : undefined}
      className="fixed inset-x-0 top-0 z-painel flex h-dvh items-end justify-center bg-black/60 md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !ocupado) onClose();
      }}
    >
      {/* Painel de baixo para cima no celular, centrado no desktop; só o miolo rola, o rodapé fica. */}
      {/* Inerte enquanto a confirmação de exclusão está aberta: `aria-modal` não tira o fundo do Tab. */}
      <div
        ref={painel}
        inert={confirmando}
        className="flex max-h-full w-full max-w-[520px] flex-col overflow-hidden rounded-t-[28px] bg-panel md:rounded-[28px] md:border md:border-border"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-2.5">
          <CabecalhoDoPainel
            idTitulo={idTitulo}
            editando={dados.editando}
            tipo={dados.campos.tipo}
            onTrocarTipo={dados.trocarTipo}
            onFechar={onClose}
            fecharBloqueado={ocupado}
          />
          <CamposDoLancamento
            dados={dados}
            onVoz={props.onVoiceActivate}
            onExcluir={
              onDelete
                ? (botao) => {
                    setBotaoExcluir(botao);
                    setConfirmando(true);
                  }
                : undefined
            }
          />
        </div>

        <footer className="shrink-0 border-t border-border bg-panel px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">
          <RodapeSalvar
            rotulo={dados.editando ? 'Salvar alterações' : `Salvar ${dados.campos.tipo}`}
            motivo={dados.motivo}
            gravando={gravacao.gravando}
            erro={gravacao.erro}
            onSalvar={() => void gravacao.salvar()}
          />
        </footer>
      </div>
      {confirmando && transacaoParaEditar && (
        <ConfirmarExclusao
          nome={transacaoParaEditar.descricao || dados.nomeDaCategoria}
          valor={transacaoParaEditar.valor}
          excluindo={exclusao.gravando}
          erro={exclusao.erro}
          onCancelar={() => setConfirmando(false)}
          onConfirmar={() => void exclusao.salvar()}
          devolverFocoPara={botaoExcluir}
        />
      )}
    </div>
  );
};

/**
 * Painel de lançar (nova transação ou edição). Só monta o painel quando aberto, então os campos
 * começam limpos a cada abertura e as buscas dele (categorias mais usadas) só rodam com ele aberto.
 */
export const TransacaoModal = (props: TransacaoModalProps) =>
  props.open ? <PainelDeLancar {...props} /> : null;
