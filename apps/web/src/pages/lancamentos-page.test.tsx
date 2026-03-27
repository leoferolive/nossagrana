import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTemplateTransacaoStore } from '@/stores/template-transacao.store';
import { LancamentosPage } from './lancamentos-page';

const mockAplicar = vi.fn();
const mockFetchTemplates = vi.fn();

vi.mock('@/services/template-transacao.service', () => ({
  templateTransacaoService: {
    listar: vi.fn(),
    aplicar: (...args: unknown[]) => mockAplicar(...args),
  },
  TemplateTransacaoService: vi.fn(),
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
};

const TEMPLATE_SALARIO = {
  id: 't1',
  familiaId: 'f1',
  nome: 'Salário',
  tipo: 'receita' as const,
  categoriaId: 'c1',
  metodoPagamentoId: null,
  cofrinhoId: null,
  ordem: 0,
  valorPadrao: '5000.00',
  ativo: true,
  criadoPor: 'u1',
  criadoEm: '2026-01-01',
  atualizadoEm: '2026-01-01',
  categoriaNome: 'Trabalho',
  metodoPagamentoNome: null,
  cofrinhoNome: null,
  cofrinhoEmoji: null,
};

const TEMPLATE_MERCADO = {
  id: 't2',
  familiaId: 'f1',
  nome: 'Mercado',
  tipo: 'despesa' as const,
  categoriaId: 'c2',
  metodoPagamentoId: null,
  cofrinhoId: null,
  ordem: 1,
  valorPadrao: '800.00',
  ativo: true,
  criadoPor: 'u1',
  criadoEm: '2026-01-01',
  atualizadoEm: '2026-01-01',
  categoriaNome: 'Alimentação',
  metodoPagamentoNome: null,
  cofrinhoNome: null,
  cofrinhoEmoji: null,
};

const TEMPLATE_COFRINHO = {
  id: 't3',
  familiaId: 'f1',
  nome: 'Viagem',
  tipo: 'despesa' as const,
  categoriaId: null,
  metodoPagamentoId: null,
  cofrinhoId: 'cf1',
  ordem: 2,
  valorPadrao: '300.00',
  ativo: true,
  criadoPor: 'u1',
  criadoEm: '2026-01-01',
  atualizadoEm: '2026-01-01',
  categoriaNome: null,
  metodoPagamentoNome: null,
  cofrinhoNome: 'Viagem',
  cofrinhoEmoji: '✈️',
};

afterEach(() => {
  cleanup();
  useTemplateTransacaoStore.setState({
    templates: [],
    valores: {},
    mesReferencia: '2026-03-01'.slice(0, 7),
    carregando: false,
    salvando: false,
    erro: null,
  });
  vi.clearAllMocks();
});

describe('LancamentosPage', () => {
  beforeEach(() => {
    useTemplateTransacaoStore.setState({
      templates: [],
      valores: {},
      mesReferencia: '2026-03',
      carregando: false,
      salvando: false,
      erro: null,
      fetchTemplates: mockFetchTemplates,
      aplicar: mockAplicar,
    });
  });

  it('exibe loading quando carregando', () => {
    useTemplateTransacaoStore.setState({
      templates: [],
      carregando: true,
      erro: null,
    });
    render(<LancamentosPage {...defaultProps} />);
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('exibe empty state quando não há templates', () => {
    render(<LancamentosPage {...defaultProps} />);
    expect(screen.getByText(/nenhum template cadastrado/i)).toBeInTheDocument();
  });

  it('chama fetchTemplates ao montar', () => {
    render(<LancamentosPage {...defaultProps} />);
    expect(mockFetchTemplates).toHaveBeenCalledWith('f1');
  });

  it('exibe lista de templates agrupados por tipo', () => {
    useTemplateTransacaoStore.setState({
      templates: [TEMPLATE_SALARIO, TEMPLATE_MERCADO],
      valores: { t1: '5000.00', t2: '800.00' },
      carregando: false,
      fetchTemplates: mockFetchTemplates,
      aplicar: mockAplicar,
    });
    render(<LancamentosPage {...defaultProps} />);
    expect(screen.getByText('Salário')).toBeInTheDocument();
    expect(screen.getByText('Mercado')).toBeInTheDocument();
    expect(screen.getAllByText(/receitas/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/alimentação/i)).toBeInTheDocument();
  });

  it('exibe template de cofrinho na seção Cofrinhos', () => {
    useTemplateTransacaoStore.setState({
      templates: [TEMPLATE_COFRINHO],
      valores: { t3: '300.00' },
      carregando: false,
      fetchTemplates: mockFetchTemplates,
      aplicar: mockAplicar,
    });
    render(<LancamentosPage {...defaultProps} />);
    expect(screen.getByText(/cofrinhos/i)).toBeInTheDocument();
    expect(screen.getByText('Viagem')).toBeInTheDocument();
    expect(screen.getByText('✈️')).toBeInTheDocument();
  });

  it('permite preencher valor de um template', () => {
    const mockSetValor = vi.fn();
    useTemplateTransacaoStore.setState({
      templates: [TEMPLATE_SALARIO],
      valores: { t1: '' },
      carregando: false,
      fetchTemplates: mockFetchTemplates,
      aplicar: mockAplicar,
      setValor: mockSetValor,
    });
    render(<LancamentosPage {...defaultProps} />);
    const input = screen.getByLabelText(/valor para salário/i);
    fireEvent.change(input, { target: { value: '5000' } });
    expect(mockSetValor).toHaveBeenCalledWith('t1', '5000');
  });

  it('botão salvar chama aplicar', async () => {
    mockAplicar.mockResolvedValue({ transacoesCriadas: 2, aportesCriados: 1, total: 3 });
    useTemplateTransacaoStore.setState({
      templates: [TEMPLATE_SALARIO],
      valores: { t1: '5000.00' },
      carregando: false,
      salvando: false,
      fetchTemplates: mockFetchTemplates,
      aplicar: mockAplicar,
    });
    render(<LancamentosPage {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /salvar lançamentos/i }));
    await waitFor(() => {
      expect(mockAplicar).toHaveBeenCalledWith('f1');
    });
  });

  it('exibe feedback de sucesso após salvar', async () => {
    mockAplicar.mockResolvedValue({ transacoesCriadas: 2, aportesCriados: 1, total: 3 });
    useTemplateTransacaoStore.setState({
      templates: [TEMPLATE_SALARIO],
      valores: { t1: '5000.00' },
      carregando: false,
      salvando: false,
      fetchTemplates: mockFetchTemplates,
      aplicar: mockAplicar,
    });
    render(<LancamentosPage {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /salvar lançamentos/i }));
    await waitFor(() => {
      expect(screen.getByText(/2 transações e 1 aportes criados/i)).toBeInTheDocument();
    });
  });

  it('exibe seletor de mês e permite navegar', () => {
    render(<LancamentosPage {...defaultProps} />);
    expect(screen.getByText(/mar 2026/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mês anterior/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/próximo mês/i)).toBeInTheDocument();
  });

  it('exibe título da página', () => {
    render(<LancamentosPage {...defaultProps} />);
    expect(screen.getByText('Lançamentos do Mês')).toBeInTheDocument();
  });
});
