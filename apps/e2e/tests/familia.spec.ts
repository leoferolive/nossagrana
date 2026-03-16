/**
 * E2E tests for the família management flows.
 *
 * Covers:
 *  1. Criar família (for a user without one) — via the onboarding UI.
 *  2. Gerar código de convite — the invite code is displayed in FamilySettingsPage.
 *  3. Segundo usuário entra via código — join request or direct invite.
 *  4. Aprovar solicitação de entrada — second user appears as member.
 *  5. Remover membro — member removed from the list.
 *
 * Strategy:
 *  - User 1 (admin) is set up via `authContext` + `familiaId` fixtures.
 *  - User 2 (second member) is registered and authenticated directly via the
 *    API client (`api.*`) — no UI interaction needed for user 2.
 *  - The UI assertions run as user 1 inside the FamilySettingsPage.
 *  - Cleanup for user 2 is done inside the test (deleteAccount).
 */

import { expect, test } from '../fixtures/base.js';
import * as api from '../helpers/api-client.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTH_KEY = 'nossagrana.auth.session';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uniqueEmail(label: string): string {
  return `e2e+familia+${label}+${Date.now()}+${Math.random().toString(36).slice(2, 7)}@test.com`;
}

/**
 * Navigates to "/" and injects an authenticated session WITHOUT a
 * familiaIdAtiva so the app lands on the onboarding screen after reload.
 */
async function gotoOnboarding(
  page: import('@playwright/test').Page,
  tokens: { accessToken: string; refreshToken: string },
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
        familiaIdAtiva: '',
      },
    },
  );

  await page.reload();
}

/**
 * Navigates to "/" and injects a fully authenticated session with a
 * familiaIdAtiva so the app lands on the dashboard after reload.
 * Then navigates to the FamilySettingsPage via screen state.
 *
 * The FamilySettingsPage is only reachable from:
 *   - Onboarding (after creating a familia)
 *   - ConfiguracoesPage → "Família"
 *
 * We use ConfiguracoesPage → Família as the navigation path from the
 * dashboard so we don't depend on the onboarding flow.
 */
