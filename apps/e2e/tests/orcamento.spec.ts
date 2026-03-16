/**
 * E2E tests for the orçamento (budget) flows.
 *
 * The NossaGrana frontend is a single-page application with state-based
 * navigation — the URL always stays at "/". These tests verify that budget
 * limits can be defined per category, that visual indicators appear when
 * spending exceeds the limit, and that the dashboard reflects budget progress.
 *
 * Strategy:
 *  - Set up: register a user, create a familia, inject the session (including
 *    familiaIdAtiva) into localStorage so the app lands on the dashboard.
 *  - Seed categories and transactions via the API client before the UI flow.
 *  - Navigate to the Orçamento screen from the dashboard nav button.
 *  - Assert UI state (progress bar, status indicators, saved values).
 */

import { expect, test } from '../fixtures/base.js';
import * as api from '../helpers/api-client.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = process.env.API_URL ?? 'http://localhost:3000';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal shape of the authContext fixture used in navigation helpers. */
interface AuthCtx {
  accessToken: string;
  refreshToken: string;
  password: string;
  user: { id: string; nome: string; email: string };
}

/**
 * Injects auth tokens and familiaIdAtiva into localStorage, reloads the page
 * so the App.tsx lazy initializer reads the session and navigates directly to
 * screen = 'dashboard'.
 */
async function gotoDashboard(
  page: import('@playwright/test').Page,
  ctx: AuthCtx,
  familiaId: string,
) {
  await page.goto('/');
  await page.evaluate(
    ([accessToken, refreshToken, fid]) => {
      localStorage.setItem(
        'nossagrana.auth.session',
        JSON.stringify({ accessToken, refreshToken, familiaIdAtiva: fid }),
      );
      // Suppress all first-time tours so they do not block UI interactions.
      for (const key of [
        'dashboard',
        'extrato',
        'historico',
        'orcamento',
        'configuracoes',
        'perfil',
      ]) {
        localStorage.setItem(`tour-${key}`, 'true');
      }
    },
    [ctx.accessToken, ctx.refreshToken, familiaId],
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'NossaGrana', exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Opens the Orçamento screen from the dashboard nav.
 */
async function gotoOrcamento(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Ver orçamentos' }).click();
  await expect(page.getByRole('heading', { name: 'Orçamento', level: 1 })).toBeVisible({
    timeout: 10_000,
  });
}

/**
 * Sets a budget limit for a given category via the API.
 */
async function setOrcamentoViaApi(
  page: import('@playwright/test').Page,
  token: string,
  familiaId: string,
  categoriaId: string,
  valorLimite: string,
) {
  const now = new Date();
  const mesReferencia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  await page.request.post(`${BASE_URL}/api/orcamento/${categoriaId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-familia-id': familiaId,
      'Content-Type': 'application/json',
    },
    data: {
      valorLimite,
      vigenciaInicio: mesReferencia,
    },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Orçamento', () => {
  // ── 1. Definir limite por categoria ───────────────────────────────────────
  test('definir limite por categoria salva com sucesso', async ({
    page,
    authContext,
    familiaId,
  }) => {
    // Seed: create an expense category and a budget limit via the API so the
    // Orçamento screen has at least one item to display.
    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Alimentação Orçamento E2E',
      tipo: 'despesa',
    });

    // Set an initial budget limit via the API so the item appears in the list.
    await setOrcamentoViaApi(page, authContext.accessToken, familiaId, categoria.id, '500.00');

    await gotoDashboard(page, authContext, familiaId);
    await gotoOrcamento(page);

    // The category should be listed with a budget item.
    await expect(page.getByText('Alimentação Orçamento E2E').first()).toBeVisible({
      timeout: 10_000,
    });

    // Click "Editar limite" for that category.
    await page.getByRole('button', { name: 'Editar limite' }).first().click();

    // The inline editing form should appear with an input.
    const input = page.getByLabel('Novo limite');
    await expect(input).toBeVisible({ timeout: 5_000 });

    // Clear and type a new limit.
    await input.clear();
    await input.fill('800');

    // Submit.
    await page.getByRole('button', { name: 'Salvar' }).click();

    // The input should disappear (form closes) and the category still visible.
    await expect(input).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Alimentação Orçamento E2E').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  // ── 2. Despesas que ultrapassam o limite exibem indicador visual ───────────
  test('despesas que ultrapassam o limite exibem indicador visual', async ({
    page,
    authContext,
    familiaId,
  }) => {
    // Seed: create a category and a tight budget limit (R$ 10).
    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Lazer Orçamento E2E',
      tipo: 'despesa',
    });

    await setOrcamentoViaApi(page, authContext.accessToken, familiaId, categoria.id, '10.00');

    // Create a transaction that exceeds the limit (R$ 150 > R$ 10).
    await api.criarTransacao(authContext.accessToken, familiaId, {
      tipo: 'despesa',
      valor: '150.00',
      categoriaId: categoria.id,
      descricao: 'Gasto acima do limite E2E',
      data: new Date().toISOString().slice(0, 10),
    });

    await gotoDashboard(page, authContext, familiaId);
    await gotoOrcamento(page);

    // The category should appear in the list.
    await expect(page.getByText('Lazer Orçamento E2E')).toBeVisible({ timeout: 10_000 });

    // The percentage label should be >= 100% when exceeded. We look for text
    // matching "100%" or higher to confirm the "exceeded" status is reflected.
    // The component renders `{item.percentual.toFixed(0)}%`.
    // We verify the progress bar has the danger class by checking that the
    // OrcamentoItem card for this category contains the danger color div.
    const itemCard = page.locator('.rounded-xl').filter({ hasText: 'Lazer Orçamento E2E' });
    await expect(itemCard).toBeVisible({ timeout: 5_000 });

    // The progress bar inner div should have bg-danger class (status = exceeded).
    // We locate the progress bar fill inside this card.
    const progressFill = itemCard.locator('div.h-2.rounded-full').nth(1);
    await expect(progressFill).toHaveClass(/bg-danger/, { timeout: 5_000 });
  });

  // ── 3. Dashboard mostra progresso do orçamento ─────────────────────────────
  test('dashboard mostra progresso do orçamento configurado', async ({
    page,
    authContext,
    familiaId,
  }) => {
    // Seed: create a category and a budget limit so the dashboard section is
    // populated (otherwise it shows "Nenhum orçamento configurado").
    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Saúde Dashboard E2E',
      tipo: 'despesa',
    });

    await setOrcamentoViaApi(page, authContext.accessToken, familiaId, categoria.id, '300.00');

    // Create a transaction so there's spending progress to show.
    await api.criarTransacao(authContext.accessToken, familiaId, {
      tipo: 'despesa',
      valor: '120.00',
      categoriaId: categoria.id,
      descricao: 'Farmácia E2E',
      data: new Date().toISOString().slice(0, 10),
    });

    await gotoDashboard(page, authContext, familiaId);

    // The dashboard ORÇAMENTO section should list the category and a progress
    // bar. We assert that the section heading is visible and that the category
    // name appears inside it.
    const orcamentoSection = page.locator('.rounded-xl').filter({ hasText: 'ORÇAMENTO' });
    await expect(orcamentoSection).toBeVisible({ timeout: 10_000 });
    await expect(orcamentoSection.getByText('Saúde Dashboard E2E')).toBeVisible({
      timeout: 10_000,
    });

    // A progress bar element should be present inside the section.
    const progressBar = orcamentoSection.locator('.h-1\\.5.w-full.rounded-full');
    await expect(progressBar.first()).toBeVisible({ timeout: 5_000 });
  });
});
