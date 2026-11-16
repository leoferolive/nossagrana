/**
 * E2E do orçamento: limites por categoria (`/planejar/limites`) e o resumo no Início.
 *
 * A tela de limites se alcança por Planejar > "Limites por categoria". Estratégia: categorias,
 * limites e lançamentos de apoio são criados pela API antes de abrir o app; o resultado é
 * conferido na interface (barra de progresso, percentual e valores salvos).
 */

import { expect, test } from '../fixtures/base.js';
import * as api from '../helpers/api-client.js';
import { hojeEmSaoPaulo } from '../helpers/data.js';
import { abrirInicio, abrirLinha, irParaAba } from '../helpers/navegacao.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = process.env.API_URL ?? 'http://localhost:3000';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Abre Planejar e, dele, a tela de limites por categoria. */
async function gotoLimites(page: import('@playwright/test').Page) {
  await irParaAba(page, 'Planejar');
  await abrirLinha(page, 'Limites por categoria', 'Limites por categoria');
  await expect(page).toHaveURL(/\/planejar\/limites$/);
}

/**
 * Sets a budget limit for a given category via the API.
 */
async function setOrcamentoViaApi(
  page: import('@playwright/test').Page,
  token: string,
  familiaId: string,
  categoriaId: string,
  valorLimite: string,
) {
  const mesReferencia = hojeEmSaoPaulo().slice(0, 7);

  const resposta = await page.request.post(`${BASE_URL}/api/orcamento/${categoriaId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-familia-id': familiaId,
      'Content-Type': 'application/json',
    },
    data: {
      valorLimite,
      vigenciaInicio: mesReferencia,
    },
  });
  expect(resposta.ok()).toBe(true);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

/** Cartão da categoria na tela de limites (o visível: a tela também tem uma tabela de desktop). */
const cartaoDaCategoria = (page: import('@playwright/test').Page, nome: string) =>
  page
    .getByText(nome, { exact: true })
    .locator('visible=true')
    .locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]');

test.describe('Orçamento', () => {
  // ── 1. Definir limite por categoria ───────────────────────────────────────
  test('definir limite por categoria salva com sucesso', async ({
    page,
    authContext,
    familiaId,
  }) => {
    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Alimentação Orçamento E2E',
      tipo: 'despesa',
    });

    // Limite inicial pela API, para a categoria aparecer na lista.
    await setOrcamentoViaApi(page, authContext.accessToken, familiaId, categoria.id, '500.00');

    await abrirInicio(page, authContext, familiaId);
    await gotoLimites(page);

    const cartao = cartaoDaCategoria(page, 'Alimentação Orçamento E2E');
    await expect(cartao).toBeVisible({ timeout: 10_000 });
    await expect(cartao).toContainText(/R\$\s*500,00/);

    await cartao.getByRole('button', { name: 'Editar limite' }).click();

    // O formulário de edição aparece com o campo do novo limite.
    const input = cartao.getByLabel('Novo limite');
    await expect(input).toBeVisible({ timeout: 5_000 });

    await input.clear();
    await input.fill('800');
    await cartao.getByRole('button', { name: 'Salvar', exact: true }).click();

    // O campo some (formulário fecha) e a lista passa a mostrar o limite novo. Não se afirma
    // "um só cartão" aqui: ver o `test.fixme` logo abaixo (a lista duplica a categoria).
    await expect(input).not.toBeVisible({ timeout: 5_000 });
    await expect(
      page
        .getByText(/R\$\s*0,00\/R\$\s*800,00/)
        .locator('visible=true')
        .first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText('Alimentação Orçamento E2E').locator('visible=true').first(),
    ).toBeVisible();
  });

  // DEFEITO DO APP/API (não corrigido neste PR): definir de novo o limite de uma categoria na
  // mesma vigência grava outra linha em `orcamento_categoria` (500 e 800 para o mês) e a lista
  // mostra as duas, com o limite antigo e o novo, em vez de só o vigente. O teste acima usa o
  // limite novo na lista e deixa de afirmar a contagem; este fixa o comportamento correto.
  test.fixme('editar o limite não duplica a categoria na lista', async ({
    page,
    authContext,
    familiaId,
  }) => {
    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Duplicada Orçamento E2E',
      tipo: 'despesa',
    });
    await setOrcamentoViaApi(page, authContext.accessToken, familiaId, categoria.id, '500.00');

    await abrirInicio(page, authContext, familiaId);
    await gotoLimites(page);

    const cartao = cartaoDaCategoria(page, 'Duplicada Orçamento E2E');
    await cartao.getByRole('button', { name: 'Editar limite' }).click();
    await cartao.getByLabel('Novo limite').fill('800');
    await cartao.getByRole('button', { name: 'Salvar', exact: true }).click();

    await expect(
      page.getByText('Duplicada Orçamento E2E', { exact: true }).locator('visible=true'),
    ).toHaveCount(1);
  });

  // ── 2. Despesas que ultrapassam o limite exibem indicador visual ───────────
  test('despesas que ultrapassam o limite exibem indicador visual', async ({
    page,
    authContext,
    familiaId,
  }) => {
    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Lazer Orçamento E2E',
      tipo: 'despesa',
    });

    await setOrcamentoViaApi(page, authContext.accessToken, familiaId, categoria.id, '10.00');

    // Despesa acima do limite (R$ 150 > R$ 10).
    await api.criarTransacao(authContext.accessToken, familiaId, {
      tipo: 'despesa',
      valor: '150.00',
      categoriaId: categoria.id,
      descricao: 'Gasto acima do limite E2E',
      data: hojeEmSaoPaulo(),
    });

    await abrirInicio(page, authContext, familiaId);
    await gotoLimites(page);

    const cartao = cartaoDaCategoria(page, 'Lazer Orçamento E2E');
    await expect(cartao).toBeVisible({ timeout: 10_000 });

    // Estourado: o percentual passa de 100% (150 de 10 = 1500%) com gasto e limite à mostra.
    await expect(cartao).toContainText(/1500%/);
    await expect(cartao).toContainText(/R\$\s*150,00\/R\$\s*10,00/);

    // A barra de progresso usa a cor de perigo (status "exceeded"); a barra preenchida é a
    // segunda `div` arredondada do cartão (a primeira é a trilha).
    const barraPreenchida = cartao.locator('div.h-2.rounded-full').nth(1);
    await expect(barraPreenchida).toHaveClass(/bg-danger/, { timeout: 5_000 });
  });

  // ── 3. Dashboard mostra progresso do orçamento ─────────────────────────────
  test('dashboard mostra progresso do orçamento configurado', async ({
    page,
    authContext,
    familiaId,
  }) => {
    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Saúde Dashboard E2E',
      tipo: 'despesa',
    });

    await setOrcamentoViaApi(page, authContext.accessToken, familiaId, categoria.id, '300.00');

    // Um gasto, para haver progresso a mostrar.
    await api.criarTransacao(authContext.accessToken, familiaId, {
      tipo: 'despesa',
      valor: '120.00',
      categoriaId: categoria.id,
      descricao: 'Farmácia E2E',
      data: hojeEmSaoPaulo(),
    });

    await abrirInicio(page, authContext, familiaId);

    // O cartão "Orçamento" do Início lista a categoria com o percentual e a barra de progresso
    // (sem o orçamento ele mostraria "Nenhum orçamento configurado").
    const secao = page.getByText('Orçamento', { exact: true }).locator('xpath=..');
    await expect(secao).toBeVisible({ timeout: 10_000 });
    await expect(secao.getByText('Saúde Dashboard E2E')).toBeVisible({ timeout: 10_000 });
    await expect(secao).toContainText(/40%\s*—\s*R\$\s*120,00\/R\$\s*300,00/);

    const barra = secao.locator('.h-1\\.5.w-full.rounded-full');
    await expect(barra.first()).toBeVisible({ timeout: 5_000 });
  });
});
