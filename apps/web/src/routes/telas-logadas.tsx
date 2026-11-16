import { useParams, useSearchParams } from 'react-router';

import { useNomeDoMetodo } from '@/hooks/use-nome-do-metodo';
import { AjudaPage } from '@/pages/ajuda-page';
import { CategoriasPage } from '@/pages/categorias-page';
import { CofrinhoDetalhePage } from '@/pages/cofrinho-detalhe-page';
import { CofrinhosPage } from '@/pages/cofrinhos-page';
import { ConfiguracoesPage } from '@/pages/configuracoes-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { ExtratoPage } from '@/pages/extrato-page';
import { FamilySettingsPage } from '@/pages/family-settings-page';
import { FaturaPage } from '@/pages/fatura-page';
import { HistoricoPage } from '@/pages/historico-page';
import { LancamentosPage } from '@/pages/lancamentos-page';
import { MetodosPagamentoPage } from '@/pages/metodos-pagamento-page';
import { OrcamentoPage } from '@/pages/orcamento-page';
import { PerfilPage } from '@/pages/perfil-page';
import { RelatoriosPage } from '@/pages/relatorios-page';
import { getCurrentMonth } from '@/utils/date';

import { caminhoDaFatura, caminhoDoCofrinho } from './caminhos';
import { useContextoLogado } from './contexto-logado';
import { useNavegacao } from './use-navegacao';

// Cada rota liga o vocabulário de navegação por propriedades das páginas (onBack, onNavigate)
// ao roteador. As páginas só passam a falar com o roteador direto no PR dos cabeçalhos únicos.

export const InicioRota = () => {
  const { familiaId, onNovaTransacao } = useContextoLogado();
  const { irPara } = useNavegacao();
  return (
    <DashboardPage familiaId={familiaId} onNovaTransacao={onNovaTransacao} onNavigate={irPara} />
  );
};

export const ExtratoRota = () => {
  const { familiaId, onNovaTransacao, onEditarTransacao } = useContextoLogado();
  const { irPara } = useNavegacao();
  return (
    <ExtratoPage
      familiaId={familiaId}
      onBack={() => irPara('dashboard')}
      onNovaTransacao={onNovaTransacao}
      onEditarTransacao={onEditarTransacao}
    />
  );
};

export const ContasRota = () => {
  const { familiaId } = useContextoLogado();
  const { irPara } = useNavegacao();
  return <LancamentosPage familiaId={familiaId} onNavigate={irPara} />;
};

export const LimitesRota = () => {
  const { familiaId } = useContextoLogado();
  const { irPara } = useNavegacao();
  return <OrcamentoPage familiaId={familiaId} onBack={() => irPara('configuracoes')} />;
};

export const CofrinhosRota = () => {
  const { familiaId } = useContextoLogado();
  const { irPara, irParaCaminho } = useNavegacao();
  return (
    <CofrinhosPage
      familiaId={familiaId}
      onNavigate={irPara}
      onVerDetalhe={(id) => irParaCaminho(caminhoDoCofrinho(id))}
    />
  );
};

export const CofrinhoDetalheRota = () => {
  const { familiaId } = useContextoLogado();
  const { cofrinhoId = '' } = useParams();
  const { irPara } = useNavegacao();
  return (
    <CofrinhoDetalhePage
      familiaId={familiaId}
      cofrinhoId={cofrinhoId}
      onBack={() => irPara('cofrinhos')}
      onNavigate={irPara}
    />
  );
};

/** `mes` do endereço só vale no formato AAAA-MM com mês de 01 a 12; senão a fatura é a do mês corrente. */
const mesDaFatura = (mes: string | null): string =>
  mes !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : getCurrentMonth();

export const FaturaRota = () => {
  const { familiaId } = useContextoLogado();
  const { metodoId = '' } = useParams();
  const [params] = useSearchParams();
  const nome = useNomeDoMetodo(familiaId, metodoId);
  const { irPara } = useNavegacao();
  return (
    <FaturaPage
      familiaId={familiaId}
      metodoPagamentoId={metodoId}
      metodoPagamentoNome={nome ?? 'Cartão'}
      mesReferencia={mesDaFatura(params.get('mes'))}
      onBack={() => irPara('metodos-pagamento')}
    />
  );
};

export const MaisRota = () => {
  const { onLogout } = useContextoLogado();
  const { irPara } = useNavegacao();
  return (
    <ConfiguracoesPage
      onBack={() => irPara('dashboard')}
      onGoToCategorias={() => irPara('categorias')}
      onGoToMetodosPagamento={() => irPara('metodos-pagamento')}
      onGoToOrcamento={() => irPara('orcamento')}
      onGoToCofrinhos={() => irPara('cofrinhos')}
      onGoToFamilia={() => irPara('family-settings')}
      onGoToHistorico={() => irPara('historico')}
      onGoToAjuda={() => irPara('ajuda')}
      onGoToPerfil={() => irPara('perfil')}
      onLogout={onLogout}
    />
  );
};

export const RelatoriosRota = () => {
  const { familiaId } = useContextoLogado();
  const { irPara } = useNavegacao();
  return <RelatoriosPage familiaId={familiaId} onBack={() => irPara('dashboard')} />;
};

export const HistoricoRota = () => {
  const { familiaId } = useContextoLogado();
  const { irPara } = useNavegacao();
  return <HistoricoPage familiaId={familiaId} onBack={() => irPara('configuracoes')} />;
};

export const FamiliaRota = () => {
  const { familiaId } = useContextoLogado();
  const { irPara } = useNavegacao();
  return (
    <FamilySettingsPage
      onBackToOnboarding={() => irPara('configuracoes')}
      onGoToDashboard={() => irPara('dashboard')}
      onBack={() => irPara('configuracoes')}
      familiaId={familiaId}
    />
  );
};

export const CategoriasRota = () => {
  const { familiaId } = useContextoLogado();
  const { irPara } = useNavegacao();
  return <CategoriasPage familiaId={familiaId} onBack={() => irPara('configuracoes')} />;
};

export const MetodosPagamentoRota = () => {
  const { familiaId } = useContextoLogado();
  const { irPara, irParaCaminho } = useNavegacao();
  return (
    <MetodosPagamentoPage
      familiaId={familiaId}
      onBack={() => irPara('configuracoes')}
      onVerFatura={(id, _nome, mes) => irParaCaminho(caminhoDaFatura(id, mes))}
    />
  );
};

export const PerfilRota = () => {
  const { irPara } = useNavegacao();
  return <PerfilPage onBack={() => irPara('configuracoes')} />;
};

export const AjudaRota = () => {
  const { irPara } = useNavegacao();
  return <AjudaPage onBack={() => irPara('configuracoes')} onNavigate={irPara} />;
};
