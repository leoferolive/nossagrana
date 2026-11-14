/**
 * E2E tests for authentication flows.
 *
 * The NossaGrana frontend is a single-page application with state-based
 * navigation — the URL stays at "/" for all screens. These tests interact
 * with the real UI to verify login, registration, protected route access,
 * and logout behaviour.
 */

import { expect, test } from '../fixtures/base.js';
import { abrirAppAutenticado, API_URL, storageSemToken } from '../helpers/session.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Autenticação', () => {
  // ── 1. Registro com dados válidos ──────────────────────────────────────────
  test('registro com dados válidos redireciona para onboarding', async ({ page }) => {
    await page.goto('/');

    // The default screen is login; navigate to the sign-up form.
    await page.getByRole('button', { name: 'Cadastre-se' }).click();

    // Fill in the registration form.
    const ts = Date.now();
    const email = `e2e+reg+${ts}@test.com`;

    await page.getByLabel('Nome completo').fill('Usuário E2E Registro');
    await page.getByLabel('E-mail').fill(email);
    // Use exact:true to avoid matching 'Confirmar senha' (partial match would
    // resolve to 2 elements and cause a strict-mode violation).
    await page.getByLabel('Senha', { exact: true }).fill('Senha@E2E123');
    await page.getByLabel('Confirmar senha').fill('Senha@E2E123');

    await page
      .getByRole('form', { name: 'cadastro' })
      .getByRole('button', { name: 'Criar conta' })
      .click();

    // After successful registration the app performs an auto-login and
    // transitions to the onboarding screen.
    await expect(
      page.getByRole('heading', { name: 'Como deseja entrar na sua familia?' }),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ── 2. Login com credenciais válidas ───────────────────────────────────────
  test('login com credenciais válidas redireciona para dashboard', async ({
    page,
    authContext,
  }) => {
    await page.goto('/');

    // The login form is the default screen.
    await page.getByLabel('E-mail').fill(authContext.user.email);
    await page.getByLabel('Senha').fill('Senha@E2E123');

    await page.getByRole('form', { name: 'login' }).getByRole('button', { name: 'Entrar' }).click();

    // After login the app navigates to the dashboard.
    await expect(page.getByRole('heading', { name: 'NossaGrana', exact: true })).toBeVisible({
      timeout: 10_000,
    });

    // The dashboard shows the financial summary labels.
    await expect(page.getByText('RECEITAS')).toBeVisible();
    await expect(page.getByText('DESPESAS')).toBeVisible();
    await expect(page.getByText('SALDO')).toBeVisible();
  });

  // ── 3. Login com credenciais inválidas ─────────────────────────────────────
  test('login com credenciais inválidas exibe mensagem de erro', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel('E-mail').fill('invalido@test.com');
    await page.getByLabel('Senha').fill('SenhaErrada123!');

    await page.getByRole('form', { name: 'login' }).getByRole('button', { name: 'Entrar' }).click();

    // The form renders a role="alert" paragraph with the error message.
    await expect(page.getByRole('alert')).toContainText(
      'E-mail ou senha incorretos. Tente novamente.',
      { timeout: 10_000 },
    );

    // The login heading must still be visible (no screen transition occurred).
    await expect(page.getByRole('heading', { name: 'Entrar no NossaGrana' })).toBeVisible();
  });

  // ── 4. Acesso a rota protegida sem autenticação ────────────────────────────
  test('acesso sem autenticação exibe tela de login', async ({ page }) => {
    // Navigate to the app without any stored session — the app should show
    // the login screen because it is not authenticated.
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Entrar no NossaGrana' })).toBeVisible();

    // The login form is rendered.
    await expect(page.getByRole('form', { name: 'login' })).toBeVisible();
  });

  // ── 5. Logout limpa sessão e retorna para login ────────────────────────────
  test('logout limpa sessão e exibe tela de login', async ({ page, authContext }) => {
    // Sessão restaurada no bootstrap pelo cookie de refresh (sem familia → onboarding).
    await abrirAppAutenticado(page, {
      email: authContext.user.email,
      password: authContext.password,
    });
    await expect(page.getByText('Como deseja entrar')).toBeVisible({ timeout: 15_000 });
    expect(await storageSemToken(page)).toBe(true);

    // Logout revoga o refresh e limpa o cookie; o reload não restaura mais a sessão.
    const resposta = await page.request.post(`${API_URL}/api/auth/logout`, {
      headers: { 'x-nossagrana-csrf': '1' },
    });
    expect(resposta.ok()).toBe(true);
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Entrar no NossaGrana' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('form', { name: 'login' })).toBeVisible();
  });
});
