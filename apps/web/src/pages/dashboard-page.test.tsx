import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../stores/dashboard.store', () => ({
  useDashboardStore: vi.fn(),
}));
vi.mock('../stores/cofrinho.store', () => ({
  useCofrinhoStore: vi.fn(),
}));
vi.mock('react-chartjs-2', () => ({
  Doughnut: () => <div data-testid="chart-doughnut" />,
  Line: () => <div data-testid="chart-line" />,
}));

import { DashboardPage } from './dashboard-page';
import { useDashboardStore } from '../stores/dashboard.store';
import { useCofrinhoStore } from '../stores/cofrinho.store';
import { renderPagina } from '../test/render-pagina';

const mockUseDashboard = useDashboardStore as unknown as ReturnType<typeof vi.fn>;
const mockUseCofrinhoStore = useCofrinhoStore as unknown as ReturnType<typeof vi.fn>;

const resumoBase = {
  mesReferencia: '2026-03',
  totalReceitas: '5200.00',
  totalDespesas: '3800.00',
  saldo: '1400.00',
  mesAnterior: null,
};

describe('DashboardPage', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue({
      resumo: null,
      graficos: null,
      orcamento: [],
      loading: false,
      error: null,
      fetchAll: vi.fn(),
    });
    mockUseCofrinhoStore.mockReturnValue({
      cofrinhos: [],
      fetchAll: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('exibe loading state', () => {
    mockUseDashboard.mockReturnValue({
      loading: true,
      resumo: null,
      graficos: null,
      orcamento: [],
      error: null,
      fetchAll: vi.fn(),
    });
    renderPagina(<DashboardPage familiaId="f1" />);
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('exibe cards de resumo com dados', () => {
    mockUseDashboard.mockReturnValue({
      resumo: resumoBase,
      graficos: { distribuicaoCategorias: [], evolucaoDiaria: [] },
      orcamento: [],
      loading: false,
      error: null,
      fetchAll: vi.fn(),
    });
    renderPagina(<DashboardPage familiaId="f1" />);
    expect(screen.getByText(/5\.200,00/)).toBeInTheDocument();
    expect(screen.getByText(/3\.800,00/)).toBeInTheDocument();
    expect(screen.getByText(/1\.400,00/)).toBeInTheDocument();
  });

  it('mostra o Saldo em largura total acima de Receitas e Despesas, sem truncar valores', () => {
    mockUseDashboard.mockReturnValue({
      resumo: { ...resumoBase, totalReceitas: '1234567.89', saldo: '1234567.89' },
      graficos: { distribuicaoCategorias: [], evolucaoDiaria: [] },
      orcamento: [],
      loading: false,
      error: null,
      fetchAll: vi.fn(),
    });
    renderPagina(<DashboardPage familiaId="f1" />);

    const cartaoSaldo = screen.getByText(/^Saldo/, { selector: 'p' }).parentElement as HTMLElement;
    const grade = cartaoSaldo.parentElement as HTMLElement;

    expect(grade).toHaveClass('grid-cols-2');
    expect(cartaoSaldo).toHaveClass('col-span-2');
    expect(cartaoSaldo).toHaveTextContent(/^Saldo/);
    expect(
      Array.from(grade.children).map(
        (c) => c.textContent?.match(/^(Saldo|Receitas|Despesas)/)?.[1],
      ),
    ).toEqual(['Saldo', 'Receitas', 'Despesas']);
    for (const valor of grade.querySelectorAll('p:nth-of-type(2)')) {
      expect(valor).not.toHaveClass('truncate');
      expect(valor).toHaveClass('tabular-nums');
    }
  });

  it('o selo de variação diz se subiu ou caiu, e não só o número', () => {
    mockUseDashboard.mockReturnValue({
      resumo: {
        ...resumoBase,
        mesAnterior: { totalReceitas: '4000.00', totalDespesas: '4000.00', saldo: '0.00' },
      },
      graficos: { distribuicaoCategorias: [], evolucaoDiaria: [] },
      orcamento: [],
      loading: false,
      error: null,
      fetchAll: vi.fn(),
    });
    renderPagina(<DashboardPage familiaId="f1" />);

    expect(screen.getByLabelText('subiu 30%')).toBeInTheDocument();
    expect(screen.getByLabelText('caiu 5%')).toBeInTheDocument();
  });

  it('exibe mensagem de estado vazio sem transações', () => {
    mockUseDashboard.mockReturnValue({
      resumo: { ...resumoBase, totalReceitas: '0.00', totalDespesas: '0.00', saldo: '0.00' },
      graficos: { distribuicaoCategorias: [], evolucaoDiaria: [] },
      orcamento: [],
      loading: false,
      error: null,
      fetchAll: vi.fn(),
    });
    renderPagina(<DashboardPage familiaId="f1" />);
    expect(screen.getByText(/nenhuma despesa registrada neste mês/i)).toBeInTheDocument();
  });

  it('exibe mensagem quando sem orçamentos', () => {
    mockUseDashboard.mockReturnValue({
      resumo: resumoBase,
      graficos: {
        distribuicaoCategorias: [
          { categoriaId: 'c1', categoriaNome: 'Alim', total: '100.00', percentual: 100 },
        ],
        evolucaoDiaria: [],
      },
      orcamento: [],
      loading: false,
      error: null,
      fetchAll: vi.fn(),
    });
    renderPagina(<DashboardPage familiaId="f1" />);
    expect(screen.getByText(/nenhum orçamento configurado/i)).toBeInTheDocument();
  });

  it('exibe barra de orçamento com status correto', () => {
    mockUseDashboard.mockReturnValue({
      resumo: resumoBase,
      graficos: { distribuicaoCategorias: [], evolucaoDiaria: [] },
      orcamento: [
        {
          categoriaId: 'c1',
          categoriaNome: 'Alimentação',
          valorLimite: '1000.00',
          totalGasto: '600.00',
          percentual: 60,
          status: 'ok',
        },
        {
          categoriaId: 'c2',
          categoriaNome: 'Lazer',
          valorLimite: '500.00',
          totalGasto: '430.00',
          percentual: 86,
          status: 'warning',
        },
        {
          categoriaId: 'c3',
          categoriaNome: 'Transporte',
          valorLimite: '300.00',
          totalGasto: '315.00',
          percentual: 105,
          status: 'exceeded',
        },
      ],
      loading: false,
      error: null,
      fetchAll: vi.fn(),
    });
    renderPagina(<DashboardPage familiaId="f1" />);
    expect(screen.getByText('Alimentação')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('Lazer')).toBeInTheDocument();
    expect(screen.getByText('Transporte')).toBeInTheDocument();
  });

  it('exibe card de cofrinhos com dados', () => {
    mockUseDashboard.mockReturnValue({
      resumo: resumoBase,
      graficos: { distribuicaoCategorias: [], evolucaoDiaria: [] },
      orcamento: [],
      loading: false,
      error: null,
      fetchAll: vi.fn(),
    });
    mockUseCofrinhoStore.mockReturnValue({
      cofrinhos: [
        { id: 'cof1', nome: 'Viagem', emoji: '✈️', saldoAtual: '1500.00', status: 'ativo' },
        { id: 'cof2', nome: 'Reserva', emoji: null, saldoAtual: '300.00', status: 'ativo' },
      ],
      fetchAll: vi.fn(),
    });
    const { container } = renderPagina(<DashboardPage familiaId="f1" onNovaTransacao={vi.fn()} />);
    expect(screen.getByText('Cofrinhos')).toBeInTheDocument();
    expect(screen.getByText('Viagem')).toBeInTheDocument();
    expect(screen.getByText('✈️')).toBeInTheDocument();
    expect(screen.getByText('Reserva')).toBeInTheDocument();
    // Sem emoji escolhido, entra o ícone do cofrinho no lugar do emoji fixo do app
    expect(container.querySelectorAll('svg.lucide-piggy-bank').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: /ver todos/i })).toBeInTheDocument();
  });

  it('exibe estado vazio quando sem cofrinhos', () => {
    mockUseDashboard.mockReturnValue({
      resumo: resumoBase,
      graficos: { distribuicaoCategorias: [], evolucaoDiaria: [] },
      orcamento: [],
      loading: false,
      error: null,
      fetchAll: vi.fn(),
    });
    mockUseCofrinhoStore.mockReturnValue({
      cofrinhos: [],
      fetchAll: vi.fn(),
    });
    renderPagina(<DashboardPage familiaId="f1" onNovaTransacao={vi.fn()} />);
    expect(screen.getByText('Cofrinhos')).toBeInTheDocument();
    expect(screen.getByText('Sua família ainda não tem cofrinhos.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver todos/i })).not.toBeInTheDocument();
  });
  it('mostra o título Início como cabeçalho de aba e a pílula de mês', () => {
    mockUseDashboard.mockReturnValue({
      resumo: resumoBase,
      graficos: { distribuicaoCategorias: [], evolucaoDiaria: [] },
      orcamento: [],
      loading: false,
      error: null,
      fetchAll: vi.fn(),
    });
    mockUseCofrinhoStore.mockReturnValue({ cofrinhos: [], fetchAll: vi.fn() });
    renderPagina(<DashboardPage familiaId="f1" onNovaTransacao={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument();
  });

  it('"Configurar orçamento" abre Limites por categoria no endereço', () => {
    mockUseDashboard.mockReturnValue({
      resumo: resumoBase,
      graficos: { distribuicaoCategorias: [], evolucaoDiaria: [] },
      orcamento: [],
      loading: false,
      error: null,
      fetchAll: vi.fn(),
    });
    mockUseCofrinhoStore.mockReturnValue({ cofrinhos: [], fetchAll: vi.fn() });
    renderPagina(<DashboardPage familiaId="f1" onNovaTransacao={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /configurar orçamento/i }));
    expect(screen.getByTestId('sonda-local')).toHaveTextContent(/^\/planejar\/limites$/);
  });

  it('"Ver todos" abre Cofrinhos no endereço', () => {
    mockUseDashboard.mockReturnValue({
      resumo: resumoBase,
      graficos: { distribuicaoCategorias: [], evolucaoDiaria: [] },
      orcamento: [],
      loading: false,
      error: null,
      fetchAll: vi.fn(),
    });
    mockUseCofrinhoStore.mockReturnValue({
      cofrinhos: [
        { id: 'cof1', nome: 'Viagem', emoji: null, saldoAtual: '10.00', status: 'ativo' },
      ],
      fetchAll: vi.fn(),
    });
    renderPagina(<DashboardPage familiaId="f1" onNovaTransacao={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /ver todos/i }));
    expect(screen.getByTestId('sonda-local')).toHaveTextContent(/^\/planejar\/cofrinhos$/);
  });

  it('abre o tour de boas-vindas no primeiro acesso e não de novo depois de concluído', () => {
    mockUseDashboard.mockReturnValue({
      resumo: resumoBase,
      graficos: { distribuicaoCategorias: [], evolucaoDiaria: [] },
      orcamento: [],
      loading: false,
      error: null,
      fetchAll: vi.fn(),
    });
    mockUseCofrinhoStore.mockReturnValue({ cofrinhos: [], fetchAll: vi.fn() });
    renderPagina(<DashboardPage familiaId="f1" onNovaTransacao={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /pular/i }));
    cleanup();
    renderPagina(<DashboardPage familiaId="f1" onNovaTransacao={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
