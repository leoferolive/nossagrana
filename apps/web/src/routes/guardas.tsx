import type { ReactNode } from 'react';
import { Navigate } from 'react-router';

import { useAuth } from '@/contexts/use-auth';

import { CAMINHOS } from './caminhos';

interface GuardaProps {
  children: ReactNode;
}

/** Telas que exigem só a sessão (escolha de família e boas-vindas). */
export const RotaAutenticada = ({ children }: GuardaProps) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to={CAMINHOS.entrar} replace />;
  return <>{children}</>;
};

/** Telas financeiras: exigem sessão e família ativa. O `familiaId` vem sempre da sessão. */
export const RotaComFamilia = ({ children }: GuardaProps) => {
  const { isAuthenticated, familiaIdAtiva } = useAuth();
  if (!isAuthenticated) return <Navigate to={CAMINHOS.entrar} replace />;
  if (!familiaIdAtiva) return <Navigate to={CAMINHOS.boasVindas} replace />;
  return <>{children}</>;
};
