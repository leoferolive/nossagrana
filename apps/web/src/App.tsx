import { useState } from 'react';

import { TransacaoModal } from '@/components/transacao-modal';
import { useAuth } from '@/contexts/use-auth';
import { AjudaPage } from '@/pages/ajuda-page';
import { CategoriasPage } from '@/pages/categorias-page';
import { ConfiguracoesPage } from '@/pages/configuracoes-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { ExtratoPage } from '@/pages/extrato-page';
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
import { transacaoService } from '@/services/core-financeiro.service';

type Screen =
  | 'login'
  | 'sign-up'
  | 'onboarding'
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
  | 'perfil';

export const App = () => {
  const { familiaIdAtiva, isAuthenticated } = useAuth();
  const familiaId = familiaIdAtiva ?? '';

  const [screen, setScreen] = useState<Screen>('login');
  const [novaTransacaoOpen, setNovaTransacaoOpen] = useState(false);
  const [faturaMetodoId, setFaturaMetodoId] = useState<string | null>(null);
  const [faturaMetodoNome, setFaturaMetodoNome] = useState<string>('');
  const [faturaMes, setFaturaMes] = useState<string>('');

  if (!isAuthenticated && screen !== 'login' && screen !== 'sign-up' && screen !== 'onboarding') {
    return (
      <LoginPage
        onOpenSignUp={() => setScreen('sign-up')}
        onLoginSuccess={() => setScreen('dashboard')}
      />
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

  if (screen === 'family-settings') {
    return (
      <FamilySettingsPage
        onBackToOnboarding={() => setScreen('onboarding')}
        familiaId={familiaId}
      />
    );
  }

  if (screen === 'dashboard') {
    return (
      <>
        <DashboardPage
          familiaId={familiaId}
          onNovaTransacao={() => setNovaTransacaoOpen(true)}
          onGoToExtrato={() => setScreen('extrato')}
          onGoToCategorias={() => setScreen('categorias')}
          onGoToMetodosPagamento={() => setScreen('metodos-pagamento')}
          onGoToOrcamento={() => setScreen('orcamento')}
          onGoToRelatorios={() => setScreen('relatorios')}
          onGoToHistorico={() => setScreen('historico')}
          onGoToAjuda={() => setScreen('ajuda')}
          onGoToConfiguracoes={() => setScreen('configuracoes')}
        />
        <TransacaoModal
          open={novaTransacaoOpen}
          onClose={() => setNovaTransacaoOpen(false)}
          onSubmit={async (payload) => {
            if (!familiaId) return;
            await transacaoService.registrar(payload, familiaId);
            setNovaTransacaoOpen(false);
          }}
        />
      </>
    );
  }

  if (screen === 'extrato') {
    return (
      <>
        <ExtratoPage
          familiaId={familiaId}
          onBack={() => setScreen('dashboard')}
          onNovaTransacao={() => setNovaTransacaoOpen(true)}
        />
        <TransacaoModal
          open={novaTransacaoOpen}
          onClose={() => setNovaTransacaoOpen(false)}
          onSubmit={async (payload) => {
            if (!familiaId) return;
            await transacaoService.registrar(payload, familiaId);
            setNovaTransacaoOpen(false);
          }}
        />
      </>
    );
  }

  if (screen === 'categorias') {
    return <CategoriasPage familiaId={familiaId} onBack={() => setScreen('dashboard')} />;
  }

  if (screen === 'metodos-pagamento') {
    return (
      <MetodosPagamentoPage
        familiaId={familiaId}
        onBack={() => setScreen('dashboard')}
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
    return <OrcamentoPage familiaId={familiaId} onBack={() => setScreen('dashboard')} />;
  }

  if (screen === 'relatorios') {
    return <RelatoriosPage familiaId={familiaId} onBack={() => setScreen('dashboard')} />;
  }

  if (screen === 'historico') {
    return <HistoricoPage familiaId={familiaId} onBack={() => setScreen('dashboard')} />;
  }

  if (screen === 'ajuda') {
    return <AjudaPage onBack={() => setScreen('configuracoes')} />;
  }

  if (screen === 'configuracoes') {
    return (
      <ConfiguracoesPage
        onBack={() => setScreen('dashboard')}
        onGoToCategorias={() => setScreen('categorias')}
        onGoToMetodosPagamento={() => setScreen('metodos-pagamento')}
        onGoToOrcamento={() => setScreen('orcamento')}
        onGoToFamilia={() => setScreen('family-settings')}
        onGoToHistorico={() => setScreen('historico')}
        onGoToAjuda={() => setScreen('ajuda')}
        onGoToPerfil={() => setScreen('perfil')}
      />
    );
  }

  if (screen === 'perfil') {
    return <PerfilPage onBack={() => setScreen('configuracoes')} />;
  }

  if (screen === 'fatura' && faturaMetodoId) {
    return (
      <FaturaPage
        familiaId={familiaId}
        metodoPagamentoId={faturaMetodoId}
        metodoPagamentoNome={faturaMetodoNome}
        mesReferencia={faturaMes}
        onBack={() => setScreen('dashboard')}
      />
    );
  }

  return (
    <LoginPage
      onOpenSignUp={() => setScreen('sign-up')}
      onLoginSuccess={() => setScreen('dashboard')}
    />
  );
};
