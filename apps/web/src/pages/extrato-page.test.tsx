import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { transacaoService } from '@/services/core-financeiro.service';
import { useCategoriaStore } from '@/stores/categoria.store';
import { useMetodoPagamentoStore } from '@/stores/metodo-pagamento.store';
import { useTransacaoStore } from '@/stores/transacao.store';
import { ExtratoPage } from './extrato-page';
import { renderPagina } from '../test/render-pagina';

vi.mock('@/contexts/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    accessToken: 'tok',
    login: vi.fn(),
    logout: vi.fn(),
    setAccessToken: vi.fn(),
  }),
}));

vi.mock('@/services/core-financeiro.service', () => ({
  transacaoService: {
    listar: vi.fn(),
  },
  metodoPagamentoService: {
    listar: vi.fn().mockResolvedValue({ metodosPagamento: [] }),
  },
  categoriaService: {
    listar: vi.fn().mockResolvedValue({ categorias: [] }),
  },
  coreFinanceiroService: {},
}));

beforeEach(() => {
  // Só o relógio: as promises e os temporizadores do Testing Library seguem reais.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.clearAllMocks();
  useTransacaoStore.setState({
    transacoes: [],
    carregando: false,
    erro: null,
    filtros: {},
    versao: 0,
  });
  useCategoriaStore.setState({ categorias: [], carregando: false, erro: null });
  useMetodoPagamentoStore.setState({ metodos: [], carregando: false, erro: null });
});

const T = (overrides = {}) => ({
  id: 't1',
  tipo: 'despesa' as const,
  valor: '150.00',
  categoriaId: 'c1',
  descricao: 'Mercado',
  data: '2026-11-10',
  mesReferencia: '2026-11',
  metodoPagamentoId: null,
  usuarioRegistrouId: 'u1',
  recorrente: false,
  frequencia: null,
  dataFimRecorrencia: null,
  parcelado: false,
  numeroParcelas: null,
  parcelaAtual: null,
  valorTotal: null,
  valorParcela: null,
  transacaoPaiId: null,
  familiaId: 'f1',
  criadoEm: '2026-11-10T00:00:00Z',
  atualizadoEm: '2026-11-10T00:00:00Z',
  ...overrides,
});

const listaDoMes = (...transacoes: ReturnType<typeof T>[]) =>
  vi.mocked(transacaoService.listar).mockResolvedValue({ transacoes });

const abrir = (onEditar = vi.fn()) => {
  renderPagina(
    <ExtratoPage familiaId="f1" onNovaTransacao={vi.fn()} onEditarTransacao={onEditar} />,
  );
  return onEditar;
};

const resumo = () => screen.getByRole('group', { name: 'Resumo do período' });
const valorDoResumo = (rotulo: string) =>
  within(resumo()).getByText(rotulo).nextElementSibling as HTMLElement;

