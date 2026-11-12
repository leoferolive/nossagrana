import { create } from 'zustand';

import { gravarFamiliaAtiva, lerFamiliaAtiva } from '../services/familia-ativa-storage';

type SessaoStatus = 'carregando' | 'autenticado' | 'anonimo';

interface AuthSessionStore {
  status: SessaoStatus;
  /** Só em memória: nunca em localStorage/sessionStorage/IndexedDB (#117). */
  accessToken: string | null;
  familiaIdAtiva: string | null;
  iniciarSessao(accessToken: string, familiaIdAtiva: string): void;
  atualizarAccessToken(accessToken: string): void;
  definirFamiliaAtiva(familiaId: string): void;
  concluirBootstrap(restaurou: boolean): void;
  encerrarSessao(): void;
}

/**
 * Fonte única do access token, compartilhada pelo `ApiClient` (via `getState()`) e pelo
 * `AuthContext` (via hook). Zustand porque o estado é compartilhado fora da árvore React.
 */
export const useAuthSessionStore = create<AuthSessionStore>((set, get) => ({
  status: 'carregando',
  accessToken: null,
  familiaIdAtiva: null,

  iniciarSessao(accessToken, familiaIdAtiva) {
    gravarFamiliaAtiva(familiaIdAtiva);
    set({ status: 'autenticado', accessToken, familiaIdAtiva: familiaIdAtiva || null });
  },

  // Refresh que termina depois do logout não pode recriar a sessão.
  atualizarAccessToken(accessToken) {
    if (get().status === 'anonimo') return;
    set({ accessToken });
  },

  definirFamiliaAtiva(familiaId) {
    gravarFamiliaAtiva(familiaId);
    set({ familiaIdAtiva: familiaId || null });
  },

  concluirBootstrap(restaurou) {
    // Logout (ou 401 no refresh) durante o bootstrap já decidiu: não ressuscitar.
    if (get().status !== 'carregando') return;
    if (!restaurou || !get().accessToken) {
      set({ status: 'anonimo', accessToken: null });
      return;
    }
    set({ status: 'autenticado', familiaIdAtiva: lerFamiliaAtiva() });
  },

  encerrarSessao() {
    gravarFamiliaAtiva('');
    set({ status: 'anonimo', accessToken: null, familiaIdAtiva: null });
  },
}));
