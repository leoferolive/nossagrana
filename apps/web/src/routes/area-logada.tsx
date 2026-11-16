import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';

import { AppShell } from '@/components/app-shell';
import { TransacaoModal } from '@/components/transacao-modal';
import { VoiceRecordingSheet } from '@/components/voice-recording-sheet';
import { useAuth } from '@/contexts/use-auth';
import { useLancamento } from '@/hooks/use-lancamento';
import { useLancarPorVoz } from '@/hooks/use-lancar-por-voz';
import type { FluxoSessao } from '@/hooks/use-fluxo-sessao';

import { CAMINHOS, ehEnderecoComId, telaDoCaminho } from './caminhos';
import type { ContextoLogado } from './contexto-logado';
import { RotaComFamilia } from './guardas';
import { useNavegacao } from './use-navegacao';

interface AreaLogadaProps {
  fluxo: FluxoSessao;
}

/**
 * Ids de cofrinho e de método no endereço pertencem à família em que foram abertos. Se a
 * família ativa muda com a pessoa num desses endereços, volta ao Início com a família nova.
 */
const useVoltarAoInicioNaTrocaDeFamilia = (familiaId: string) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const familiaAnterior = useRef(familiaId);
  useEffect(() => {
    const trocou = familiaAnterior.current !== familiaId;
    familiaAnterior.current = familiaId;
    if (trocou && ehEnderecoComId(pathname)) void navigate(CAMINHOS.inicio, { replace: true });
  }, [familiaId, pathname, navigate]);
};

const useLancar = (familiaId: string) => {
  const lancamento = useLancamento(familiaId);
  const voz = useLancarPorVoz({ familiaId, abrirPainel: lancamento.abrirNova });
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
  const { pathname } = useLocation();
  const { irPara } = useNavegacao();
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
        currentScreen={telaDoCaminho(pathname)}
        onNavigate={irPara}
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
