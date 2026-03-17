import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMetodoPagamentoStore } from '@/stores/metodo-pagamento.store';
import { MetodosPagamentoPage } from './metodos-pagamento-page';

vi.mock('@/contexts/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    accessToken: 'tok',
    refreshToken: 'ref',
    login: vi.fn(),
    logout: vi.fn(),
    setAccessToken: vi.fn(),
  }),
}));

const mockListar = vi.fn();
const mockCriar = vi.fn();
const mockDesativar = vi.fn();

vi.mock('@/services/core-financeiro.service', () => ({
  metodoPagamentoService: {
    listar: (...args: unknown[]) => mockListar(...args),
    criar: (...args: unknown[]) => mockCriar(...args),
    desativar: (...args: unknown[]) => mockDesativar(...args),
  },
}));

afterEach(() => {
  cleanup();
  useMetodoPagamentoStore.setState({ metodos: [], carregando: false, erro: null });
  vi.clearAllMocks();
});

const METODOS = [
  {
    id: 'm1',
    nome: 'Nubank',
    tipo: 'credito' as const,
    dataFechamento: 15,
    dataVencimento: 22,
    usuarioDonoId: 'u1',
    ativo: true,
    familiaId: 'f1',
    criadoEm: '2026-01-01',
  },
  {
    id: 'm2',
    nome: 'Pix pessoal',
    tipo: 'pix' as const,
    dataFechamento: null,
    dataVencimento: null,
    usuarioDonoId: 'u1',
    ativo: true,
    familiaId: 'f1',
    criadoEm: '2026-01-01',
  },
];

describe('MetodosPagamentoPage', () => {
  beforeEach(() => {
    useMetodoPagamentoStore.setState({ metodos: METODOS, carregando: false, erro: null });
  });

  it('exibe lista de métodos', () => {
    mockListar.mockResolvedValue({ metodosPagamento: METODOS });
    render(<MetodosPagamentoPage familiaId="f1" onBack={vi.fn()} />);
    expect(screen.getByText('Nubank')).toBeInTheDocument();
    expect(screen.getByText('Pix pessoal')).toBeInTheDocument();
  });

  it('exibe tipo do método', () => {
    mockListar.mockResolvedValue({ metodosPagamento: METODOS });
    render(<MetodosPagamentoPage familiaId="f1" onBack={vi.fn()} />);
    // Crédito mostra info de fechamento/vencimento
    expect(screen.getByText(/fecha dia 15/i)).toBeInTheDocument();
    // Pix mostra badge de tipo
    expect(screen.getByText('pix')).toBeInTheDocument();
  });

  it('exibe datas de fechamento/vencimento para crédito', () => {
    mockListar.mockResolvedValue({ metodosPagamento: METODOS });
    render(<MetodosPagamentoPage familiaId="f1" onBack={vi.fn()} />);
    expect(screen.getByText(/fecha dia 15/i)).toBeInTheDocument();
  });

  it('abre formulário ao clicar em novo método', () => {
    mockListar.mockResolvedValue({ metodosPagamento: METODOS });
    render(<MetodosPagamentoPage familiaId="f1" onBack={vi.fn()} />);
    const addButtons = screen.getAllByRole('button', { name: /novo método/i });
    fireEvent.click(addButtons[0]);
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
  });

  it('chama onBack ao clicar em voltar', () => {
    mockListar.mockResolvedValue({ metodosPagamento: METODOS });
    const onBack = vi.fn();
    render(<MetodosPagamentoPage familiaId="f1" onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(onBack).toHaveBeenCalled();
  });

  // ── Novos testes TDD ────────────────────────────────────────────────────────

  it('chama metodoPagamentoService.listar ao montar com familiaId', async () => {
    mockListar.mockResolvedValue({ metodosPagamento: METODOS });
    render(<MetodosPagamentoPage familiaId="f1" onBack={vi.fn()} />);
    await waitFor(() => {
      expect(mockListar).toHaveBeenCalledWith('f1');
    });
  });

  it('exibe métodos retornados pelo serviço após montagem', async () => {
    useMetodoPagamentoStore.setState({ metodos: [], carregando: false, erro: null });
    mockListar.mockResolvedValue({ metodosPagamento: METODOS });
    render(<MetodosPagamentoPage familiaId="f1" onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Nubank')).toBeInTheDocument();
      expect(screen.getByText('Pix pessoal')).toBeInTheDocument();
    });
  });

  it('salvar chama metodoPagamentoService.criar e fecha formulário', async () => {
    mockListar.mockResolvedValue({ metodosPagamento: METODOS });
    const novoMetodo = {
      id: 'm3',
      nome: 'Cartão Inter',
      tipo: 'credito' as const,
      dataFechamento: 10,
      dataVencimento: 20,
      usuarioDonoId: 'u1',
      ativo: true,
      familiaId: 'f1',
      criadoEm: '2026-01-01',
    };
    mockCriar.mockResolvedValue({ metodoPagamento: novoMetodo });

    render(<MetodosPagamentoPage familiaId="f1" onBack={vi.fn()} />);

    const addButtons = screen.getAllByRole('button', { name: /novo método/i });
    fireEvent.click(addButtons[0]);

    const inputNome = screen.getByLabelText(/nome/i);
    fireEvent.change(inputNome, { target: { value: 'Cartão Inter' } });

    // tipo já é crédito por padrão, preencher fechamento e vencimento
    const inputFechamento = screen.getByLabelText(/dia de fechamento/i);
    fireEvent.change(inputFechamento, { target: { value: '10' } });

    const inputVencimento = screen.getByLabelText(/dia de vencimento/i);
    fireEvent.change(inputVencimento, { target: { value: '20' } });

    fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }));

    await waitFor(() => {
      expect(mockCriar).toHaveBeenCalledWith(
        {
          nome: 'Cartão Inter',
          tipo: 'credito',
          dataFechamento: 10,
          dataVencimento: 20,
        },
        'f1',
      );
    });

    // Formulário deve fechar após salvar
    await waitFor(() => {
      expect(screen.queryByLabelText(/nome/i)).not.toBeInTheDocument();
    });
  });

  it('desativar chama metodoPagamentoService.desativar e remove do store', async () => {
    mockListar.mockResolvedValue({ metodosPagamento: METODOS });
    mockDesativar.mockResolvedValue({ success: true });

    render(<MetodosPagamentoPage familiaId="f1" onBack={vi.fn()} />);

    const desativarButtons = screen.getAllByRole('button', { name: /desativar/i });
    fireEvent.click(desativarButtons[0]);

    await waitFor(() => {
      expect(mockDesativar).toHaveBeenCalledWith('m1', 'f1');
    });

    await waitFor(() => {
      expect(screen.queryByText('Nubank')).not.toBeInTheDocument();
    });
  });
});