async function gotoFamilySettings(
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

  // Wait for dashboard.
  await expect(page.getByRole('heading', { name: 'NossaGrana' })).toBeVisible({
    timeout: 15_000,
  });

  // Navigate to Configurações.
  await page.getByRole('button', { name: 'Ver configurações' }).click();
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible({
    timeout: 10_000,
  });

  // Navigate to Família settings.
  await page.getByRole('button', { name: /família/i }).click();

  // FamilySettingsPage renders with its AuthShell heading.
  await expect(page.getByRole('heading', { name: /configuracoes da familia/i })).toBeVisible({
    timeout: 10_000,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Família', () => {
  // ── 1. Criar família (para usuário sem família) ───────────────────────────
  test('criar familia via onboarding avança para configurações da família', async ({
    page,
    authContext,
  }) => {
    await gotoOnboarding(page, authContext);

    // "Criar familia" is the default mode.
    await expect(page.getByRole('form', { name: 'Criar familia' })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByLabel('Nome da familia').fill('Família E2E Criação');
    await page
      .getByRole('form', { name: 'Criar familia' })
      .getByRole('button', { name: 'Criar familia' })
      .click();

    // After creating, the app moves to FamilySettingsPage.
    await expect(page.getByRole('heading', { name: /configuracoes da familia/i })).toBeVisible({
      timeout: 10_000,
    });

    // The session must now contain a familiaIdAtiva.
    const session = await page.evaluate((key: string) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as { familiaIdAtiva?: string };
    }, AUTH_KEY);

    expect(session?.familiaIdAtiva).toBeTruthy();
  });

  // ── 2. Gerar código de convite → código exibido na UI ────────────────────
  test('gerar código de convite exibe o código na tela', async ({
    page,
    authContext,
    familiaId,
  }) => {
    await gotoFamilySettings(page, authContext, familiaId);

    // Click the "Gerar codigo de convite" button.
    await page.getByRole('button', { name: 'Gerar codigo de convite' }).click();

    // A section with "Codigo: <value>" must appear.
    await expect(page.getByText(/Codigo:/)).toBeVisible({ timeout: 10_000 });

    // The copy button must also appear.
    await expect(page.getByRole('button', { name: 'Copiar codigo' })).toBeVisible();
  });

  // ── 3. Segundo usuário entra via código de convite ───────────────────────
  test('segundo usuário entra na família via código de convite', async ({
    page,
    authContext,
    familiaId,
  }) => {
    // ── User 1: generate an invite code via the API ──
    const BASE_URL = process.env.API_URL ?? 'http://localhost:3000';
    const inviteRes = await page.request.post(`${BASE_URL}/api/familias/convites`, {
      headers: {
        Authorization: `Bearer ${authContext.accessToken}`,
        'x-familia-id': familiaId,
        'Content-Type': 'application/json',
      },
      data: {},
    });

    expect(inviteRes.status()).toBe(201);
    const inviteData = (await inviteRes.json()) as { convite: { codigo: string } };
    const codigo = inviteData.convite.codigo;

    // ── User 2: register, login, and join the family using the invite code ──
    const user2Email = uniqueEmail('user2');
    await api.register({ nome: 'Usuário E2E 2', email: user2Email, senha: 'Senha@E2E123' });
    const user2Login = await api.login({ email: user2Email, senha: 'Senha@E2E123' });

    let joinedFamiliaId: string | null = null;
    try {
      const joinRes = await page.request.post(`${BASE_URL}/api/familias/entrar/${codigo}`, {
        headers: {
          Authorization: `Bearer ${user2Login.accessToken}`,
          'Content-Type': 'application/json',
        },
        data: {},
      });

      expect(joinRes.status()).toBe(200);
      const joinData = (await joinRes.json()) as { familia: { id: string } };
      joinedFamiliaId = joinData.familia.id;

      // The joined familia must be the same family.
      expect(joinedFamiliaId).toBe(familiaId);
    } finally {
      // Cleanup user 2.
      await api.deleteAccount(user2Login.accessToken);
    }
  });

  // ── 4. Segundo usuário solicita entrada; admin aprova → membro aparece ────
  test('aprovar solicitação de entrada faz membro aparecer na lista', async ({
    page,
    authContext,
    familiaId,
  }) => {
    // ── User 2: register and send a join request via the API ──
    const user2Email = uniqueEmail('req');
    const user2Reg = await api.register({
      nome: 'Usuário Solicitante E2E',
      email: user2Email,
      senha: 'Senha@E2E123',
    });
    const user2Login = await api.login({ email: user2Email, senha: 'Senha@E2E123' });

    const BASE_URL = process.env.API_URL ?? 'http://localhost:3000';

    try {
      // User 2 sends a join request.
      const reqRes = await page.request.post(`${BASE_URL}/api/familias/solicitar`, {
        headers: {
          Authorization: `Bearer ${user2Login.accessToken}`,
          'Content-Type': 'application/json',
        },
        data: { familiaId },
      });

      expect(reqRes.status()).toBe(201);
      const reqData = (await reqRes.json()) as { solicitacao: { id: string } };
      const solicitacaoId = reqData.solicitacao.id;

      // ── User 1 (admin): navigate to FamilySettings and approve the request ──
      await gotoFamilySettings(page, authContext, familiaId);

      // The pending request section must list the request — identified by the
      // "Aprovar" button presence (the UI renders one per pending request).
      await expect(page.getByRole('button', { name: /^Aprovar$/ })).toBeVisible({
        timeout: 10_000,
      });

      // Approve.
      await page.getByRole('button', { name: /^Aprovar$/ }).click();

      // The "Aprovar" button for that request should disappear.
      await expect(page.getByRole('button', { name: /^Aprovar$/ })).not.toBeVisible({
        timeout: 10_000,
      });

      // Verify via API that the second user is now a member.
      const membrosRes = await page.request.get(`${BASE_URL}/api/familias/${familiaId}/membros`, {
        headers: {
          Authorization: `Bearer ${authContext.accessToken}`,
          'x-familia-id': familiaId,
        },
      });

      expect(membrosRes.status()).toBe(200);
      const membrosData = (await membrosRes.json()) as {
        membros: Array<{ usuarioId: string; role: string }>;
      };

      const user2Member = membrosData.membros.find((m) => m.usuarioId === user2Reg.user.id);
      expect(user2Member).toBeTruthy();
      expect(user2Member?.role).toBe('membro');

      // Suppress unused variable warning — solicitacaoId is read above.
      void solicitacaoId;
    } finally {
      // Cleanup user 2.
      await api.deleteAccount(user2Login.accessToken);
    }
  });

  // ── 5. Remover membro → membro removido da lista ─────────────────────────
  test('remover membro remove-o da lista de membros', async ({ page, authContext, familiaId }) => {
    // ── User 2: register, get invite, join the family ──
    const user2Email = uniqueEmail('remove');
    const user2Reg = await api.register({
      nome: 'Usuário para Remover E2E',
      email: user2Email,
      senha: 'Senha@E2E123',
    });
    const user2Login = await api.login({ email: user2Email, senha: 'Senha@E2E123' });

    const BASE_URL = process.env.API_URL ?? 'http://localhost:3000';

    try {
      // Generate invite and have user 2 join via the API.
      const inviteRes = await page.request.post(`${BASE_URL}/api/familias/convites`, {
        headers: {
          Authorization: `Bearer ${authContext.accessToken}`,
          'x-familia-id': familiaId,
          'Content-Type': 'application/json',
        },
        data: {},
      });

      const inviteData = (await inviteRes.json()) as { convite: { codigo: string } };
      const codigo = inviteData.convite.codigo;

      await page.request.post(`${BASE_URL}/api/familias/entrar/${codigo}`, {
        headers: {
          Authorization: `Bearer ${user2Login.accessToken}`,
          'Content-Type': 'application/json',
        },
        data: {},
      });

      // ── User 1: navigate to FamilySettingsPage and remove user 2 ──
      await gotoFamilySettings(page, authContext, familiaId);

      // The members list should show a "Remover <userId>" button for user 2.
      // The UI renders the usuarioId (UUID) as text. We locate the remove button
      // by its partial text which includes the user2 id.
      const removeButton = page.getByRole('button', {
        name: new RegExp(`Remover ${user2Reg.user.id}`, 'i'),
      });

      await expect(removeButton).toBeVisible({ timeout: 10_000 });

      await removeButton.click();

      // After removal the button must disappear.
      await expect(removeButton).not.toBeVisible({ timeout: 10_000 });

      // Verify via API that the member is gone.
      const membrosRes = await page.request.get(`${BASE_URL}/api/familias/${familiaId}/membros`, {
        headers: {
          Authorization: `Bearer ${authContext.accessToken}`,
          'x-familia-id': familiaId,
        },
      });

      const membrosData = (await membrosRes.json()) as {
        membros: Array<{ usuarioId: string }>;
      };

      const stillMember = membrosData.membros.find((m) => m.usuarioId === user2Reg.user.id);
      expect(stillMember).toBeUndefined();
    } finally {
      // Cleanup user 2.
      await api.deleteAccount(user2Login.accessToken);
    }
  });
});
