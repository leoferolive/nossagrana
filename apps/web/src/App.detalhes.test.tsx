import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockSessao, resetAppMocks } from '@/test/app-mocks';
import { renderApp } from '@/test/render-app';

import { useAuth } from './contexts/use-auth';
import { cofrinhoService } from './services/cofrinho.service';
import { coreFinanceiroService, metodoPagamentoService } from './services/core-financeiro.service';
import { useCofrinhoStore } from './stores/cofrinho.store';
import { useMetodoPagamentoStore } from './stores/metodo-pagamento.store';
import { getCurrentMonth } from './utils/date';

vi.mock('./services/cofrinho.service', () => ({
  cofrinhoService: { listar: vi.fn(), detalhe: vi.fn() },
}));

const cofrinhoBase = {
  id: 'c1',
  familiaId: 'fam-test',
  nome: 'Viagem Europa',
  emoji: null,
  descricao: null,
  metaValor: null,
  saldoAtual: '2500.00',
  status: 'ativo' as const,
  criadoPor: 'u1',
  criadoEm: '2026-01-15T10:00:00.000Z',
  encerradoEm: null,
};

const cartao = {
  id: 'm1',
  familiaId: 'fam-test',
  nome: 'Nubank',
  tipo: 'credito' as const,
  dataFechamento: 5,
  dataVencimento: 12,
  usuarioDonoId: 'u1',
  ativo: true,
  criadoEm: '2026-01-01T00:00:00Z',
};

const tituloNoConteudo = (nome: RegExp) =>
  within(screen.getByRole('main')).getByRole('heading', { level: 1, name: nome });

beforeEach(() => {
  mockSessao({ autenticado: true, familiaAtiva: 'fam-test' });
  vi.mocked(cofrinhoService.listar).mockResolvedValue({ cofrinhos: [cofrinhoBase] });
  vi.mocked(cofrinhoService.detalhe).mockImplementation(async (_familia, id) => {
    if (id !== 'c1') throw new Error('Cofrinho não encontrado');
    return { cofrinho: cofrinhoBase, movimentacoes: [], aporteRecorrenteAtivo: null };
  });
  vi.mocked(metodoPagamentoService.listar).mockResolvedValue({ metodosPagamento: [cartao] });
});

afterEach(() => {
  resetAppMocks();
  useCofrinhoStore.getState().reset();
  useMetodoPagamentoStore.setState({ metodos: [] });
});

describe('App > cofrinho no endereço', () => {
  it('/planejar/cofrinhos/c1 abre o detalhe do cofrinho c1', async () => {
    renderApp('/planejar/cofrinhos/c1');

    expect(await waitFor(() => tituloNoConteudo(/viagem europa/i))).toBeInTheDocument();
    expect(cofrinhoService.detalhe).toHaveBeenCalledWith('fam-test', 'c1');
  });

  it('abrir um cofrinho pela lista muda o endereço para /planejar/cofrinhos/<id>', async () => {
    renderApp('/planejar/cofrinhos');

    fireEvent.click(await screen.findByRole('button', { name: /viagem europa/i }));

    expect(await waitFor(() => tituloNoConteudo(/viagem europa/i))).toBeInTheDocument();
    expect(screen.getByTestId('sonda-local')).toHaveTextContent(/^\/planejar\/cofrinhos\/c1$/);
  });

  it('cofrinho inexistente mostra o erro da própria tela, sem dados de outro cofrinho', async () => {
    useCofrinhoStore.setState({
      cofrinhoSelecionado: {
        cofrinho: cofrinhoBase,
        movimentacoes: [],
        aporteRecorrenteAtivo: null,
      },
    });
    renderApp('/planejar/cofrinhos/de-outra-familia');

    expect(await screen.findByRole('alert')).toHaveTextContent(/erro ao carregar detalhe/i);
    expect(screen.queryByText(/viagem europa/i)).not.toBeInTheDocument();
  });

  it('voltar do detalhe leva à lista de cofrinhos', async () => {
    renderApp('/planejar/cofrinhos/c1');

    fireEvent.click(await screen.findByRole('button', { name: /^voltar$/i }));

    expect(await waitFor(() => tituloNoConteudo(/^cofrinhos$/i))).toBeInTheDocument();
    expect(screen.getByTestId('sonda-local')).toHaveTextContent(/^\/planejar\/cofrinhos$/);
  });
});

describe('App > fatura no endereço', () => {
  it('abre a fatura do método m1 no mês do endereço, com o nome do cartão', async () => {
    renderApp('/planejar/fatura/m1?mes=2026-11');

    expect(await screen.findByRole('heading', { name: /fatura — nubank/i })).toBeInTheDocument();
    expect(coreFinanceiroService.getFatura).toHaveBeenCalledWith('fam-test', 'm1', '2026-11');
  });

  it('sem mes no endereço, a fatura usa o mês corrente', async () => {
    renderApp('/planejar/fatura/m1');

    await waitFor(() =>
      expect(coreFinanceiroService.getFatura).toHaveBeenCalledWith(
        'fam-test',
        'm1',
        getCurrentMonth(),
      ),
    );
  });

  it.each(['abc', '2026-13', '2026-1', '20261-11'])(
    'mes fora do formato AAAA-MM (%s) é tratado como ausente',
    async (mes) => {
      renderApp(`/planejar/fatura/m1?mes=${mes}`);

      await waitFor(() =>
        expect(coreFinanceiroService.getFatura).toHaveBeenCalledWith(
          'fam-test',
          'm1',
          getCurrentMonth(),
        ),
      );
    },
  );

  it('abrir a fatura pela lista de cartões grava o mês no endereço', async () => {
    renderApp('/mais/metodos-pagamento');

    fireEvent.click(await screen.findByRole('button', { name: /ver fatura de nubank/i }));

    expect(await screen.findByRole('heading', { name: /fatura — nubank/i })).toBeInTheDocument();
    expect(screen.getByTestId('sonda-local')).toHaveTextContent(
      `/planejar/fatura/m1?mes=${getCurrentMonth()}`,
    );
  });
});

describe('App > troca de família com id no endereço', () => {
  it('trocar de família estando num endereço com id leva ao Início', async () => {
    const { reavaliarSessao } = renderApp('/planejar/cofrinhos/c1');
    await waitFor(() => tituloNoConteudo(/viagem europa/i));

    vi.mocked(useAuth).mockImplementation(() => ({
      isAuthenticated: true,
      accessToken: 'token',
      familiaIdAtiva: 'fam-outra',
      login: vi.fn(),
      logout: vi.fn(),
      setAccessToken: vi.fn(),
      updateFamiliaIdAtiva: vi.fn(),
    }));
    reavaliarSessao();

    expect(await waitFor(() => tituloNoConteudo(/nossagrana/i))).toBeInTheDocument();
    expect(screen.getByTestId('sonda-local')).toHaveTextContent(/^\/$/);
  });
});
