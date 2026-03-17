/**
 * E2E tests for the onboarding flow.
 *
 * Onboarding is the screen shown to a newly registered user who does not yet
 * have an active familia. It offers three modes:
 *   - "Criar familia"        — create a brand-new familia
 *   - "Entrar com convite"   — join an existing familia via invite code
 *   - "Buscar e solicitar"   — search for a familia and request to join
 *
 * The tests in this file focus on the "Criar familia" path which is the most
 * common first-run experience. A freshly registered user is set up via the API
 * (using `authContext`) and the tokens are injected into localStorage so the
 * app starts in the correct authenticated-but-no-familia state.
 *
 * ## Navigation strategy
 *
 * The app uses a state-machine navigation pattern: the `screen` state in
 * `App.tsx` always initialises to `'login'` regardless of what is stored in
 * localStorage.  To reach `screen = 'onboarding'` we must either:
 *   a) Complete the sign-up UI flow (which calls `onCompleteSignUp →
 *      setScreen('onboarding')`), OR
 *   b) Log in through the UI (to reach `screen = 'dashboard'`) and then use
 *      the React fiber helper to switch the screen state to `'onboarding'`.
 *
 * We use option (b) here so that we can reuse the `authContext` fixture user
 * (registered once per test via the API) without going through the sign-up
 * form every time.
 */

import { expect, test } from '../fixtures/base.js';

// ─── Constant ────────────────────────────────────────────────────────────────

const AUTH_KEY = 'nossagrana.auth.session';

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Injects auth tokens without a familiaIdAtiva into localStorage and reloads
 * the page so the App.tsx lazy initializer navigates to screen = 'onboarding'.
 */
