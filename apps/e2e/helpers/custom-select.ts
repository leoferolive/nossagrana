/**
 * Escolha de opção no `CustomSelect` do app (botão `combobox` que abre uma lista `listbox`).
 * Não é um `<select>`: `selectOption` não funciona.
 */
import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Abre o campo pelo nome acessível e escolhe a opção pelo nome exato. `exact` é necessário
 * porque as categorias padrão da família podem ter nomes que contêm o da opção procurada.
 * `escopo` restringe a busca (por exemplo, ao painel de lançar).
 */
export async function escolherOpcao(
  page: Page,
  escopo: Locator,
  campo: string,
  opcao: string,
): Promise<void> {
  const combo = escopo.getByRole('combobox', { name: campo, exact: true });
  await combo.click();
  await page.getByRole('option', { name: opcao, exact: true }).click();
  // A lista fecha e o campo passa a mostrar a opção escolhida.
  await expect(combo).toContainText(opcao);
}
