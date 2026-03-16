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
   * Returns a Playwright Page with authentication tokens pre-loaded into
   * localStorage so the React app treats the user as already signed in.
   *
   * The auth context is stored under the key `nossagrana.auth.session` as a
   * JSON object matching the shape expected by the `AuthProvider`:
   *   { accessToken, refreshToken, familiaIdAtiva }
   *
   * Navigates to the baseURL once to establish a browsing context, injects the
   * session, then lets the test proceed.
   *
   * Depends on `authContext`.
   */
  authenticatedPage: async ({ page, authContext }, use) => {
    // Navigate to the app root to get a document under the right origin before
    // accessing localStorage.
    await page.goto('/');

    await page.evaluate(
      ({ accessToken, refreshToken }: { accessToken: string; refreshToken: string }) => {
        localStorage.setItem(
          'nossagrana.auth.session',
          JSON.stringify({ accessToken, refreshToken, familiaIdAtiva: '' }),
        );
      },
      {
        accessToken: authContext.accessToken,
        refreshToken: authContext.refreshToken,
      },
    );

    await use(page);
  },
});

export { expect };
