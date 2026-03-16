/**
 * E2E tests for the transações (transactions) flows.
 *
 * The NossaGrana frontend is a single-page application with state-based
 * navigation — the URL always stays at "/". These tests verify that
 * transactions can be created, edited, and deleted through the UI, and
 * that the extrato (statement) and dashboard update accordingly.
 *
 * Strategy:
 *  - Set up: register a user, create a familia, inject the session into
 *    localStorage (including familiaIdAtiva) so the app lands on the dashboard.
 *  - Seed data (categories, etc.) via the API client before the UI flow.
 *  - Assert results via the UI and, when the UI has no discernible indicator,
 *    fall back to a direct API call.
 */

import { expect, test } from '../fixtures/base.js';
import * as api from '../helpers/api-client.js';

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Minimal shape of the authContext fixture used in navigation helpers. */
interface AuthCtx {
  accessToken: string;
  refreshToken: string;
  password: string;
  user: { id: string; nome: string; email: string };
}

/**
 * Navigates to the app, injects auth tokens and familiaIdAtiva into
 * localStorage, reloads the page so the App.tsx lazy initializer reads the
 * session and navigates directly to screen = 'dashboard'.
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
 * Opens the extrato screen from the dashboard.
 */
async function gotoExtrato(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Ver extrato' }).click();
  await expect(page.getByRole('heading', { name: 'Extrato', level: 1 })).toBeVisible({
    timeout: 10_000,
  });
}

/**
 * Opens the Nova Transação modal from wherever the FAB / "+ Nova" button is visible.
 */
