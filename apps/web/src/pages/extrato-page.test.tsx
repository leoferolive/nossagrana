import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { transacaoService } from '@/services/core-financeiro.service';
import { useCategoriaStore } from '@/stores/categoria.store';
import { useMetodoPagamentoStore } from '@/stores/metodo-pagamento.store';
import { useTransacaoStore } from '@/stores/transacao.store';
import { ExtratoPage } from './extrato-page';

vi.mock('../components/first-time-tour', () => ({
  FirstTimeTour: ({ tourKey }: { tourKey: string }) => <div data-testid={`tour-${tourKey}`} />,
}));

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

vi.mock('@/services/core-financeiro.service', () => ({
  transacaoService: {
    listar: vi.fn(),
  },
  metodoPagamentoService: {
    listar: vi.fn().mockResolvedValue({ metodosPagamento: [] }),
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useTransacaoStore.setState({ transacoes: [], carregando: false, erro: null, filtros: {} });
  useCategoriaStore.setState({ categorias: [], carregando: false, erro: null });
  useMetodoPagamentoStore.setState({ metodos: [], carregando: false, erro: null });
});

const T = (overrides = {}) => ({
  id: 't1',
  tipo: 'despesa' as const,
  valor: '150.00',
  categoriaId: 'c1',
  descricao: 'Mercado',
  data: '2026-03-10',
  mesReferencia: '2026-03',
  metodoPagamentoId: null,
  usuarioRegistrouId: 'u1',
  recorrente: false,
  frequencia: null,
  dataFimRecorrencia: null,
  parcelado: false,
  numeroParcelas: null,
  parcelaAtual: null,
  valorTotal: null,
  valorParcela: null,
  transacaoPaiId: null,
  familiaId: 'f1',
  criadoEm: '2026-03-10T00:00:00Z',
  atualizadoEm: '2026-03-10T00:00:00Z',
  ...overrides,
});

describe('ExtratoPage', () => {
  beforeEach(() => {
    vi.mocked(transacaoService.listar).mockResolvedValue({ transacoes: [] });
    useTransacaoStore.setState({
      transacoes: [
        T({ id: 't1', valor: '150.00', descricao: 'Mercado', tipo: 'despesa' }),
        T({ id: 't2', valor: '5000.00', descricao: 'Salario', tipo: 'receita' }),
      ],
      carregando: false,
      erro: null,
      filtros: {},
    });
  });

  it('exibe lista de transações', () => {
    render(<ExtratoPage familiaId="f1" onBack={vi.fn()} onNovaTransacao={vi.fn()} />);
    expect(screen.getAllByText('Mercado').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Salario').length).toBeGreaterThan(0);
  });

  it('exibe valores formatados com sinal', () => {
    render(<ExtratoPage familiaId="f1" onBack={vi.fn()} onNovaTransacao={vi.fn()} />);
    expect(screen.getAllByText(/- R\$\s*150,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\+ R\$\s*5\.000,00/).length).toBeGreaterThan(0);
  });

  it('exibe badge "Parcela X/N" para transação parcelada', () => {
    useTransacaoStore.setState({
      transacoes: [
        T({ id: 't3', descricao: 'TV', parcelado: true, parcelaAtual: 2, numeroParcelas: 6 }),
      ],
      carregando: false,
      erro: null,
      filtros: {},
    });
    render(<ExtratoPage familiaId="f1" onBack={vi.fn()} onNovaTransacao={vi.fn()} />);
    expect(screen.getAllByText('Parcela 2/6').length).toBeGreaterThan(0);
  });

  it('exibe badge "Recorrente" para transação recorrente', () => {
    useTransacaoStore.setState({
      transacoes: [T({ id: 't4', descricao: 'Netflix', recorrente: true, frequencia: 'mensal' })],
      carregando: false,
      erro: null,
      filtros: {},
    });
    render(<ExtratoPage familiaId="f1" onBack={vi.fn()} onNovaTransacao={vi.fn()} />);
    expect(screen.getAllByText(/recorrente/i).length).toBeGreaterThan(0);
  });

  it('filtro de tipo filtra visualmente', () => {
    render(<ExtratoPage familiaId="f1" onBack={vi.fn()} onNovaTransacao={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /filtrar despesas/i }));
    expect(screen.getAllByText('Mercado').length).toBeGreaterThan(0);
  });

  it('abre modal de detalhe ao clicar na transação', () => {
    render(<ExtratoPage familiaId="f1" onBack={vi.fn()} onNovaTransacao={vi.fn()} />);
    fireEvent.click(screen.getAllByText('Mercado')[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('exibe o tour de extrato', () => {
    render(<ExtratoPage familiaId="f1" onBack={vi.fn()} onNovaTransacao={vi.fn()} />);
    expect(screen.getByTestId('tour-extrato')).toBeInTheDocument();
  });
});

describe('ExtratoPage — carregamento via API', () => {
  afterEach(() => {
    vi.clearAllMocks();
    useTransacaoStore.setState({ transacoes: [], carregando: false, erro: null, filtros: {} });
  });

  it('chama transacaoService.listar ao montar com familiaId', async () => {
    vi.mocked(transacaoService.listar).mockResolvedValue({ transacoes: [] });
    render(<ExtratoPage familiaId="f1" onBack={vi.fn()} onNovaTransacao={vi.fn()} />);
    await waitFor(() => {
      expect(transacaoService.listar).toHaveBeenCalledWith(
        expect.objectContaining({ mesReferencia: expect.any(String) }),
        'f1',
      );
    });
  });

  it('não chama transacaoService.listar quando familiaId está vazio', async () => {
    vi.mocked(transacaoService.listar).mockResolvedValue({ transacoes: [] });
    render(<ExtratoPage familiaId="" onBack={vi.fn()} onNovaTransacao={vi.fn()} />);
    await waitFor(() => {
      expect(transacaoService.listar).not.toHaveBeenCalled();
    });
  });

  it('exibe transações retornadas pela API', async () => {
    vi.mocked(transacaoService.listar).mockResolvedValue({
      transacoes: [T({ id: 'api1', descricao: 'Jantar API', valor: '80.00', tipo: 'despesa' })],
    });
    render(<ExtratoPage familiaId="f1" onBack={vi.fn()} onNovaTransacao={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getAllByText('Jantar API').length).toBeGreaterThan(0);
    });
  });

  it('exibe "Carregando..." durante o carregamento', async () => {
    let resolve: (v: { transacoes: ReturnType<typeof T>[] }) => void;
    vi.mocked(transacaoService.listar).mockImplementation(
      () =>
        new Promise((res) => {
          resolve = res;
        }),
    );
    render(<ExtratoPage familiaId="f1" onBack={vi.fn()} onNovaTransacao={vi.fn()} />);
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
    resolve!({ transacoes: [] });
  });

  it('exibe "Nenhuma transação encontrada." quando lista está vazia', async () => {
    vi.mocked(transacaoService.listar).mockResolvedValue({ transacoes: [] });
    render(<ExtratoPage familiaId="f1" onBack={vi.fn()} onNovaTransacao={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Nenhuma transação encontrada.')).toBeInTheDocument();
    });
  });

  it('exibe "Nenhuma transação encontrada." quando a API falha', async () => {
    vi.mocked(transacaoService.listar).mockRejectedValue(new Error('Erro de rede'));
    render(<ExtratoPage familiaId="f1" onBack={vi.fn()} onNovaTransacao={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Nenhuma transação encontrada.')).toBeInTheDocument();
    });
  });
});
