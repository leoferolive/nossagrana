import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { resetAppMocks } from '@/test/app-mocks';

import { App } from './App';

afterEach(resetAppMocks);

describe('App > fluxo autenticado com familia > navegação', () => {
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
});
