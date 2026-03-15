import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./services/core-financeiro.service', () => ({
  lazyApiClient: { request: vi.fn() },
  coreFinanceiroService: {
    getOrcamentos: vi.fn().mockResolvedValue({ orcamentos: [] }),
    getRelatorioDistribuicao: vi.fn().mockResolvedValue({ distribuicao: [] }),
    getRelatorioPorUsuario: vi.fn().mockResolvedValue({ porUsuario: [] }),
    getRelatorioTendencias: vi.fn().mockResolvedValue({ meses: [] }),
    getPerfil: vi.fn().mockResolvedValue({ nome: 'Demo', email: 'demo@example.com' }),
    getHistorico: vi.fn().mockResolvedValue({ meses: [] }),
  },
}));

vi.mock('./services/auth.service', () => ({
  authService: {
    login: vi.fn().mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' }),
    register: vi.fn().mockResolvedValue({ user: {} }),
    logout: vi.fn().mockResolvedValue(undefined),
  },
  familiaService: {
    criar: vi.fn(),
    alternar: vi.fn(),
    buscar: vi.fn(),
  },
}));

vi.mock('./contexts/use-auth', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: false,
    accessToken: null,
    refreshToken: null,
    familiaIdAtiva: null,
    login: vi.fn(),
    logout: vi.fn(),
    setAccessToken: vi.fn(),
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

import { App } from './App';

afterEach(() => {
  cleanup();
});

describe('App', () => {
  it('renders login screen', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /entrar no nossagrana/i })).toBeInTheDocument();
    expect(screen.getByText(/financas familiares em tempo real/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
    expect(screen.getByText(/não tem conta\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cadastre-se/i })).toBeInTheDocument();
  });

  it('navigates to sign up screen', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));

    expect(screen.getByRole('heading', { name: /criar conta no nossagrana/i })).toBeInTheDocument();
    expect(screen.getByText(/junte sua familia e organize tudo em um lugar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^e-mail$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^senha$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar senha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /criar conta/i })).toBeInTheDocument();
  });

  it('opens onboarding flow after sign up submit', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(
      screen.getByRole('heading', { name: /como deseja entrar na sua familia/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /criar familia/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /entrar com convite/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /buscar e solicitar/i })).toBeInTheDocument();
  });

  it('opens family settings screen from onboarding', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    fireEvent.click(screen.getByRole('button', { name: /configuracoes da familia/i }));

    expect(screen.getByRole('heading', { name: /configuracoes da familia/i })).toBeInTheDocument();
    expect(screen.getByText(/gestao de membros, convites e solicitacoes/i)).toBeInTheDocument();
  });

  it('lists members and allows removing a member in family settings', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    fireEvent.click(screen.getByRole('button', { name: /configuracoes da familia/i }));

    expect(screen.getByText(/leo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remover maria/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /remover maria/i }));

    expect(screen.queryByRole('button', { name: /remover maria/i })).not.toBeInTheDocument();
  });

  it('manages pending requests in family settings', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    fireEvent.click(screen.getByRole('button', { name: /configuracoes da familia/i }));

    expect(screen.getByRole('button', { name: /aprovar joao/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rejeitar joao/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /aprovar joao/i }));

    expect(screen.queryByRole('button', { name: /aprovar joao/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rejeitar joao/i })).not.toBeInTheDocument();
  });

  it('generates and copies invite code in family settings', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    fireEvent.click(screen.getByRole('button', { name: /configuracoes da familia/i }));

    fireEvent.click(screen.getByRole('button', { name: /gerar codigo de convite/i }));

    expect(screen.getByText(/codigo: FAM-LEO-2026/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copiar codigo/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /copiar codigo/i }));

    expect(writeText).toHaveBeenCalledWith('FAM-LEO-2026');
    expect(await screen.findByText(/codigo copiado/i)).toBeInTheDocument();
  });

  it('switches active family from onboarding selector', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(screen.getByText(/familia ativa: Familia Oliveira/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/selecionar familia ativa/i), {
      target: { value: 'familia-souza' },
    });
    fireEvent.click(screen.getByRole('button', { name: /alternar familia/i }));

    expect(screen.getByText(/familia ativa: Familia Souza/i)).toBeInTheDocument();
  });

  it('navega para dashboard ao submeter login', async () => {
    render(<App />);
    fireEvent.submit(screen.getByRole('form', { name: /login/i }));
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: /nossagrana/i }).length).toBeGreaterThan(0),
    );
    expect(screen.getAllByRole('button', { name: /nova/i }).length).toBeGreaterThan(0);
  });

  it('navega para ExtratoPage ao clicar em Extrato', async () => {
    render(<App />);
    fireEvent.submit(screen.getByRole('form', { name: /login/i }));
    await waitFor(() => screen.getByRole('button', { name: /ver extrato/i }));
    fireEvent.click(screen.getByRole('button', { name: /ver extrato/i }));
    expect(screen.getAllByRole('heading', { name: /extrato/i }).length).toBeGreaterThan(0);
  });

  it('navega para CategoriasPage ao clicar em Categorias', async () => {
    render(<App />);
    fireEvent.submit(screen.getByRole('form', { name: /login/i }));
    await waitFor(() => screen.getByRole('button', { name: /ver categorias/i }));
    fireEvent.click(screen.getByRole('button', { name: /ver categorias/i }));
    expect(screen.getByRole('heading', { name: /categorias/i })).toBeInTheDocument();
  });

  it('navega para MetodosPagamentoPage ao clicar em Cartões', async () => {
    render(<App />);
    fireEvent.submit(screen.getByRole('form', { name: /login/i }));
    await waitFor(() => screen.getByRole('button', { name: /ver métodos de pagamento/i }));
    fireEvent.click(screen.getByRole('button', { name: /ver métodos de pagamento/i }));
    expect(screen.getByRole('heading', { name: /cart.es e m.todos/i })).toBeInTheDocument();
  });

  it('navega para OrcamentoPage ao clicar em Orçamento', async () => {
    render(<App />);
    fireEvent.submit(screen.getByRole('form', { name: /login/i }));
    await waitFor(() => screen.getByRole('button', { name: /ver orçamentos/i }));
    fireEvent.click(screen.getByRole('button', { name: /ver orçamentos/i }));
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: /orçamento/i }).length).toBeGreaterThan(0),
    );
  });

  it('navega para RelatoriosPage ao clicar em Relatórios', async () => {
    render(<App />);
    fireEvent.submit(screen.getByRole('form', { name: /login/i }));
    await waitFor(() => screen.getByRole('button', { name: /ver relatórios/i }));
    fireEvent.click(screen.getByRole('button', { name: /ver relatórios/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /relatórios/i })).toBeInTheDocument(),
    );
  });

  it('navega para HistoricoPage ao clicar em Ver histórico', async () => {
    render(<App />);
    fireEvent.submit(screen.getByRole('form', { name: /login/i }));
    await waitFor(() => screen.getByRole('button', { name: /ver histórico/i }));
    fireEvent.click(screen.getByRole('button', { name: /ver histórico/i }));
    expect(screen.getAllByRole('heading', { name: /histórico/i }).length).toBeGreaterThan(0);
  });

  it('navega para ConfiguracoesPage ao clicar em Ver configurações', async () => {
    render(<App />);
    fireEvent.submit(screen.getByRole('form', { name: /login/i }));
    await waitFor(() => screen.getByRole('button', { name: /ver configurações/i }));
    fireEvent.click(screen.getByRole('button', { name: /ver configurações/i }));
    expect(screen.getAllByRole('heading', { name: /configurações/i }).length).toBeGreaterThan(0);
  });

  it('navega para PerfilPage a partir das configurações', async () => {
    render(<App />);
    fireEvent.submit(screen.getByRole('form', { name: /login/i }));
    await waitFor(() => screen.getByRole('button', { name: /ver configurações/i }));
    fireEvent.click(screen.getByRole('button', { name: /ver configurações/i }));
    fireEvent.click(screen.getByRole('button', { name: /perfil e conta/i }));
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: /perfil/i }).length).toBeGreaterThan(0),
    );
  });

  it('navega para AjudaPage a partir das configurações', async () => {
    render(<App />);
    fireEvent.submit(screen.getByRole('form', { name: /login/i }));
    await waitFor(() => screen.getByRole('button', { name: /ver configurações/i }));
    fireEvent.click(screen.getByRole('button', { name: /ver configurações/i }));
    fireEvent.click(screen.getByRole('button', { name: /ajuda/i }));
    expect(screen.getAllByRole('heading', { name: /ajuda/i }).length).toBeGreaterThan(0);
  });
});
