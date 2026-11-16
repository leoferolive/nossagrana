import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockSessao, resetAppMocks } from '@/test/app-mocks';
import { barraInferior } from '@/test/barra-inferior';
import { renderApp } from '@/test/render-app';

afterEach(resetAppMocks);

const tituloNoConteudo = (nome: RegExp) =>
  within(screen.getByRole('main')).getByRole('heading', { level: 1, name: nome });

const TELAS_POR_ENDERECO: Array<[string, RegExp]> = [
  ['/', /^início$/i],
  ['/extrato', /^extrato$/i],
  ['/planejar', /^planejar$/i],
  ['/planejar/contas', /lançamentos do mês/i],
  ['/planejar/limites', /orçamento mensal/i],
  ['/planejar/cofrinhos', /^cofrinhos$/i],
  ['/mais', /^mais$/i],
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
    await waitFor(() => barraInferior().getByRole('link', { name: 'Extrato' }));

    fireEvent.click(barraInferior().getByRole('link', { name: 'Extrato' }));

    expect(tituloNoConteudo(/^extrato$/i)).toBeInTheDocument();
    expect(screen.getByTestId('sonda-local')).toHaveTextContent('/extrato');
  });

  it('endereço desconhecido mostra o Início', async () => {
    renderApp('/nao-existe');

    expect(await waitFor(() => tituloNoConteudo(/^início$/i))).toBeInTheDocument();
    expect(screen.getByTestId('sonda-local')).toHaveTextContent(/^\/$/);
  });

  it('/planejar mostra a tela Planejar, sem redirecionar', async () => {
    renderApp('/planejar');

    expect(await waitFor(() => tituloNoConteudo(/^planejar$/i))).toBeInTheDocument();
    expect(screen.getByTestId('sonda-local')).toHaveTextContent(/^\/planejar$/);
  });
});

describe('App > guardas > sessão e retorno ao endereço pedido', () => {
  const entrarComFamilias = async (familias: Array<{ id: string; nome: string }>) => {
    const { familiaService } = await import('./services/auth.service');
    vi.mocked(familiaService.listarMinhas).mockResolvedValue({
      familias: familias.map((f) => ({
        ...f,
        dataEntrada: '2026-01-01',
        role: 'admin' as const,
      })),
    });
    fireEvent.submit(screen.getByRole('form', { name: /login/i }));
  };

  const local = () => screen.getByTestId('sonda-local');

  it('sem login, endereço protegido leva a /entrar', async () => {
    mockSessao();
    renderApp('/mais/categorias');

    expect(await screen.findByRole('form', { name: /login/i })).toBeInTheDocument();
    expect(local()).toHaveTextContent(/^\/entrar$/);
  });

  it('link direto sem login: depois do login chega ao endereço pedido, não ao Início', async () => {
    mockSessao();
    renderApp('/mais/categorias');
    await screen.findByRole('form', { name: /login/i });

    await entrarComFamilias([{ id: 'fam-1', nome: 'Casa' }]);

    expect(await waitFor(() => tituloNoConteudo(/^categorias$/i))).toBeInTheDocument();
    expect(local()).toHaveTextContent(/^\/mais\/categorias$/);
  });

  it('o endereço pedido mantém o parâmetro do endereço', async () => {
    mockSessao();
    renderApp('/planejar/fatura/m1?mes=2026-11');
    await screen.findByRole('form', { name: /login/i });

    await entrarComFamilias([{ id: 'fam-1', nome: 'Casa' }]);

    await waitFor(() => expect(local()).toHaveTextContent('/planejar/fatura/m1?mes=2026-11'));
  });

  it('com várias famílias, o endereço pedido vale depois de escolher a família', async () => {
    mockSessao();
    renderApp('/mais/categorias');
    await screen.findByRole('form', { name: /login/i });

    await entrarComFamilias([
      { id: 'fam-1', nome: 'Casa' },
      { id: 'fam-2', nome: 'Praia' },
    ]);
    fireEvent.click(await screen.findByRole('button', { name: /praia/i }));

    expect(await waitFor(() => tituloNoConteudo(/^categorias$/i))).toBeInTheDocument();
    expect(local()).toHaveTextContent(/^\/mais\/categorias$/);
  });

  it('login sem endereço pedido segue a regra das famílias: nenhuma vai a /boas-vindas', async () => {
    mockSessao();
    renderApp('/entrar');

    await entrarComFamilias([]);

    await waitFor(() => expect(local()).toHaveTextContent(/^\/boas-vindas$/));
  });

  it('login sem endereço pedido segue a regra das famílias: uma vai ao Início', async () => {
    mockSessao();
    renderApp('/entrar');

    await entrarComFamilias([{ id: 'fam-1', nome: 'Casa' }]);

    expect(await waitFor(() => tituloNoConteudo(/^início$/i))).toBeInTheDocument();
    expect(local()).toHaveTextContent(/^\/$/);
  });

  it('login sem endereço pedido segue a regra das famílias: várias vão a /familias', async () => {
    mockSessao();
    renderApp('/entrar');

    await entrarComFamilias([
      { id: 'fam-1', nome: 'Casa' },
      { id: 'fam-2', nome: 'Praia' },
    ]);

    expect(
      await screen.findByRole('heading', { name: /escolha uma família/i }),
    ).toBeInTheDocument();
    expect(local()).toHaveTextContent(/^\/familias$/);
  });

  it('com login e sem família ativa, endereço protegido leva a /boas-vindas', async () => {
    mockSessao({ autenticado: true, familiaAtiva: null });
    renderApp('/extrato');

    expect(
      await screen.findByRole('heading', { name: /entrar numa família/i }),
    ).toBeInTheDocument();
    expect(local()).toHaveTextContent(/^\/boas-vindas$/);
  });

  it.each(['/entrar', '/cadastro'])('com login, %s leva ao Início', async (endereco) => {
    mockSessao({ autenticado: true, familiaAtiva: 'fam-test' });
    renderApp(endereco);

    expect(await waitFor(() => tituloNoConteudo(/^início$/i))).toBeInTheDocument();
    expect(local()).toHaveTextContent(/^\/$/);
  });

  it('descarta endereço pedido que sairia do app (//evil.example)', async () => {
    mockSessao();
    renderApp({ pathname: '/entrar', state: { de: '//evil.example' } });

    await entrarComFamilias([{ id: 'fam-1', nome: 'Casa' }]);

    expect(await waitFor(() => tituloNoConteudo(/^início$/i))).toBeInTheDocument();
    expect(local()).toHaveTextContent(/^\/$/);
  });

  it('sair leva ao login e voltar no histórico não mostra tela protegida', async () => {
    mockSessao({ autenticado: true, familiaAtiva: 'fam-test' });
    renderApp(['/', '/mais']);
    const main = await waitFor(() => screen.getByRole('main'));

    fireEvent.click(await within(main).findByRole('button', { name: 'Sair' }));

    expect(await screen.findByRole('form', { name: /login/i })).toBeInTheDocument();
    expect(local()).toHaveTextContent(/^\/entrar$/);

    fireEvent.click(screen.getByRole('button', { name: /histórico para trás/i }));

    expect(await screen.findByRole('form', { name: /login/i })).toBeInTheDocument();
    // A casca (barra inferior) só existe nas telas protegidas.
    expect(screen.queryByRole('link', { name: 'Extrato' })).not.toBeInTheDocument();
    expect(local()).toHaveTextContent(/^\/entrar$/);
  });

  it('depois de sair, entrar de novo não volta à tela que foi deixada', async () => {
    mockSessao({ autenticado: true, familiaAtiva: 'fam-test' });
    renderApp(['/', '/mais/categorias', '/mais']);
    const main = await waitFor(() => screen.getByRole('main'));
    fireEvent.click(await within(main).findByRole('button', { name: 'Sair' }));
    await screen.findByRole('form', { name: /login/i });

    await entrarComFamilias([{ id: 'fam-1', nome: 'Casa' }]);

    await waitFor(() => expect(local()).toHaveTextContent(/^\/$/));
  });
});

