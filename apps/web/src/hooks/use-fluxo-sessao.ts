import type { FamiliaMinhasItem } from '@nossagrana/types';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useAuth } from '@/contexts/use-auth';
import { CAMINHOS } from '@/routes/caminhos';
import { enderecoPedido } from '@/routes/guardas';
import { limparDadosDaFamilia } from '@/stores/limpar-dados-da-familia';
import { authService, familiaService } from '@/services/auth.service';

/** Entrada, escolha de família e saída da sessão, e a navegação que cada uma provoca. */
export const useFluxoSessao = () => {
  const { isAuthenticated, familiaIdAtiva, logout, updateFamiliaIdAtiva } = useAuth();
  const navigate = useNavigate();
  const { pathname, state } = useLocation();
  const [familiasDoUsuario, setFamiliasDoUsuario] = useState<FamiliaMinhasItem[]>([]);
  const [erroFamilias, setErroFamilias] = useState<string | null>(null);

  const aoEntrar = (familias: FamiliaMinhasItem[]) => {
    // Sessão que expirou sem passar por "sair" deixaria dados da conta anterior nas stores.
    limparDadosDaFamilia();
    setFamiliasDoUsuario(familias);
    if (familias.length === 0) {
      void navigate(CAMINHOS.boasVindas, { replace: true });
      return;
    }
    // O endereço pedido só vale com a família já ativa; com várias, segue junto até a escolha.
    const pedido = enderecoPedido(state);
    if (familias.length > 1) {
      void navigate(CAMINHOS.familias, {
        replace: true,
        state: pedido ? { de: pedido } : undefined,
      });
      return;
    }
    updateFamiliaIdAtiva(familias[0].id);
    void navigate(pedido ?? CAMINHOS.inicio, { replace: true });
  };

  const aoEscolherFamilia = (familiaId: string) => {
    limparDadosDaFamilia();
    updateFamiliaIdAtiva(familiaId);
    void navigate(enderecoPedido(state) ?? CAMINHOS.inicio, { replace: true });
  };

  const aoSair = () => {
    // O servidor revoga o refresh vigente pelo cookie (não por uma cópia obsoleta no estado).
    authService.logout().catch(() => {});
    limparDadosDaFamilia();
    // Substitui a entrada: voltar no histórico não pode reabrir a tela que a sessão acabou de deixar.
    void navigate(CAMINHOS.entrar, { replace: true });
    logout();
  };

  const naTelaDeFamilias = pathname === CAMINHOS.familias;
  useEffect(() => {
    if (!naTelaDeFamilias || !isAuthenticated || familiasDoUsuario.length > 0) return;
    // Cada tentativa começa sem o aviso da anterior.
    setErroFamilias(null);
    familiaService
      .listarMinhas()
      .then((res) => setFamiliasDoUsuario(res.familias))
      .catch(() => {
        // Quem já tem família ativa não é um caso de onboarding: fica no seletor, com o aviso.
        if (familiaIdAtiva) setErroFamilias('Não foi possível carregar suas famílias.');
        else void navigate(CAMINHOS.boasVindas);
      });
  }, [naTelaDeFamilias, isAuthenticated, familiasDoUsuario.length, familiaIdAtiva, navigate]);

  return { familiasDoUsuario, erroFamilias, familiaIdAtiva, aoEntrar, aoEscolherFamilia, aoSair };
};

export type FluxoSessao = ReturnType<typeof useFluxoSessao>;