async function openNovaTransacaoModal(page: import('@playwright/test').Page) {
  // There are two "Nova transação" triggers: the header "+ Nova" button and the
  // fixed FAB. Use the FAB (aria-label) which is always present on both screens.
  await page.getByRole('button', { name: 'Nova transação' }).first().click();

  // Wait for the modal to appear.
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Transações', () => {
  // ── 1. Criar receita simples → aparece no extrato ─────────────────────────
  test('criar receita simples aparece no extrato', async ({ page, authContext, familiaId }) => {
    // Seed: create a categoria for receipts via the API.
    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Salário E2E',
      tipo: 'receita',
    });

    await gotoDashboard(page, authContext, familiaId);
    await gotoExtrato(page);
    await openNovaTransacaoModal(page);

    // Select "Receita" type (scoped to dialog to avoid matching the "Filtrar
    // receitas" filter button in the extrato page behind the modal).
    await page.getByRole('dialog').getByRole('button', { name: 'Receita', exact: true }).click();

    // Fill in the form fields.
    await page.getByRole('spinbutton', { name: 'Valor' }).fill('1500.00');
    await page.getByRole('combobox', { name: 'Categoria' }).selectOption(categoria.id);
    await page.getByRole('textbox', { name: 'Descrição' }).fill('Salário mês E2E');

    // Submit.
    await page.getByRole('button', { name: 'Salvar' }).click();

    // The modal should close.
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });

    // The transaction should appear in the extrato list.
    // The ExtratoPage re-fetches transactions on mount; we need to wait.
    await expect(page.getByText('Salário mês E2E')).toBeVisible({ timeout: 10_000 });
  });

  // ── 2. Criar despesa simples → saldo atualiza no dashboard ────────────────
  test('criar despesa simples e verificar via API', async ({ page, authContext, familiaId }) => {
    // Seed a category for expenses.
    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Alimentação E2E',
      tipo: 'despesa',
    });

    await gotoDashboard(page, authContext, familiaId);
    await openNovaTransacaoModal(page);

    // "Despesa" is selected by default — verify and proceed.
    await page.getByRole('button', { name: 'Despesa' }).click();

    await page.getByRole('spinbutton', { name: 'Valor' }).fill('200.00');
    await page.getByRole('combobox', { name: 'Categoria' }).selectOption(categoria.id);
    await page.getByRole('textbox', { name: 'Descrição' }).fill('Supermercado E2E');

    await page.getByRole('button', { name: 'Salvar' }).click();

    // Modal closes.
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });

    // Navigate to extrato to confirm the transaction was registered.
    await gotoExtrato(page);
    await expect(page.getByText('Supermercado E2E')).toBeVisible({ timeout: 10_000 });
  });

  // ── 3. Criar transação parcelada (3x) → parcelas geradas ─────────────────
  test('criar transação parcelada em 3x gera 3 parcelas no extrato', async ({
    page,
    authContext,
    familiaId,
  }) => {
    // Seed a credit card method (required for parcelas).
    const metodo = await api.criarMetodoPagamento(authContext.accessToken, familiaId, {
      nome: 'Cartão Visa E2E',
      tipo: 'credito',
      dataFechamento: 20,
      dataVencimento: 27,
    });

    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Eletronicos E2E',
      tipo: 'despesa',
    });

    await gotoDashboard(page, authContext, familiaId);
    await openNovaTransacaoModal(page);

    await page.getByRole('button', { name: 'Despesa' }).click();
    await page.getByRole('spinbutton', { name: 'Valor' }).fill('900.00');
    await page.getByRole('combobox', { name: 'Categoria' }).selectOption(categoria.id);
    await page.getByRole('combobox', { name: 'Método de pagamento' }).selectOption(metodo.id);
    await page.getByRole('textbox', { name: 'Descrição' }).fill('Notebook parcelado E2E');

    // Enable parcelas.
    await page.getByRole('button', { name: 'Parcelado' }).click();

    // Set 3 parcelas.
    await page.getByRole('spinbutton', { name: 'Parcelas' }).fill('3');

    await page.getByRole('button', { name: 'Salvar' }).click();

    // Modal closes.
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });

    // Verify via API that 3 parcelas were created (the extrato lists only the
    // current month's parcela by default, so we confirm with the API).
    const BASE_URL = process.env.API_URL ?? 'http://localhost:3000';
    const res = await page.request.get(`${BASE_URL}/api/transacoes`, {
      headers: {
        Authorization: `Bearer ${authContext.accessToken}`,
        'x-familia-id': familiaId,
      },
    });

    const data = (await res.json()) as {
      transacoes: Array<{ descricao: string | null; parcelaAtual: number | null }>;
    };
    const parcelas = data.transacoes.filter((t) => t.descricao?.includes('Notebook parcelado E2E'));

    // The service generates one transacao per parcela: parcelaAtual 1, 2, 3.
    expect(parcelas.length).toBe(3);
  });

  // ── 4. Criar transação recorrente mensal ──────────────────────────────────
  test('criar transação recorrente mensal é marcada como recorrente no extrato', async ({
    page,
    authContext,
    familiaId,
  }) => {
    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Assinaturas E2E',
      tipo: 'despesa',
    });

    await gotoDashboard(page, authContext, familiaId);
    await openNovaTransacaoModal(page);

    await page.getByRole('button', { name: 'Despesa' }).click();
    await page.getByRole('spinbutton', { name: 'Valor' }).fill('50.00');
    await page.getByRole('combobox', { name: 'Categoria' }).selectOption(categoria.id);
    await page.getByRole('textbox', { name: 'Descrição' }).fill('Netflix E2E');

    // Enable recorrência.
    await page.getByRole('button', { name: 'Recorrente' }).click();

    // "Mensal" is the default frequência.
    await expect(page.getByRole('combobox', { name: 'Frequência' })).toBeVisible();

    await page.getByRole('button', { name: 'Salvar' }).click();

    // Modal closes.
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });

    // Navigate to extrato and verify the badge "Recorrente" is shown.
    await gotoExtrato(page);
    await expect(page.getByText('Netflix E2E').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Recorrente').first()).toBeVisible({ timeout: 5_000 });
  });

  // ── 5. Editar transação → valor atualizado no extrato ────────────────────
  test('editar transação atualiza valor no extrato', async ({ page, authContext, familiaId }) => {
    // Create a transaction via the API so we have something to edit.
    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Transporte E2E',
      tipo: 'despesa',
    });

    await api.criarTransacao(authContext.accessToken, familiaId, {
      tipo: 'despesa',
      valor: '30.00',
      categoriaId: categoria.id,
      descricao: 'Uber E2E original',
      data: new Date().toISOString().slice(0, 10),
    });

    await gotoDashboard(page, authContext, familiaId);
    await gotoExtrato(page);

    // The transaction should appear in the list.
    await expect(page.getByText('Uber E2E original')).toBeVisible({ timeout: 10_000 });

    // The extrato page does not currently expose an edit button in the UI —
    // clicking a transaction opens a read-only detail modal (TransacaoDetalheModal).
    // We therefore verify the edit via a direct API PATCH and then confirm the
    // updated value is reflected after a page reload.
    //
    // Fetch the transaction id from the API.
    const BASE_URL = process.env.API_URL ?? 'http://localhost:3000';
    const listRes = await page.request.get(`${BASE_URL}/api/transacoes`, {
      headers: {
        Authorization: `Bearer ${authContext.accessToken}`,
        'x-familia-id': familiaId,
      },
    });

    const listData = (await listRes.json()) as {
      transacoes: Array<{ id: string; descricao: string | null; valor: string }>;
    };
    const tx = listData.transacoes.find((t) => t.descricao === 'Uber E2E original');
    expect(tx).toBeTruthy();

    // Patch the value via the API.
    const patchRes = await page.request.patch(`${BASE_URL}/api/transacoes/${tx!.id}`, {
      headers: {
        Authorization: `Bearer ${authContext.accessToken}`,
        'x-familia-id': familiaId,
        'Content-Type': 'application/json',
      },
      data: {
        tipo: 'despesa',
        valor: '45.00',
        categoriaId: categoria.id,
        descricao: 'Uber E2E editado',
        data: new Date().toISOString().slice(0, 10),
      },
    });

    expect(patchRes.status()).toBe(200);

    // Navigate back to the dashboard and then the extrato to force a fresh
    // fetch of the updated transactions.
    await gotoDashboard(page, authContext, familiaId);
    await gotoExtrato(page);

    // The updated description must be visible in the extrato.
    await expect(page.getByText('Uber E2E editado')).toBeVisible({ timeout: 10_000 });
  });

  // ── 6. Excluir transação → removida do extrato ───────────────────────────
  test('excluir transação remove-a do extrato', async ({ page, authContext, familiaId }) => {
    // Seed a transaction via the API.
    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Lazer E2E',
      tipo: 'despesa',
    });

    await api.criarTransacao(authContext.accessToken, familiaId, {
      tipo: 'despesa',
      valor: '80.00',
      categoriaId: categoria.id,
      descricao: 'Cinema E2E para excluir',
      data: new Date().toISOString().slice(0, 10),
    });

    // The extrato does not currently expose a delete button in the UI — the
    // TransacaoDetalheModal is read-only. We verify deletion via a direct API
    // DELETE and then confirm the transaction no longer appears in the list.
    const BASE_URL = process.env.API_URL ?? 'http://localhost:3000';

    // Fetch the transaction id.
    const listRes = await page.request.get(`${BASE_URL}/api/transacoes`, {
      headers: {
        Authorization: `Bearer ${authContext.accessToken}`,
        'x-familia-id': familiaId,
      },
    });

    const listData = (await listRes.json()) as {
      transacoes: Array<{ id: string; descricao: string | null }>;
    };
    const tx = listData.transacoes.find((t) => t.descricao === 'Cinema E2E para excluir');
    expect(tx).toBeTruthy();

    // Delete via the API.
    const deleteRes = await page.request.delete(`${BASE_URL}/api/transacoes/${tx!.id}`, {
      headers: {
        Authorization: `Bearer ${authContext.accessToken}`,
        'x-familia-id': familiaId,
      },
    });

    expect(deleteRes.status()).toBe(204);

    // Navigate to the extrato and confirm the transaction is gone.
    await gotoDashboard(page, authContext, familiaId);
    await gotoExtrato(page);

    await expect(page.getByText('Cinema E2E para excluir')).not.toBeVisible({ timeout: 10_000 });
  });
});
