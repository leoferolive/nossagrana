import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { resetAppMocks } from '@/test/app-mocks';
import { renderApp } from '@/test/render-app';

afterEach(resetAppMocks);

const tituloNoConteudo = (nome: RegExp) =>
  within(screen.getByRole('main')).getByRole('heading', { level: 1, name: nome });

const TELAS_POR_ENDERECO: Array<[string, RegExp]> = [
  ['/', /nossagrana/i],
  ['/extrato', /^extrato$/i],
  ['/planejar/contas', /lançamentos do mês/i],
  ['/planejar/limites', /orçamento mensal/i],
  ['/planejar/cofrinhos', /^cofrinhos$/i],
  ['/mais', /configurações/i],
  ['/mais/relatorios', /relatórios/i],
  ['/mais/historico', /histórico/i],
  ['/mais/familia', /^família$/i],
  ['/mais/categorias', /^categorias$/i],
  ['/mais/metodos-pagamento', /cartões e pagamentos/i],
  ['/mais/perfil', /^perfil$/i],
  ['/mais/ajuda', /^ajuda$/i],
];

describe('App > rotas > a tela vem do endereço', () => {
  it.each(TELAS_POR_ENDERECO)('abre %s direto na tela certa', async (endereco, titulo) => {
    renderApp(endereco);

    expect(await waitFor(() => tituloNoConteudo(titulo))).toBeInTheDocument();
  });

  it('recarregar em /extrato mantém o Extrato', async () => {
    renderApp('/extrato');

    expect(await waitFor(() => tituloNoConteudo(/^extrato$/i))).toBeInTheDocument();
  });

  it('link direto para /mais/categorias abre Categorias', async () => {
    renderApp('/mais/categorias');

    expect(await waitFor(() => tituloNoConteudo(/^categorias$/i))).toBeInTheDocument();
  });

  it('clicar em "Ver extrato" a partir do Início muda a tela e o endereço', async () => {
    renderApp('/');
    await waitFor(() => screen.getByRole('button', { name: /ver extrato/i }));

    fireEvent.click(screen.getByRole('button', { name: /ver extrato/i }));

    expect(tituloNoConteudo(/^extrato$/i)).toBeInTheDocument();
    expect(screen.getByTestId('sonda-local')).toHaveTextContent('/extrato');
  });

  it('endereço desconhecido mostra o Início', async () => {
    renderApp('/nao-existe');

    expect(await waitFor(() => tituloNoConteudo(/nossagrana/i))).toBeInTheDocument();
    expect(screen.getByTestId('sonda-local')).toHaveTextContent(/^\/$/);
  });

  it('/planejar mostra Lançamentos até a tela Planejar existir', async () => {
    renderApp('/planejar');

    expect(await waitFor(() => tituloNoConteudo(/lançamentos do mês/i))).toBeInTheDocument();
    expect(screen.getByTestId('sonda-local')).toHaveTextContent('/planejar/contas');
  });
});
