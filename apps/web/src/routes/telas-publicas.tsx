import { LoginPage } from '@/pages/login-page';
import { OnboardingPage } from '@/pages/onboarding-page';
import { SignUpPage } from '@/pages/sign-up-page';
import { FamiliaSelectorPage } from '@/pages/familia-selector-page';
import type { FluxoSessao } from '@/hooks/use-fluxo-sessao';

import { useNavegacao } from './use-navegacao';

interface TelaDeFluxoProps {
  fluxo: FluxoSessao;
}

export const EntrarRota = ({ fluxo }: TelaDeFluxoProps) => {
  const { irPara } = useNavegacao();
  return <LoginPage onOpenSignUp={() => irPara('sign-up')} onLoginSuccess={fluxo.aoEntrar} />;
};

export const CadastroRota = () => {
  const { irPara } = useNavegacao();
  return (
    <SignUpPage onOpenLogin={() => irPara('login')} onCompleteSignUp={() => irPara('onboarding')} />
  );
};

export const BoasVindasRota = () => {
  const { irPara } = useNavegacao();
  return (
    <OnboardingPage
      onOpenLogin={() => irPara('login')}
      onOpenFamilySettings={() => irPara('family-settings')}
    />
  );
};

export const FamiliasRota = ({ fluxo }: TelaDeFluxoProps) => {
  const { irPara } = useNavegacao();
  return (
    <FamiliaSelectorPage
      familias={fluxo.familiasDoUsuario}
      onSelect={fluxo.aoEscolherFamilia}
      onGoToOnboarding={() => irPara('onboarding')}
    />
  );
};
