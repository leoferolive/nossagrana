/**
 * E2E de relatórios, fatura do cartão e histórico.
 *
 * As telas vivem em Mais (Relatórios, Histórico, Métodos de pagamento); a fatura abre a partir do
 * cartão. Verifica:
 *  - a distribuição por categoria (gráfico de pizza em SVG, sem canvas) e a legenda;
 *  - a aba "Por Membro";
 *  - a fatura do cartão com os lançamentos do mês;
 *  - o histórico, com a lista de meses e o detalhe de um mês.
 *
 * Estratégia: categorias, cartão e lançamentos de apoio são criados pela API antes de abrir o app.
 */

import { expect, test } from '../fixtures/base.js';
import * as api from '../helpers/api-client.js';
import { hojeEmSaoPaulo } from '../helpers/data.js';
import { abrirInicio, abrirLinha, esperarTela, irParaAba } from '../helpers/navegacao.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Abre uma tela de segundo nível de Mais pelo nome da linha. */
async function gotoDeMais(page: import('@playwright/test').Page, rotulo: string, titulo: string) {
  await irParaAba(page, 'Mais');
  await abrirLinha(page, rotulo, titulo);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Relatórios', () => {
  // ── 1. Relatório de distribuição por categoria → gráfico renderizado ───────
  test('relatório de distribuição por categoria exibe gráfico de pizza', async ({
    page,
    authContext,
    familiaId,
  }) => {
    // Uma categoria e um lançamento: sem dados a distribuição não desenha o gráfico.
    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Alimentação Relatorio E2E',
      tipo: 'despesa',
    });

    await api.criarTransacao(authContext.accessToken, familiaId, {
      tipo: 'despesa',
      valor: '250.00',
      categoriaId: categoria.id,
      descricao: 'Mercado Relatorio E2E',
      data: hojeEmSaoPaulo(),
    });

    await abrirInicio(page, authContext, familiaId);
    await gotoDeMais(page, 'Relatórios', 'Relatórios');

    // "Distribuição" é a aba aberta. O gráfico é um SVG (`PieChart`, 120px) escondido dos
    // leitores de tela; o nome acessível dele é a legenda, que lista categoria e valor. Com uma
    // categoria só, a pizza é um anel (`circle`).
    await expect(page.getByRole('tab', { name: 'Distribuição', selected: true })).toBeVisible();
    const grafico = page.locator('svg[width="120"][height="120"]');
    await expect(grafico).toBeVisible({ timeout: 10_000 });
    await expect(grafico.locator('circle')).toHaveCount(1);

    // A categoria aparece na legenda, com o valor e a fatia de 100%.
    const legenda = page
      .getByRole('listitem')
      .filter({ hasText: 'Alimentação Relatorio E2E' })
      .first();
    await expect(legenda).toBeVisible({ timeout: 10_000 });
    await expect(legenda).toContainText(/R\$\s*250,00/);
    await expect(legenda).toContainText('100%');
  });

  // ── 2. Relatório por usuário (membro) exibe dados ─────────────────────────
  test('relatório por membro exibe dados do usuário', async ({ page, authContext, familiaId }) => {
    // Um lançamento registrado pelo usuário autenticado: sem ele a aba fica vazia.
    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Transporte Relatorio E2E',
      tipo: 'despesa',
    });

    await api.criarTransacao(authContext.accessToken, familiaId, {
      tipo: 'despesa',
      valor: '80.00',
      categoriaId: categoria.id,
      descricao: 'Uber Relatorio E2E',
      data: hojeEmSaoPaulo(),
    });

    await abrirInicio(page, authContext, familiaId);
    await gotoDeMais(page, 'Relatórios', 'Relatórios');

    await page.getByRole('tab', { name: 'Por Membro' }).click();

    // A lista mostra o nome do usuário (definido em fixtures/base.ts) e o total dele.
    const cartao = page.locator('div.rounded-xl').filter({ hasText: 'Usuário E2E' });
    await expect(cartao).toBeVisible({ timeout: 10_000 });
    await expect(cartao).toContainText(/R\$\s*80,00/);
  });

  // ── 3. Fatura do cartão → transações do mês exibidas ─────────────────────
  test('fatura do cartão exibe transações do mês', async ({ page, authContext, familiaId }) => {
    // Fechamento no dia 31: qualquer dia do mês é "até o fechamento", então o lançamento de hoje
    // cai sempre na fatura do mês corrente, em qualquer dia em que a suíte rode.
    const cartao = await api.criarMetodoPagamento(authContext.accessToken, familiaId, {
      nome: 'Visa Fatura E2E',
      tipo: 'credito',
      dataFechamento: 31,
      dataVencimento: 10,
    });

    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Eletrônicos Fatura E2E',
      tipo: 'despesa',
    });

    const hoje = hojeEmSaoPaulo();
    await api.criarTransacao(authContext.accessToken, familiaId, {
      tipo: 'despesa',
      valor: '399.90',
      categoriaId: categoria.id,
      metodoPagamentoId: cartao.id,
      descricao: 'Fone Bluetooth Fatura E2E',
      data: hoje,
    });

    await abrirInicio(page, authContext, familiaId);
    await gotoDeMais(page, 'Métodos de pagamento', 'Métodos de pagamento');

    // O cartão cadastrado aparece, com o botão que abre a fatura dele.
    await expect(page.getByText('Visa Fatura E2E')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Ver fatura de Visa Fatura E2E' }).click();

    // A fatura do mês corrente: título com o cartão, o mês no subtítulo, o lançamento e o total.
    await esperarTela(page, 'Fatura — Visa Fatura E2E');
    await expect(page.getByText(hoje.slice(0, 7), { exact: true })).toBeVisible({ timeout: 5_000 });

    const linha = page.getByRole('listitem').filter({ hasText: 'Fone Bluetooth Fatura E2E' });
    await expect(linha).toBeVisible({ timeout: 10_000 });
    await expect(linha).toContainText(/R\$\s*399,90/);
    await expect(page.getByText('Total', { exact: true })).toBeVisible();
    await expect(page.getByText('Total', { exact: true }).locator('xpath=..')).toContainText(
      /R\$\s*399,90/,
    );
  });

  // ── 4. Histórico de meses → lista de meses exibida ────────────────────────
  test('histórico de meses lista resumos mensais', async ({ page, authContext, familiaId }) => {
    // Um lançamento do mês corrente: sem ele o histórico mostraria só o estado vazio.
    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Salário Historico E2E',
      tipo: 'receita',
    });

    await api.criarTransacao(authContext.accessToken, familiaId, {
      tipo: 'receita',
      valor: '3000.00',
      categoriaId: categoria.id,
      descricao: 'Salário Historico E2E',
      data: hojeEmSaoPaulo(),
    });

    await abrirInicio(page, authContext, familiaId);
    await gotoDeMais(page, 'Histórico', 'Histórico');

    // O mês do lançamento aparece na lista (botão com o mês e o ano), com a receita lançada.
    const mes = page.getByRole('button', { name: /\d{4}/ }).first();
    await expect(mes).toBeVisible({ timeout: 10_000 });
    await expect(mes).toContainText(/R\$\s*3\.000,00/);

    // Abrir o mês mostra o detalhe.
    await mes.click();
    await expect(page.getByRole('heading', { name: /Detalhe —/ })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Valores Atuais')).toBeVisible({ timeout: 5_000 });

    // Fechar o detalhe.
    await page.getByRole('button', { name: 'Fechar detalhe' }).click();
    await expect(page.getByRole('heading', { name: /Detalhe —/ })).toHaveCount(0, {
      timeout: 5_000,
    });
  });
});
