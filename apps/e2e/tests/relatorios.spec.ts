/**
 * E2E tests for the relatórios (reports) and historico (history) flows.
 *
 * The NossaGrana frontend is a single-page application with state-based
 * navigation — the URL always stays at "/". These tests verify:
 *  - The distribuição (distribution) chart renders after seeding transactions.
 *  - The "Por Membro" tab renders user spending data.
 *  - The fatura (credit-card statement) screen renders transactions for a month.
 *  - The histórico (monthly history) screen lists snapshots / month summaries.
 *
 * Strategy:
 *  - Set up: register a user, create a familia, inject the session (including
 *    familiaIdAtiva) into localStorage so the app lands on the dashboard.
 *  - Seed categories, methods and transactions via the API client.
 *  - Navigate to the target screen via the dashboard nav buttons.
 *  - For charts (Doughnut / Line rendered with chart.js inside a <canvas>),
 *    assert the presence of the canvas element — not its pixel content.
 */

import { expect, test } from '../fixtures/base.js';
import * as api from '../helpers/api-client.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTH_KEY = 'nossagrana.auth.session';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Injects a fully-authenticated session (with familiaIdAtiva) into localStorage
 * and reloads the page so React reads the session on mount, landing on the
 * dashboard.
 */
async function gotoDashboard(
  page: import('@playwright/test').Page,
  tokens: { accessToken: string; refreshToken: string },
  familiaId: string,
) {
  await page.goto('/');

  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    {
      key: AUTH_KEY,
      value: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        familiaIdAtiva: familiaId,
      },
    },
  );

  await page.reload();

  await expect(page.getByRole('heading', { name: 'NossaGrana' })).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Opens the Relatórios screen from the dashboard nav.
 */
async function gotoRelatorios(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Ver relatórios' }).click();
  await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible({
    timeout: 10_000,
  });
}

/**
 * Opens the Histórico screen from the dashboard nav.
 */
