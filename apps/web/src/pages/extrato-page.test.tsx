import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCategoriaStore } from '@/stores/categoria.store';
import { useMetodoPagamentoStore } from '@/stores/metodo-pagamento.store';
import { useTransacaoStore } from '@/stores/transacao.store';
import { ExtratoPage } from './extrato-page';

vi.mock('../components/first-time-tour', () => ({
  FirstTimeTour: ({ tourKey }: { tourKey: string }) => <div data-testid={`tour-${tourKey}`} />,
}));

vi.mock('@/contexts/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    accessToken: 'tok',
    refreshToken: 'ref',
    login: vi.fn(),
    logout: vi.fn(),
    setAccessToken: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  useTransacaoStore.setState({ transacoes: [], carregando: false, erro: null, filtros: {} });
  useCategoriaStore.setState({ categorias: [], carregando: false, erro: null });
  useMetodoPagamentoStore.setState({ metodos: [], carregando: false, erro: null });
});

const T = (overrides = {}) => ({
  id: 't1',
  tipo: 'despesa' as const,
  valor: '150.00',
  categoriaId: 'c1',
  descricao: 'Mercado',
  data: '2026-03-10',
  mesReferencia: '2026-03',
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
  criadoEm: '2026-03-10T00:00:00Z',
  atualizadoEm: '2026-03-10T00:00:00Z',
  ...overrides,
});

describe('ExtratoPage', () => {
  beforeEach(() => {
    useTransacaoStore.setState({
      transacoes: [
        T({ id: 't1', valor: '150.00', descricao: 'Mercado', tipo: 'despesa' }),
        T({ id: 't2', valor: '5000.00', descricao: 'Salario', tipo: 'receita' }),
      ],
      carregando: false,
      erro: null,
      filtros: {},
    });
  });

  it('exibe lista de transações', () => {
    render(<ExtratoPage familiaId="f1" onBack={vi.fn()} onNovaTransacao={vi.fn()} />);
    expect(screen.getByText('Mercado')).toBeInTheDocument();
    expect(screen.getByText('Salario')).toBeInTheDocument();
  });

  it('exibe valores formatados com sinal', () => {
    render(<ExtratoPage familiaId="f1" onBack={vi.fn()} onNovaTransacao={vi.fn()} />);
    expect(screen.getByText(/- R\$\s*150,00/)).toBeInTheDocument();
    expect(screen.getByText(/\+ R\$\s*5\.000,00/)).toBeInTheDocument();
  });

  it('exibe FAB "+" para nova transação', () => {
    render(<ExtratoPage familiaId="f1" onBack={vi.fn()} onNovaTransacao={vi.fn()} />);
    expect(screen.getByRole('button', { name: /nova transação/i })).toBeInTheDocument();
  });

  it('chama onNovaTransacao ao clicar no FAB', () => {
    const onNovaTransacao = vi.fn();
    render(<ExtratoPage familiaId="f1" onBack={vi.fn()} onNovaTransacao={onNovaTransacao} />);
    fireEvent.click(screen.getByRole('button', { name: /nova transação/i }));
    expect(onNovaTransacao).toHaveBeenCalled();
  });

  it('exibe badge "Parcela X/N" para transação parcelada', () => {
    useTransacaoStore.setState({
      transacoes: [
        T({ id: 't3', descricao: 'TV', parcelado: true, parcelaAtual: 2, numeroParcelas: 6 }),
      ],
      carregando: false,
      erro: null,
      filtros: {},
    });
    render(<ExtratoPage familiaId="f1" onBack={vi.fn()} onNovaTransacao={vi.fn()} />);
    expect(screen.getByText('Parcela 2/6')).toBeInTheDocument();
  });

  it('exibe badge "Recorrente" para transação recorrente', () => {
    useTransacaoStore.setState({
      transacoes: [T({ id: 't4', descricao: 'Netflix', recorrente: true, frequencia: 'mensal' })],
      carregando: false,
      erro: null,
      filtros: {},
    });
    render(<ExtratoPage familiaId="f1" onBack={vi.fn()} onNovaTransacao={vi.fn()} />);
    expect(screen.getByText(/recorrente/i)).toBeInTheDocument();
  });

  it('filtro de tipo filtra visualmente', () => {
    render(<ExtratoPage familiaId="f1" onBack={vi.fn()} onNovaTransacao={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /filtrar despesas/i }));
    expect(screen.getByText('Mercado')).toBeInTheDocument();
  });

  it('abre modal de detalhe ao clicar na transação', () => {
    render(<ExtratoPage familiaId="f1" onBack={vi.fn()} onNovaTransacao={vi.fn()} />);
    fireEvent.click(screen.getByText('Mercado'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('exibe o tour de extrato', () => {
    render(<ExtratoPage familiaId="f1" onBack={vi.fn()} onNovaTransacao={vi.fn()} />);
    expect(screen.getByTestId('tour-extrato')).toBeInTheDocument();
  });
});
