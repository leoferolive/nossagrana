/**
 * Playwright fixture extensions for NossaGrana E2E tests.
 *
 * Provides:
 *  - `authContext`      – a registered and authenticated user with tokens
 *  - `familiaId`        – a familia created and owned by `authContext.user`
 *  - `authenticatedPage` – a Playwright Page with auth tokens already set in
 *                          localStorage so the app treats the user as logged in
 *
 * Cleanup (deleteAccount) runs automatically after each test that uses any of
 * these fixtures.
 *
 * ## Navigation strategy
 *
 * The NossaGrana frontend reads the localStorage session during the initial
 * render of `App.tsx` via a lazy initializer on the `screen` useState.
 * Injecting auth tokens into localStorage and reloading the page is therefore
 * sufficient to land on `screen = 'dashboard'` (when familiaIdAtiva is set) or
 * `screen = 'onboarding'` (when familiaIdAtiva is empty).
 */

import { test as base, expect, type Page } from '@playwright/test';

import * as api from '../helpers/api-client.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContext {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    nome: string;
    email: string;
  };
  /** The plaintext password used during registration (needed for UI login). */
  password: string;
}

// ─── Fixture definitions ──────────────────────────────────────────────────────

type E2EFixtures = {
  authContext: AuthContext;
  familiaId: string;
  authenticatedPage: Page;
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function uniqueEmail(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 7);
  return `test+${ts}+${rand}@e2e.com`;
}

// ─── Extended test ────────────────────────────────────────────────────────────

export const test = base.extend<E2EFixtures>({
  /**
   * Creates a unique user, registers it, and logs in to obtain tokens.
   * Deletes the account after the test completes.
   */
  authContext: async ({}, use) => {
    const email = uniqueEmail();
    const senha = 'Senha@E2E123';
    const nome = 'Usuário E2E';

    // Register — returns user data (no tokens)
    const registerResponse = await api.register({ nome, email, senha });

    // Login — returns tokens (no user data)
    const loginResponse = await api.login({ email, senha });

    const context: AuthContext = {
      accessToken: loginResponse.accessToken,
      refreshToken: loginResponse.refreshToken,
      password: senha,
      user: {
        id: registerResponse.user.id,
        nome: registerResponse.user.nome,
        email: registerResponse.user.email,
      },
    };

    await use(context);

    // Cleanup: delete the account so the database stays clean between test runs
    try {
      await api.deleteAccount(context.accessToken);
    } catch {
      // If the token has expired or the account was already removed by the test
      // itself, ignore the error — cleanup is best-effort.
    }
  },

  /**
   * Creates a familia for the authenticated user.
   * Depends on `authContext`.
   */
  familiaId: async ({ authContext }, use) => {
    const familia = await api.criarFamilia(authContext.accessToken, {
      nome: 'Família E2E',
    });

    await use(familia.id);
  },

  /**
   * Returns a Playwright Page with the user authenticated and on the dashboard
   * screen (familiaIdAtiva is set to the familia created by the `familiaId`
   * fixture).
   *
   * Auth tokens and familiaIdAtiva are injected into localStorage before
   * loading the app. The App.tsx lazy initializer reads the session on first
   * render and navigates directly to screen = 'dashboard'.
   *
   * Depends on `authContext` and `familiaId`.
   */
  authenticatedPage: async ({ page, authContext, familiaId }, use) => {
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
      [authContext.accessToken, authContext.refreshToken, familiaId],
    );
    await page.reload();
    await expect(page.getByRole('heading', { name: 'NossaGrana', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await use(page);
  },
});

export { expect };