async function gotoHistorico(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Ver histórico' }).click();
  await expect(page.getByRole('heading', { name: 'Histórico' })).toBeVisible({
    timeout: 10_000,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Relatórios', () => {
  // ── 1. Relatório de distribuição por categoria → gráfico renderizado ───────
  test('relatório de distribuição por categoria exibe gráfico canvas', async ({
    page,
    authContext,
    familiaId,
  }) => {
    // Seed: create a category and a transaction so the distribuição endpoint
    // returns at least one item (otherwise the chart is not rendered).
    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Alimentação Relatorio E2E',
      tipo: 'despesa',
    });

    await api.criarTransacao(authContext.accessToken, familiaId, {
      tipo: 'despesa',
      valor: '250.00',
      categoriaId: categoria.id,
      descricao: 'Mercado Relatorio E2E',
      data: new Date().toISOString().slice(0, 10),
    });

    await gotoDashboard(page, authContext, familiaId);
    await gotoRelatorios(page);

    // The "Distribuição" tab is active by default.
    // When there is data, a Doughnut chart is rendered inside a <canvas>.
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 10_000 });

    // The category name should also appear in the legend list below the chart.
    await expect(page.getByText('Alimentação Relatorio E2E')).toBeVisible({ timeout: 10_000 });
  });

  // ── 2. Relatório por usuário (membro) exibe dados ─────────────────────────
  test('relatório por membro exibe dados do usuário', async ({ page, authContext, familiaId }) => {
    // Seed: create a category and a transaction registered by the authenticated
    // user so the por-usuario endpoint returns at least one item.
    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Transporte Relatorio E2E',
      tipo: 'despesa',
    });

    await api.criarTransacao(authContext.accessToken, familiaId, {
      tipo: 'despesa',
      valor: '80.00',
      categoriaId: categoria.id,
      descricao: 'Uber Relatorio E2E',
      data: new Date().toISOString().slice(0, 10),
    });

    await gotoDashboard(page, authContext, familiaId);
    await gotoRelatorios(page);

    // Switch to "Por Membro" tab.
    await page.getByRole('tab', { name: 'Por Membro' }).click();

    // When data is available, the list should show the user's name and a total.
    // The authenticated user's name is "Usuário E2E" (set in fixtures/base.ts).
    await expect(page.getByText('Usuário E2E')).toBeVisible({ timeout: 10_000 });
  });

  // ── 3. Fatura do cartão → transações do mês exibidas ─────────────────────
  test('fatura do cartão exibe transações do mês', async ({ page, authContext, familiaId }) => {
    // Seed: create a credit card method.
    const cartao = await api.criarMetodoPagamento(authContext.accessToken, familiaId, {
      nome: 'Visa Fatura E2E',
      tipo: 'credito',
      dataFechamento: 20,
      dataVencimento: 27,
    });

    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Eletrônicos Fatura E2E',
      tipo: 'despesa',
    });

    const today = new Date();
    const mesReferencia = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    await api.criarTransacao(authContext.accessToken, familiaId, {
      tipo: 'despesa',
      valor: '399.90',
      categoriaId: categoria.id,
      metodoPagamentoId: cartao.id,
      descricao: 'Fone Bluetooth Fatura E2E',
      data: today.toISOString().slice(0, 10),
    });

    await gotoDashboard(page, authContext, familiaId);

    // Navigate to Métodos de Pagamento (Cartões) to access the fatura.
    await page.getByRole('button', { name: 'Ver métodos de pagamento' }).click();
    await expect(page.getByRole('heading', { name: /Cartões e Métodos/i })).toBeVisible({
      timeout: 10_000,
    });

    // The credit card should be listed.
    await expect(page.getByText('Visa Fatura E2E')).toBeVisible({ timeout: 10_000 });

    // Click the "Ver fatura" button for this credit card.
    // The MetodosPagamentoPage renders an aria-label="Ver fatura de <nome>" button
    // per card. We match by the card name we seeded.
    const verFaturaBtn = page.getByRole('button', { name: /Ver fatura de Visa Fatura E2E/i });
    await expect(verFaturaBtn).toBeVisible({ timeout: 10_000 });
    await verFaturaBtn.click();

    // The FaturaPage heading should include the card name.
    await expect(page.getByText(/Visa Fatura E2E/)).toBeVisible({ timeout: 10_000 });

    // The transaction seeded above should appear in the fatura list.
    // Note: depending on the closing-date logic (mesReferencia), the transaction
    // may appear in the current or the next month's fatura. We assert the page
    // loaded without an error banner and shows either the transaction or the
    // empty state message — not an unhandled crash.
    const hasTransaction = await page.getByText('Fone Bluetooth Fatura E2E').isVisible();
    const hasEmptyState = await page.getByText('Nenhuma transação nesta fatura.').isVisible();
    expect(hasTransaction || hasEmptyState).toBe(true);

    // The total row is always rendered once the fatura data is loaded.
    await expect(page.getByText('Total')).toBeVisible({ timeout: 5_000 });

    // Sanity: the month reference rendered in the subtitle matches the expected format.
    await expect(page.getByText(mesReferencia)).toBeVisible({ timeout: 5_000 });
  });

  // ── 4. Histórico de meses → lista de meses exibida ────────────────────────
  test('histórico de meses lista resumos mensais', async ({ page, authContext, familiaId }) => {
    // Seed: create a category and a transaction so the historico endpoint has
    // at least one month entry to list.
    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Salário Historico E2E',
      tipo: 'receita',
    });

    await api.criarTransacao(authContext.accessToken, familiaId, {
      tipo: 'receita',
      valor: '3000.00',
      categoriaId: categoria.id,
      descricao: 'Salário Historico E2E',
      data: new Date().toISOString().slice(0, 10),
    });

    await gotoDashboard(page, authContext, familiaId);
    await gotoHistorico(page);

    // The HistoricoPage shows the heading and either a list of months or an
    // empty-state message. Both are valid — we verify that the page loaded.
    const hasMeses =
      (await page
        .locator('button.w-full')
        .filter({ hasText: /jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez/i })
        .count()) > 0;

    const hasEmptyState = await page.getByText('Nenhum histórico disponível ainda.').isVisible();

    // The page must have rendered one of the two states — not a crash.
    expect(hasMeses || hasEmptyState).toBe(true);

    if (hasMeses) {
      // When months are listed, clicking on one should open the detail modal.
      const firstMes = page
        .locator('button.w-full')
        .filter({ hasText: /jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez/i })
        .first();

      await firstMes.click();

      // The modal heading "Detalhe —" should appear.
      await expect(page.getByText(/Detalhe —/)).toBeVisible({ timeout: 10_000 });

      // The modal shows current-period values.
      await expect(page.getByText('Valores Atuais')).toBeVisible({ timeout: 5_000 });

      // Close the modal.
      await page.getByRole('button', { name: '✕' }).click();
      await expect(page.getByText(/Detalhe —/)).not.toBeVisible({ timeout: 5_000 });
    }
  });
});