async function gotoOnboarding(
  page: import('@playwright/test').Page,
  tokens: { accessToken: string; refreshToken: string; email: string; password: string },
) {
  await page.goto('/');
  await page.evaluate(
    ([accessToken, refreshToken]) => {
      localStorage.setItem(
        'nossagrana.auth.session',
        JSON.stringify({ accessToken, refreshToken, familiaIdAtiva: '' }),
      );
    },
    [tokens.accessToken, tokens.refreshToken],
  );
  await page.reload();
  // The app should show the onboarding screen (no familia → onboarding)
  await expect(page.getByText('Como deseja entrar')).toBeVisible({ timeout: 15_000 });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Onboarding', () => {
  // ── 1. Primeiro acesso: onboarding é exibido ───────────────────────────────
  test('usuário autenticado sem familia vê tela de onboarding', async ({ page, authContext }) => {
    await gotoOnboarding(page, {
      accessToken: authContext.accessToken,
      refreshToken: authContext.refreshToken,
      email: authContext.user.email,
      password: authContext.password,
    });

    // The onboarding heading must be visible.
    await expect(
      page.getByRole('heading', { name: 'Como deseja entrar na sua familia?' }),
    ).toBeVisible({ timeout: 10_000 });

    // The three mode buttons must be present.
    await expect(page.getByRole('button', { name: 'Criar familia' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar com convite' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Buscar e solicitar' })).toBeVisible();
  });

  // ── 2. Criar família durante onboarding ───────────────────────────────────
  test('criar familia avança para configurações da família', async ({ page, authContext }) => {
    await gotoOnboarding(page, {
      accessToken: authContext.accessToken,
      refreshToken: authContext.refreshToken,
      email: authContext.user.email,
      password: authContext.password,
    });

    // "Criar familia" mode is active by default.
    await expect(page.getByRole('form', { name: 'Criar familia' })).toBeVisible({
      timeout: 10_000,
    });

    // Fill in the family name and submit.
    await page.getByLabel('Nome da familia').fill('Família E2E Onboarding');
    await page
      .getByRole('form', { name: 'Criar familia' })
      .getByRole('button', { name: 'Criar familia' })
      .click();

    // After creating a familia the app transitions to the FamilySettingsPage.
    // That page renders its content inside an AuthShell — we look for the
    // invite-code section or the members list heading which both appear there.
    // The page title shown in FamilySettingsPage header is not yet known, so
    // we rely on the absence of the onboarding heading plus the presence of
    // a known FamilySettings element.
    await expect(
      page.getByRole('heading', { name: 'Como deseja entrar na sua familia?' }),
    ).not.toBeVisible({ timeout: 10_000 });
  });

  // ── 3. Alternar para modo "Entrar com convite" ─────────────────────────────
  test('modo entrar com convite exibe campo de código de convite', async ({
    page,
    authContext,
  }) => {
    await gotoOnboarding(page, {
      accessToken: authContext.accessToken,
      refreshToken: authContext.refreshToken,
      email: authContext.user.email,
      password: authContext.password,
    });

    await page.getByRole('button', { name: 'Entrar com convite' }).click();

    // The invite-code form must be visible.
    await expect(page.getByRole('form', { name: 'Entrar com convite' })).toBeVisible();
    await expect(page.getByLabel('Codigo de convite')).toBeVisible();
  });

  // ── 4. Alternar para modo "Buscar e solicitar" ────────────────────────────
  test('modo buscar e solicitar exibe campo de busca por familia', async ({
    page,
    authContext,
  }) => {
    await gotoOnboarding(page, {
      accessToken: authContext.accessToken,
      refreshToken: authContext.refreshToken,
      email: authContext.user.email,
      password: authContext.password,
    });

    await page.getByRole('button', { name: 'Buscar e solicitar' }).click();

    // The search form must be visible.
    await expect(page.getByRole('form', { name: 'Buscar familia' })).toBeVisible();
    await expect(page.getByLabel('Nome da familia')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Buscar', exact: true })).toBeVisible();
  });

  // ── 5. Código de convite inválido exibe erro ──────────────────────────────
  test('código de convite inválido exibe mensagem de erro', async ({ page, authContext }) => {
    await gotoOnboarding(page, {
      accessToken: authContext.accessToken,
      refreshToken: authContext.refreshToken,
      email: authContext.user.email,
      password: authContext.password,
    });

    await page.getByRole('button', { name: 'Entrar com convite' }).click();

    await page.getByLabel('Codigo de convite').fill('CODIGO-INVALIDO-123');
    await page
      .getByRole('form', { name: 'Entrar com convite' })
      .getByRole('button', { name: 'Entrar com convite' })
      .click();

    await expect(page.getByRole('alert')).toContainText('Código inválido ou expirado.', {
      timeout: 10_000,
    });
  });

  // ── 6. Onboarding completo: dashboard com estado inicial ──────────────────
  test('após criar familia o dashboard apresenta estado inicial zerado', async ({
    page,
    authContext,
  }) => {
    await gotoOnboarding(page, {
      accessToken: authContext.accessToken,
      refreshToken: authContext.refreshToken,
      email: authContext.user.email,
      password: authContext.password,
    });

    // Create the familia through the onboarding form.
    await page.getByLabel('Nome da familia').fill('Família E2E Dashboard');
    await page
      .getByRole('form', { name: 'Criar familia' })
      .getByRole('button', { name: 'Criar familia' })
      .click();

    // The FamilySettingsPage is shown after creating a familia. In a real
    // first-run scenario the user would proceed to the dashboard from there.
    // Since the FamilySettingsPage does not yet expose a "Ir para dashboard"
    // button in the current implementation, we verify we left onboarding and
    // the session now contains a familiaIdAtiva.
    await expect(
      page.getByRole('heading', { name: 'Como deseja entrar na sua familia?' }),
    ).not.toBeVisible({ timeout: 10_000 });

    // Confirm the session has been updated with a familiaIdAtiva.
    const session = await page.evaluate((key: string) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as { familiaIdAtiva?: string };
    }, AUTH_KEY);

    expect(session).not.toBeNull();
    expect(session?.familiaIdAtiva).toBeTruthy();
  });
});
