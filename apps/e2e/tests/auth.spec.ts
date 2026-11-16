/**
 * E2E das telas de autenticação: cadastro, login, tela de entrada sem sessão e sair.
 *
 * Cada tela tem endereço próprio (`/entrar`, `/cadastro`, `/boas-vindas`, `/mais`). Os testes que
 * passam pelos formulários pedem as fixtures `vagaDeCadastroNaTela` e `vagaDeLoginNaTela`, que
 * esperam a vez no limite de requisições da API (ver `helpers/ritmo.ts`).
 */

import { expect, test } from '../fixtures/base.js';
import { abrirInicio, esperarTela, irParaAba } from '../helpers/navegacao.js';
import { storageSemToken } from '../helpers/session.js';

const entrarForm = (page: import('@playwright/test').Page) =>
  page.getByRole('form', { name: 'login' });

test.describe('Autenticação', () => {
  // ── 1. Registro com dados válidos ──────────────────────────────────────────
  test('registro com dados válidos redireciona para onboarding', async ({
    page,
    vagaDeCadastroNaTela: _vaga,
  }) => {
    await page.goto('/');

    // Sem sessão, o app leva à tela de entrada; de lá, ao formulário de cadastro.
    await expect(page).toHaveURL(/\/entrar$/);
    await page.getByRole('button', { name: 'Cadastre-se' }).click();
    await expect(page).toHaveURL(/\/cadastro$/);

    const email = `e2e+reg+${Date.now()}@test.com`;
    await page.getByLabel('Nome', { exact: true }).fill('Usuário E2E Registro');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha', { exact: true }).fill('Senha@E2E123');

    await page
      .getByRole('form', { name: 'cadastro' })
      .getByRole('button', { name: 'Continuar' })
      .click();

    // Depois do cadastro o app faz o login sozinho e abre as boas-vindas (sem família ainda).
    await expect(page).toHaveURL(/\/boas-vindas$/, { timeout: 10_000 });
    await expect(
      page.getByRole('heading', { name: 'Entrar numa Família', level: 1 }),
    ).toBeVisible();
  });

  // ── 2. Login com credenciais válidas ───────────────────────────────────────
  test('login com credenciais válidas redireciona para dashboard', async ({
    page,
    authContext,
    familiaId: _familiaId,
    vagaDeLoginNaTela: _vaga,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/entrar$/);

    await page.getByLabel('E-mail').fill(authContext.user.email);
    await page.getByLabel('Senha').fill(authContext.password);
    await entrarForm(page).getByRole('button', { name: 'Entrar' }).click();

    // Com uma família, o login termina no Início, que mostra o resumo financeiro do mês.
    await esperarTela(page, 'Início');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Saldo', { exact: true })).toBeVisible();
    await expect(page.getByText('Receitas', { exact: true })).toBeVisible();
    await expect(page.getByText('Despesas', { exact: true })).toBeVisible();
  });

  // ── 3. Login com credenciais inválidas ─────────────────────────────────────
  test('login com credenciais inválidas exibe mensagem de erro', async ({
    page,
    vagaDeLoginNaTela: _vaga,
  }) => {
    await page.goto('/entrar');

    await page.getByLabel('E-mail').fill('invalido@test.com');
    await page.getByLabel('Senha').fill('SenhaErrada123!');
    await entrarForm(page).getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'E-mail ou senha incorretos. Tente novamente.',
      { timeout: 10_000 },
    );

    // Nenhuma troca de tela: o formulário de entrada segue na tela, no mesmo endereço.
    await expect(entrarForm(page)).toBeVisible();
    await expect(page).toHaveURL(/\/entrar$/);
  });

  // ── 4. Acesso a rota protegida sem autenticação ────────────────────────────
  test('acesso sem autenticação exibe tela de login', async ({ page }) => {
    // Endereço protegido, sem sessão: a guarda leva à entrada.
    await page.goto('/extrato');

    await expect(page).toHaveURL(/\/entrar$/);
    await expect(entrarForm(page)).toBeVisible();
    await expect(entrarForm(page).getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  // ── 5. Sair limpa sessão e retorna para login ──────────────────────────────
  test('logout limpa sessão e exibe tela de login', async ({ page, authContext, familiaId }) => {
    await abrirInicio(page, authContext, familiaId);
    expect(await storageSemToken(page)).toBe(true);

    // "Sair" fica na tela Mais, no grupo Conta.
    await irParaAba(page, 'Mais');
    await page.getByRole('button', { name: 'Sair' }).click();

    await expect(page).toHaveURL(/\/entrar$/, { timeout: 10_000 });
    await expect(entrarForm(page)).toBeVisible();

    // Sair revoga o refresh e limpa o cookie: recarregar não restaura mais a sessão.
    await page.reload();
    await expect(page).toHaveURL(/\/entrar$/);
    await expect(entrarForm(page)).toBeVisible();
    expect(await storageSemToken(page)).toBe(true);
  });
});
