/**
 * Playwright fixture extensions for NossaGrana E2E tests.
 *
 * Provides:
 *  - `authContext`      – a registered and authenticated user with tokens
 *  - `familiaId`        – a familia created and owned by `authContext.user`
 *  - `authenticatedPage` – a Playwright Page logged in through the browser context
 *                          (HttpOnly refresh cookie); the app bootstrap restores the
 *                          session in memory (#117)
 *  - `vagaDeCadastroNaTela` / `vagaDeLoginNaTela` – reserve room in the API rate limit
 *                          before a test registers / logs in through the UI
 *  - `tourSuprimido`    – automatic; marks the welcome tour as seen in every test
 *
 * Cleanup (deleteAccount) runs automatically after each test that uses any of
 * these fixtures.
 *
 * ## Rate limit
 *
 * The isolated environment keeps the API limits on (3 registrations and 5 logins per minute
 * per IP), so every registration and login waits for its turn (`helpers/ritmo.ts`). Each
 * test costs one registration and one login: `authContext` logs in once and keeps the refresh
 * cookie, which `abrirAppAutenticado` hands to the browser instead of logging in again.
 *
 * ## Navigation strategy
 *
 * Tokens are never stored in the browser storage. `abrirAppAutenticado` puts the refresh
 * cookie of the fixture login in the browser context, stores only the non-secret active
 * familia id and opens the app: the bootstrap refreshes the session from the cookie.
 */

import { test as base, expect, type Page } from '@playwright/test';

import * as api from '../helpers/api-client.js';
import { esperarTela } from '../helpers/navegacao.js';
import { reservarVaga, TEMPO_MAXIMO_DE_VAGA_MS } from '../helpers/ritmo.js';
import { abrirAppAutenticado, suprimirTour } from '../helpers/session.js';

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
  /** Refresh cookie issued by the fixture login; the browser gets it in `abrirAppAutenticado`. */
  refreshCookie: api.CookieDeRefresh | null;
}

// ─── Fixture definitions ──────────────────────────────────────────────────────

type E2EFixtures = {
  authContext: AuthContext;
  familiaId: string;
  authenticatedPage: Page;
  vagaDeCadastroNaTela: void;
  vagaDeLoginNaTela: void;
  tourSuprimido: void;
};

// Waiting for a free slot in the rate limit can take up to a full window; fixtures that wait
// have their own timeout so the wait does not eat the 30s of the test body.
const TIMEOUT_DE_VAGA = { timeout: TEMPO_MAXIMO_DE_VAGA_MS };

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
  authContext: [
    async ({}, use) => {
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
        refreshCookie: loginResponse.refreshCookie,
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
    TIMEOUT_DE_VAGA,
  ],

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
    await abrirAppAutenticado(page, authContext, familiaId);
    await esperarTela(page, 'Início');

    await use(page);
  },

  /**
   * Reserves a registration slot (and the auto-login that follows it) before a test signs up
   * through the UI form, which does not go through `api.register`.
   */
  vagaDeCadastroNaTela: [
    async ({}, use) => {
      await reservarVaga('cadastro');
      await reservarVaga('login');
      await use();
    },
    TIMEOUT_DE_VAGA,
  ],

  /**
   * Reserves a login slot before a test logs in through the UI form. Failed attempts count
   * against the limit too, so tests with a wrong password need it as well.
   */
  vagaDeLoginNaTela: [
    async ({}, use) => {
      await reservarVaga('login');
      await use();
    },
    TIMEOUT_DE_VAGA,
  ],

  /** Marks the welcome tour as seen in every page of the test (see `suprimirTour`). */
  tourSuprimido: [
    async ({ page }, use) => {
      await suprimirTour(page);
      await use();
    },
    { auto: true },
  ],
});

export { expect };
