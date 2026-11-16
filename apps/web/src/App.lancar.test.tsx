import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeTransacao, mockSessao, resetAppMocks } from '@/test/app-mocks';
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
const abrirPainelNovo = () =>
  fireEvent.click(screen.getAllByRole('button', { name: /^nova transação/i })[0]);
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
    expect(await waitFor(() => tituloNoConteudo(/nossagrana/i))).toBeInTheDocument();
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

  it('link direto com ?lancar=nova abre o painel sobre a tela', async () => {
    renderApp('/extrato?lancar=nova');

    expect(await screen.findByRole('heading', { name: 'Nova Transação' })).toBeInTheDocument();
    expect(tituloNoConteudo(/^extrato$/i)).toBeInTheDocument();
  });

  it('o fluxo de voz termina abrindo o painel pelo mesmo caminho, com os dados falados', async () => {
    renderApp(['/', '/extrato']);
    await waitFor(() => tituloNoConteudo(/^extrato$/i));
    const botaoMais = screen.getAllByRole('button', { name: /segure para usar voz/i })[0];

    // Segurar o "+" por 500 ms abre a folha de gravação.
    fireEvent.pointerDown(botaoMais, { clientX: 1, clientY: 1 });
    await act(() => new Promise((resolve) => setTimeout(resolve, 600)));
    fireEvent.pointerUp(botaoMais);
    falaDeTeste.finalTranscript = 'gastei 50 reais no mercado';
    fireEvent.pointerDown(await screen.findByRole('button', { name: /segure para falar/i }));

    expect(await screen.findByRole('heading', { name: 'Nova Transação' })).toBeInTheDocument();
    expect(local()).toHaveTextContent('/extrato?lancar=nova');
    expect(screen.getByLabelText(/valor/i)).toHaveValue(50);
    voltar();
    await waitFor(() => expect(local()).toHaveTextContent(/^\/extrato$/));
  });
});
