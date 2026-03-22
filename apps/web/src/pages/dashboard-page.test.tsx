import { cleanup, render, screen } from '@testing-library/react';
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
  });

  it('exibe loading state', () => {
    mockUseDashboard.mockReturnValue({ loading: true, resumo: null, graficos: null, orcamento: [], error: null, fetchAll: vi.fn() });
    render(<DashboardPage familiaId="f1" onNovaTransacao={vi.fn()} />);
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
    render(<DashboardPage familiaId="f1" onNovaTransacao={vi.fn()} />);
    expect(screen.getByText(/5\.200,00/)).toBeInTheDocument();
    expect(screen.getByText(/3\.800,00/)).toBeInTheDocument();
    expect(screen.getByText(/1\.400,00/)).toBeInTheDocument();
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
    render(<DashboardPage familiaId="f1" onNovaTransacao={vi.fn()} />);
    expect(screen.getByText(/nenhuma transação registrada/i)).toBeInTheDocument();
  });

  it('exibe mensagem quando sem orçamentos', () => {
    mockUseDashboard.mockReturnValue({
      resumo: resumoBase,
      graficos: { distribuicaoCategorias: [{ categoriaId: 'c1', categoriaNome: 'Alim', total: '100.00', percentual: 100 }], evolucaoDiaria: [] },
      orcamento: [],
      loading: false,
      error: null,
      fetchAll: vi.fn(),
    });
    render(<DashboardPage familiaId="f1" onNovaTransacao={vi.fn()} />);
    expect(screen.getByText(/nenhum orçamento configurado/i)).toBeInTheDocument();
  });

  it('exibe barra de orçamento com status correto', () => {
    mockUseDashboard.mockReturnValue({
      resumo: resumoBase,
      graficos: { distribuicaoCategorias: [], evolucaoDiaria: [] },
      orcamento: [
        { categoriaId: 'c1', categoriaNome: 'Alimentação', valorLimite: '1000.00', totalGasto: '600.00', percentual: 60, status: 'ok' },
        { categoriaId: 'c2', categoriaNome: 'Lazer', valorLimite: '500.00', totalGasto: '430.00', percentual: 86, status: 'warning' },
        { categoriaId: 'c3', categoriaNome: 'Transporte', valorLimite: '300.00', totalGasto: '315.00', percentual: 105, status: 'exceeded' },
      ],
      loading: false,
      error: null,
      fetchAll: vi.fn(),
    });
    render(<DashboardPage familiaId="f1" onNovaTransacao={vi.fn()} />);
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
    render(<DashboardPage familiaId="f1" onNovaTransacao={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByText('Cofrinhos')).toBeInTheDocument();
    expect(screen.getByText('Viagem')).toBeInTheDocument();
    expect(screen.getByText('✈️')).toBeInTheDocument();
    expect(screen.getByText('Reserva')).toBeInTheDocument();
    expect(screen.getByText('🐷')).toBeInTheDocument();
    expect(screen.getByText('Ver todos →')).toBeInTheDocument();
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
    render(<DashboardPage familiaId="f1" onNovaTransacao={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByText('Cofrinhos')).toBeInTheDocument();
    expect(screen.getByText('Sua família ainda não tem cofrinhos.')).toBeInTheDocument();
    expect(screen.queryByText('Ver todos →')).not.toBeInTheDocument();
  });
});
