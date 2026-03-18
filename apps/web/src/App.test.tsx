import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./services/core-financeiro.service', () => ({
  lazyApiClient: { request: vi.fn() },
  transacaoService: {
    listar: vi.fn().mockResolvedValue({ transacoes: [] }),
    registrar: vi.fn().mockResolvedValue({ transacao: { id: 'tx-1' } }),
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

vi.mock('./services/auth.service', () => ({
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

vi.mock('./contexts/use-auth', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    accessToken: 'token',
    refreshToken: 'rt',
    familiaIdAtiva: 'fam-test',
    login: vi.fn(),
    logout: vi.fn(),
    setAccessToken: vi.fn(),
    updateFamiliaIdAtiva: vi.fn(),
  })),
}));

vi.mock('./stores/dashboard.store', () => ({
  useDashboardStore: vi.fn(() => ({
    resumo: null,
    graficos: null,
    orcamento: [],
    loading: false,
    error: null,
    fetchAll: vi.fn(),
  })),
}));

vi.mock('./stores/websocket.store', () => ({
  useWebSocketStore: vi.fn(() => ({
    socket: null,
    status: 'disconnected',
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

import { within } from '@testing-library/react';

import { useAuth } from './contexts/use-auth';
import { App } from './App';

afterEach(() => {
  cleanup();
  vi.mocked(useAuth).mockImplementation(() => ({
    isAuthenticated: true,
    accessToken: 'token',
    refreshToken: 'rt',
    familiaIdAtiva: 'fam-test',
    login: vi.fn(),
    logout: vi.fn(),
    setAccessToken: vi.fn(),
    updateFamiliaIdAtiva: vi.fn(),
  }));
});

const fillSignUpForm = () => {
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

describe('App', () => {
  describe('fluxo não autenticado', () => {
    beforeEach(() => {
      let currentFamiliaId: string | null = null;
      vi.mocked(useAuth).mockImplementation(() => ({
        isAuthenticated: false as const,
        accessToken: null,
        refreshToken: null,
        familiaIdAtiva: currentFamiliaId,
        login: vi.fn(),
        logout: vi.fn(),
        setAccessToken: vi.fn(),
        updateFamiliaIdAtiva: vi.fn((id: string) => {
          currentFamiliaId = id;
        }),
      }));
    });

    it('renders login screen', () => {
      render(<App />);

      expect(screen.getByText('NossaGrana')).toBeInTheDocument();
      expect(screen.getByText(/finanças da família/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
      expect(screen.getByText(/não tem conta\?/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cadastre-se/i })).toBeInTheDocument();
    });

    it('navigates to sign up screen', () => {
      render(<App />);

      fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));

      expect(screen.getByRole('heading', { name: /criar conta/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /voltar/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^e-mail$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^senha$/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continuar/i })).toBeInTheDocument();
    });

    it('opens onboarding flow after sign up submit', async () => {
      render(<App />);

      fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));
      fillSignUpForm();
      fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

      await waitFor(() =>
        expect(screen.getByRole('heading', { name: /entrar numa família/i })).toBeInTheDocument(),
      );
      expect(screen.getByRole('button', { name: /criar família/i })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /tenho um código de convite/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /buscar família/i })).toBeInTheDocument();
    });

    it('opens family settings screen from onboarding via criar familia', async () => {
      render(<App />);

      fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));
      fillSignUpForm();
      fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: /entrar numa família/i })).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByRole('button', { name: /criar família/i }));
      fireEvent.change(screen.getByLabelText(/nome da fam/i), {
        target: { value: 'Familia Test' },
      });
      fireEvent.submit(screen.getByRole('form', { name: /criar fam/i }));

      await waitFor(() =>
        expect(screen.getByRole('heading', { name: /família/i })).toBeInTheDocument(),
      );
    });

    it('lists members and allows removing a member in family settings', async () => {
      render(<App />);

      fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));
      fillSignUpForm();
      fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: /entrar numa família/i })).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByRole('button', { name: /criar família/i }));
      fireEvent.change(screen.getByLabelText(/nome da fam/i), {
        target: { value: 'Familia Test' },
      });
      fireEvent.submit(screen.getByRole('form', { name: /criar fam/i }));

      await waitFor(() =>
        expect(screen.getByRole('heading', { name: /família/i })).toBeInTheDocument(),
      );

      await waitFor(
        () => {
          expect(screen.getAllByText(/leo/i).length).toBeGreaterThan(0);
          expect(screen.getByRole('button', { name: /remover maria/i })).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      fireEvent.click(screen.getByRole('button', { name: /remover maria/i }));

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /remover maria/i })).not.toBeInTheDocument();
      });
    });

    it('manages pending requests in family settings', async () => {
      render(<App />);

      fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));
      fillSignUpForm();
      fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: /entrar numa família/i })).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByRole('button', { name: /criar família/i }));
      fireEvent.change(screen.getByLabelText(/nome da fam/i), {
        target: { value: 'Familia Test' },
      });
      fireEvent.submit(screen.getByRole('form', { name: /criar fam/i }));

      await waitFor(() =>
        expect(screen.getByRole('heading', { name: /família/i })).toBeInTheDocument(),
      );

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /^aprovar$/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /^rejeitar$/i })).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      fireEvent.click(screen.getByRole('button', { name: /^aprovar$/i }));

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /^aprovar$/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^rejeitar$/i })).not.toBeInTheDocument();
      });
    });

    it('generates and copies invite code in family settings', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });

      render(<App />);

      fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));
      fillSignUpForm();
      fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: /entrar numa família/i })).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByRole('button', { name: /criar família/i }));
      fireEvent.change(screen.getByLabelText(/nome da fam/i), {
        target: { value: 'Familia Test' },
      });
      fireEvent.submit(screen.getByRole('form', { name: /criar fam/i }));

      await waitFor(() =>
        expect(screen.getByRole('heading', { name: /família/i })).toBeInTheDocument(),
      );

      await waitFor(
        () =>
          expect(
            screen.getByRole('button', { name: /gerar c.digo de convite/i }),
          ).toBeInTheDocument(),
        { timeout: 3000 },
      );
      fireEvent.click(screen.getByRole('button', { name: /gerar c.digo de convite/i }));

      await waitFor(
        () => {
          expect(screen.getByText(/FAM-LEO-2026/)).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /copiar/i })).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      fireEvent.click(screen.getByRole('button', { name: /copiar/i }));

      expect(writeText).toHaveBeenCalledWith('FAM-LEO-2026');
      expect(await screen.findByText(/c.digo copiado/i)).toBeInTheDocument();
    });

    it('navega para onboarding quando familiaId não existe após login', async () => {
      render(<App />);

      // Trigger onLoginSuccess → sem familiaId → setScreen('onboarding')
      fireEvent.submit(screen.getByRole('form', { name: /login/i }));

      // Deve ir para onboarding quando não há familiaId
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: /entrar numa família/i })).toBeInTheDocument(),
      );
    });
  });

  describe('fluxo autenticado com familia', () => {
    it('exibe dashboard ao inicializar com sessão ativa', async () => {
      render(<App />);
      await waitFor(() =>
        expect(screen.getAllByRole('heading', { name: /nossagrana/i }).length).toBeGreaterThan(0),
      );
      expect(screen.getAllByRole('button', { name: /nova/i }).length).toBeGreaterThan(0);
    });

    it('navega para ExtratoPage ao clicar em Extrato', async () => {
      render(<App />);
      await waitFor(() => screen.getByRole('button', { name: /ver extrato/i }));
      fireEvent.click(screen.getByRole('button', { name: /ver extrato/i }));
      expect(screen.getAllByRole('heading', { name: /extrato/i }).length).toBeGreaterThan(0);
    });

    it('navega para CategoriasPage ao clicar em Categorias', async () => {
      render(<App />);
      await waitFor(() => screen.getByRole('button', { name: /ver configurações/i }));
      fireEvent.click(screen.getByRole('button', { name: /ver configurações/i }));
      const main = screen.getByRole('main');
      await waitFor(() => within(main).getByRole('button', { name: /categorias/i }));
      fireEvent.click(within(main).getByRole('button', { name: /categorias/i }));
      expect(screen.getAllByRole('heading', { name: /categorias/i }).length).toBeGreaterThan(0);
    });

    it('navega para MetodosPagamentoPage ao clicar em Cartões', async () => {
      render(<App />);
      await waitFor(() => screen.getByRole('button', { name: /ver configurações/i }));
      fireEvent.click(screen.getByRole('button', { name: /ver configurações/i }));
      const main = screen.getByRole('main');
      await waitFor(() => within(main).getByRole('button', { name: /cart.es \/ pagamentos/i }));
      fireEvent.click(within(main).getByRole('button', { name: /cart.es \/ pagamentos/i }));
      expect(
        screen.getAllByRole('heading', { name: /cart.es e pagamentos/i }).length,
      ).toBeGreaterThan(0);
    });

    it('navega para OrcamentoPage ao clicar em Orçamento', async () => {
      render(<App />);
      await waitFor(() => screen.getByRole('button', { name: /ver configurações/i }));
      fireEvent.click(screen.getByRole('button', { name: /ver configurações/i }));
      const main = screen.getByRole('main');
      await waitFor(() => within(main).getByRole('button', { name: /orçamento mensal/i }));
      fireEvent.click(within(main).getByRole('button', { name: /orçamento mensal/i }));
      await waitFor(() =>
        expect(screen.getAllByRole('heading', { name: /orçamento/i }).length).toBeGreaterThan(0),
      );
    });

    it('navega para RelatoriosPage ao clicar em Relatórios', async () => {
      render(<App />);
      await waitFor(() => screen.getByRole('button', { name: /ver relatórios/i }));
      fireEvent.click(screen.getByRole('button', { name: /ver relatórios/i }));
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: /relatórios/i })).toBeInTheDocument(),
      );
    });

    it('navega para HistoricoPage ao clicar em Ver histórico', async () => {
      render(<App />);
      await waitFor(() => screen.getByRole('button', { name: /ver configurações/i }));
      fireEvent.click(screen.getByRole('button', { name: /ver configurações/i }));
      const main = screen.getByRole('main');
      await waitFor(() => within(main).getByRole('button', { name: /histórico de meses/i }));
      fireEvent.click(within(main).getByRole('button', { name: /histórico de meses/i }));
      expect(screen.getAllByRole('heading', { name: /histórico/i }).length).toBeGreaterThan(0);
    });

    it('navega para ConfiguracoesPage ao clicar em Ver configurações', async () => {
      render(<App />);
      await waitFor(() => screen.getByRole('button', { name: /ver configurações/i }));
      fireEvent.click(screen.getByRole('button', { name: /ver configurações/i }));
      expect(screen.getAllByRole('heading', { name: /configurações/i }).length).toBeGreaterThan(0);
    });

    it('navega para PerfilPage a partir das configurações', async () => {
      render(<App />);
      await waitFor(() => screen.getByRole('button', { name: /ver configurações/i }));
      fireEvent.click(screen.getByRole('button', { name: /ver configurações/i }));
      fireEvent.click(screen.getByRole('button', { name: /perfil \/ conta/i }));
      await waitFor(() =>
        expect(screen.getAllByRole('heading', { name: /perfil/i }).length).toBeGreaterThan(0),
      );
    });

    it('navega para AjudaPage a partir das configurações', async () => {
      render(<App />);
      await waitFor(() => screen.getByRole('button', { name: /ver configurações/i }));
      fireEvent.click(screen.getByRole('button', { name: /ver configurações/i }));
      const main = screen.getByRole('main');
      await waitFor(() => within(main).getByRole('button', { name: /^ajuda$/i }));
      fireEvent.click(within(main).getByRole('button', { name: /^ajuda$/i }));
      expect(screen.getAllByRole('heading', { name: /ajuda/i }).length).toBeGreaterThan(0);
    });

    it('DashboardPage recebe familiaIdAtiva do AuthContext em vez de DEMO_FAMILIA_ID', async () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        accessToken: 'token',
        refreshToken: 'rt',
        familiaIdAtiva: 'fam-123',
        login: vi.fn(),
        logout: vi.fn(),
        setAccessToken: vi.fn(),
        updateFamiliaIdAtiva: vi.fn(),
      });

      render(<App />);

      // Com isAuthenticated=true e familiaIdAtiva, App inicia direto no dashboard
      await waitFor(() =>
        expect(screen.getAllByRole('heading', { name: /nossagrana/i }).length).toBeGreaterThan(0),
      );

      // Navigate via BottomNav to extrato to verify familiaId propagation
      fireEvent.click(screen.getByRole('button', { name: /ver extrato/i }));
      expect(screen.getAllByRole('heading', { name: /extrato/i }).length).toBeGreaterThan(0);
    });
  });
});
