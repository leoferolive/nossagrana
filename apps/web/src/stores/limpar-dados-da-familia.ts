import { esquecerBuscasDeCategorias } from '@/hooks/use-categorias-mais-usadas';

import { useCategoriaStore } from './categoria.store';
import { useCofrinhoStore } from './cofrinho.store';
import { useDashboardStore } from './dashboard.store';
import { useMetodoPagamentoStore } from './metodo-pagamento.store';
import { useTemplateTransacaoStore } from './template-transacao.store';
import { useTransacaoStore } from './transacao.store';

/**
 * Zera todas as stores com dados de uma família. Elas são globais e não guardam a que família
 * pertencem; sem isto, trocar de família ou de conta mostraria dado da anterior até a nova
 * resposta chegar (ou para sempre, se ela falhar). Fica de fora o que não é dado de família:
 * sessão (`auth-session`) e conexão (`websocket`). Nova store com dado de família entra aqui.
 */
export const limparDadosDaFamilia = (): void => {
  esquecerBuscasDeCategorias();
  useCategoriaStore.setState({ categorias: [], carregando: false, erro: null });
  useCofrinhoStore.getState().reset();
  useDashboardStore.setState({
    resumo: null,
    graficos: null,
    orcamento: [],
    loading: false,
    error: null,
  });
  useMetodoPagamentoStore.setState({ metodos: [], carregando: false, erro: null });
  useTemplateTransacaoStore.setState({
    templates: [],
    valores: {},
    carregando: false,
    salvando: false,
    erro: null,
  });
  useTransacaoStore.setState({ transacoes: [], carregando: false, erro: null, filtros: {} });
};
