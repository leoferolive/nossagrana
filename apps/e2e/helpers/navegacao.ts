/**
 * Navegação da nova UI nos testes E2E. O projeto roda em 390x844 (celular), onde a barra
 * inferior é a navegação; no desktop ela some e quem aparece é o menu lateral.
 */
import { expect, type Locator, type Page } from '@playwright/test';

import { abrirAppAutenticado } from './session.js';

/** Sessão do usuário criada pela fixture `authContext` (só o que a navegação precisa). */
export interface SessaoDoTeste {
  refreshCookie: { name: string; value: string } | null;
}

/** Barra inferior de cinco posições (Início, Extrato, Lançar, Planejar, Mais). */
export const barraPrincipal = (page: Page): Locator =>
  page.getByRole('navigation', { name: 'Navegação principal' });

/** Abre o app autenticado na família dada e espera o Início. */
export async function abrirInicio(
  page: Page,
  sessao: SessaoDoTeste,
  familiaId: string,
): Promise<void> {
  await abrirAppAutenticado(page, sessao, familiaId);
  await esperarTela(page, 'Início');
}

/** Espera o título (h1) da tela; é o que diz que o app terminou de trocar de tela. */
export async function esperarTela(page: Page, titulo: string): Promise<void> {
  await expect(page.getByRole('heading', { name: titulo, level: 1, exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

/** Vai a uma aba pela barra inferior e espera o título dela. */
export async function irParaAba(
  page: Page,
  aba: 'Início' | 'Extrato' | 'Planejar' | 'Mais',
): Promise<void> {
  await barraPrincipal(page).getByRole('link', { name: aba, exact: true }).click();
  await esperarTela(page, aba);
}

/**
 * Abre uma tela de segundo nível pela linha de link dela (em Mais ou Planejar). Em Planejar o
 * nome acessível da linha inclui o resumo ("Limites por categoria 2 de 3 ..."), então o rótulo
 * casa pelo início do nome.
 */
export async function abrirLinha(page: Page, rotulo: string, titulo: string): Promise<void> {
  const inicioDoNome = new RegExp(`^${rotulo}`);
  await page.getByRole('main').getByRole('link', { name: inicioDoNome }).click();
  await esperarTela(page, titulo);
}

/** Abre o painel de lançar pelo "+" da barra e devolve o painel. */
export async function abrirPainelLancar(page: Page): Promise<Locator> {
  await barraPrincipal(page).getByRole('button', { name: 'Lançar', exact: true }).click();
  const painel = page.getByRole('dialog');
  await expect(painel.getByRole('heading', { name: 'Nova Transação' })).toBeVisible({
    timeout: 5_000,
  });
  return painel;
}

/** Salva o lançamento do painel e espera o painel fechar. */
export async function salvarLancamento(page: Page, painel: Locator): Promise<void> {
  await painel.getByRole('button', { name: 'Salvar Transação', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 5_000 });
}
