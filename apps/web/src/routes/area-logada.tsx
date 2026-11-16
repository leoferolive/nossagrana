import { useState } from 'react';
import { Outlet, useLocation } from 'react-router';

import { AppShell } from '@/components/app-shell';
import { TransacaoModal } from '@/components/transacao-modal';
import { VoiceRecordingSheet } from '@/components/voice-recording-sheet';
import { useAuth } from '@/contexts/use-auth';
import { useLancamento } from '@/hooks/use-lancamento';
import { useLancarPorVoz } from '@/hooks/use-lancar-por-voz';
import type { FluxoSessao } from '@/hooks/use-fluxo-sessao';

import { caminhoDaFatura, caminhoDoCofrinho, telaDoCaminho } from './caminhos';
import type { ContextoLogado, SelecaoDetalhe } from './contexto-logado';
import { RotaComFamilia } from './guardas';
import { useNavegacao } from './use-navegacao';

interface AreaLogadaProps {
  fluxo: FluxoSessao;
}

const useSelecaoDetalhe = (): SelecaoDetalhe => {
  const { irParaCaminho } = useNavegacao();
  const [cofrinhoId, setCofrinhoId] = useState('');
  const [fatura, setFatura] = useState({ metodoId: null as string | null, nome: '', mes: '' });
  return {
    cofrinhoId,
    faturaMetodoId: fatura.metodoId,
    faturaMetodoNome: fatura.nome,
    faturaMes: fatura.mes,
    escolherCofrinho: (id) => {
      setCofrinhoId(id);
      irParaCaminho(caminhoDoCofrinho(id));
    },
    escolherFatura: (id, nome, mes) => {
      setFatura({ metodoId: id, nome, mes });
      irParaCaminho(caminhoDaFatura(id, mes));
    },
  };
};

const AreaLogadaConteudo = ({ fluxo, familiaId }: AreaLogadaProps & { familiaId: string }) => {
  const { pathname } = useLocation();
  const { irPara } = useNavegacao();
  const detalhe = useSelecaoDetalhe();
  const lancamento = useLancamento(familiaId);
  const voz = useLancarPorVoz({ familiaId, abrirPainel: lancamento.abrirNova });
  const familiaNome = fluxo.familiasDoUsuario.find((f) => f.id === familiaId)?.nome;

  const contexto: ContextoLogado = {
    familiaId,
    onNovaTransacao: lancamento.abrirNova,
    onEditarTransacao: lancamento.abrirEdicao,
    onLogout: fluxo.aoSair,
    detalhe,
  };

  return (
    <>
      <AppShell
        currentScreen={telaDoCaminho(pathname)}
        onNavigate={irPara}
        onNovaTransacao={lancamento.abrirNova}
        onVoiceActivate={voz.ativar}
        onLogout={fluxo.aoSair}
        familiaNome={familiaNome}
      >
        <Outlet context={contexto} />
      </AppShell>
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
