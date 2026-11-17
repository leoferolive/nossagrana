/**
 * Passo a passo do painel de lançar nos testes E2E: abrir pelo "+", valor, tipo, categoria (chip
 * ou "Todas"), data, forma de pagamento, "Mais opções" e salvar. Concentrado aqui para os specs
 * não repetirem os seletores do painel.
 */
import { expect, type Locator, type Page } from '@playwright/test';

import { barraPrincipal } from './navegacao.js';

type Tipo = 'despesa' | 'receita';

export interface DadosDoLancamento {
  /** Padrão: despesa. */
  tipo?: Tipo;
  /** Valor com ponto decimal, como o campo aceita (`'200.00'`). */
  valor: string;
  categoria: string;
  /** Padrão: Hoje. `'Ontem'` usa o chip; `{ outra: 'AAAA-MM-DD' }` usa "Outra data". */
  data?: 'Hoje' | 'Ontem' | { outra: string };
  /** Nome da forma de pagamento; sem ela o lançamento não tem forma. */
  pagamento?: string;
  descricao?: string;
  /** Só com cartão de crédito. */
  parcelas?: number;
  recorrente?: boolean;
  /** Roda com tudo preenchido e antes de salvar (para conferir "Mais opções", por exemplo). */
  antesDeSalvar?: (painel: Locator) => Promise<void>;
}

/** Abre o painel de lançar pelo "+" da barra e devolve o painel. */
export async function abrirPainelLancar(page: Page): Promise<Locator> {
  await barraPrincipal(page).getByRole('button', { name: 'Lançar', exact: true }).click();
  const painel = page.getByRole('dialog', { name: 'Nova Transação' });
  await expect(painel).toBeVisible({ timeout: 5_000 });
  return painel;
}

/** Escolhe a categoria pelo chip; se ela não está entre as mais usadas, pela lista de "Todas". */
export async function escolherCategoria(page: Page, painel: Locator, nome: string): Promise<void> {
  const chip = painel.getByRole('group', { name: 'Categoria' }).getByRole('button', {
    name: nome,
    exact: true,
  });
  if ((await chip.count()) === 0) {
    await painel.getByRole('button', { name: 'Todas', exact: true }).click();
    const lista = page.getByRole('dialog', { name: 'Todas as categorias' });
    await lista.getByRole('button', { name: nome, exact: true }).click();
    await expect(lista).toHaveCount(0);
  } else {
    await chip.click();
  }
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
}

/** Escolhe a data pelos chips Hoje, Ontem ou "Outra data". */
export async function escolherData(painel: Locator, data: NonNullable<DadosDoLancamento['data']>) {
  const quando = painel.getByRole('group', { name: 'Quando' });
  if (typeof data === 'string') {
    await quando.getByRole('button', { name: data, exact: true }).click();
    return;
  }
  await quando.getByRole('button', { name: /^Outra data/ }).click();
  await quando.getByLabel('Data', { exact: true }).fill(data.outra);
}

/** Escolhe a forma de pagamento pelo chip. */
export async function escolherPagamento(painel: Locator, nome: string): Promise<void> {
  const chip = painel.getByRole('group', { name: 'Pago com' }).getByRole('button', {
    name: nome,
    exact: true,
  });
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
}

/** Abre "Descrição, parcelas e repetição" se ainda estiver fechada. */
export async function abrirMaisOpcoes(painel: Locator): Promise<void> {
  const linha = painel.getByRole('button', { name: 'Descrição, parcelas e repetição' });
  if ((await linha.getAttribute('aria-expanded')) !== 'true') await linha.click();
}

async function preencherMaisOpcoes(painel: Locator, dados: DadosDoLancamento): Promise<void> {
  if (!dados.descricao && !dados.parcelas && !dados.recorrente) return;
  await abrirMaisOpcoes(painel);
  if (dados.descricao)
    await painel.getByRole('textbox', { name: 'Descrição' }).fill(dados.descricao);
  if (dados.parcelas) {
    await painel.getByRole('button', { name: 'Parcelado', exact: true }).click();
    await painel.getByRole('spinbutton', { name: 'Parcelas' }).fill(String(dados.parcelas));
  }
  if (dados.recorrente) {
    await painel.getByRole('button', { name: 'Recorrente', exact: true }).click();
  }
}

/** Salva o lançamento do painel e espera o painel fechar. */
export async function salvarLancamento(
  page: Page,
  painel: Locator,
  tipo: Tipo = 'despesa',
): Promise<void> {
  await painel.getByRole('button', { name: `Salvar ${tipo}`, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 5_000 });
}

/** Lança um lançamento do começo ao fim: abre o painel, preenche, salva e espera fechar. */
export async function lancar(page: Page, dados: DadosDoLancamento): Promise<void> {
  const tipo = dados.tipo ?? 'despesa';
  const painel = await abrirPainelLancar(page);

  await painel
    .getByRole('button', { name: tipo === 'receita' ? 'Receita' : 'Despesa', exact: true })
    .click();
  await painel.getByRole('spinbutton', { name: 'Valor' }).fill(dados.valor);
  await escolherCategoria(page, painel, dados.categoria);
  if (dados.data) await escolherData(painel, dados.data);
  if (dados.pagamento) await escolherPagamento(painel, dados.pagamento);
  await preencherMaisOpcoes(painel, dados);
  await dados.antesDeSalvar?.(painel);
  await salvarLancamento(page, painel, tipo);
}

/** Aviso de baixo ("Despesa lançada", "Lançamento desfeito"...), achado pelo texto. */
export const avisoDeLancamento = (page: Page, texto: string): Locator =>
  page.getByRole('status').filter({ hasText: texto });