describe('App > o "Voltar" da tela e o voltar do navegador', () => {
  const local = () => screen.getByTestId('sonda-local');
  const voltarDoNavegador = () =>
    fireEvent.click(screen.getByRole('button', { name: /histórico para trás/i }));

  it('Início, Mais, Categorias e "Voltar" da tela: o voltar do navegador termina no Início', async () => {
    renderApp('/');
    fireEvent.click(await screen.findByRole('link', { name: 'Mais' }));
    const main = screen.getByRole('main');
    fireEvent.click(await within(main).findByRole('link', { name: 'Categorias' }));
    await waitFor(() => tituloNoConteudo(/^categorias$/i));

    fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: /^voltar$/i }));

    await waitFor(() => expect(local()).toHaveTextContent(/^\/mais$/));
    voltarDoNavegador();
    await waitFor(() => expect(local()).toHaveTextContent(/^\/$/));
  });

  it('aberta por link direto, o "Voltar" da tela vai à origem do mapa e não deixa Categorias para trás', async () => {
    renderApp('/mais/categorias');
    await waitFor(() => tituloNoConteudo(/^categorias$/i));

    fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: /^voltar$/i }));

    await waitFor(() => expect(local()).toHaveTextContent(/^\/mais$/));
    voltarDoNavegador();
    expect(local()).toHaveTextContent(/^\/mais$/);
  });
});

describe('App > "Voltar" depois de link direto com login', () => {
  it('link direto sem login, login e "Voltar": vai a /mais e a entrada de /entrar não fica no histórico', async () => {
    mockSessao();
    renderApp('/mais/categorias', { navegador: true });
    await screen.findByRole('form', { name: /login/i });
    const { familiaService } = await import('./services/auth.service');
    vi.mocked(familiaService.listarMinhas).mockResolvedValue({
      familias: [{ id: 'fam-1', nome: 'Casa', dataEntrada: '2026-01-01', role: 'admin' }],
    });
    fireEvent.submit(screen.getByRole('form', { name: /login/i }));
    await waitFor(() => tituloNoConteudo(/^categorias$/i));

    fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: /^voltar$/i }));

    await waitFor(() => expect(screen.getByTestId('sonda-local')).toHaveTextContent(/^\/mais$/));
    fireEvent.click(screen.getByRole('button', { name: /histórico para trás/i }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByTestId('sonda-local')).toHaveTextContent(/^\/mais$/);
    expect(screen.queryByRole('form', { name: /login/i })).not.toBeInTheDocument();
  });
});
