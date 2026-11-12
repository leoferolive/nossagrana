/**
 * Playwright fixture extensions for NossaGrana E2E tests.
 *
 * Provides:
 *  - `authContext`      – a registered and authenticated user with tokens
 *  - `familiaId`        – a familia created and owned by `authContext.user`
 *  - `authenticatedPage` – a Playwright Page logged in through the browser context
 *                          (HttpOnly refresh cookie); the app bootstrap restores the
 *                          session in memory (#117)
 *
 * Cleanup (deleteAccount) runs automatically after each test that uses any of
 * these fixtures.
 *
 * ## Navigation strategy
 *
 * Tokens are never stored in the browser storage. `abrirAppAutenticado` logs in via
 * `page.request` (cookie jar shared with the page), stores only the non-secret active
 * familia id and reloads: the bootstrap refreshes the session from the cookie.
 */

import { test as base, expect, type Page } from '@playwright/test';

import * as api from '../helpers/api-client.js';
import { abrirAppAutenticado } from '../helpers/session.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContext {
  accessToken: string;
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
   * The session is restored by the cookie-based bootstrap (no token in storage).
   *
   * Depends on `authContext` and `familiaId`.
   */
  authenticatedPage: async ({ page, authContext, familiaId }, use) => {
    await abrirAppAutenticado(
      page,
      { email: authContext.user.email, password: authContext.password },
      familiaId,
    );
    await expect(page.getByRole('heading', { name: 'NossaGrana', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await use(page);
  },
});

export { expect };
