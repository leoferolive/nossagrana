import { useParams, useSearchParams } from 'react-router';

import { useNomeDoMetodo } from '@/hooks/use-nome-do-metodo';
import { AjudaPage } from '@/pages/ajuda-page';
import { CategoriasPage } from '@/pages/categorias-page';
import { CofrinhoDetalhePage } from '@/pages/cofrinho-detalhe-page';
import { CofrinhosPage } from '@/pages/cofrinhos-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { ExtratoPage } from '@/pages/extrato-page';
import { FamilySettingsPage } from '@/pages/family-settings-page';
import { FaturaPage } from '@/pages/fatura-page';
import { HistoricoPage } from '@/pages/historico-page';
import { LancamentosPage } from '@/pages/lancamentos-page';
import { MaisPage } from '@/pages/mais-page';
import { MetodosPagamentoPage } from '@/pages/metodos-pagamento-page';
import { OrcamentoPage } from '@/pages/orcamento-page';
import { PerfilPage } from '@/pages/perfil-page';
import { PlanejarPage } from '@/pages/planejar-page';
import { RelatoriosPage } from '@/pages/relatorios-page';
import { getCurrentMonth } from '@/utils/date';

import { useContextoLogado } from './contexto-logado';

// Cada rota entrega ao componente da página o que ela não tira sozinha do roteador (a família e
// o contexto de lançar). Na navegação, as páginas falam direto, por `useNavegacao` e pelos cabeçalhos.

export const InicioRota = () => {
  const { familiaId, onNovaTransacao } = useContextoLogado();
  return <DashboardPage familiaId={familiaId} onNovaTransacao={onNovaTransacao} />;
};

export const ExtratoRota = () => {
  const { familiaId, onNovaTransacao, onEditarTransacao } = useContextoLogado();
  return (
    <ExtratoPage
      familiaId={familiaId}
      onNovaTransacao={onNovaTransacao}
      onEditarTransacao={onEditarTransacao}
    />
  );
};

export const PlanejarRota = () => {
  const { familiaId } = useContextoLogado();
  return <PlanejarPage familiaId={familiaId} />;
};

export const ContasRota = () => {
  const { familiaId } = useContextoLogado();
  return <LancamentosPage familiaId={familiaId} />;
};

export const LimitesRota = () => {
  const { familiaId } = useContextoLogado();
  return <OrcamentoPage familiaId={familiaId} />;
};

export const CofrinhosRota = () => {
  const { familiaId } = useContextoLogado();
  return <CofrinhosPage familiaId={familiaId} />;
};

export const CofrinhoDetalheRota = () => {
  const { familiaId } = useContextoLogado();
  const { cofrinhoId = '' } = useParams();
  return <CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />;
};

/** `mes` do endereço só vale no formato AAAA-MM com mês de 01 a 12; senão a fatura é a do mês corrente. */
const mesDaFatura = (mes: string | null): string =>
  mes !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : getCurrentMonth();

export const FaturaRota = () => {
  const { familiaId } = useContextoLogado();
  const { metodoId = '' } = useParams();
  const [params] = useSearchParams();
  const nome = useNomeDoMetodo(familiaId, metodoId);
  return (
    <FaturaPage
      familiaId={familiaId}
      metodoPagamentoId={metodoId}
      metodoPagamentoNome={nome ?? 'Cartão'}
      mesReferencia={mesDaFatura(params.get('mes'))}
    />
  );
};

export const MaisRota = () => {
  const { onLogout } = useContextoLogado();
  return <MaisPage onLogout={onLogout} />;
};

export const RelatoriosRota = () => {
  const { familiaId } = useContextoLogado();
  return <RelatoriosPage familiaId={familiaId} />;
};

export const HistoricoRota = () => {
  const { familiaId } = useContextoLogado();
  return <HistoricoPage familiaId={familiaId} />;
};

export const FamiliaRota = () => {
  const { familiaId } = useContextoLogado();
  return <FamilySettingsPage familiaId={familiaId} />;
};

export const CategoriasRota = () => {
  const { familiaId } = useContextoLogado();
  return <CategoriasPage familiaId={familiaId} />;
};

export const MetodosPagamentoRota = () => {
  const { familiaId } = useContextoLogado();
  return <MetodosPagamentoPage familiaId={familiaId} />;
};

export const PerfilRota = () => <PerfilPage />;

export const AjudaRota = () => <AjudaPage />;
