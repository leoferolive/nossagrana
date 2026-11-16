import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { resetAppMocks } from '@/test/app-mocks';
import { barraInferior } from '@/test/barra-inferior';
import { renderApp } from '@/test/render-app';

afterEach(resetAppMocks);

describe('App > fluxo autenticado com familia > navegação', () => {
  it('exibe dashboard ao inicializar com sessão ativa', async () => {
    renderApp();
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: /início|nossagrana/i }).length).toBeGreaterThan(
        0,
      ),
    );
    expect(screen.getAllByRole('button', { name: /nova/i }).length).toBeGreaterThan(0);
  });

  it('navega para ExtratoPage ao clicar em Extrato', async () => {
    renderApp();
    await waitFor(() => barraInferior().getByRole('link', { name: 'Extrato' }));
    fireEvent.click(barraInferior().getByRole('link', { name: 'Extrato' }));
    expect(screen.getAllByRole('heading', { name: /extrato/i }).length).toBeGreaterThan(0);
  });

  it('navega para CategoriasPage ao clicar em Categorias', async () => {
    renderApp();
    await waitFor(() => screen.getByRole('link', { name: 'Mais' }));
    fireEvent.click(screen.getByRole('link', { name: 'Mais' }));
    const main = screen.getByRole('main');
    await waitFor(() => within(main).getByRole('link', { name: 'Categorias' }));
    fireEvent.click(within(main).getByRole('link', { name: 'Categorias' }));
    expect(screen.getAllByRole('heading', { name: /categorias/i }).length).toBeGreaterThan(0);
  });

  it('navega para MetodosPagamentoPage ao clicar em Cartões', async () => {
    renderApp();
    await waitFor(() => screen.getByRole('link', { name: 'Mais' }));
    fireEvent.click(screen.getByRole('link', { name: 'Mais' }));
    const main = screen.getByRole('main');
    await waitFor(() => within(main).getByRole('link', { name: 'Métodos de pagamento' }));
    fireEvent.click(within(main).getByRole('link', { name: 'Métodos de pagamento' }));
    expect(
      screen.getAllByRole('heading', { name: /cart.es e pagamentos/i }).length,
    ).toBeGreaterThan(0);
  });

  it('navega para OrcamentoPage ao clicar em Orçamento', async () => {
    renderApp();
    await waitFor(() => screen.getByRole('link', { name: 'Limites por categoria' }));
    fireEvent.click(screen.getByRole('link', { name: 'Limites por categoria' }));
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: /orçamento/i }).length).toBeGreaterThan(0),
    );
  });

  it('navega para RelatoriosPage ao clicar em Relatórios', async () => {
    renderApp();
    await waitFor(() => screen.getByRole('link', { name: 'Relatórios' }));
    fireEvent.click(screen.getByRole('link', { name: 'Relatórios' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /relatórios/i })).toBeInTheDocument(),
    );
  });

  it('navega para HistoricoPage ao clicar em Ver histórico', async () => {
    renderApp();
    await waitFor(() => screen.getByRole('link', { name: 'Mais' }));
    fireEvent.click(screen.getByRole('link', { name: 'Mais' }));
    const main = screen.getByRole('main');
    await waitFor(() => within(main).getByRole('link', { name: 'Histórico' }));
    fireEvent.click(within(main).getByRole('link', { name: 'Histórico' }));
    expect(screen.getAllByRole('heading', { name: /histórico/i }).length).toBeGreaterThan(0);
  });

  it('abre a tela Mais ao tocar na aba Mais', async () => {
    renderApp();
    await waitFor(() => screen.getByRole('link', { name: 'Mais' }));
    fireEvent.click(screen.getByRole('link', { name: 'Mais' }));
    expect(
      within(screen.getByRole('main')).getByRole('heading', { level: 1, name: 'Mais' }),
    ).toBeInTheDocument();
  });

  it('navega para PerfilPage a partir das configurações', async () => {
    renderApp();
    await waitFor(() => screen.getByRole('link', { name: 'Mais' }));
    fireEvent.click(screen.getByRole('link', { name: 'Mais' }));
    fireEvent.click(within(screen.getByRole('main')).getByRole('link', { name: 'Perfil' }));
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: /perfil/i }).length).toBeGreaterThan(0),
    );
  });
});
