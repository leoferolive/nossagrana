import { useFluxoSessao } from '@/hooks/use-fluxo-sessao';
import { AppRotas } from '@/routes/app-rotas';

/** Raiz do app: a tela vem do endereço (ver `routes/`), a sessão vem de `useFluxoSessao`. */
export const App = () => {
  const fluxo = useFluxoSessao();
  return <AppRotas fluxo={fluxo} />;
};
