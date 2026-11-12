import { useAuthSessionStore } from '../stores/auth-session.store';

import { gravarFamiliaAtiva, lerFamiliaAtiva, migrarSessaoLegada } from './familia-ativa-storage';

export interface SessaoRestauravel {
  restaurarSessao(): Promise<boolean>;
}

/**
 * Reload/abertura do app: sem access token em memória, tenta restaurar a sessão pelo cookie
 * de refresh. Antes disso remove a sessão legada do storage (só a família é aproveitada).
 */
export const bootstrapSessao = async (api: SessaoRestauravel): Promise<void> => {
  const familiaLegada = migrarSessaoLegada();
  if (familiaLegada && !lerFamiliaAtiva()) gravarFamiliaAtiva(familiaLegada);
  const restaurou = await api.restaurarSessao().catch(() => false);
  useAuthSessionStore.getState().concluirBootstrap(restaurou);
};
