import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { esquecerBuscasDeCategorias } from '@/hooks/use-categorias-mais-usadas';
import { transacaoService } from '@/services/core-financeiro.service';
import { useAvisoStore } from '@/stores/aviso.store';
import { useCategoriaStore } from '@/stores/categoria.store';
import { useMetodoPagamentoStore } from '@/stores/metodo-pagamento.store';
import type { DadosVoz } from './transacao-modal';
import { TransacaoModal } from './transacao-modal';

// Fake nomeada do I/O: as buscas que o painel faz ao abrir (categorias, formas de pagamento e
// os lançamentos recentes que ordenam os chips) respondem vazio, sem rede.
vi.mock('@/services/core-financeiro.service', () => ({
  transacaoService: { listar: vi.fn() },
  categoriaService: { listar: vi.fn().mockResolvedValue({ categorias: [] }) },
  metodoPagamentoService: { listar: vi.fn().mockResolvedValue({ metodosPagamento: [] }) },
}));

beforeEach(() => {
  esquecerBuscasDeCategorias();
  useAvisoStore.getState().fechar();
  vi.mocked(transacaoService.listar).mockResolvedValue({ transacoes: [] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useCategoriaStore.setState({ categorias: [], carregando: false, erro: null });
  useMetodoPagamentoStore.setState({ metodos: [], carregando: false, erro: null });
});

const categoria = (id: string, nome: string, tipo: 'despesa' | 'receita' = 'despesa') => ({
  id,
  nome,
  tipo,
  ativo: true,
  familiaId: 'f1',
  criadoPor: 'u1',
  criadoEm: '2026-01-01',
});

const CATEGORIAS = [categoria('c1', 'Mercado'), categoria('c2', 'Salario', 'receita')];

const OITO_DESPESAS = [
  'Mercado',
  'Lazer',
  'Saúde',
  'Transporte',
  'Moradia',
  'Educação',
  'Viagem',
  'Pets',
].map((nome, i) => categoria(`d${i + 1}`, nome));

const metodo = (id: string, nome: string, tipo: 'credito' | 'pix' | 'dinheiro') => ({
  id,
  nome,
  tipo,
  dataFechamento: tipo === 'credito' ? 15 : null,
  dataVencimento: tipo === 'credito' ? 22 : null,
  usuarioDonoId: 'u1',
  ativo: true,
  familiaId: 'f1',
  criadoEm: '2026-01-01',
});

const METODOS = [metodo('m1', 'Nubank', 'credito'), metodo('m2', 'Pix', 'pix')];

const poremCategorias = (lista = CATEGORIAS) =>
  useCategoriaStore.setState({ categorias: lista, carregando: false, erro: null });
const poremMetodos = (lista = METODOS) =>
  useMetodoPagamentoStore.setState({ metodos: lista, carregando: false, erro: null });

const abrir = (props: Partial<Parameters<typeof TransacaoModal>[0]> = {}) => {
  const onClose = vi.fn();
  const onSubmit = vi.fn();
  const utils = render(
    <TransacaoModal open familiaId="f1" onClose={onClose} onSubmit={onSubmit} {...props} />,
  );
  return { onClose, onSubmit, ...utils };
};

const digitarValor = (v: string) =>
  fireEvent.change(screen.getByLabelText('Valor'), { target: { value: v } });
const chip = (nome: string | RegExp) => screen.getByRole('button', { name: nome });
const grupo = (nome: string) => screen.getByRole('group', { name: nome });
const maisOpcoes = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Descrição, parcelas e repetição' }));
const nomesDosChips = (nomeDoGrupo: string) =>
  within(grupo(nomeDoGrupo))
    .getAllByRole('button')
    .map((b) => b.textContent);

const EDICAO = {
  id: 't1',
  tipo: 'despesa' as const,
  valor: '80',
  categoriaId: 'c1',
  descricao: null,
  data: '2026-03-05',
  metodoPagamentoId: null,
};

describe('TransacaoModal', () => {
  it('não renderiza quando fechado', () => {
    abrir({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('é um diálogo com título acessível para nova transação e para edição', () => {
    poremCategorias();
    abrir();
    expect(screen.getByRole('dialog', { name: 'Nova Transação' })).toBeInTheDocument();
    cleanup();

    abrir({ transacaoParaEditar: EDICAO });
    expect(screen.getByRole('dialog', { name: 'Editar Transação' })).toBeInTheDocument();
  });

  it('mostra os blocos na ordem: tipo, valor, categoria, quando, pago com, mais opções, salvar', () => {
    poremCategorias();
    poremMetodos();
    abrir();

    const blocos = [
      chip('Despesa'),
      screen.getByLabelText('Valor'),
      grupo('Categoria'),
      grupo('Quando'),
      grupo('Pago com'),
      chip('Descrição, parcelas e repetição'),
      chip('Salvar despesa'),
    ];
    blocos.slice(1).forEach((bloco, i) => {
      expect(
        blocos[i].compareDocumentPosition(bloco) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  it('o valor recebe o foco ao abrir uma transação nova, mas não na edição', () => {
    poremCategorias();
    abrir();
    expect(screen.getByLabelText('Valor')).toHaveFocus();
    cleanup();

    abrir({ transacaoParaEditar: EDICAO });
    expect(screen.getByLabelText('Valor')).not.toHaveFocus();
  });

  it('o botão de fechar chama onClose', () => {
    const { onClose } = abrir();
    fireEvent.click(chip('Fechar modal'));
    expect(onClose).toHaveBeenCalled();
  });

  it('a área visível acompanha o teclado: o painel usa a altura do visualViewport', () => {
    const fake = Object.assign(new EventTarget(), { height: 480, offsetTop: 0 });
    Object.defineProperty(window, 'visualViewport', { value: fake, configurable: true });
    try {
      abrir();
      const raiz = screen.getByRole('dialog');
      expect(raiz).toHaveStyle({ height: '480px', top: '0px' });
      act(() => {
        fake.height = 300;
        fake.dispatchEvent(new Event('resize'));
      });
      expect(raiz).toHaveStyle({ height: '300px' });
    } finally {
      Reflect.deleteProperty(window, 'visualViewport');
    }
  });

  it('o rodapé com o botão fica fora da área que rola', () => {
    abrir();
    const salvar = chip('Salvar despesa');
    const rolagem = screen.getByLabelText('Valor').closest('.overflow-y-auto');
    expect(rolagem).not.toBeNull();
    expect(rolagem).not.toContainElement(salvar);
  });

  describe('data', () => {
    beforeEach(() => {
      // Só o Date é falso, para não travar as esperas da Testing Library.
      vi.useFakeTimers({ toFake: ['Date'] });
    });

    const salvarCom = (valor: string) => {
      digitarValor(valor);
      fireEvent.click(chip('Mercado'));
      fireEvent.click(chip('Salvar despesa'));
    };

    it('abre em Hoje com o dia local depois das 21h, e não com o dia seguinte em UTC', () => {
      vi.setSystemTime(new Date('2026-11-15T02:11:00Z')); // 14/11 às 23:11 em São Paulo
      poremCategorias();
      const { onSubmit } = abrir();

      expect(chip('Hoje')).toHaveAttribute('aria-pressed', 'true');
      salvarCom('10');
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ data: '2026-11-14' }));
    });

    it('Ontem em 1º de janeiro é 31 de dezembro do ano anterior', () => {
      vi.setSystemTime(new Date('2027-01-01T15:00:00Z'));
      poremCategorias();
      const { onSubmit } = abrir();

      fireEvent.click(chip('Ontem'));
      salvarCom('10');
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ data: '2026-12-31' }));
    });

    it('Outra data usa a data escolhida no campo', () => {
      vi.setSystemTime(new Date('2026-11-17T15:00:00Z'));
      poremCategorias();
      const { onSubmit } = abrir();

      fireEvent.click(chip(/outra data/i));
      fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-10-05' } });
      salvarCom('10');
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ data: '2026-10-05' }));
    });
  });

  describe('categoria em chips', () => {
    it('mostra só categorias do tipo; trocar o tipo troca os chips', () => {
      poremCategorias();
      abrir();
      expect(nomesDosChips('Categoria')).toEqual(['Mercado', 'Todas']);

      fireEvent.click(chip('Receita'));
      expect(nomesDosChips('Categoria')).toEqual(['Salario', 'Todas']);
    });

    it('limita a seis chips e o "Todas" abre a lista completa', () => {
      poremCategorias(OITO_DESPESAS);
      const { onSubmit } = abrir();
      expect(nomesDosChips('Categoria')).toHaveLength(7);

      fireEvent.click(chip('Todas'));
      const lista = screen.getByRole('dialog', { name: 'Todas as categorias' });
      fireEvent.click(within(lista).getByRole('button', { name: 'Pets' }));
      expect(chip('Pets')).toHaveAttribute('aria-pressed', 'true');

      digitarValor('5');
      fireEvent.click(chip('Salvar despesa'));
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ categoriaId: 'd8' }));
    });

    it('ordena os chips pelas categorias mais usadas nos últimos meses', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-17T15:00:00Z'));
      poremCategorias(OITO_DESPESAS);
      const recentes = ['d8', 'd8', 'd8', 'd7', 'd7', 'd3'].map((categoriaId, i) => ({
        categoriaId,
        tipo: 'despesa',
        data: `2026-11-${10 + i}`,
      }));
      vi.mocked(transacaoService.listar).mockImplementation(async ({ mesReferencia }) => ({
        transacoes: (mesReferencia === '2026-11' ? recentes : []) as never,
      }));
      abrir();

      await waitFor(() =>
        expect(nomesDosChips('Categoria').slice(0, 3)).toEqual(['Pets', 'Viagem', 'Saúde']),
      );
    });

    it('limpa a categoria escolhida ao trocar para um tipo incompatível', () => {
      poremCategorias();
      const { onSubmit } = abrir();

      fireEvent.click(chip('Mercado'));
      fireEvent.click(chip('Receita'));
      fireEvent.click(chip('Despesa'));

      expect(chip('Mercado')).toHaveAttribute('aria-pressed', 'false');
      digitarValor('5');
      expect(chip('Salvar despesa')).toBeDisabled();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('edição de categoria fora das seis mostra a categoria dela selecionada', () => {
      poremCategorias(OITO_DESPESAS);
      abrir({ transacaoParaEditar: { ...EDICAO, categoriaId: 'd8' } });

      expect(nomesDosChips('Categoria')).toContain('Pets');
      expect(chip('Pets')).toHaveAttribute('aria-pressed', 'true');
    });

    it('edição mantém a categoria atual e envia o tipo e o id', () => {
      poremCategorias();
      const onUpdate = vi.fn();
      abrir({
        onUpdate,
        transacaoParaEditar: { ...EDICAO, tipo: 'receita', valor: '5000', categoriaId: 'c2' },
      });

      expect(chip('Salario')).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(chip('Salvar alterações'));
      expect(onUpdate).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ tipo: 'receita', categoriaId: 'c2' }),
      );
    });

    describe('categoria inativa na edição', () => {
      const INATIVA = { ...EDICAO, categoriaId: 'c-inativa' };

      it('aparece selecionada como "Categoria inativa" e reenvia o mesmo id', () => {
        poremCategorias();
        const onUpdate = vi.fn();
        abrir({ onUpdate, transacaoParaEditar: INATIVA });

        expect(chip('Categoria inativa')).toHaveAttribute('aria-pressed', 'true');
        maisOpcoes();
        fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Ajuste' } });
        fireEvent.click(chip('Salvar alterações'));
        expect(onUpdate).toHaveBeenCalledWith(
          't1',
          expect.objectContaining({ categoriaId: 'c-inativa', descricao: 'Ajuste' }),
        );
      });

      it('trocar o tipo descarta a categoria inativa até escolher outra', () => {
        poremCategorias();
        const onUpdate = vi.fn();
        abrir({ onUpdate, transacaoParaEditar: INATIVA });

        fireEvent.click(chip('Receita'));
        expect(nomesDosChips('Categoria')).toEqual(['Salario', 'Todas']);
        expect(chip('Salvar alterações')).toBeDisabled();

        fireEvent.click(chip('Salario'));
        fireEvent.click(chip('Salvar alterações'));
        expect(onUpdate).toHaveBeenCalledWith(
          't1',
          expect.objectContaining({ tipo: 'receita', categoriaId: 'c2' }),
        );
      });

      it('voltar ao tipo original reoferece a inativa em "Todas", sem selecioná-la', () => {
        poremCategorias();
        abrir({ onUpdate: vi.fn(), transacaoParaEditar: INATIVA });

        fireEvent.click(chip('Receita'));
        fireEvent.click(chip('Despesa'));

        expect(chip('Salvar alterações')).toBeDisabled();
        fireEvent.click(chip('Todas'));
        const lista = screen.getByRole('dialog', { name: 'Todas as categorias' });
        expect(within(lista).getByRole('button', { name: 'Categoria inativa' })).toHaveAttribute(
          'aria-pressed',
          'false',
        );
      });

      it('clicar no tipo já ativo não descarta a categoria inativa', () => {
        poremCategorias();
        abrir({ onUpdate: vi.fn(), transacaoParaEditar: INATIVA });

        fireEvent.click(chip('Despesa'));
        expect(chip('Categoria inativa')).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('criação não oferece categoria inativa', () => {
      poremCategorias();
      abrir();
      expect(screen.queryByRole('button', { name: 'Categoria inativa' })).not.toBeInTheDocument();
    });
  });

  describe('forma de pagamento e parcelas', () => {
    it('um chip por forma ativa; nenhuma escolhida envia metodoPagamentoId nulo', () => {
      poremCategorias();
      poremMetodos();
      const { onSubmit } = abrir();
      expect(nomesDosChips('Pago com')).toEqual(['Nubank', 'Pix']);

      digitarValor('10');
      fireEvent.click(chip('Mercado'));
      fireEvent.click(chip('Salvar despesa'));
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ metodoPagamentoId: null }));
    });

    it('parcelas só aparecem em "Mais opções" quando a forma é cartão de crédito', () => {
      poremCategorias();
      poremMetodos();
      abrir();
      maisOpcoes();
      expect(screen.queryByRole('button', { name: 'Parcelado' })).not.toBeInTheDocument();

      fireEvent.click(chip('Pix'));
      expect(screen.queryByRole('button', { name: 'Parcelado' })).not.toBeInTheDocument();

      fireEvent.click(chip('Nubank'));
      fireEvent.click(chip('Parcelado'));
      expect(screen.getByLabelText('Parcelas')).toBeInTheDocument();
    });

    it('parcelado no crédito envia o número de parcelas', () => {
      poremCategorias();
      poremMetodos();
      const { onSubmit } = abrir();
      digitarValor('120');
      fireEvent.click(chip('Mercado'));
      fireEvent.click(chip('Nubank'));
      maisOpcoes();
      fireEvent.click(chip('Parcelado'));
      fireEvent.change(screen.getByLabelText('Parcelas'), { target: { value: '3' } });
      fireEvent.click(chip('Salvar despesa'));
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ parcelado: true, numeroParcelas: 3, metodoPagamentoId: 'm1' }),
      );
    });

    it('trocar a forma para outra que não é crédito desfaz o parcelamento', () => {
      poremCategorias();
      poremMetodos();
      const { onSubmit } = abrir();
      digitarValor('120');
      fireEvent.click(chip('Mercado'));
      fireEvent.click(chip('Nubank'));
      maisOpcoes();
      fireEvent.click(chip('Parcelado'));
      fireEvent.click(chip('Pix'));
      fireEvent.click(chip('Salvar despesa'));
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          parcelado: false,
          numeroParcelas: null,
          metodoPagamentoId: 'm2',
        }),
      );
    });

    it('repetição envia frequência e data fim', () => {
      poremCategorias();
      const { onSubmit } = abrir();
      digitarValor('50');
      fireEvent.click(chip('Mercado'));
      maisOpcoes();
      fireEvent.click(chip('Recorrente'));
      fireEvent.change(screen.getByLabelText('Data fim recorrência'), {
        target: { value: '2027-06-30' },
      });
      fireEvent.click(chip('Salvar despesa'));
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          recorrente: true,
          frequencia: 'mensal',
          dataFimRecorrencia: '2027-06-30',
          parcelado: false,
        }),
      );
    });
  });

  describe('salvar', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-17T15:00:00Z'));
    });

    it('envia o mesmo payload de antes para os mesmos dados', () => {
      poremCategorias();
      poremMetodos();
      const { onSubmit } = abrir();
      digitarValor('42.50');
      fireEvent.click(chip('Mercado'));
      fireEvent.click(chip('Pix'));
      maisOpcoes();
      fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Feira' } });
      fireEvent.click(chip('Salvar despesa'));

      expect(onSubmit).toHaveBeenCalledWith({
        tipo: 'despesa',
        valor: '42.50',
        categoriaId: 'c1',
        descricao: 'Feira',
        data: '2026-11-17',
        metodoPagamentoId: 'm2',
        parcelado: false,
        numeroParcelas: null,
        recorrente: false,
        frequencia: null,
        dataFimRecorrencia: null,
      });
    });

    it('na edição envia o payload de atualização', () => {
      poremCategorias();
      const onUpdate = vi.fn();
      abrir({ onUpdate, transacaoParaEditar: { ...EDICAO, descricao: 'Antigo' } });
      digitarValor('99');
      fireEvent.click(chip('Salvar alterações'));

      expect(onUpdate).toHaveBeenCalledWith('t1', {
        tipo: 'despesa',
        valor: '99',
        categoriaId: 'c1',
        descricao: 'Antigo',
        data: '2026-03-05',
        metodoPagamentoId: null,
      });
    });

    it('o rótulo do botão acompanha o tipo', () => {
      poremCategorias();
      abrir();
      expect(chip('Salvar despesa')).toBeInTheDocument();
      fireEvent.click(chip('Receita'));
      expect(chip('Salvar receita')).toBeInTheDocument();
    });

    it('sem valor e sem categoria fica desabilitado e escreve os dois motivos', () => {
      poremCategorias();
      const { onSubmit } = abrir();

      const salvar = chip('Salvar despesa');
      expect(salvar).toBeDisabled();
      expect(salvar).toHaveAccessibleDescription(
        'Digite o valor e escolha uma categoria de despesa',
      );
      fireEvent.click(salvar);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('com valor falta só a categoria, e o motivo acompanha o tipo', () => {
      poremCategorias();
      abrir();
      digitarValor('10');
      expect(chip('Salvar despesa')).toHaveAccessibleDescription(
        'Escolha uma categoria de despesa',
      );
      fireEvent.click(chip('Receita'));
      expect(screen.getByText('Escolha uma categoria de receita')).toBeInTheDocument();
    });

    it('valor zero também bloqueia', () => {
      poremCategorias();
      abrir();
      fireEvent.click(chip('Mercado'));
      digitarValor('0');
      expect(chip('Salvar despesa')).toBeDisabled();
      expect(chip('Salvar despesa')).toHaveAccessibleDescription('Digite o valor');
    });

    it('com valor e categoria habilita salvar, sem motivo', () => {
      poremCategorias();
      abrir();
      digitarValor('10');
      fireEvent.click(chip('Mercado'));
      expect(chip('Salvar despesa')).toBeEnabled();
      expect(screen.queryByText(/escolha uma categoria/i)).not.toBeInTheDocument();
    });

    it('tocar duas vezes durante a gravação grava uma vez só', async () => {
      poremCategorias();
      let terminar: () => void = () => {};
      const onSubmit = vi.fn(() => new Promise<void>((resolve) => (terminar = resolve)));
      abrir({ onSubmit });
      digitarValor('10');
      fireEvent.click(chip('Mercado'));

      fireEvent.click(chip('Salvar despesa'));
      fireEvent.click(screen.getByRole('button', { name: /salvando/i }));
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: /salvando/i })).toBeDisabled();
      await act(async () => terminar());
    });

    it('depois do sucesso o botão segue travado até o painel fechar: um toque na janela não grava de novo', async () => {
      poremCategorias();
      let terminar: () => void = () => {};
      const onSubmit = vi.fn(() => new Promise<void>((resolve) => (terminar = resolve)));
      abrir({ onSubmit });
      digitarValor('10');
      fireEvent.click(chip('Mercado'));
      const salvar = chip('Salvar despesa');
      fireEvent.click(salvar);

      // A gravação terminou, mas o painel ainda não fechou (o voltar do histórico é assíncrono).
      await act(async () => terminar());
      fireEvent.click(salvar);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(salvar).toBeDisabled();
    });

    it('enquanto grava, o X e o fundo não fecham o painel', async () => {
      poremCategorias();
      let terminar: () => void = () => {};
      const onSubmit = vi.fn(() => new Promise<void>((resolve) => (terminar = resolve)));
      const { onClose } = abrir({ onSubmit });
      digitarValor('10');
      fireEvent.click(chip('Mercado'));
      fireEvent.click(chip('Salvar despesa'));

      expect(chip('Fechar modal')).toBeDisabled();
      fireEvent.click(chip('Fechar modal'));
      fireEvent.click(screen.getByRole('dialog', { name: 'Nova Transação' }));
      expect(onClose).not.toHaveBeenCalled();
      await act(async () => terminar());
    });

    it('se a gravação falha depois de o painel ter fechado (voltar), o erro vira aviso', async () => {
      poremCategorias();
      let falhar: (erro: Error) => void = () => {};
      const onSubmit = vi.fn(() => new Promise<void>((_, rejeitar) => (falhar = rejeitar)));
      const { rerender } = abrir({ onSubmit });
      digitarValor('10');
      fireEvent.click(chip('Mercado'));
      fireEvent.click(chip('Salvar despesa'));

      rerender(
        <TransacaoModal open={false} familiaId="f1" onClose={vi.fn()} onSubmit={onSubmit} />,
      );
      await act(async () => falhar(new Error('rede')));

      expect(useAvisoStore.getState().aviso).toMatchObject({
        mensagem: 'Não foi possível salvar. Tente de novo.',
        tom: 'erro',
      });
    });

    it('se gravar falha, mantém o painel aberto, avisa e deixa tentar de novo', async () => {
      poremCategorias();
      const onSubmit = vi
        .fn()
        .mockRejectedValueOnce(new Error('rede'))
        .mockResolvedValue(undefined);
      const { onClose } = abrir({ onSubmit });
      digitarValor('10');
      fireEvent.click(chip('Mercado'));

      fireEvent.click(chip('Salvar despesa'));
      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar');
      expect(chip('Salvar despesa')).toBeEnabled();
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.click(chip('Salvar despesa'));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    });
  });

  describe('excluir', () => {
    const abrirConfirmacao = (onDelete = vi.fn()) => {
      poremCategorias();
      abrir({ onDelete, transacaoParaEditar: EDICAO });
      maisOpcoes();
      fireEvent.click(chip('Excluir lançamento'));
      return onDelete;
    };

    it('fica em "Mais opções" na edição', () => {
      poremCategorias();
      abrir({ onDelete: vi.fn(), transacaoParaEditar: EDICAO });
      expect(screen.queryByRole('button', { name: 'Excluir lançamento' })).not.toBeInTheDocument();
      maisOpcoes();
      expect(chip('Excluir lançamento')).toBeInTheDocument();
    });

    it('abre o painel de confirmação do app, sem window.confirm, e ainda não exclui', () => {
      const confirmar = vi.spyOn(window, 'confirm');
      const onDelete = abrirConfirmacao();

      const painel = screen.getByRole('dialog', { name: 'Excluir lançamento?' });
      // Sem descrição, o nome do lançamento é o da categoria.
      expect(painel).toHaveTextContent('Mercado');
      expect(painel).toHaveTextContent('R$ 80,00');
      expect(confirmar).not.toHaveBeenCalled();
      expect(onDelete).not.toHaveBeenCalled();
      confirmar.mockRestore();
    });

    it('Cancelar fecha a confirmação e não exclui', () => {
      const onDelete = abrirConfirmacao();
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('dialog', { name: 'Excluir lançamento?' })).not.toBeInTheDocument();
      expect(onDelete).not.toHaveBeenCalled();
    });

    it('confirmar exclui o lançamento uma vez só', async () => {
      let terminar: () => void = () => {};
      const onDelete = abrirConfirmacao(vi.fn(() => new Promise<void>((r) => (terminar = r))));

      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
      fireEvent.click(screen.getByRole('button', { name: /excluindo/i }));
      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledWith('t1');
      expect(chip('Fechar modal')).toBeDisabled();
      await act(async () => terminar());
    });

    it('se excluir falha, mantém a confirmação aberta e avisa', async () => {
      abrirConfirmacao(vi.fn().mockRejectedValue(new Error('rede')));
      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível excluir');
      expect(screen.getByRole('button', { name: 'Excluir' })).toBeEnabled();
    });
  });

  describe('voz', () => {
    const dadosVoz: DadosVoz = {
      tipo: 'despesa',
      valor: '42.50',
      categoriaId: 'c1',
      descricao: 'Almoço no restaurante',
      data: '2026-03-20',
    };

    it('preenche o painel com o que a voz reconheceu', () => {
      poremCategorias();
      abrir({ dadosVoz });

      expect(screen.getByLabelText('Valor')).toHaveValue(42.5);
      expect(chip('Mercado')).toHaveAttribute('aria-pressed', 'true');
      expect(chip(/outra data/i)).toHaveTextContent('20/03/2026');
      // A descrição reconhecida aparece sem precisar abrir "Mais opções".
      expect(screen.getByLabelText('Descrição')).toHaveValue('Almoço no restaurante');
    });

    it('mostra o microfone ao lado do valor e chama a voz', () => {
      const onVoiceActivate = vi.fn();
      abrir({ onVoiceActivate });
      fireEvent.click(chip('Preencher por voz'));
      expect(onVoiceActivate).toHaveBeenCalledOnce();
    });

    it('não mostra o microfone sem voz disponível nem na edição', () => {
      abrir();
      expect(screen.queryByRole('button', { name: 'Preencher por voz' })).not.toBeInTheDocument();
      cleanup();

      abrir({ transacaoParaEditar: EDICAO, onVoiceActivate: vi.fn() });
      expect(screen.queryByRole('button', { name: 'Preencher por voz' })).not.toBeInTheDocument();
    });

    it('categoria de outro tipo não deixa categoria incoerente', () => {
      poremCategorias();
      const { onSubmit } = abrir({ dadosVoz: { ...dadosVoz, tipo: 'receita', descricao: null } });

      expect(screen.getByRole('button', { name: 'Salario' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      expect(chip('Salvar receita')).toBeDisabled();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('voz sem dados de data usa hoje', () => {
      poremCategorias();
      abrir({ dadosVoz: { ...dadosVoz, data: null } });
      expect(chip('Hoje')).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
