import { useState } from 'react';

import { LoginPage } from '@/pages/login-page';
import { SignUpPage } from '@/pages/sign-up-page';

type AuthScreen = 'login' | 'sign-up';

export const App = () => {
  const [screen, setScreen] = useState<AuthScreen>('login');

  if (screen === 'sign-up') {
    return <SignUpPage onOpenLogin={() => setScreen('login')} />;
  }

  return <LoginPage onOpenSignUp={() => setScreen('sign-up')} />;
};
