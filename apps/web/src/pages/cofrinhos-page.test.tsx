import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCofrinhoStore } from '@/stores/cofrinho.store';
import { CofrinhosPage } from './cofrinhos-page';

const mockCriar = vi.fn();

vi.mock('@/services/cofrinho.service', () => ({
  cofrinhoService: {
    criar: (...args: unknown[]) => mockCriar(...args),
    listar: vi.fn(),
  },
}));

vi.mock('@/contexts/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    accessToken: 'tok',
    refreshToken: 'ref',
    login: vi.fn(),
    logout: vi.fn(),
    setAccessToken: vi.fn(),
    setRefreshToken: vi.fn(),
  }),
}));

const defaultProps = {
  familiaId: 'f1',
  onNavigate: vi.fn(),
  onVerDetalhe: vi.fn(),
};

const COFRINHO_VIAGEM = {
  id: '1',
  nome: 'Viagem',
  emoji: '✈️',
  saldoAtual: '1500.00',
  metaValor: '5000.00',
  status: 'ativo' as const,
  familiaId: 'f1',
  descricao: null,
  criadoPor: 'u1',
  criadoEm: '2026-01-01',
  encerradoEm: null,
};

const COFRINHO_SEM_META = {
  id: '2',
  nome: 'Reserva',
  emoji: '🏦',
  saldoAtual: '800.00',
  metaValor: null,
  status: 'ativo' as const,
  familiaId: 'f1',
  descricao: 'Reserva emergencial',
  criadoPor: 'u1',
  criadoEm: '2026-01-01',
  encerradoEm: null,
};

const COFRINHO_META_ATINGIDA = {
  id: '3',
  nome: 'Celular',
  emoji: '📱',
  saldoAtual: '3000.00',
  metaValor: '2500.00',
  status: 'ativo' as const,
  familiaId: 'f1',
  descricao: null,
  criadoPor: 'u1',
  criadoEm: '2026-01-01',
  encerradoEm: null,
};

const mockFetchAll = vi.fn();

afterEach(() => {
  cleanup();
  useCofrinhoStore.setState({
    cofrinhos: [],
    cofrinhoSelecionado: null,
    carregando: false,
    erro: null,
  });
  vi.clearAllMocks();
});

describe('CofrinhosPage', () => {
  beforeEach(() => {
    localStorage.setItem('tour-cofrinhos', 'true');
    useCofrinhoStore.setState({
      cofrinhos: [],
      carregando: false,
      erro: null,
      fetchAll: mockFetchAll,
    });
  });

  it('exibe empty state quando não há cofrinhos', () => {
    render(<CofrinhosPage {...defaultProps} />);
    expect(screen.getByText(/ainda não tem cofrinhos/i)).toBeInTheDocument();
  });

  it('exibe botão de criar cofrinho no empty state', () => {
    render(<CofrinhosPage {...defaultProps} />);
    expect(screen.getByRole('button', { name: /criar cofrinho/i })).toBeInTheDocument();
  });

  it('exibe lista de cofrinhos ativos', () => {
    useCofrinhoStore.setState({
      cofrinhos: [COFRINHO_VIAGEM],
      carregando: false,
      erro: null,
    });
    render(<CofrinhosPage {...defaultProps} />);
    expect(screen.getByText('Viagem')).toBeInTheDocument();
    expect(screen.getByText(/1\.500/)).toBeInTheDocument();
  });

  it('exibe emoji do cofrinho', () => {
    useCofrinhoStore.setState({
      cofrinhos: [COFRINHO_VIAGEM],
      carregando: false,
      erro: null,
    });
    render(<CofrinhosPage {...defaultProps} />);
    expect(screen.getByText('✈️')).toBeInTheDocument();
  });

  it('exibe barra de progresso quando tem meta', () => {
    useCofrinhoStore.setState({
      cofrinhos: [COFRINHO_VIAGEM],
      carregando: false,
      erro: null,
    });
    render(<CofrinhosPage {...defaultProps} />);
    // BudgetBar renders percentage text
    expect(screen.getByText(/30%/)).toBeInTheDocument();
  });

  it('não exibe barra de progresso quando não tem meta', () => {
    useCofrinhoStore.setState({
      cofrinhos: [COFRINHO_SEM_META],
      carregando: false,
      erro: null,
    });
    render(<CofrinhosPage {...defaultProps} />);
    expect(screen.getByText('Reserva')).toBeInTheDocument();
    // Should not have percentage since there's no meta
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('exibe badge "Meta atingida!" quando saldo >= meta', () => {
    useCofrinhoStore.setState({
      cofrinhos: [COFRINHO_META_ATINGIDA],
      carregando: false,
      erro: null,
    });
    render(<CofrinhosPage {...defaultProps} />);
    expect(screen.getByText(/meta atingida/i)).toBeInTheDocument();
  });

  it('chama onVerDetalhe ao clicar no card', () => {
    useCofrinhoStore.setState({
      cofrinhos: [COFRINHO_VIAGEM],
      carregando: false,
      erro: null,
    });
    render(<CofrinhosPage {...defaultProps} />);
    fireEvent.click(screen.getByText('Viagem'));
    expect(defaultProps.onVerDetalhe).toHaveBeenCalledWith('1');
  });

  it('abre modal de criar ao clicar botão "+ Novo Cofrinho"', () => {
    useCofrinhoStore.setState({
      cofrinhos: [COFRINHO_VIAGEM],
      carregando: false,
      erro: null,
    });
    render(<CofrinhosPage {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /novo cofrinho/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('abre modal de criar ao clicar botão no empty state', () => {
    render(<CofrinhosPage {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /criar cofrinho/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('exibe loading quando carregando', () => {
    useCofrinhoStore.setState({
      cofrinhos: [],
      carregando: true,
      erro: null,
    });
    render(<CofrinhosPage {...defaultProps} />);
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('exibe mensagem de erro quando há erro', () => {
    useCofrinhoStore.setState({
      cofrinhos: [],
      carregando: false,
      erro: 'Erro ao carregar cofrinhos',
    });
    render(<CofrinhosPage {...defaultProps} />);
    expect(screen.getByText('Erro ao carregar cofrinhos')).toBeInTheDocument();
  });

  it('chama fetchAll ao montar', () => {
    render(<CofrinhosPage {...defaultProps} />);
    expect(mockFetchAll).toHaveBeenCalledWith('f1');
  });

  it('cria cofrinho via modal e faz refresh', async () => {
    mockCriar.mockResolvedValue({ cofrinho: COFRINHO_VIAGEM });

    render(<CofrinhosPage {...defaultProps} />);

    // Open modal
    fireEvent.click(screen.getByRole('button', { name: /criar cofrinho/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Viagem' } });

    // Submit - click "Criar" button inside modal
    const buttons = screen.getAllByRole('button');
    const criarButton = buttons.find(
      (b) => b.textContent === 'Criar' && !b.hasAttribute('aria-label'),
    );
    expect(criarButton).toBeTruthy();
    fireEvent.click(criarButton!);

    await waitFor(() => {
      expect(mockCriar).toHaveBeenCalledWith('f1', {
        nome: 'Viagem',
        emoji: null,
        descricao: null,
        metaValor: null,
      });
    });

    await waitFor(() => {
      // fetchAll called once on mount + once after create
      expect(mockFetchAll).toHaveBeenCalledTimes(2);
    });
  });

  it('exibe título "Cofrinhos"', () => {
    render(<CofrinhosPage {...defaultProps} />);
    expect(screen.getByText('Cofrinhos')).toBeInTheDocument();
  });
});
