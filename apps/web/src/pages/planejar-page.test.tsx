import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  coreFinanceiroService,
  metodoPagamentoService,
  transacaoService,
} from '../services/core-financeiro.service';
import { cofrinhoService } from '../services/cofrinho.service';
import { templateTransacaoService } from '../services/template-transacao.service';
import { renderPagina } from '../test/render-pagina';

import { PlanejarPage } from './planejar-page';

vi.mock('../services/core-financeiro.service', () => ({
  lazyApiClient: { request: vi.fn() },
  transacaoService: { listar: vi.fn() },
  coreFinanceiroService: { getDashboardOrcamento: vi.fn() },
  metodoPagamentoService: { listar: vi.fn() },
}));
vi.mock('../services/template-transacao.service', () => ({
  templateTransacaoService: { listar: vi.fn() },
}));
vi.mock('../services/cofrinho.service', () => ({ cofrinhoService: { listar: vi.fn() } }));

const modelo = (nome: string, tipo: 'receita' | 'despesa' = 'despesa') => ({
  id: nome,
  nome,
  tipo,
});
const transacao = (descricao: string) => ({ id: `t-${descricao}`, descricao });
const orcamento = (status: 'ok' | 'warning' | 'exceeded') => ({
  categoriaId: status,
  categoriaNome: status,
  status,
});
const cartao = (
  id: string,
  nome: string,
  fechamento: number,
  vencimento: number,
  ativo = true,
) => ({
  id,
  nome,
  tipo: 'credito',
  dataFechamento: fechamento,
  dataVencimento: vencimento,
  ativo,
});

const configurarDados = ({
  modelos = [modelo('Salário', 'receita'), modelo('Aluguel'), modelo('Luz')],
  lancadas = ['Salário', 'Aluguel'],
  limites = [orcamento('ok'), orcamento('exceeded'), orcamento('warning'), orcamento('ok')],
  metodos = [cartao('m1', 'Nubank', 28, 5), cartao('m2', 'Inter', 10, 17)] as object[],
  cofrinhos = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
} = {}) => {
  vi.mocked(templateTransacaoService.listar).mockResolvedValue({ templates: modelos } as never);
  vi.mocked(transacaoService.listar).mockResolvedValue({
    transacoes: lancadas.map(transacao),
  } as never);
  vi.mocked(coreFinanceiroService.getDashboardOrcamento).mockResolvedValue(limites as never);
  vi.mocked(metodoPagamentoService.listar).mockResolvedValue({
    metodosPagamento: metodos,
  } as never);
  vi.mocked(cofrinhoService.listar).mockResolvedValue({ cofrinhos } as never);
};

