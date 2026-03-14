import { useState } from 'react';

import { TransacaoModal } from '@/components/transacao-modal';
import { CategoriasPage } from '@/pages/categorias-page';
import { ExtratoPage } from '@/pages/extrato-page';
import { FamilySettingsPage } from '@/pages/family-settings-page';
import { HomePage } from '@/pages/home-page';
import { LoginPage } from '@/pages/login-page';
import { MetodosPagamentoPage } from '@/pages/metodos-pagamento-page';
import { OnboardingPage } from '@/pages/onboarding-page';
import { SignUpPage } from '@/pages/sign-up-page';

type Screen =
  | 'login'
  | 'sign-up'
  | 'onboarding'
  | 'family-settings'
  | 'home'
  | 'extrato'
  | 'categorias'
  | 'metodos-pagamento';

// Demo familiaId until real auth is wired up
const DEMO_FAMILIA_ID = 'familia-oliveira';

export const App = () => {
  const [screen, setScreen] = useState<Screen>('login');
  const [novaTransacaoOpen, setNovaTransacaoOpen] = useState(false);

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
    return <FamilySettingsPage onBackToOnboarding={() => setScreen('onboarding')} />;
  }

  if (screen === 'home') {
    return (
      <>
        <HomePage
          familiaId={DEMO_FAMILIA_ID}
          onGoExtrato={() => setScreen('extrato')}
          onGoCategorias={() => setScreen('categorias')}
          onGoMetodos={() => setScreen('metodos-pagamento')}
          onNovaTransacao={() => setNovaTransacaoOpen(true)}
        />
        <TransacaoModal
          open={novaTransacaoOpen}
          onClose={() => setNovaTransacaoOpen(false)}
          onSubmit={() => setNovaTransacaoOpen(false)}
        />
      </>
    );
  }

  if (screen === 'extrato') {
    return (
      <>
        <ExtratoPage
          familiaId={DEMO_FAMILIA_ID}
          onBack={() => setScreen('home')}
          onNovaTransacao={() => setNovaTransacaoOpen(true)}
        />
        <TransacaoModal
          open={novaTransacaoOpen}
          onClose={() => setNovaTransacaoOpen(false)}
          onSubmit={() => setNovaTransacaoOpen(false)}
        />
      </>
    );
  }

  if (screen === 'categorias') {
    return (
      <CategoriasPage
        familiaId={DEMO_FAMILIA_ID}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'metodos-pagamento') {
    return (
      <MetodosPagamentoPage
        familiaId={DEMO_FAMILIA_ID}
        onBack={() => setScreen('home')}
      />
    );
  }

  return (
    <LoginPage
      onOpenSignUp={() => setScreen('sign-up')}
      onLoginSuccess={() => setScreen('home')}
    />
  );
};
