import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';

import { AppShell } from '@/components/app-shell';
import { TransacaoModal } from '@/components/transacao-modal';
import { VoiceRecordingSheet } from '@/components/voice-recording-sheet';
import { useAuth } from '@/contexts/use-auth';
import { limparDadosDaFamilia } from '@/stores/limpar-dados-da-familia';
import { useLancamento } from '@/hooks/use-lancamento';
import { useLancarPorVoz } from '@/hooks/use-lancar-por-voz';
import type { FluxoSessao } from '@/hooks/use-fluxo-sessao';

import { CAMINHOS, ehEnderecoComId } from './caminhos';
import type { ContextoLogado } from './contexto-logado';
import { RotaComFamilia } from './guardas';
import { temEntradaAnteriorDoApp } from './historico-do-app';

interface AreaLogadaProps {
  fluxo: FluxoSessao;
}

/** Família em que a entrada de histórico com id foi aberta, carimbada pela própria área logada. */
const familiaDaEntrada = (state: unknown): string | null => {
  if (typeof state !== 'object' || state === null || !('familiaId' in state)) return null;
  return typeof state.familiaId === 'string' ? state.familiaId : null;
};

const objetoOuVazio = (state: unknown): object =>
  typeof state === 'object' && state !== null ? state : {};

/**
 * Ids de cofrinho e de método no endereço pertencem à família em que foram abertos. Se a
 * família ativa muda com a pessoa num desses endereços, ou se o voltar do navegador chega a uma
 * entrada aberta em outra família, vai ao Início (substituindo a entrada) com a família atual.
 *
 * Quem carimba a entrada é esta guarda, não quem navega: uma entrada que chega sem carimbo (por
 * qualquer link ou chamada) é substituída, no primeiro render, pelo mesmo endereço com a família
 * da sessão. Depender de cada chamador lembrar do `state` deixou um furo antes.
 */
const useVoltarAoInicioNaTrocaDeFamilia = (familiaId: string) => {
  const navigate = useNavigate();
  const { pathname, search, state, key } = useLocation();
  const familiaAnterior = useRef(familiaId);
  useEffect(() => {
    const trocou = familiaAnterior.current !== familiaId;
    familiaAnterior.current = familiaId;
    if (trocou) limparDadosDaFamilia();
    if (!ehEnderecoComId(pathname)) return;
    const carimbada = familiaDaEntrada(state);
    if (carimbada === null && !trocou) {
      void navigate(
        { pathname, search },
        {
          replace: true,
          state: {
            ...objetoOuVazio(state),
            familiaId,
            semEntradaAnterior: !temEntradaAnteriorDoApp(key, state),
          },
        },
      );
      return;
    }
    if (trocou || (carimbada ?? familiaId) !== familiaId) {
      void navigate(CAMINHOS.inicio, { replace: true });
    }
  }, [familiaId, pathname, search, state, key, navigate]);
};

const useLancar = (familiaId: string) => {
  const lancamento = useLancamento(familiaId);
  const voz = useLancarPorVoz({ familiaId, abrirPainel: lancamento.abrirNova });
  // O painel fecha por vários caminhos (botão, salvar, voltar do histórico). Só limpar nos
  // callbacks do modal deixaria o rascunho de voz vivo e ele sobrescreveria o próximo lançamento.
  const { limparDados } = voz;
  const painelAberto = lancamento.modal.open;
  useEffect(() => {
    if (!painelAberto) limparDados();
  }, [painelAberto, limparDados]);
  return { lancamento, voz };
};

type Lancar = ReturnType<typeof useLancar>;

const PaineisDeLancar = ({ lancamento, voz }: Lancar) => (
  <>
    <TransacaoModal
      {...lancamento.modal}
      onClose={() => {
        lancamento.modal.onClose();
        voz.limparDados();
      }}
      onSubmit={async (payload) => {
        await lancamento.modal.onSubmit(payload);
        voz.limparDados();
      }}
      dadosVoz={voz.dadosVoz}
      onVoiceActivate={voz.ativar}
    />
    <VoiceRecordingSheet {...voz.folha} />
  </>
);

const AreaLogadaConteudo = ({ fluxo, familiaId }: AreaLogadaProps & { familiaId: string }) => {
  useVoltarAoInicioNaTrocaDeFamilia(familiaId);
  const { lancamento, voz } = useLancar(familiaId);
  const contexto: ContextoLogado = {
    familiaId,
    onNovaTransacao: lancamento.abrirNova,
    onEditarTransacao: lancamento.abrirEdicao,
    onLogout: fluxo.aoSair,
  };
  return (
    <>
      <AppShell
        onNovaTransacao={lancamento.abrirNova}
        onVoiceActivate={voz.ativar}
        onLogout={fluxo.aoSair}
        familiaNome={fluxo.familiasDoUsuario.find((f) => f.id === familiaId)?.nome}
      >
        <Outlet context={contexto} />
      </AppShell>
      <PaineisDeLancar lancamento={lancamento} voz={voz} />
    </>
  );
};

/** Layout das telas financeiras: guarda de sessão, casca de navegação, painel de lançar e voz. */
export const AreaLogada = ({ fluxo }: AreaLogadaProps) => {
  const { familiaIdAtiva } = useAuth();
  return (
    <RotaComFamilia>
      <AreaLogadaConteudo fluxo={fluxo} familiaId={familiaIdAtiva ?? ''} />
    </RotaComFamilia>
  );
};
