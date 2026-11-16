import type { FamiliaMinhasItem } from '@nossagrana/types';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useAuth } from '@/contexts/use-auth';
import { CAMINHOS } from '@/routes/caminhos';
import { authService, familiaService } from '@/services/auth.service';

/** Entrada, escolha de família e saída da sessão, e a navegação que cada uma provoca. */
export const useFluxoSessao = () => {
  const { isAuthenticated, logout, updateFamiliaIdAtiva } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [familiasDoUsuario, setFamiliasDoUsuario] = useState<FamiliaMinhasItem[]>([]);

  const aoEntrar = (familias: FamiliaMinhasItem[]) => {
    setFamiliasDoUsuario(familias);
    if (familias.length === 0) {
      void navigate(CAMINHOS.boasVindas);
      return;
    }
    if (familias.length > 1) {
      void navigate(CAMINHOS.familias);
      return;
    }
    updateFamiliaIdAtiva(familias[0].id);
    void navigate(CAMINHOS.inicio);
  };

  const aoEscolherFamilia = (familiaId: string) => {
    updateFamiliaIdAtiva(familiaId);
    void navigate(CAMINHOS.inicio);
  };

  const aoSair = () => {
    // O servidor revoga o refresh vigente pelo cookie (não por uma cópia obsoleta no estado).
    authService.logout().catch(() => {});
    logout();
  };

  const naTelaDeFamilias = pathname === CAMINHOS.familias;
  useEffect(() => {
    if (!naTelaDeFamilias || !isAuthenticated || familiasDoUsuario.length > 0) return;
    familiaService
      .listarMinhas()
      .then((res) => setFamiliasDoUsuario(res.familias))
      .catch(() => void navigate(CAMINHOS.boasVindas));
  }, [naTelaDeFamilias, isAuthenticated, familiasDoUsuario.length, navigate]);

  return { familiasDoUsuario, aoEntrar, aoEscolherFamilia, aoSair };
};

export type FluxoSessao = ReturnType<typeof useFluxoSessao>;
