/**
 * E2E das transações: criar (receita, despesa, parcelada, recorrente), editar e excluir.
 *
 * O projeto roda em 390x844: o "+" da barra inferior ("Lançar") abre o painel de lançar, e as
 * telas se alcançam pela barra (Início, Extrato). Categoria e método de pagamento são
 * `CustomSelect` (ver `helpers/custom-select.ts`).
 *
 * Estratégia:
 *  - Os dados de apoio (categorias, lançamentos a editar ou excluir) são criados pela API antes
 *    de abrir o app, para a tela já carregar com eles.
 *  - O resultado é conferido na interface e, onde ela não mostra (parcelas futuras), pela API.
 */

import { expect, test } from '../fixtures/base.js';
import * as api from '../helpers/api-client.js';
import { hojeEmSaoPaulo } from '../helpers/data.js';
import { escolherOpcao } from '../helpers/custom-select.js';
import {
  abrirInicio,
  abrirPainelLancar,
  irParaAba,
  salvarLancamento,
} from '../helpers/navegacao.js';

// ─── Tests ────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.API_URL ?? 'http://localhost:3000';
const hoje = hojeEmSaoPaulo;

test.describe('Transações', () => {
  // ── 1. Criar receita simples → aparece no extrato ─────────────────────────
  // ── 1. Criar receita simples → aparece no extrato ─────────────────────────
  test('criar receita simples aparece no extrato', async ({ page, authContext, familiaId }) => {
    await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Salário E2E',
      tipo: 'receita',
    });

    // Lança pelo Início (como a despesa) e confere no Extrato, que busca a lista ao abrir.
    await abrirInicio(page, authContext, familiaId);
    const painel = await abrirPainelLancar(page);

    await painel.getByRole('button', { name: 'Receita', exact: true }).click();
    await painel.getByRole('spinbutton', { name: 'Valor' }).fill('1500.00');
    await escolherOpcao(page, painel, 'Categoria', 'Salário E2E');
    await painel.getByRole('textbox', { name: 'Descrição' }).fill('Salário mês E2E');
    await salvarLancamento(page, painel);

    await irParaAba(page, 'Extrato');
    const linha = page.getByRole('listitem').filter({ hasText: 'Salário mês E2E' });
    await expect(linha).toBeVisible({ timeout: 10_000 });
    await expect(linha).toContainText(/\+\s*R\$\s*1\.500,00/);
  });

  // O Extrato recarrega o mês depois de salvar, sem sair da tela (Entrega 3 da nova UI).
  test('lançar com o Extrato aberto atualiza a lista', async ({ page, authContext, familiaId }) => {
    await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Salário aberto E2E',
      tipo: 'receita',
    });

    await abrirInicio(page, authContext, familiaId);
    await irParaAba(page, 'Extrato');
    const painel = await abrirPainelLancar(page);

    await painel.getByRole('button', { name: 'Receita', exact: true }).click();
    await painel.getByRole('spinbutton', { name: 'Valor' }).fill('1500.00');
    await escolherOpcao(page, painel, 'Categoria', 'Salário aberto E2E');
    await painel.getByRole('textbox', { name: 'Descrição' }).fill('Salário aberto E2E');
    await salvarLancamento(page, painel);

    // O lançamento aparece na lista do Extrato, como receita, e o resumo do período o soma.
    const linha = page.getByRole('listitem').filter({ hasText: 'Salário aberto E2E' });
    await expect(linha).toBeVisible({ timeout: 10_000 });
    await expect(linha).toContainText(/\+\s*R\$\s*1\.500,00/);
    const resumo = page.getByRole('group', { name: 'Resumo do período' });
    await expect(resumo.getByText('Entradas').locator('..')).toContainText(/R\$\s*1\.500,00/);
  });

  // ── 2. Criar despesa simples → aparece no extrato ──────────────────────────
  test('criar despesa simples e verificar via API', async ({ page, authContext, familiaId }) => {
    await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Alimentação E2E',
      tipo: 'despesa',
    });

    await abrirInicio(page, authContext, familiaId);
    const painel = await abrirPainelLancar(page);

    // "Despesa" já vem escolhida; clicar confirma o tipo.
    await painel.getByRole('button', { name: 'Despesa', exact: true }).click();
    await painel.getByRole('spinbutton', { name: 'Valor' }).fill('200.00');
    await escolherOpcao(page, painel, 'Categoria', 'Alimentação E2E');
    await painel.getByRole('textbox', { name: 'Descrição' }).fill('Supermercado E2E');
    await salvarLancamento(page, painel);

    // Vai ao Extrato para conferir que o lançamento foi registrado.
    await irParaAba(page, 'Extrato');
    const linha = page.getByRole('listitem').filter({ hasText: 'Supermercado E2E' });
    await expect(linha).toBeVisible({ timeout: 10_000 });
    await expect(linha).toContainText(/[-\u2212]\s*R\$\s*200,00/);
  });

  // ── 3. Criar transação parcelada (3x) → parcelas geradas ─────────────────
  test('criar transação parcelada em 3x gera 3 parcelas no extrato', async ({
    page,
    authContext,
    familiaId,
  }) => {
    // Cartão de crédito (necessário para parcelar) e categoria de apoio.
    await api.criarMetodoPagamento(authContext.accessToken, familiaId, {
      nome: 'Cartão Visa E2E',
      tipo: 'credito',
      dataFechamento: 20,
      dataVencimento: 27,
    });
    await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Eletronicos E2E',
      tipo: 'despesa',
    });

    await abrirInicio(page, authContext, familiaId);
    const painel = await abrirPainelLancar(page);

    await painel.getByRole('button', { name: 'Despesa', exact: true }).click();
    await painel.getByRole('spinbutton', { name: 'Valor' }).fill('900.00');
    await escolherOpcao(page, painel, 'Categoria', 'Eletronicos E2E');
    await escolherOpcao(page, painel, 'Método de pagamento', 'Cartão Visa E2E');
    await painel.getByRole('textbox', { name: 'Descrição' }).fill('Notebook parcelado E2E');

    await painel.getByRole('button', { name: 'Parcelado', exact: true }).click();
    await painel.getByRole('spinbutton', { name: 'Parcelas' }).fill('3');
    await salvarLancamento(page, painel);

    // O Extrato lista só o mês corrente; as 3 parcelas se confirmam pela API. O painel fecha antes
    // de a gravação terminar, então a conferência repete até as parcelas aparecerem.
    const numeroDeParcelas = async (): Promise<number[]> => {
      const res = await page.request.get(`${BASE_URL}/api/transacoes`, {
        headers: {
          Authorization: `Bearer ${authContext.accessToken}`,
          'x-familia-id': familiaId,
        },
      });
      const data = (await res.json()) as {
        transacoes: Array<{ descricao: string | null; parcelaAtual: number | null }>;
      };
      return data.transacoes
        .filter((t) => t.descricao?.includes('Notebook parcelado E2E'))
        .map((t) => t.parcelaAtual ?? 0)
        .sort();
    };

    // O serviço gera uma transação por parcela: parcelaAtual 1, 2 e 3.
    await expect.poll(numeroDeParcelas, { timeout: 10_000 }).toEqual([1, 2, 3]);
  });

  // ── 4. Criar transação recorrente mensal ──────────────────────────────────
  test('criar transação recorrente mensal é marcada como recorrente no extrato', async ({
    page,
    authContext,
    familiaId,
  }) => {
    await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Assinaturas E2E',
      tipo: 'despesa',
    });

    await abrirInicio(page, authContext, familiaId);
    const painel = await abrirPainelLancar(page);

    await painel.getByRole('button', { name: 'Despesa', exact: true }).click();
    await painel.getByRole('spinbutton', { name: 'Valor' }).fill('50.00');
    await escolherOpcao(page, painel, 'Categoria', 'Assinaturas E2E');
    await painel.getByRole('textbox', { name: 'Descrição' }).fill('Netflix E2E');

    await painel.getByRole('button', { name: 'Recorrente', exact: true }).click();

    // "Mensal" é a frequência padrão.
    await expect(painel.getByRole('combobox', { name: 'Frequência' })).toContainText('Mensal');
    await salvarLancamento(page, painel);

    // No Extrato, o lançamento traz o selo "Recorrente".
    await irParaAba(page, 'Extrato');
    const linha = page.getByRole('listitem').filter({ hasText: 'Netflix E2E' }).first();
    await expect(linha).toBeVisible({ timeout: 10_000 });
    await expect(linha).toContainText('Recorrente');
  });

  // ── 5. Editar transação → valor atualizado no extrato ────────────────────
  test('editar transação atualiza valor no extrato', async ({ page, authContext, familiaId }) => {
    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Transporte E2E',
      tipo: 'despesa',
    });

    await api.criarTransacao(authContext.accessToken, familiaId, {
      tipo: 'despesa',
      valor: '30.00',
      categoriaId: categoria.id,
      descricao: 'Uber E2E original',
      data: hoje(),
    });

    await abrirInicio(page, authContext, familiaId);
    await irParaAba(page, 'Extrato');
    const original = page.getByRole('listitem').filter({ hasText: 'Uber E2E original' });
    await expect(original).toBeVisible({ timeout: 10_000 });

    // A edição é feita pela API (PATCH); o teste confere que o Extrato mostra o resultado.
    const listRes = await page.request.get(`${BASE_URL}/api/transacoes`, {
      headers: {
        Authorization: `Bearer ${authContext.accessToken}`,
        'x-familia-id': familiaId,
      },
    });

    const listData = (await listRes.json()) as {
      transacoes: Array<{ id: string; descricao: string | null; valor: string }>;
    };
    const tx = listData.transacoes.find((t) => t.descricao === 'Uber E2E original');
    expect(tx).toBeTruthy();

    const patchRes = await page.request.patch(`${BASE_URL}/api/transacoes/${tx!.id}`, {
      headers: {
        Authorization: `Bearer ${authContext.accessToken}`,
        'x-familia-id': familiaId,
        'Content-Type': 'application/json',
      },
      data: {
        tipo: 'despesa',
        valor: '45.00',
        categoriaId: categoria.id,
        descricao: 'Uber E2E editado',
        data: hoje(),
      },
    });

    expect(patchRes.status()).toBe(200);

    // Sai do Extrato e volta: a lista é buscada de novo ao entrar na tela.
    await irParaAba(page, 'Início');
    await irParaAba(page, 'Extrato');

    const linha = page.getByRole('listitem').filter({ hasText: 'Uber E2E editado' });
    await expect(linha).toBeVisible({ timeout: 10_000 });
    await expect(linha).toContainText(/[-\u2212]\s*R\$\s*45,00/);
    await expect(original).toHaveCount(0);
  });

  // ── 6. Excluir transação → removida do extrato ───────────────────────────
  test('excluir transação remove-a do extrato', async ({ page, authContext, familiaId }) => {
    const categoria = await api.criarCategoria(authContext.accessToken, familiaId, {
      nome: 'Lazer E2E',
      tipo: 'despesa',
    });

    await api.criarTransacao(authContext.accessToken, familiaId, {
      tipo: 'despesa',
      valor: '80.00',
      categoriaId: categoria.id,
      descricao: 'Cinema E2E para excluir',
      data: hoje(),
    });

    // A exclusão é feita pela API (DELETE); o teste confere que o Extrato não a mostra mais.
    const listRes = await page.request.get(`${BASE_URL}/api/transacoes`, {
      headers: {
        Authorization: `Bearer ${authContext.accessToken}`,
        'x-familia-id': familiaId,
      },
    });

    const listData = (await listRes.json()) as {
      transacoes: Array<{ id: string; descricao: string | null }>;
    };
    const tx = listData.transacoes.find((t) => t.descricao === 'Cinema E2E para excluir');
    expect(tx).toBeTruthy();

    const deleteRes = await page.request.delete(`${BASE_URL}/api/transacoes/${tx!.id}`, {
      headers: {
        Authorization: `Bearer ${authContext.accessToken}`,
        'x-familia-id': familiaId,
      },
    });

    expect(deleteRes.status()).toBe(204);

    await abrirInicio(page, authContext, familiaId);
    await irParaAba(page, 'Extrato');

    // Era o único lançamento da família: a lista carregada está vazia, e não só ainda carregando.
    await expect(page.getByText(/Nenhum lançamento em/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Cinema E2E para excluir')).toHaveCount(0);
  });
});