describe('ExtratoPage', () => {
  it('usa o cabeçalho de aba: título de nível 1, pílula de mês e nenhum Voltar', async () => {
    listaDoMes();
    abrir();
    expect(screen.getByRole('heading', { level: 1, name: 'Extrato' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument();
    await screen.findByText(/Nenhum lançamento/);
  });

  it('agrupa por dia, do mais recente ao mais antigo, com rótulo legível', async () => {
    listaDoMes(
      T({ id: 'a', data: '2026-11-13', descricao: 'Padaria' }),
      T({ id: 'b', data: '2026-11-16', descricao: 'Café' }),
      T({ id: 'c', data: '2026-11-15', descricao: 'Cinema' }),
    );
    abrir();
    await screen.findByText('Café');
    const dias = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(dias).toEqual(['Hoje · seg, 16 nov', 'Ontem · dom, 15 nov', 'Sex, 13 nov']);
  });

  it('mostra o total do dia (entradas menos saídas)', async () => {
    listaDoMes(
      T({ id: 'a', data: '2026-11-13', valor: '100.00', tipo: 'receita', descricao: 'Freela' }),
      T({ id: 'b', data: '2026-11-13', valor: '30.00', descricao: 'Almoço' }),
    );
    abrir();
    await screen.findByText('Freela');
    expect(screen.getByLabelText(/total do dia/i)).toHaveTextContent(/\+R\$\s*70,00/);
  });

  it('o resumo soma o que está na lista e acompanha o filtro de tipo', async () => {
    listaDoMes(
      T({ id: 'a', valor: '5000.00', tipo: 'receita', descricao: 'Salario' }),
      T({ id: 'b', valor: '150.00', descricao: 'Mercado' }),
    );
    abrir();
    await screen.findByText('Mercado');
    expect(valorDoResumo('Entradas')).toHaveTextContent(/R\$\s*5\.000,00/);
    expect(valorDoResumo('Saídas')).toHaveTextContent(/R\$\s*150,00/);
    expect(valorDoResumo('Saldo')).toHaveTextContent(/R\$\s*4\.850,00/);

    fireEvent.click(screen.getByRole('button', { name: 'Saídas' }));
    expect(screen.queryByText('Salario')).not.toBeInTheDocument();
    expect(valorDoResumo('Entradas')).toHaveTextContent(/R\$\s*0,00/);
    expect(valorDoResumo('Saldo')).toHaveTextContent(/-R\$\s*150,00/);
  });

  it('o resumo e o total do dia acompanham a busca', async () => {
    listaDoMes(
      T({ id: 'a', valor: '40.00', descricao: 'Pizza' }),
      T({ id: 'b', valor: '10.00', descricao: 'Ônibus' }),
    );
    abrir();
    await screen.findByText('Pizza');

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'piz' } });

    expect(screen.queryByText('Ônibus')).not.toBeInTheDocument();
    expect(valorDoResumo('Saídas')).toHaveTextContent(/R\$\s*40,00/);
    expect(screen.getByLabelText(/total do dia/i)).toHaveTextContent(/−R\$\s*40,00/);
  });

  it('filtra por tipo com chips que informam aria-pressed', async () => {
    listaDoMes(T({ descricao: 'Mercado' }));
    abrir();
    await screen.findByText('Mercado');
    expect(screen.getByRole('button', { name: 'Tudo' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Entradas' }));
    expect(screen.getByRole('button', { name: 'Entradas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Tudo' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('a busca fica escondida até tocar em "Buscar"', async () => {
    listaDoMes(T());
    abrir();
    await screen.findByText('Mercado');
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });

  it('exibe parcela como "3/10" no metadado, no dia dela', async () => {
    useCategoriaStore.setState({
      categorias: [
        {
          id: 'c1',
          nome: 'Compras',
          tipo: 'despesa',
          familiaId: 'f1',
          ativo: true,
          criadoPor: 'u1',
          criadoEm: '',
        },
      ],
      carregando: false,
      erro: null,
    });
    listaDoMes(
      T({
        descricao: 'TV',
        data: '2026-11-12',
        parcelado: true,
        parcelaAtual: 3,
        numeroParcelas: 10,
      }),
    );
    abrir();
    expect(await screen.findByText('Compras · 3/10')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Qui, 12 nov' })).toBeInTheDocument();
  });

  it('o lançamento das 23h do último dia do mês fica no dia e no mês certos', async () => {
    listaDoMes(
      T({ id: 'x', data: '2026-10-31', descricao: 'Jantar', criadoEm: '2026-11-01T02:00:00Z' }),
    );
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
    await screen.findByText('Jantar');
    expect(transacaoService.listar).toHaveBeenLastCalledWith(
      expect.objectContaining({ mesReferencia: '2026-10' }),
      'f1',
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Sáb, 31 out' })).toBeInTheDocument();
  });

  it('tocar numa linha abre a edição daquela transação', async () => {
    const t = T({ descricao: 'Mercado' });
    listaDoMes(t);
    const onEditar = abrir();
    fireEvent.click(await screen.findByRole('button', { name: /Mercado/ }));
    expect(onEditar).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }));
  });

  describe('exportar CSV', () => {
    it('fica em "Mais ações" e baixa o mesmo CSV de antes', async () => {
      let blobGerado: Blob | null = null;
      URL.createObjectURL = vi.fn((b: Blob) => {
        blobGerado = b;
        return 'blob:x';
      });
      URL.revokeObjectURL = vi.fn();
      const cliques: string[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        cliques.push(this.download);
      });
      listaDoMes(T({ descricao: 'Mercado' }));
      abrir();
      await screen.findByText('Mercado');
      expect(screen.queryByRole('menuitem', { name: 'Exportar CSV' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Exportar CSV' }));

      expect(cliques).toEqual(['extrato-2026-11.csv']);
      expect(blobGerado).not.toBeNull();
      expect(blobGerado!.type).toBe('text/csv;charset=utf-8;');
    });
  });

  describe('estados', () => {
    it('mostra "Carregando..." enquanto busca', () => {
      vi.mocked(transacaoService.listar).mockReturnValue(new Promise(() => {}));
      abrir();
      expect(screen.getByText('Carregando...')).toBeInTheDocument();
    });

    it('mês sem lançamentos: "Nenhum lançamento em novembro"', async () => {
      listaDoMes();
      abrir();
      expect(await screen.findByText('Nenhum lançamento em novembro')).toBeInTheDocument();
    });

    it('busca sem resultado tem outra mensagem: "Nada encontrado para \'xyz\'"', async () => {
      listaDoMes(T());
      abrir();
      await screen.findByText('Mercado');
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'xyz' } });
      expect(screen.getByText("Nada encontrado para 'xyz'")).toBeInTheDocument();
      expect(screen.queryByText(/Nenhum lançamento em/)).not.toBeInTheDocument();
    });

    it('erro ao carregar: mensagem e "Tentar de novo", que busca outra vez', async () => {
      vi.mocked(transacaoService.listar).mockRejectedValue(new Error('rede'));
      abrir();
      expect(await screen.findByText(/Não foi possível carregar o extrato/)).toBeInTheDocument();
      expect(screen.queryByText(/Nenhum lançamento em/)).not.toBeInTheDocument();

      listaDoMes(T({ descricao: 'Mercado' }));
      fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
      expect(await screen.findByText('Mercado')).toBeInTheDocument();
    });
  });

  describe('busca que sobrevive à troca de mês', () => {
    it('o campo volta aberto com o texto e o resumo bate com o filtrado; limpar volta tudo', async () => {
      listaDoMes(
        T({ id: 'a', valor: '40.00', descricao: 'Mercado do bairro' }),
        T({ id: 'b', valor: '10.00', descricao: 'Ônibus' }),
      );
      abrir();
      await screen.findByText('Ônibus');
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'mercado' } });

      fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
      const campo = await screen.findByRole('searchbox');

      expect(campo).toHaveValue('mercado');
      expect(screen.queryByText('Ônibus')).not.toBeInTheDocument();
      expect(valorDoResumo('Saídas')).toHaveTextContent(/R\$\s*40,00/);

      fireEvent.click(screen.getByRole('button', { name: 'Limpar busca' }));
      expect(screen.getByText('Ônibus')).toBeInTheDocument();
      expect(valorDoResumo('Saídas')).toHaveTextContent(/R\$\s*50,00/);
    });
  });

  describe('carga robusta', () => {
    const adiada = () => {
      let resolver!: (v: { transacoes: ReturnType<typeof T>[] }) => void;
      const promessa = new Promise<{ transacoes: ReturnType<typeof T>[] }>((r) => {
        resolver = r;
      });
      return { promessa, resolver };
    };

    it('falha na carga dentro do StrictMode mostra "Tentar de novo"', async () => {
      vi.mocked(transacaoService.listar).mockRejectedValue(new Error('rede'));
      renderPagina(
        <ExtratoPage familiaId="f1" onNovaTransacao={vi.fn()} onEditarTransacao={vi.fn()} />,
        '/',
        { strict: true },
      );
      expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
      expect(screen.queryByText(/Nenhum lançamento em/)).not.toBeInTheDocument();
    });

    it('resposta fora de ordem (a do mês anterior chega depois) não substitui a lista', async () => {
      const novembro = adiada();
      const outubro = adiada();
      vi.mocked(transacaoService.listar)
        .mockReturnValueOnce(novembro.promessa)
        .mockReturnValueOnce(outubro.promessa);
      abrir();
      fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));

      await act(async () => {
        outubro.resolver({ transacoes: [T({ id: 'o', descricao: 'Compra de outubro' })] });
      });
      await act(async () => {
        novembro.resolver({ transacoes: [T({ id: 'n', descricao: 'Compra de novembro' })] });
      });

      expect(await screen.findByText('Compra de outubro')).toBeInTheDocument();
      expect(screen.queryByText('Compra de novembro')).not.toBeInTheDocument();
    });

    it('gravar durante uma carga em andamento termina mostrando os dados novos', async () => {
      const velha = adiada();
      vi.mocked(transacaoService.listar)
        .mockReturnValueOnce(velha.promessa)
        .mockResolvedValueOnce({ transacoes: [T({ id: 'n', descricao: 'Lançamento novo' })] });
      abrir();

      act(() => useTransacaoStore.getState().sinalizarMudanca());
      await screen.findByText('Lançamento novo');
      await act(async () => {
        velha.resolver({ transacoes: [T({ id: 'v', descricao: 'Lançamento velho' })] });
      });

      expect(screen.getByText('Lançamento novo')).toBeInTheDocument();
      expect(screen.queryByText('Lançamento velho')).not.toBeInTheDocument();
    });

    it('recarga depois de gravar que falha mostra o erro, não a lista velha', async () => {
      listaDoMes(T({ descricao: 'Mercado' }));
      abrir();
      await screen.findByText('Mercado');

      vi.mocked(transacaoService.listar).mockRejectedValue(new Error('rede'));
      act(() => useTransacaoStore.getState().sinalizarMudanca());

      expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
      expect(screen.queryByText('Mercado')).not.toBeInTheDocument();
    });
  });

  describe('dados da API e nomes do cadastro', () => {
    it('chama listar com o mês e a família ao montar', async () => {
      listaDoMes();
      abrir();
      await waitFor(() =>
        expect(transacaoService.listar).toHaveBeenCalledWith(
          expect.objectContaining({ mesReferencia: '2026-11' }),
          'f1',
        ),
      );
    });

    it('não chama listar sem família', async () => {
      listaDoMes();
      renderPagina(
        <ExtratoPage familiaId="" onNovaTransacao={vi.fn()} onEditarTransacao={vi.fn()} />,
      );
      await Promise.resolve();
      expect(transacaoService.listar).not.toHaveBeenCalled();
    });

    it('exibe categoria e forma de pagamento do cadastro no metadado', async () => {
      useCategoriaStore.setState({
        categorias: [
          {
            id: 'c1',
            nome: 'Alimentacao',
            tipo: 'despesa',
            familiaId: 'f1',
            ativo: true,
            criadoPor: 'u1',
            criadoEm: '',
          },
        ],
        carregando: false,
        erro: null,
      });
      useMetodoPagamentoStore.setState({
        metodos: [
          {
            id: 'm1',
            nome: 'Cartao Nubank',
            tipo: 'credito',
            familiaId: 'f1',
            ativo: true,
            dataFechamento: null,
            dataVencimento: null,
            usuarioDonoId: 'u1',
            criadoEm: '',
          },
        ],
        carregando: false,
        erro: null,
      });
      listaDoMes(T({ metodoPagamentoId: 'm1', descricao: 'Almoço' }));
      abrir();
      expect(await screen.findByText('Alimentacao · Cartao Nubank')).toBeInTheDocument();
    });
  });
});
