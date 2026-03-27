import type {
  FamiliaMinhasItem,
  TransacaoListResponse,
  TransacaoUpdateRequest,
} from '@nossagrana/types';
import { useCallback, useEffect, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import type { DadosVoz } from '@/components/transacao-modal';
import { TransacaoModal } from '@/components/transacao-modal';
import { VoiceRecordingSheet } from '@/components/voice-recording-sheet';
import { useAuth } from '@/contexts/use-auth';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { categoriaService } from '@/services/core-financeiro.service';
import { useCategoriaStore } from '@/stores/categoria.store';
import { matchCategory } from '@/utils/category-matcher';
import { parseVoiceInput } from '@/utils/voice-parser';
import { AjudaPage } from '@/pages/ajuda-page';
import { CategoriasPage } from '@/pages/categorias-page';
import { CofrinhoDetalhePage } from '@/pages/cofrinho-detalhe-page';
import { CofrinhosPage } from '@/pages/cofrinhos-page';
import { ConfiguracoesPage } from '@/pages/configuracoes-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { ExtratoPage } from '@/pages/extrato-page';
import { FamiliaSelectorPage } from '@/pages/familia-selector-page';
import { FamilySettingsPage } from '@/pages/family-settings-page';
import { FaturaPage } from '@/pages/fatura-page';
import { HistoricoPage } from '@/pages/historico-page';
import { LoginPage } from '@/pages/login-page';
import { MetodosPagamentoPage } from '@/pages/metodos-pagamento-page';
import { OnboardingPage } from '@/pages/onboarding-page';
import { OrcamentoPage } from '@/pages/orcamento-page';
import { PerfilPage } from '@/pages/perfil-page';
import { RelatoriosPage } from '@/pages/relatorios-page';
import { SignUpPage } from '@/pages/sign-up-page';
import { authService, familiaService } from '@/services/auth.service';
import { transacaoService } from '@/services/core-financeiro.service';

type Screen =
  | 'login'
  | 'sign-up'
  | 'onboarding'
  | 'familia-selector'
  | 'family-settings'
  | 'dashboard'
  | 'extrato'
  | 'categorias'
  | 'metodos-pagamento'
  | 'orcamento'
  | 'relatorios'
  | 'fatura'
  | 'historico'
  | 'ajuda'
  | 'configuracoes'
  | 'perfil'
  | 'cofrinhos'
  | 'cofrinho-detalhe';

type Transacao = TransacaoListResponse['transacoes'][number];

export const App = () => {
  const { familiaIdAtiva, isAuthenticated, refreshToken, logout, updateFamiliaIdAtiva } = useAuth();
  const familiaId = familiaIdAtiva ?? '';

  const [screen, setScreen] = useState<Screen>(() => {
    if (isAuthenticated && familiaIdAtiva) return 'dashboard';
    if (isAuthenticated) return 'onboarding';
    return 'login';
  });
  const [novaTransacaoOpen, setNovaTransacaoOpen] = useState(false);
  const [cofrinhoIdSelecionado, setCofrinhoIdSelecionado] = useState<string>('');
  const [faturaMetodoId, setFaturaMetodoId] = useState<string | null>(null);
  const [faturaMetodoNome, setFaturaMetodoNome] = useState<string>('');
  const [faturaMes, setFaturaMes] = useState<string>('');
  const [familiasDoUsuario, setFamiliasDoUsuario] = useState<FamiliaMinhasItem[]>([]);
  const [transacaoParaEditar, setTransacaoParaEditar] = useState<{
    id: string;
    tipo: 'receita' | 'despesa';
    valor: string;
    categoriaId: string;
    descricao: string | null;
    data: string;
    metodoPagamentoId: string | null;
  } | null>(null);
  const [dadosVoz, setDadosVoz] = useState<DadosVoz | null>(null);
  const [voiceSheetOpen, setVoiceSheetOpen] = useState(false);
  const [voiceRecorded, setVoiceRecorded] = useState(false);
  const categorias = useCategoriaStore((s) => s.categorias);
  const setCategorias = useCategoriaStore((s) => s.setCategorias);
  const speech = useSpeechRecognition();

  // Pre-load categories so voice matching works even before modal is opened
  useEffect(() => {
    if (familiaId && categorias.length === 0) {
      categoriaService
        .listar(familiaId)
        .then((res) => setCategorias(res.categorias))
        .catch(() => {});
    }
  }, [familiaId, categorias.length, setCategorias]);

  const handleLoginSuccess = useCallback(
    (familias: FamiliaMinhasItem[]) => {
      setFamiliasDoUsuario(familias);
      if (familias.length === 0) {
        setScreen('onboarding');
      } else if (familias.length === 1) {
        updateFamiliaIdAtiva(familias[0].id);
        setScreen('dashboard');
      } else {
        setScreen('familia-selector');
      }
    },
    [updateFamiliaIdAtiva],
  );

  const handleFamiliaSelect = useCallback(
    (selectedFamiliaId: string) => {
      updateFamiliaIdAtiva(selectedFamiliaId);
      setScreen('dashboard');
    },
    [updateFamiliaIdAtiva],
  );

  const handleLogout = useCallback(() => {
    if (refreshToken) {
      authService.logout(refreshToken).catch(() => {});
    }
    logout();
  }, [refreshToken, logout]);

  useEffect(() => {
    if (screen === 'familia-selector' && isAuthenticated && familiasDoUsuario.length === 0) {
      familiaService
        .listarMinhas()
        .then((res) => setFamiliasDoUsuario(res.familias))
        .catch(() => setScreen('onboarding'));
    }
  }, [screen, isAuthenticated, familiasDoUsuario.length]);

  const handleVoiceActivate = useCallback(() => {
    setVoiceSheetOpen(true);
    setVoiceRecorded(false);
  }, []);

  const handleVoiceStart = useCallback(() => {
    speech.start();
    setVoiceRecorded(true);
  }, [speech]);

  const handleVoiceStop = useCallback(() => {
    speech.stop();
  }, [speech]);

  const handleVoiceClose = useCallback(() => {
    speech.stop();
    setVoiceSheetOpen(false);
  }, [speech]);

  useEffect(() => {
    if (voiceSheetOpen && voiceRecorded && !speech.isListening && speech.finalTranscript) {
      const parsed = parseVoiceInput(speech.finalTranscript);
      const catMatch = parsed.descricao
        ? matchCategory(
            parsed.descricao,
            categorias.map((c) => ({ id: c.id, nome: c.nome })),
          )
        : null;

      setDadosVoz({
        tipo: parsed.tipo,
        valor: parsed.valor,
        categoriaId: catMatch?.categoriaId ?? null,
        descricao: parsed.descricao,
        data: parsed.data,
      });

      setVoiceSheetOpen(false);
      setNovaTransacaoOpen(true);
    }
  }, [voiceSheetOpen, voiceRecorded, speech.isListening, speech.finalTranscript, categorias]);

  // Telas fora do AppShell (autenticação e onboarding)
  if (
    screen === 'login' ||
    (!isAuthenticated &&
      screen !== 'sign-up' &&
      screen !== 'onboarding' &&
      screen !== 'family-settings')
  ) {
    return (
      <LoginPage onOpenSignUp={() => setScreen('sign-up')} onLoginSuccess={handleLoginSuccess} />
    );
  }

  if (screen === 'sign-up') {
    return (
      <SignUpPage
        onOpenLogin={() => setScreen('login')}
        onCompleteSignUp={() => setScreen('onboarding')}
      />
    );
  }

  if (screen === 'onboarding') {
    return (
      <OnboardingPage
        onOpenLogin={() => setScreen('login')}
        onOpenFamilySettings={() => setScreen('family-settings')}
      />
    );
  }

  if (screen === 'familia-selector') {
    return (
      <FamiliaSelectorPage
        familias={familiasDoUsuario}
        onSelect={handleFamiliaSelect}
        onGoToOnboarding={() => setScreen('onboarding')}
      />
    );
  }

  if (screen === 'family-settings' && !familiaId) {
    return (
      <FamilySettingsPage
        onBackToOnboarding={() => setScreen('onboarding')}
        onGoToDashboard={() => setScreen('dashboard')}
        familiaId={familiaId}
      />
    );
  }

  const handleNovaTransacao = () => setNovaTransacaoOpen(true);

  const handleEditarTransacao = (t: Transacao) => {
    setTransacaoParaEditar({
      id: t.id,
      tipo: t.tipo,
      valor: t.valor,
      categoriaId: t.categoriaId,
      descricao: t.descricao,
      data: t.data,
      metodoPagamentoId: t.metodoPagamentoId,
    });
    setNovaTransacaoOpen(true);
  };

  const handleUpdateTransacao = async (id: string, payload: TransacaoUpdateRequest) => {
    if (!familiaId) return;
    await transacaoService.editar(id, payload, familiaId);
    setNovaTransacaoOpen(false);
    setTransacaoParaEditar(null);
  };

  const handleDeleteTransacao = async (id: string) => {
    if (!familiaId) return;
    await transacaoService.excluir(id, familiaId);
    setNovaTransacaoOpen(false);
    setTransacaoParaEditar(null);
  };

  const familiaNomeAtiva = familiasDoUsuario.find((f) => f.id === familiaId)?.nome;

  const renderContent = () => {
    if (screen === 'dashboard') {
      return (
        <DashboardPage
          familiaId={familiaId}
          onNovaTransacao={handleNovaTransacao}
          onNavigate={(s) => setScreen(s as Screen)}
        />
      );
    }

    if (screen === 'extrato') {
      return (
        <ExtratoPage
          familiaId={familiaId}
          onBack={() => setScreen('dashboard')}
          onNovaTransacao={handleNovaTransacao}
          onEditarTransacao={handleEditarTransacao}
        />
      );
    }

    if (screen === 'categorias') {
      return <CategoriasPage familiaId={familiaId} onBack={() => setScreen('configuracoes')} />;
    }

    if (screen === 'metodos-pagamento') {
      return (
        <MetodosPagamentoPage
          familiaId={familiaId}
          onBack={() => setScreen('configuracoes')}
          onVerFatura={(id, nome, mes) => {
            setFaturaMetodoId(id);
            setFaturaMetodoNome(nome);
            setFaturaMes(mes);
            setScreen('fatura');
          }}
        />
      );
    }

    if (screen === 'orcamento') {
      return <OrcamentoPage familiaId={familiaId} onBack={() => setScreen('configuracoes')} />;
    }

    if (screen === 'cofrinhos') {
      return (
        <CofrinhosPage
          familiaId={familiaId}
          onNavigate={(s) => setScreen(s as Screen)}
          onVerDetalhe={(id: string) => {
            setCofrinhoIdSelecionado(id);
            setScreen('cofrinho-detalhe');
          }}
        />
      );
    }

    if (screen === 'cofrinho-detalhe') {
      return (
        <CofrinhoDetalhePage
          familiaId={familiaId}
          cofrinhoId={cofrinhoIdSelecionado}
          onBack={() => setScreen('cofrinhos')}
          onNavigate={(s) => setScreen(s as Screen)}
        />
      );
    }

    if (screen === 'relatorios') {
      return <RelatoriosPage familiaId={familiaId} onBack={() => setScreen('dashboard')} />;
    }

    if (screen === 'historico') {
      return <HistoricoPage familiaId={familiaId} onBack={() => setScreen('configuracoes')} />;
    }

    if (screen === 'ajuda') {
      return (
        <AjudaPage
          onBack={() => setScreen('configuracoes')}
          onNavigate={(s) => setScreen(s as Screen)}
        />
      );
    }

    if (screen === 'configuracoes') {
      return (
        <ConfiguracoesPage
          onBack={() => setScreen('dashboard')}
          onGoToCategorias={() => setScreen('categorias')}
          onGoToMetodosPagamento={() => setScreen('metodos-pagamento')}
          onGoToOrcamento={() => setScreen('orcamento')}
          onGoToCofrinhos={() => setScreen('cofrinhos')}
          onGoToFamilia={() => setScreen('family-settings')}
          onGoToHistorico={() => setScreen('historico')}
          onGoToAjuda={() => setScreen('ajuda')}
          onGoToPerfil={() => setScreen('perfil')}
          onLogout={handleLogout}
        />
      );
    }

    if (screen === 'perfil') {
      return <PerfilPage onBack={() => setScreen('configuracoes')} />;
    }

    if (screen === 'family-settings') {
      return (
        <FamilySettingsPage
          onBackToOnboarding={() => setScreen('configuracoes')}
          onGoToDashboard={() => setScreen('dashboard')}
          onBack={() => setScreen('configuracoes')}
          familiaId={familiaId}
        />
      );
    }

    if (screen === 'fatura' && faturaMetodoId) {
      return (
        <FaturaPage
          familiaId={familiaId}
          metodoPagamentoId={faturaMetodoId}
          metodoPagamentoNome={faturaMetodoNome}
          mesReferencia={faturaMes}
          onBack={() => setScreen('metodos-pagamento')}
        />
      );
    }

    return (
      <DashboardPage
        familiaId={familiaId}
        onNovaTransacao={handleNovaTransacao}
        onNavigate={(s) => setScreen(s as Screen)}
      />
    );
  };

  return (
    <>
      <AppShell
        currentScreen={screen}
        onNavigate={(s) => setScreen(s as Screen)}
        onNovaTransacao={handleNovaTransacao}
        onVoiceActivate={speech.isSupported ? handleVoiceActivate : undefined}
        onLogout={handleLogout}
        familiaNome={familiaNomeAtiva}
      >
        {renderContent()}
      </AppShell>
      <TransacaoModal
        open={novaTransacaoOpen}
        familiaId={familiaId}
        onClose={() => {
          setNovaTransacaoOpen(false);
          setTransacaoParaEditar(null);
          setDadosVoz(null);
        }}
        onSubmit={async (payload) => {
          if (!familiaId) return;
          await transacaoService.registrar(payload, familiaId);
          setNovaTransacaoOpen(false);
          setDadosVoz(null);
        }}
        transacaoParaEditar={transacaoParaEditar}
        onUpdate={handleUpdateTransacao}
        onDelete={handleDeleteTransacao}
        dadosVoz={dadosVoz}
        onVoiceActivate={speech.isSupported ? handleVoiceActivate : undefined}
      />
      <VoiceRecordingSheet
        open={voiceSheetOpen}
        isListening={speech.isListening}
        transcript={speech.transcript}
        error={speech.error}
        onStart={handleVoiceStart}
        onStop={handleVoiceStop}
        onClose={handleVoiceClose}
      />
    </>
  );
};
