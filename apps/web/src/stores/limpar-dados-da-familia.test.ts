import { describe, expect, it, vi } from 'vitest';

import { esquecerBuscasDeCategorias } from '@/hooks/use-categorias-mais-usadas';

import { useCategoriaStore } from './categoria.store';
import { useCofrinhoStore } from './cofrinho.store';
import { useDashboardStore } from './dashboard.store';
import { limparDadosDaFamilia } from './limpar-dados-da-familia';
import { useMetodoPagamentoStore } from './metodo-pagamento.store';
import { useTemplateTransacaoStore } from './template-transacao.store';
import { useTransacaoStore } from './transacao.store';

vi.mock('@/hooks/use-categorias-mais-usadas', () => ({ esquecerBuscasDeCategorias: vi.fn() }));

describe('limparDadosDaFamilia', () => {
  it('esquece as buscas das categorias mais usadas da família anterior', () => {
    limparDadosDaFamilia();
    expect(esquecerBuscasDeCategorias).toHaveBeenCalled();
  });

  it('zera todas as stores que guardam dado de família', () => {
    useCategoriaStore.setState({ categorias: [{ id: 'c' } as never], erro: 'x' });
    useCofrinhoStore.setState({ cofrinhos: [{ id: 'k' } as never] });
    useDashboardStore.setState({ orcamento: [{ id: 'o' } as never], error: 'x' });
    useMetodoPagamentoStore.setState({ metodos: [{ id: 'm' } as never] });
    useTemplateTransacaoStore.setState({ templates: [{ id: 't' } as never], valores: { t: '1' } });
    useTransacaoStore.setState({
      transacoes: [{ id: 'x' } as never],
      filtros: { tipo: 'despesa' },
    });

    limparDadosDaFamilia();

    expect(useCategoriaStore.getState().categorias).toEqual([]);
    expect(useCofrinhoStore.getState().cofrinhos).toEqual([]);
    expect(useDashboardStore.getState().orcamento).toEqual([]);
    expect(useDashboardStore.getState().error).toBeNull();
    expect(useMetodoPagamentoStore.getState().metodos).toEqual([]);
    expect(useTemplateTransacaoStore.getState().templates).toEqual([]);
    expect(useTemplateTransacaoStore.getState().valores).toEqual({});
    expect(useTransacaoStore.getState().transacoes).toEqual([]);
    expect(useTransacaoStore.getState().filtros).toEqual({});
  });
});