const linha = (nome: RegExp) => screen.findByRole('link', { name: nome });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 12));
  configurarDados();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('PlanejarPage', () => {
  it('mostra Planejar como cabeçalho de aba, com a pílula de mês e sem Voltar', async () => {
    renderPagina(<PlanejarPage familiaId="f1" />, '/planejar');
    expect(screen.getByRole('heading', { level: 1, name: 'Planejar' })).toBeInTheDocument();
    expect(screen.getByText('Novembro de 2026')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument();
    await linha(/contas do mês/i);
  });

  it('Contas do mês: "N de M lançadas" pelas transações do mês com o nome do modelo', async () => {
    renderPagina(<PlanejarPage familiaId="f1" />, '/planejar');
    const contas = await linha(/contas do mês/i);
    expect(contas).toHaveAttribute('href', '/planejar/contas');
    await waitFor(() => expect(contas).toHaveTextContent('2 de 3 lançadas'));
    expect(transacaoService.listar).toHaveBeenCalledWith({ mesReferencia: '2026-11' }, 'f1');
  });

  it('Contas do mês: com uma só lançada, o resumo fica no singular', async () => {
    configurarDados({ lancadas: ['Luz'] });
    renderPagina(<PlanejarPage familiaId="f1" />, '/planejar');
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /contas do mês/i })).toHaveTextContent(
        '1 de 3 lançada',
      ),
    );
  });

  it('Limites por categoria: "N de M estourados" do orçamento do mês', async () => {
    renderPagina(<PlanejarPage familiaId="f1" />, '/planejar');
    const limites = await linha(/limites por categoria/i);
    expect(limites).toHaveAttribute('href', '/planejar/limites');
    await waitFor(() => expect(limites).toHaveTextContent('1 de 4 estourado'));
    expect(coreFinanceiroService.getDashboardOrcamento).toHaveBeenCalledWith('f1', '2026-11');
  });

  it('Cofrinhos: "N ativos"', async () => {
    renderPagina(<PlanejarPage familiaId="f1" />, '/planejar');
    const cofrinhos = await linha(/^cofrinhos/i);
    expect(cofrinhos).toHaveAttribute('href', '/planejar/cofrinhos');
    await waitFor(() => expect(cofrinhos).toHaveTextContent('3 ativos'));
  });

  it('uma linha de fatura por cartão de crédito ativo, com o vencimento', async () => {
    configurarDados({
      metodos: [
        cartao('m1', 'Nubank', 28, 5),
        cartao('m2', 'Inter', 10, 17),
        cartao('m3', 'Antigo', 10, 17, false),
        {
          id: 'm4',
          nome: 'Pix',
          tipo: 'pix',
          ativo: true,
          dataFechamento: null,
          dataVencimento: null,
        },
      ],
    });
    renderPagina(<PlanejarPage familiaId="f1" />, '/planejar');
    const nubank = await linha(/fatura nubank/i);
    expect(nubank).toHaveAttribute('href', '/planejar/fatura/m1?mes=2026-11');
    await waitFor(() => expect(nubank).toHaveTextContent('vence 05/12'));
    const inter = screen.getByRole('link', { name: /fatura inter/i });
    expect(inter).toHaveAttribute('href', '/planejar/fatura/m2?mes=2026-11');
    expect(inter).toHaveTextContent('vence 17/11');
    expect(screen.queryByRole('link', { name: /fatura antigo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /fatura pix/i })).not.toBeInTheDocument();
  });

  it('sem cartão de crédito, não há linha de fatura', async () => {
    configurarDados({ metodos: [] });
    renderPagina(<PlanejarPage familiaId="f1" />, '/planejar');
    await linha(/contas do mês/i);
    await waitFor(() => expect(vi.mocked(metodoPagamentoService.listar)).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: /fatura/i })).not.toBeInTheDocument();
  });

  it('as linhas são links de pelo menos 44px, dentro de um cartão', async () => {
    renderPagina(<PlanejarPage familiaId="f1" />, '/planejar');
    const contas = await linha(/contas do mês/i);
    expect(contas).toHaveClass('min-h-11');
    const cartaoDeLinhas = contas.closest('ul');
    expect(cartaoDeLinhas).toHaveClass('bg-panel', 'shadow-soft', 'rounded-[18px]');
    expect(within(cartaoDeLinhas as HTMLElement).getAllByRole('link')).toHaveLength(5);
  });

  it('trocar o mês busca os resumos do mês escolhido', async () => {
    renderPagina(<PlanejarPage familiaId="f1" />, '/planejar');
    await waitFor(() => expect(transacaoService.listar).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
    await waitFor(() =>
      expect(transacaoService.listar).toHaveBeenLastCalledWith({ mesReferencia: '2026-10' }, 'f1'),
    );
    expect(coreFinanceiroService.getDashboardOrcamento).toHaveBeenLastCalledWith('f1', '2026-10');
    expect(screen.getByText('Outubro de 2026')).toBeInTheDocument();
  });

  it('enquanto carrega, mostra o aviso e já deixa as linhas navegáveis', () => {
    vi.mocked(templateTransacaoService.listar).mockReturnValue(new Promise(() => undefined));
    vi.mocked(transacaoService.listar).mockReturnValue(new Promise(() => undefined));
    vi.mocked(coreFinanceiroService.getDashboardOrcamento).mockReturnValue(
      new Promise(() => undefined),
    );
    vi.mocked(metodoPagamentoService.listar).mockReturnValue(new Promise(() => undefined));
    vi.mocked(cofrinhoService.listar).mockReturnValue(new Promise(() => undefined));
    renderPagina(<PlanejarPage familiaId="f1" />, '/planejar');
    expect(screen.getByText('Carregando resumos...')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /contas do mês/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /limites por categoria/i })).toBeInTheDocument();
  });

  it('se um resumo falha, avisa e deixa a linha sem resumo, com os demais intactos', async () => {
    vi.mocked(coreFinanceiroService.getDashboardOrcamento).mockRejectedValue(new Error('rede'));
    renderPagina(<PlanejarPage familiaId="f1" />, '/planejar');
    expect(await screen.findByRole('alert')).toHaveTextContent(/resumos/i);
    const limites = screen.getByRole('link', { name: /limites por categoria/i });
    expect(limites).toHaveAttribute('href', '/planejar/limites');
    expect(limites).not.toHaveTextContent(/estourado/);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /^cofrinhos/i })).toHaveTextContent('3 ativos'),
    );
    expect(screen.queryByText('Carregando resumos...')).not.toBeInTheDocument();
  });

  it('tocar numa linha abre a tela de destino', async () => {
    renderPagina(<PlanejarPage familiaId="f1" />, '/planejar');
    fireEvent.click(await linha(/limites por categoria/i));
    expect(screen.getByTestId('sonda-local')).toHaveTextContent(/^\/planejar\/limites$/);
  });
});
