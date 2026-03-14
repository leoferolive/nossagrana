import { beforeEach, describe, expect, it } from 'vitest';

import { useCategoriaStore } from './categoria.store';
import { useMetodoPagamentoStore } from './metodo-pagamento.store';
import { useTransacaoStore } from './transacao.store';

describe('useCategoriaStore', () => {
  beforeEach(() => {
    useCategoriaStore.setState({ categorias: [], carregando: false, erro: null });
  });

  it('estado inicial vazio', () => {
    const state = useCategoriaStore.getState();
    expect(state.categorias).toHaveLength(0);
    expect(state.carregando).toBe(false);
  });

  it('setCategorias atualiza lista', () => {
    useCategoriaStore.getState().setCategorias([
      { id: 'c1', nome: 'Mercado', tipo: 'despesa', ativo: true, familiaId: 'f1', criadoPor: 'u1', criadoEm: '2026-01-01' },
    ]);
    expect(useCategoriaStore.getState().categorias).toHaveLength(1);
  });

  it('addCategoria insere na lista', () => {
    const cat = { id: 'c2', nome: 'Lazer', tipo: 'despesa' as const, ativo: true, familiaId: 'f1', criadoPor: 'u1', criadoEm: '2026-01-01' };
    useCategoriaStore.getState().addCategoria(cat);
    expect(useCategoriaStore.getState().categorias).toHaveLength(1);
  });

  it('updateCategoria substitui pelo id', () => {
    const cat = { id: 'c1', nome: 'Mercado', tipo: 'despesa' as const, ativo: true, familiaId: 'f1', criadoPor: 'u1', criadoEm: '2026-01-01' };
    useCategoriaStore.getState().setCategorias([cat]);
    useCategoriaStore.getState().updateCategoria({ ...cat, nome: 'Supermercado' });
    expect(useCategoriaStore.getState().categorias[0]?.nome).toBe('Supermercado');
  });

  it('removeCategoria filtra pelo id', () => {
    const cat = { id: 'c1', nome: 'Mercado', tipo: 'despesa' as const, ativo: true, familiaId: 'f1', criadoPor: 'u1', criadoEm: '2026-01-01' };
    useCategoriaStore.getState().setCategorias([cat]);
    useCategoriaStore.getState().removeCategoria('c1');
    expect(useCategoriaStore.getState().categorias).toHaveLength(0);
  });
});

describe('useMetodoPagamentoStore', () => {
  beforeEach(() => {
    useMetodoPagamentoStore.setState({ metodos: [], carregando: false, erro: null });
  });

  it('estado inicial vazio', () => {
    expect(useMetodoPagamentoStore.getState().metodos).toHaveLength(0);
  });

  it('setMetodos / addMetodo / removeMetodo', () => {
    const m = { id: 'm1', nome: 'Nubank', tipo: 'credito' as const, dataFechamento: 15, dataVencimento: 22, usuarioDonoId: 'u1', ativo: true, familiaId: 'f1', criadoEm: '2026-01-01' };
    useMetodoPagamentoStore.getState().setMetodos([m]);
    expect(useMetodoPagamentoStore.getState().metodos).toHaveLength(1);

    useMetodoPagamentoStore.getState().removeMetodo('m1');
    expect(useMetodoPagamentoStore.getState().metodos).toHaveLength(0);
  });
});

describe('useTransacaoStore', () => {
  beforeEach(() => {
    useTransacaoStore.setState({ transacoes: [], carregando: false, erro: null, filtros: {} });
  });

  it('estado inicial vazio', () => {
    expect(useTransacaoStore.getState().transacoes).toHaveLength(0);
  });

  it('setTransacoes / addTransacao / removeTransacao', () => {
    const t = {
      id: 't1', tipo: 'despesa' as const, valor: '100.00', categoriaId: 'c1',
      descricao: null, data: '2026-03-10', mesReferencia: '2026-03',
      metodoPagamentoId: null, usuarioRegistrouId: 'u1',
      recorrente: false, frequencia: null, dataFimRecorrencia: null,
      parcelado: false, numeroParcelas: null, parcelaAtual: null,
      valorTotal: null, valorParcela: null, transacaoPaiId: null,
      familiaId: 'f1', criadoEm: '2026-03-10T00:00:00Z', atualizadoEm: '2026-03-10T00:00:00Z',
    };
    useTransacaoStore.getState().setTransacoes([t]);
    expect(useTransacaoStore.getState().transacoes).toHaveLength(1);

    useTransacaoStore.getState().removeTransacao('t1');
    expect(useTransacaoStore.getState().transacoes).toHaveLength(0);
  });

  it('setFiltros atualiza filtros', () => {
    useTransacaoStore.getState().setFiltros({ mesReferencia: '2026-03' });
    expect(useTransacaoStore.getState().filtros.mesReferencia).toBe('2026-03');
  });
});
