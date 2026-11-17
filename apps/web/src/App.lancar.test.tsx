import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeTransacao, mockSessao, resetAppMocks } from '@/test/app-mocks';
import { barraInferior } from '@/test/barra-inferior';
import { renderApp } from '@/test/render-app';

import { categoriaService, transacaoService } from './services/core-financeiro.service';
import { useCategoriaStore } from './stores/categoria.store';

// Fala controlada pelo teste: troca o reconhecimento de voz do navegador, que o jsdom não tem.
const falaDeTeste = vi.hoisted(() => ({ finalTranscript: '' }));
vi.mock('./hooks/use-speech-recognition', () => ({
  useSpeechRecognition: () => ({
    isListening: false,
    transcript: '',
    finalTranscript: falaDeTeste.finalTranscript,
    error: null,
    isSupported: true,
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

const local = () => screen.getByTestId('sonda-local');
const tituloNoConteudo = (nome: RegExp) =>
  within(screen.getByRole('main')).getByRole('heading', { level: 1, name: nome });
const abrirPainelNovo = () => fireEvent.click(screen.getByRole('button', { name: 'Lançar' }));
const voltar = () => fireEvent.click(screen.getByRole('button', { name: /histórico para trás/i }));

beforeEach(() => {
  mockSessao({ autenticado: true, familiaAtiva: 'fam-test' });
  falaDeTeste.finalTranscript = '';
  vi.mocked(categoriaService.listar).mockResolvedValue({
    categorias: [
      {
        id: 'cat-1',
        familiaId: 'fam-test',
        nome: 'Mercado',
        tipo: 'despesa',
        ativo: true,
        criadoPor: 'u1',
        criadoEm: '2026-01-01',
      },
    ],
  });
});

afterEach(() => {
  resetAppMocks();
  vi.mocked(categoriaService.listar).mockResolvedValue({ categorias: [] });
  useCategoriaStore.setState({ categorias: [] });
});

describe('App > painel de lançar no endereço', () => {
  it('abrir o painel acrescenta ?lancar=nova sem trocar a tela de baixo', async () => {
    renderApp('/extrato');
    await waitFor(() => tituloNoConteudo(/^extrato$/i));

    abrirPainelNovo();

    expect(await screen.findByRole('heading', { name: 'Nova Transação' })).toBeInTheDocument();
    expect(local()).toHaveTextContent('/extrato?lancar=nova');
    expect(tituloNoConteudo(/^extrato$/i)).toBeInTheDocument();
  });

  it('voltar com o painel aberto e valor digitado fecha só o painel', async () => {
    renderApp(['/', '/extrato']);
    await waitFor(() => tituloNoConteudo(/^extrato$/i));
    abrirPainelNovo();
    fireEvent.change(await screen.findByLabelText(/valor/i), { target: { value: '100.00' } });

    voltar();

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Nova Transação' })).not.toBeInTheDocument(),
    );
    expect(local()).toHaveTextContent(/^\/extrato$/);
    expect(tituloNoConteudo(/^extrato$/i)).toBeInTheDocument();
  });

  it('fechar pelo botão deixa o histórico como estava: um voltar depois sai da tela', async () => {
    renderApp(['/', '/extrato']);
    await waitFor(() => tituloNoConteudo(/^extrato$/i));
    abrirPainelNovo();

    fireEvent.click(await screen.findByRole('button', { name: /fechar modal/i }));

    await waitFor(() => expect(local()).toHaveTextContent(/^\/extrato$/));
    voltar();
    expect(await waitFor(() => tituloNoConteudo(/^início$/i))).toBeInTheDocument();
    expect(local()).toHaveTextContent(/^\/$/);
  });

  it('salvar uma transação nova fecha o painel e mantém a tela', async () => {
    renderApp(['/', '/extrato']);
    await waitFor(() => tituloNoConteudo(/^extrato$/i));
    abrirPainelNovo();
    fireEvent.change(await screen.findByLabelText(/valor/i), { target: { value: '100.00' } });
    fireEvent.click(screen.getByRole('combobox', { name: 'Categoria' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Mercado' }));

    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => expect(transacaoService.registrar).toHaveBeenCalled());
    await waitFor(() => expect(local()).toHaveTextContent(/^\/extrato$/));
    expect(screen.queryByRole('heading', { name: 'Nova Transação' })).not.toBeInTheDocument();
  });

  it('editar uma transação pelo extrato abre com ?lancar=<id>', async () => {
    vi.mocked(transacaoService.listar).mockResolvedValue({
      transacoes: [makeTransacao({ id: 'tx-edit-1', descricao: 'Mercado do mês' })],
    });
    renderApp('/extrato');

    fireEvent.click((await screen.findAllByText('Mercado do mês'))[0]);

    expect(await screen.findByText('Editar Transação')).toBeInTheDocument();
    expect(local()).toHaveTextContent('/extrato?lancar=tx-edit-1');
  });

  it('recarregar em ?lancar=<id> de transação que não está em memória remove o parâmetro', async () => {
    renderApp('/extrato?lancar=tx-que-nao-esta-em-memoria');

    await waitFor(() => expect(local()).toHaveTextContent(/^\/extrato$/));
    expect(tituloNoConteudo(/^extrato$/i)).toBeInTheDocument();
    expect(screen.queryByText('Editar Transação')).not.toBeInTheDocument();
  });

  it('no StrictMode, recarregar em ?lancar=<id> desconhecido não volta entradas a mais', async () => {
    renderApp(
      [
        '/',
        '/extrato',
        { pathname: '/extrato', search: '?lancar=desconhecida', state: { painelLancar: true } },
      ],
      { strict: true },
    );

    await waitFor(() => expect(local()).toHaveTextContent(/^\/extrato$/));
    expect(tituloNoConteudo(/^extrato$/i)).toBeInTheDocument();
    // Um único voltar sai do Extrato: não sobra uma segunda entrada /extrato no histórico.
    voltar();
    await waitFor(() => expect(local()).toHaveTextContent(/^\/$/));
  });

  it('link direto com ?lancar=nova abre o painel sobre a tela', async () => {
    renderApp('/extrato?lancar=nova');

    expect(await screen.findByRole('heading', { name: 'Nova Transação' })).toBeInTheDocument();
    expect(tituloNoConteudo(/^extrato$/i)).toBeInTheDocument();
  });

  it('o fluxo de voz termina abrindo o painel pelo mesmo caminho, com os dados falados', async () => {
    renderApp(['/', '/extrato']);
    await waitFor(() => tituloNoConteudo(/^extrato$/i));
    const botaoMais = screen.getByRole('button', { name: 'Lançar' });

    // Segurar o "+" por 500 ms abre a folha de gravação.
    fireEvent.pointerDown(botaoMais, { clientX: 1, clientY: 1 });
    await act(() => new Promise((resolve) => setTimeout(resolve, 600)));
    fireEvent.pointerUp(botaoMais);
    // Depois de um toque longo o navegador ainda dispara o clique; ele não pode abrir o painel.
    fireEvent.click(botaoMais);
    falaDeTeste.finalTranscript = 'gastei 50 reais no mercado';
    fireEvent.pointerDown(await screen.findByRole('button', { name: /segure para falar/i }));

    expect(await screen.findByRole('heading', { name: 'Nova Transação' })).toBeInTheDocument();
    expect(local()).toHaveTextContent('/extrato?lancar=nova');
    expect(screen.getByLabelText(/valor/i)).toHaveValue(50);
    voltar();
    await waitFor(() => expect(local()).toHaveTextContent(/^\/extrato$/));
  });
});

describe('App > dados de voz não sobram depois de o painel fechar', () => {
  const rascunhoPorVoz = async () => {
    await waitFor(() => tituloNoConteudo(/^extrato$/i));
    const botaoMais = screen.getByRole('button', { name: 'Lançar' });
    fireEvent.pointerDown(botaoMais, { clientX: 1, clientY: 1 });
    await act(() => new Promise((resolve) => setTimeout(resolve, 600)));
    fireEvent.pointerUp(botaoMais);
    // Depois de um toque longo o navegador ainda dispara o clique; ele não pode abrir o painel.
    fireEvent.click(botaoMais);
    falaDeTeste.finalTranscript = 'gastei 50 reais no mercado';
    fireEvent.pointerDown(await screen.findByRole('button', { name: /segure para falar/i }));
    await waitFor(() => expect(screen.getByLabelText(/valor/i)).toHaveValue(50));
  };

  const fecharPeloVoltar = async () => {
    voltar();
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Nova Transação' })).not.toBeInTheDocument(),
    );
  };

  it('rascunho por voz, voltar do histórico e editar um lançamento: mostra o lançamento, não a voz', async () => {
    vi.mocked(transacaoService.listar).mockResolvedValue({
      transacoes: [makeTransacao({ id: 'tx-1', descricao: 'Farmácia', valor: '75.00' })],
    });
    renderApp(['/', '/extrato']);
    await rascunhoPorVoz();
    await fecharPeloVoltar();

    fireEvent.click((await screen.findAllByText('Farmácia'))[0]);

    await screen.findByText('Editar Transação');
    expect(screen.getByLabelText(/valor/i)).toHaveValue(75);
    expect(screen.getByLabelText(/descri/i)).toHaveValue('Farmácia');
  });

  it('rascunho por voz, voltar do histórico e "+" de novo: formulário vazio', async () => {
    renderApp(['/', '/extrato']);
    await rascunhoPorVoz();
    await fecharPeloVoltar();

    abrirPainelNovo();

    expect(await screen.findByRole('heading', { name: 'Nova Transação' })).toBeInTheDocument();
    expect(screen.getByLabelText(/valor/i)).toHaveValue(null);
  });

  it('fluxo normal: voz, painel preenchido e salvar registra os dados falados', async () => {
    renderApp(['/', '/extrato']);
    await rascunhoPorVoz();

    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => expect(transacaoService.registrar).toHaveBeenCalled());
    expect(vi.mocked(transacaoService.registrar).mock.calls[0][0]).toMatchObject({
      valor: '50.00',
    });
  });
});

describe('App > encerrar o painel anda no histórico uma única vez', () => {
  const MODOS: Array<[string, { strict?: boolean; navegador?: boolean }]> = [
    ['MemoryRouter', {}],
    ['StrictMode', { strict: true }],
    ['BrowserRouter', { navegador: true }],
  ];

  const ENCERRAMENTOS: Array<[string, () => Promise<void>]> = [
    [
      'fechar no X',
      async () => void fireEvent.click(screen.getByRole('button', { name: /fechar modal/i })),
    ],
    [
      'salvar',
      async () => {
        fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
        await waitFor(() => expect(transacaoService.editar).toHaveBeenCalled());
      },
    ],
    [
      'excluir',
      async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        fireEvent.click(screen.getByRole('button', { name: /excluir/i }));
        await waitFor(() => expect(transacaoService.excluir).toHaveBeenCalled());
      },
    ],
  ];

  const esperar = (ms = 80) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

  beforeEach(() => {
    vi.mocked(transacaoService.listar).mockResolvedValue({
      transacoes: [makeTransacao({ id: 'tx-1', descricao: 'Farmácia' })],
    });
  });

  const editarPrimeira = async () => {
    fireEvent.click((await screen.findAllByText('Farmácia'))[0]);
    await screen.findByText('Editar Transação');
    expect(local()).toHaveTextContent('/extrato?lancar=tx-1');
  };

  describe.each(MODOS)('%s', (_nome, opcoes) => {
    it.each(ENCERRAMENTOS)(
      'editar e %s termina em /extrato; um voltar leva ao Início',
      async (_n, encerrar) => {
        renderApp('/', opcoes);
        fireEvent.click(await barraInferior().findByRole('link', { name: 'Extrato' }));
        await editarPrimeira();

        await encerrar();
        await esperar();

        expect(local()).toHaveTextContent(/^\/extrato$/);
        voltar();
        await esperar();
        expect(local()).toHaveTextContent(/^\/$/);
      },
    );

    it('nova transação salva: mesma tela e um voltar leva à anterior', async () => {
      renderApp('/', opcoes);
      fireEvent.click(await barraInferior().findByRole('link', { name: 'Extrato' }));
      abrirPainelNovo();
      fireEvent.change(await screen.findByLabelText(/valor/i), { target: { value: '10.00' } });
      fireEvent.click(screen.getByRole('combobox', { name: 'Categoria' }));
      fireEvent.click(await screen.findByRole('option', { name: 'Mercado' }));

      fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
      await waitFor(() => expect(transacaoService.registrar).toHaveBeenCalled());
      await esperar();

      expect(local()).toHaveTextContent(/^\/extrato$/);
      voltar();
      await esperar();
      expect(local()).toHaveTextContent(/^\/$/);
    });
  });

  it.each(ENCERRAMENTOS)(
    'Extrato aberto por link direto: editar e %s continua em /extrato',
    async (_n, encerrar) => {
      renderApp('/extrato');
      await editarPrimeira();

      await encerrar();
      await esperar();

      expect(local()).toHaveTextContent(/^\/extrato$/);
      expect(tituloNoConteudo(/^extrato$/i)).toBeInTheDocument();
    },
  );
});

describe('App > o Extrato aberto atualiza a lista depois de gravar', () => {
  const FARMACIA = makeTransacao({ id: 'tx-1', descricao: 'Farmácia', valor: '75.00' });

  const preencherEGravarNova = async () => {
    abrirPainelNovo();
    fireEvent.change(await screen.findByLabelText(/valor/i), { target: { value: '100.00' } });
    fireEvent.click(screen.getByRole('combobox', { name: 'Categoria' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Mercado' }));
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
  };

  const abrirEdicaoDaFarmacia = async () => {
    fireEvent.click((await screen.findAllByText('Farmácia'))[0]);
    await screen.findByText('Editar Transação');
  };

  it('lançar uma receita pelo "+" mostra a linha nova sem sair da tela', async () => {
    vi.mocked(transacaoService.listar)
      .mockResolvedValueOnce({ transacoes: [FARMACIA] })
      .mockResolvedValue({
        transacoes: [
          makeTransacao({ id: 'tx-2', descricao: 'Salário de novembro', tipo: 'receita' }),
          FARMACIA,
        ],
      });
    renderApp('/extrato');
    await screen.findAllByText('Farmácia');

    await preencherEGravarNova();

    expect((await screen.findAllByText('Salário de novembro')).length).toBeGreaterThan(0);
    expect(local()).toHaveTextContent(/^\/extrato$/);
  });

  it('editar o valor muda a linha', async () => {
    vi.mocked(transacaoService.listar)
      .mockResolvedValueOnce({ transacoes: [FARMACIA] })
      .mockResolvedValue({ transacoes: [{ ...FARMACIA, valor: '99.00' }] });
    renderApp('/extrato');
    await abrirEdicaoDaFarmacia();

    fireEvent.change(screen.getByLabelText(/valor/i), { target: { value: '99.00' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    expect((await screen.findAllByText(/99,00/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/75,00/)).not.toBeInTheDocument();
  });

  it('excluir tira a linha', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(transacaoService.listar)
      .mockResolvedValueOnce({ transacoes: [FARMACIA] })
      .mockResolvedValue({ transacoes: [] });
    renderApp('/extrato');
    await abrirEdicaoDaFarmacia();

    fireEvent.click(screen.getByRole('button', { name: /excluir/i }));

    await waitFor(() => expect(screen.queryByText('Farmácia')).not.toBeInTheDocument());
  });
});
