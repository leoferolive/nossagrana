import { useAuthSessionStore } from '../stores/auth-session.store';

import type { ResultadoRefresh } from './api-client';
import { gravarFamiliaAtiva, lerFamiliaAtiva, migrarSessaoLegada } from './familia-ativa-storage';

export interface SessaoRestauravel {
  restaurarSessao(): Promise<ResultadoRefresh>;
}

/** Ids das famílias do usuário (`/familias/minhas`), para validar a família persistida. */
type ListarFamiliaIds = () => Promise<string[]>;

/**
 * Reload/abertura do app: sem access token em memória, tenta restaurar a sessão pelo cookie
 * de refresh. Antes disso remove a sessão legada do storage (só a família é aproveitada).
 */
export const bootstrapSessao = async (
  api: SessaoRestauravel,
  listarFamiliaIds: ListarFamiliaIds,
): Promise<void> => {
  const familiaLegada = migrarSessaoLegada();
  if (familiaLegada && !lerFamiliaAtiva()) gravarFamiliaAtiva(familiaLegada);
  const resultado = await api.restaurarSessao().catch((): ResultadoRefresh => 'indisponivel');
  if (resultado === 'ok') await descartarFamiliaObsoleta(listarFamiliaIds);
  useAuthSessionStore.getState().concluirBootstrap(resultado);
};

/**
 * A família persistida pode ter sido removida/excluída desde a última visita: se não está em
 * `/familias/minhas`, descarta (o app vai ao onboarding). Falha na consulta mantém a família,
 * pois a sessão em si é válida.
 */
const descartarFamiliaObsoleta = async (listarFamiliaIds: ListarFamiliaIds): Promise<void> => {
  const persistida = lerFamiliaAtiva();
  if (!persistida) return;
  try {
    const ids = await listarFamiliaIds();
    if (!ids.includes(persistida)) gravarFamiliaAtiva('');
  } catch {
    // Mantém a família: a validação é best effort.
  }
};
