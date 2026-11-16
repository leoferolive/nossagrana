/**
 * E2E do onboarding (`/boas-vindas`), a tela de quem entrou mas ainda não tem família ativa.
 *
 * Três caminhos: criar família, entrar com código de convite e buscar uma família para pedir
 * entrada. Os testes cobrem criar (o caminho do primeiro acesso) e a troca entre os modos.
 *
 * Um usuário recém-criado pela fixture `authContext` (sem família) abre o app direto: sem família
 * ativa, a guarda das telas financeiras leva a `/boas-vindas`.
 */

import { expect, test } from '../fixtures/base.js';
import { barraPrincipal, esperarTela } from '../helpers/navegacao.js';
import { abrirAppAutenticado, storageSemToken } from '../helpers/session.js';

type Sessao = Parameters<typeof abrirAppAutenticado>[1];

async function abrirBoasVindas(page: import('@playwright/test').Page, sessao: Sessao) {
  await abrirAppAutenticado(page, sessao);
  await expect(page).toHaveURL(/\/boas-vindas$/, { timeout: 15_000 });
  await esperarTela(page, 'Entrar numa Família');
}

/** As três opções são botões cujo nome acessível inclui a descrição embaixo do título. */
const opcao = (page: import('@playwright/test').Page, titulo: string) =>
  page.getByRole('button', { name: new RegExp(`^${titulo}`) });

test.describe('Onboarding', () => {
  // ── 1. Primeiro acesso: onboarding é exibido ───────────────────────────────
  test('usuário autenticado sem familia vê tela de onboarding', async ({ page, authContext }) => {
    await abrirBoasVindas(page, authContext);

    await expect(opcao(page, 'Criar Família')).toBeVisible();
    await expect(opcao(page, 'Tenho um código de convite')).toBeVisible();
    await expect(opcao(page, 'Buscar Família')).toBeVisible();
  });

  // ── 2. Criar família durante onboarding ───────────────────────────────────
  test('criar familia avança para configurações da família', async ({ page, authContext }) => {
    await abrirBoasVindas(page, authContext);

    await opcao(page, 'Criar Família').click();
    const formulario = page.getByRole('form', { name: 'Criar família' });
    await expect(formulario).toBeVisible({ timeout: 10_000 });

    await formulario.getByLabel('Nome da família', { exact: true }).fill('Família E2E Criação');
    await formulario.getByRole('button', { name: 'Criar família', exact: true }).click();

    // Criada a família, o app abre as configurações dela, dentro da casca com a barra inferior.
    await expect(page).toHaveURL(/\/mais\/familia$/, { timeout: 10_000 });
    await esperarTela(page, 'Família');
    await expect(page.getByRole('heading', { name: 'Membros', level: 2 })).toBeVisible();

    // O id da família ativa (não secreto) fica guardado; nenhum token pode ir para o storage.
    const familiaAtiva = await page.evaluate(() =>
      localStorage.getItem('nossagrana.familia-ativa'),
    );
    expect(familiaAtiva).toBeTruthy();
    expect(await storageSemToken(page)).toBe(true);
  });

  // ── 3. Alternar para modo "Entrar com convite" ─────────────────────────────
  test('modo entrar com convite exibe campo de código de convite', async ({
    page,
    authContext,
  }) => {
    await abrirBoasVindas(page, authContext);

    await opcao(page, 'Tenho um código de convite').click();

    await expect(page.getByRole('form', { name: 'Entrar com convite' })).toBeVisible();
    await expect(page.getByLabel('Código de convite', { exact: true })).toBeVisible();
  });

  // ── 4. Alternar para modo "Buscar e solicitar" ────────────────────────────
  test('modo buscar e solicitar exibe campo de busca por familia', async ({
    page,
    authContext,
  }) => {
    await abrirBoasVindas(page, authContext);

    await opcao(page, 'Buscar Família').click();

    const formulario = page.getByRole('form', { name: 'Buscar família' });
    await expect(formulario).toBeVisible();
    await expect(formulario.getByLabel('Nome da família', { exact: true })).toBeVisible();
    await expect(formulario.getByRole('button', { name: 'Buscar', exact: true })).toBeVisible();
  });

  // ── 5. Código de convite inválido exibe erro ──────────────────────────────
  test('código de convite inválido exibe mensagem de erro', async ({ page, authContext }) => {
    await abrirBoasVindas(page, authContext);

    await opcao(page, 'Tenho um código de convite').click();

    const formulario = page.getByRole('form', { name: 'Entrar com convite' });
    await formulario.getByLabel('Código de convite', { exact: true }).fill('CODIGO-INVALIDO-123');
    await formulario.getByRole('button', { name: 'Entrar com convite', exact: true }).click();

    await expect(page.getByRole('alert')).toContainText('Código inválido ou expirado.', {
      timeout: 10_000,
    });
  });

  // ── 6. Onboarding completo: dashboard com estado inicial ──────────────────
  test('após criar familia o dashboard apresenta estado inicial zerado', async ({
    page,
    authContext,
  }) => {
    await abrirBoasVindas(page, authContext);

    await opcao(page, 'Criar Família').click();
    const formulario = page.getByRole('form', { name: 'Criar família' });
    await formulario.getByLabel('Nome da família', { exact: true }).fill('Família E2E Dashboard');
    await formulario.getByRole('button', { name: 'Criar família', exact: true }).click();

    // O app abre as configurações da família; de lá o usuário vai ao Início pela barra.
    await expect(page).toHaveURL(/\/mais\/familia$/, { timeout: 10_000 });
    await barraPrincipal(page).getByRole('link', { name: 'Início', exact: true }).click();
    await esperarTela(page, 'Início');

    // Família nova: nada lançado, então saldo, receitas e despesas valem zero.
    const zero = /R\$\s*0,00/;
    await expect(page.getByText('Saldo', { exact: true }).locator('..')).toContainText(zero);
    await expect(page.getByText('Receitas', { exact: true }).locator('..')).toContainText(zero);
    await expect(page.getByText('Despesas', { exact: true }).locator('..')).toContainText(zero);
    await expect(page.getByText('Nenhuma despesa registrada neste mês')).toBeVisible();

    // O id da família ativa (não secreto) fica guardado; nenhum token pode ir para o storage.
    const familiaAtiva = await page.evaluate(() =>
      localStorage.getItem('nossagrana.familia-ativa'),
    );
    expect(familiaAtiva).toBeTruthy();
    expect(await storageSemToken(page)).toBe(true);
  });
});
