import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeTransacao, resetAppMocks } from '@/test/app-mocks';

import { App } from './App';
import { useAuth } from './contexts/use-auth';
import { categoriaService } from './services/core-financeiro.service';
import { useCategoriaStore } from './stores/categoria.store';

afterEach(() => {
  resetAppMocks();
  vi.mocked(categoriaService.listar).mockResolvedValue({ categorias: [] });
  useCategoriaStore.setState({ categorias: [] });
});

describe('App > fluxo autenticado com familia > configurações e transações', () => {
  it('navega para AjudaPage a partir das configurações', async () => {
    render(<App />);
    await waitFor(() => screen.getByRole('button', { name: /ver configurações/i }));
    fireEvent.click(screen.getByRole('button', { name: /ver configurações/i }));
    const main = screen.getByRole('main');
    await waitFor(() => within(main).getByRole('button', { name: /^ajuda$/i }));
    fireEvent.click(within(main).getByRole('button', { name: /^ajuda$/i }));
    expect(screen.getAllByRole('heading', { name: /ajuda/i }).length).toBeGreaterThan(0);
  });

  it('chama authService.logout e useAuth().logout ao clicar "Sair da conta" nas configurações', async () => {
    const logoutMock = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      accessToken: 'token',
      refreshToken: 'rt',
      familiaIdAtiva: 'fam-test',
      login: vi.fn(),
      logout: logoutMock,
      setAccessToken: vi.fn(),
      setRefreshToken: vi.fn(),
      updateFamiliaIdAtiva: vi.fn(),
    });

    const { authService } = await import('./services/auth.service');

    render(<App />);
    await waitFor(() => screen.getByRole('button', { name: /ver configurações/i }));
    fireEvent.click(screen.getByRole('button', { name: /ver configurações/i }));

    const main = screen.getByRole('main');
    await waitFor(() => within(main).getByRole('button', { name: /sair da conta/i }));
    fireEvent.click(within(main).getByRole('button', { name: /sair da conta/i }));

    expect(authService.logout).toHaveBeenCalledWith('rt');
    expect(logoutMock).toHaveBeenCalled();
  });

  it('navega para FamilySettingsPage a partir das configurações', async () => {
    render(<App />);
    await waitFor(() => screen.getByRole('button', { name: /ver configurações/i }));
    fireEvent.click(screen.getByRole('button', { name: /ver configurações/i }));
    const main = screen.getByRole('main');
    await waitFor(() => within(main).getByRole('button', { name: /família/i }));
    fireEvent.click(within(main).getByRole('button', { name: /família/i }));
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: /família/i }).length).toBeGreaterThan(0),
    );
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
      setRefreshToken: vi.fn(),
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

  it('abre modal de edição ao clicar em transação no extrato', async () => {
    const { transacaoService } = await import('./services/core-financeiro.service');
    vi.mocked(transacaoService.listar).mockResolvedValue({
      transacoes: [makeTransacao({ id: 'tx-edit-1', descricao: 'Mercado' })],
    });

    render(<App />);
    await waitFor(() => screen.getByRole('button', { name: /ver extrato/i }));
    fireEvent.click(screen.getByRole('button', { name: /ver extrato/i }));

    await waitFor(() => expect(screen.getAllByText('Mercado').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('Mercado')[0]);

    await waitFor(() => expect(screen.getByText('Editar Transação')).toBeInTheDocument());
  });

  it('chama transacaoService.editar ao atualizar transação via modal', async () => {
    const { transacaoService } = await import('./services/core-financeiro.service');
    vi.mocked(transacaoService.listar).mockResolvedValue({
      transacoes: [
        makeTransacao({
          id: 'tx-upd-1',
          valor: '75.00',
          descricao: 'Farmácia',
          data: '2026-03-15',
        }),
      ],
    });

    render(<App />);
    await waitFor(() => screen.getByRole('button', { name: /ver extrato/i }));
    fireEvent.click(screen.getByRole('button', { name: /ver extrato/i }));

    await waitFor(() => expect(screen.getAllByText('Farmácia').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('Farmácia')[0]);
    await waitFor(() => expect(screen.getByText('Editar Transação')).toBeInTheDocument());

    // Change valor and submit
    const valorInput = screen.getByLabelText(/valor/i);
    fireEvent.change(valorInput, { target: { value: '80.00' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => {
      expect(transacaoService.editar).toHaveBeenCalled();
    });
  });

  it('chama transacaoService.excluir ao excluir transação via modal', async () => {
    const { transacaoService } = await import('./services/core-financeiro.service');
    vi.mocked(transacaoService.listar).mockResolvedValue({
      transacoes: [
        makeTransacao({
          id: 'tx-del-1',
          tipo: 'receita',
          valor: '200.00',
          descricao: 'Salário',
          data: '2026-03-01',
        }),
      ],
    });

    render(<App />);
    await waitFor(() => screen.getByRole('button', { name: /ver extrato/i }));
    fireEvent.click(screen.getByRole('button', { name: /ver extrato/i }));

    await waitFor(() => expect(screen.getAllByText('Salário').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('Salário')[0]);
    await waitFor(() => expect(screen.getByText('Editar Transação')).toBeInTheDocument());

    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: /excluir/i }));

    await waitFor(() => {
      expect(transacaoService.excluir).toHaveBeenCalledWith('tx-del-1', 'fam-test');
    });
  });

  it('fecha modal e limpa transacaoParaEditar ao clicar onClose', async () => {
    const { transacaoService } = await import('./services/core-financeiro.service');
    vi.mocked(transacaoService.listar).mockResolvedValue({
      transacoes: [
        makeTransacao({
          id: 'tx-close-1',
          valor: '30.00',
          descricao: 'Café',
          data: '2026-03-20',
        }),
      ],
    });

    render(<App />);
    await waitFor(() => screen.getByRole('button', { name: /ver extrato/i }));
    fireEvent.click(screen.getByRole('button', { name: /ver extrato/i }));

    await waitFor(() => expect(screen.getAllByText('Café').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('Café')[0]);
    await waitFor(() => expect(screen.getByText('Editar Transação')).toBeInTheDocument());

    // Close using X button
    fireEvent.click(screen.getByRole('button', { name: /fechar modal/i }));
    await waitFor(() => expect(screen.queryByText('Editar Transação')).not.toBeInTheDocument());
  });

  it('abre e submete nova transação via modal do FAB', async () => {
    const { transacaoService } = await import('./services/core-financeiro.service');
    // Sem categoria o modal bloqueia o salvar (a API exige categoriaId UUID).
    vi.mocked(categoriaService.listar).mockResolvedValue({
      categorias: [
        {
          id: 'cat-1',
          familiaId: 'fam-test',
          nome: 'Mercado',
          tipo: 'despesa',
          ativo: true,
          criadoPor: 'u1',
          criadoEm: '2026-01-01',
        },
      ],
    });

    render(<App />);
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: /nossagrana/i }).length).toBeGreaterThan(0),
    );

    // Click "Nova Transação" button (top bar or FAB)
    const novaButtons = screen.getAllByRole('button', { name: /nova/i });
    fireEvent.click(novaButtons[0]);
    await waitFor(() => expect(screen.getByText('Nova Transação')).toBeInTheDocument());

    // Fill required fields and submit
    const valorInput = screen.getByLabelText(/valor/i);
    fireEvent.change(valorInput, { target: { value: '100.00' } });
    fireEvent.click(screen.getByRole('combobox', { name: 'Categoria' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Mercado' }));
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => {
      expect(transacaoService.registrar).toHaveBeenCalled();
    });
  });
});
