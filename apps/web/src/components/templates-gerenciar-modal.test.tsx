import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCategoriaStore } from '@/stores/categoria.store';
import { useCofrinhoStore } from '@/stores/cofrinho.store';
import { useTemplateTransacaoStore } from '@/stores/template-transacao.store';

import { TemplatesGerenciarModal } from './templates-gerenciar-modal';

const mockCriar = vi.fn();
const mockEditar = vi.fn();
const mockExcluir = vi.fn();
const mockFetchTemplates = vi.fn();

vi.mock('@/services/template-transacao.service', () => ({
  templateTransacaoService: {
    criar: (...args: unknown[]) => mockCriar(...args),
    editar: (...args: unknown[]) => mockEditar(...args),
    excluir: (...args: unknown[]) => mockExcluir(...args),
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

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  familiaId: 'f1',
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  useTemplateTransacaoStore.setState({
    templates: [],
    valores: {},
    mesReferencia: '2026-03',
    carregando: false,
    salvando: false,
    erro: null,
    fetchTemplates: mockFetchTemplates,
  });
  useCategoriaStore.setState({ categorias: [], carregando: false, erro: null });
  useCofrinhoStore.setState({ cofrinhos: [], cofrinhoSelecionado: null, carregando: false, erro: null });
});

describe('TemplatesGerenciarModal', () => {
  it('não renderiza quando fechado', () => {
    render(<TemplatesGerenciarModal {...defaultProps} open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renderiza o modal quando aberto', () => {
    render(<TemplatesGerenciarModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Gerenciar Templates')).toBeInTheDocument();
  });

  it('renderiza lista de templates quando aberto', () => {
    useTemplateTransacaoStore.setState({
      templates: [TEMPLATE_SALARIO, TEMPLATE_MERCADO],
      fetchTemplates: mockFetchTemplates,
    });
    render(<TemplatesGerenciarModal {...defaultProps} />);
    expect(screen.getByText('Salário')).toBeInTheDocument();
    expect(screen.getByText('Mercado')).toBeInTheDocument();
  });

  it('mostra as seções Receitas e Despesas', () => {
    render(<TemplatesGerenciarModal {...defaultProps} />);
    expect(screen.getByText(/receitas/i)).toBeInTheDocument();
    expect(screen.getByText(/despesas/i)).toBeInTheDocument();
  });

  it('chama fetchTemplates ao abrir', () => {
    render(<TemplatesGerenciarModal {...defaultProps} />);
    expect(mockFetchTemplates).toHaveBeenCalledWith('f1');
  });

  it('mostra botão "Adicionar"', () => {
    render(<TemplatesGerenciarModal {...defaultProps} />);
    expect(screen.getByLabelText('Adicionar template')).toBeInTheDocument();
  });

  it('exibe formulário de criação ao clicar em "Adicionar"', () => {
    render(<TemplatesGerenciarModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Adicionar template'));
    expect(screen.getByLabelText('Nome')).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo')).toBeInTheDocument();
  });

  it('cria template via formulário', async () => {
    mockCriar.mockResolvedValue({ template: { id: 'new-t', nome: 'Novo', tipo: 'receita' } });
    mockFetchTemplates.mockResolvedValue(undefined);

    render(<TemplatesGerenciarModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Adicionar template'));

    const nomeInput = screen.getByLabelText('Nome');
    fireEvent.change(nomeInput, { target: { value: 'Novo Template' } });

    const tipoSelect = screen.getByLabelText('Tipo');
    fireEvent.change(tipoSelect, { target: { value: 'receita' } });

    fireEvent.click(screen.getByLabelText('Salvar template'));

    await waitFor(() => {
      expect(mockCriar).toHaveBeenCalledWith('f1', expect.objectContaining({ nome: 'Novo Template', tipo: 'receita' }));
    });
    await waitFor(() => {
      expect(mockFetchTemplates).toHaveBeenCalledWith('f1');
    });
  });

  it('não cria template com nome vazio', () => {
    render(<TemplatesGerenciarModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Adicionar template'));
    fireEvent.click(screen.getByLabelText('Salvar template'));
    expect(mockCriar).not.toHaveBeenCalled();
  });

  it('cancela criação ao clicar em Cancelar', () => {
    render(<TemplatesGerenciarModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Adicionar template'));
    expect(screen.getByLabelText('Nome')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Cancelar criação'));
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument();
  });

  it('desativa template ao clicar em excluir e confirmar', async () => {
    mockExcluir.mockResolvedValue(undefined);
    mockFetchTemplates.mockResolvedValue(undefined);

    useTemplateTransacaoStore.setState({
      templates: [TEMPLATE_SALARIO],
      fetchTemplates: mockFetchTemplates,
    });
    render(<TemplatesGerenciarModal {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('Excluir Salário'));
    expect(screen.getByLabelText('Confirmar exclusão')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Confirmar exclusão'));

    await waitFor(() => {
      expect(mockExcluir).toHaveBeenCalledWith('f1', 't1');
    });
    await waitFor(() => {
      expect(mockFetchTemplates).toHaveBeenCalledWith('f1');
    });
  });

  it('cancela exclusão ao clicar em Cancelar exclusão', () => {
    useTemplateTransacaoStore.setState({
      templates: [TEMPLATE_SALARIO],
      fetchTemplates: mockFetchTemplates,
    });
    render(<TemplatesGerenciarModal {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('Excluir Salário'));
    expect(screen.getByLabelText('Confirmar exclusão')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Cancelar exclusão'));
    expect(screen.queryByLabelText('Confirmar exclusão')).not.toBeInTheDocument();
  });

  it('exibe formulário de edição ao clicar em editar', () => {
    useTemplateTransacaoStore.setState({
      templates: [TEMPLATE_SALARIO],
      fetchTemplates: mockFetchTemplates,
    });
    render(<TemplatesGerenciarModal {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('Editar Salário'));
    expect(screen.getByLabelText('Nome do template')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Salário')).toBeInTheDocument();
  });

  it('edita template ao submeter formulário de edição', async () => {
    mockEditar.mockResolvedValue({ template: { ...TEMPLATE_SALARIO, nome: 'Salário Editado' } });
    mockFetchTemplates.mockResolvedValue(undefined);

    useTemplateTransacaoStore.setState({
      templates: [TEMPLATE_SALARIO],
      fetchTemplates: mockFetchTemplates,
    });
    render(<TemplatesGerenciarModal {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('Editar Salário'));
    const nomeInput = screen.getByLabelText('Nome do template');
    fireEvent.change(nomeInput, { target: { value: 'Salário Editado' } });

    fireEvent.click(screen.getByLabelText('Salvar edição'));

    await waitFor(() => {
      expect(mockEditar).toHaveBeenCalledWith('f1', 't1', expect.objectContaining({ nome: 'Salário Editado' }));
    });
  });

  it('fecha o modal ao clicar no botão Fechar', () => {
    const onClose = vi.fn();
    render(<TemplatesGerenciarModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Fechar modal'));
    expect(onClose).toHaveBeenCalled();
  });

  it('exibe empty state quando não há receitas', () => {
    render(<TemplatesGerenciarModal {...defaultProps} />);
    expect(screen.getByText('Nenhuma receita cadastrada.')).toBeInTheDocument();
  });

  it('exibe cofrinho no select apenas para despesas', () => {
    useCofrinhoStore.setState({
      cofrinhos: [{ id: 'cf1', familiaId: 'f1', nome: 'Viagem', emoji: '✈️', descricao: null, metaValor: null, saldoAtual: '0', ativo: true, criadoPor: 'u1', criadoEm: '2026-01-01', atualizadoEm: '2026-01-01' }],
      cofrinhoSelecionado: null,
      carregando: false,
      erro: null,
    });

    render(<TemplatesGerenciarModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Adicionar template'));

    // Change tipo to despesa to show cofrinho
    const tipoSelect = screen.getByLabelText('Tipo');
    fireEvent.change(tipoSelect, { target: { value: 'despesa' } });

    expect(screen.getByLabelText('Cofrinho')).toBeInTheDocument();

    // Change to receita - cofrinho should disappear
    fireEvent.change(tipoSelect, { target: { value: 'receita' } });
    expect(screen.queryByLabelText('Cofrinho')).not.toBeInTheDocument();
  });
});
