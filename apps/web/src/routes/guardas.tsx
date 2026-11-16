import { useEffect, useRef, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { useAuth } from '@/contexts/use-auth';

import { CAMINHOS } from './caminhos';

interface GuardaProps {
  children: ReactNode;
}

/**
 * Endereço que o usuário tinha pedido antes de cair no login, guardado no `state` da
 * entrada de histórico (sobrevive à recarga). Só aceita endereço interno: começar com `/`
 * e não com `//` nem `/\`, que o navegador leria como outro site.
 */
export const enderecoPedido = (state: unknown): string | null => {
  if (typeof state !== 'object' || state === null || !('de' in state)) return null;
  const { de } = state;
  if (typeof de !== 'string' || !de.startsWith('/')) return null;
  return de.startsWith('//') || de.startsWith('/\\') ? null : de;
};

/**
 * Detecta a saída da sessão: a guarda continua montada quando `isAuthenticated` vira falso, e
 * quem acabou de sair não deve ter a tela que deixou guardada como "endereço pedido".
 */
const useSaiuDaSessao = (isAuthenticated: boolean): boolean => {
  const estavaAutenticado = useRef(isAuthenticated);
  useEffect(() => {
    estavaAutenticado.current = isAuthenticated;
  }, [isAuthenticated]);
  return estavaAutenticado.current && !isAuthenticated;
};

const IrParaEntrar = ({ guardarEndereco }: { guardarEndereco: boolean }) => {
  const { pathname, search } = useLocation();
  const state = guardarEndereco ? { de: `${pathname}${search}` } : undefined;
  return <Navigate to={CAMINHOS.entrar} replace state={state} />;
};

/** Telas que exigem só a sessão (escolha de família e boas-vindas). */
export const RotaAutenticada = ({ children }: GuardaProps) => {
  const { isAuthenticated } = useAuth();
  const saiu = useSaiuDaSessao(isAuthenticated);
  if (!isAuthenticated) return <IrParaEntrar guardarEndereco={!saiu} />;
  return <>{children}</>;
};

/** Telas financeiras: exigem sessão e família ativa. O `familiaId` vem sempre da sessão. */
export const RotaComFamilia = ({ children }: GuardaProps) => {
  const { isAuthenticated, familiaIdAtiva } = useAuth();
  const saiu = useSaiuDaSessao(isAuthenticated);
  if (!isAuthenticated) return <IrParaEntrar guardarEndereco={!saiu} />;
  if (!familiaIdAtiva) return <Navigate to={CAMINHOS.boasVindas} replace />;
  return <>{children}</>;
};

/**
 * Entrada e cadastro: quem já tem sessão e família não precisa deles. Sem família o login
 * ainda está em curso (a família só é escolhida depois que a tela busca as do usuário), então
 * a tela fica onde está.
 */
export const RotaDeEntrada = ({ children }: GuardaProps) => {
  const { isAuthenticated, familiaIdAtiva } = useAuth();
  const { state } = useLocation();
  if (isAuthenticated && familiaIdAtiva) {
    return <Navigate to={enderecoPedido(state) ?? CAMINHOS.inicio} replace />;
  }
  return <>{children}</>;
};
