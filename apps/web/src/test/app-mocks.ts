import { cleanup, fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { useAuth } from '../contexts/use-auth';

vi.mock('../services/core-financeiro.service', () => ({
  lazyApiClient: { request: vi.fn() },
  transacaoService: {
    listar: vi.fn().mockResolvedValue({ transacoes: [] }),
    registrar: vi.fn().mockResolvedValue({ transacao: { id: 'tx-1' } }),
    editar: vi.fn().mockResolvedValue({ transacao: { id: 'tx-1' } }),
    excluir: vi.fn().mockResolvedValue(undefined),
  },
  categoriaService: {
    listar: vi.fn().mockResolvedValue({ categorias: [] }),
    criar: vi.fn().mockResolvedValue({ categoria: {} }),
    editar: vi.fn().mockResolvedValue({ categoria: {} }),
    desativar: vi.fn().mockResolvedValue({ success: true }),
  },
  coreFinanceiroService: {
    getOrcamentos: vi.fn().mockResolvedValue({ orcamentos: [] }),
    getRelatorioDistribuicao: vi.fn().mockResolvedValue({ distribuicao: [] }),
    getRelatorioPorUsuario: vi.fn().mockResolvedValue({ porUsuario: [] }),
    getRelatorioTendencias: vi.fn().mockResolvedValue({ meses: [] }),
    getPerfil: vi.fn().mockResolvedValue({ nome: 'Demo', email: 'demo@example.com' }),
    getHistorico: vi.fn().mockResolvedValue({ meses: [] }),
  },
  metodoPagamentoService: {
    listar: vi.fn().mockResolvedValue({ metodosPagamento: [] }),
    criar: vi.fn().mockResolvedValue({ metodoPagamento: {} }),
    desativar: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../services/auth.service', () => ({
  authService: {
    login: vi.fn().mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' }),
    register: vi.fn().mockResolvedValue({ user: {} }),
    logout: vi.fn().mockResolvedValue(undefined),
  },
  familiaService: {
    listarMinhas: vi.fn().mockResolvedValue({ familias: [] }),
    criar: vi
      .fn()
      .mockResolvedValue({ familia: { id: 'fam-1', nome: 'Test', dataCriacao: '2026-01-01' } }),
    alternar: vi.fn().mockResolvedValue({ familiaIdAtiva: 'fam-1' }),
    buscar: vi.fn(),
    entrarPorConvite: vi.fn(),
    solicitarEntrada: vi.fn(),
    listarMembros: vi.fn().mockResolvedValue({
      membros: [
        { usuarioId: 'Leo', familiaId: 'fam-test', role: 'admin', dataEntrada: '2026-01-01' },
        { usuarioId: 'Maria', familiaId: 'fam-test', role: 'membro', dataEntrada: '2026-01-02' },
      ],
    }),
    listarSolicitacoes: vi.fn().mockResolvedValue({
      solicitacoes: [
        {
          id: 'r1',
          familiaId: 'fam-test',
          usuarioId: 'Joao',
          status: 'pendente',
          solicitadoEm: '2026-01-01',
        },
      ],
    }),
    gerarConvite: vi.fn().mockResolvedValue({
      convite: {
        id: 'c1',
        codigo: 'FAM-LEO-2026',
        familiaId: 'fam-test',
        criadoPor: 'Leo',
        expiraEm: '2026-02-01',
        dataCriacao: '2026-01-01',
      },
    }),
    removerMembro: vi.fn().mockResolvedValue(undefined),
    revisarSolicitacao: vi
      .fn()
      .mockResolvedValue({ solicitacao: { id: 'r1', status: 'aprovada' } }),
  },
}));

vi.mock('../contexts/use-auth', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    accessToken: 'token',
    refreshToken: 'rt',
    familiaIdAtiva: 'fam-test',
    login: vi.fn(),
    logout: vi.fn(),
    setAccessToken: vi.fn(),
    setRefreshToken: vi.fn(),
    updateFamiliaIdAtiva: vi.fn(),
  })),
}));

// fetchAll precisa de identidade estável entre renders: DashboardPage a usa como
// dependência de useEffect (src/pages/dashboard-page.tsx). Uma factory que cria um
// vi.fn() novo a cada chamada do hook quebra essa estabilidade e, combinada com o
// fetchAll real (não mockado) de useCofrinhoStore disparando set() a cada chamada,
// gera um loop infinito de render que trava o event loop nos testes.
const dashboardFetchAll = vi.fn();
vi.mock('../stores/dashboard.store', () => ({
  useDashboardStore: vi.fn(() => ({
    resumo: null,
    graficos: null,
    orcamento: [],
    loading: false,
    error: null,
    fetchAll: dashboardFetchAll,
  })),
}));

const websocketConnect = vi.fn();
const websocketDisconnect = vi.fn();
vi.mock('../stores/websocket.store', () => ({
  useWebSocketStore: vi.fn(() => ({
    socket: null,
    status: 'disconnected',
    connect: websocketConnect,
    disconnect: websocketDisconnect,
  })),
}));

export const makeTransacao = (overrides: Record<string, unknown> = {}) => ({
  id: 'tx-1',
  tipo: 'despesa' as const,
  valor: '50.00',
  categoriaId: 'cat-1',
  descricao: 'Transação',
  data: '2026-03-10',
  mesReferencia: '2026-03',
  metodoPagamentoId: null,
  familiaId: 'fam-test',
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
  criadoEm: '2026-03-10T00:00:00Z',
  atualizadoEm: '2026-03-10T00:00:00Z',
  ...overrides,
});

export const resetAppMocks = () => {
  cleanup();
  vi.clearAllMocks();
  vi.mocked(useAuth).mockImplementation(() => ({
    isAuthenticated: true,
    accessToken: 'token',
    refreshToken: 'rt',
    familiaIdAtiva: 'fam-test',
    login: vi.fn(),
    logout: vi.fn(),
    setAccessToken: vi.fn(),
    setRefreshToken: vi.fn(),
    updateFamiliaIdAtiva: vi.fn(),
  }));
};

export const fillSignUpForm = () => {
  fireEvent.change(screen.getByLabelText(/nome/i), {
    target: { value: 'João Silva' },
  });
  fireEvent.change(screen.getByLabelText(/^e-mail$/i), {
    target: { value: 'joao@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^senha$/i), {
    target: { value: 'senha12345' },
  });
};
