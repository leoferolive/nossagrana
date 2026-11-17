import type { CategoriaListResponse, TransacaoListResponse } from '@nossagrana/types';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { transacaoService } from '@/services/core-financeiro.service';
import { useCategoriaStore } from '@/stores/categoria.store';

import { esquecerBuscasDeCategorias, useCategoriasMaisUsadas } from './use-categorias-mais-usadas';

vi.mock('@/services/core-financeiro.service', () => ({
  transacaoService: { listar: vi.fn() },
}));

type Categoria = CategoriaListResponse['categorias'][number];
type Transacao = TransacaoListResponse['transacoes'][number];

const cat = (id: string, nome: string): Categoria => ({
  id,
  nome,
  tipo: 'despesa',
  ativo: true,
  familiaId: 'f1',
  criadoPor: 'u1',
  criadoEm: '2026-01-01',
});

const lanc = (categoriaId: string, data: string) =>
  ({ categoriaId, data, tipo: 'despesa' }) as Transacao;

const nomes = (lista: Categoria[]) => lista.map((c) => c.nome);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-17T15:00:00Z'));
  esquecerBuscasDeCategorias();
  useCategoriaStore.setState({ categorias: [cat('a', 'Alimentação'), cat('b', 'Mercado')] });
  vi.mocked(transacaoService.listar).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCategoriasMaisUsadas', () => {
  it('busca o mês atual e os dois anteriores', async () => {
    vi.mocked(transacaoService.listar).mockResolvedValue({ transacoes: [] });
    renderHook(() => useCategoriasMaisUsadas('f1', 'despesa'));
    await waitFor(() => expect(transacaoService.listar).toHaveBeenCalledTimes(3));
    const meses = vi.mocked(transacaoService.listar).mock.calls.map(([f]) => f.mesReferencia);
    expect(meses.sort()).toEqual(['2026-09', '2026-10', '2026-11']);
  });

  it('devolve a lista calculada depois da busca', async () => {
    vi.mocked(transacaoService.listar).mockResolvedValue({
      transacoes: [lanc('b', '2026-11-10'), lanc('b', '2026-11-11')],
    });
    const { result } = renderHook(() => useCategoriasMaisUsadas('f1', 'despesa'));
    expect(nomes(result.current)).toEqual(['Alimentação', 'Mercado']);
    await waitFor(() => expect(nomes(result.current)).toEqual(['Mercado', 'Alimentação']));
  });

  it('não repete a busca ao reabrir (montar de novo) para a mesma família', async () => {
    vi.mocked(transacaoService.listar).mockResolvedValue({ transacoes: [] });
    const primeira = renderHook(() => useCategoriasMaisUsadas('f1', 'despesa'));
    await waitFor(() => expect(transacaoService.listar).toHaveBeenCalledTimes(3));
    primeira.unmount();
    renderHook(() => useCategoriasMaisUsadas('f1', 'despesa'));
    renderHook(() => useCategoriasMaisUsadas('f1', 'receita'));
    await Promise.resolve();
    expect(transacaoService.listar).toHaveBeenCalledTimes(3);
  });

  it('busca de novo para outra família', async () => {
    vi.mocked(transacaoService.listar).mockResolvedValue({ transacoes: [] });
    renderHook(() => useCategoriasMaisUsadas('f1', 'despesa'));
    renderHook(() => useCategoriasMaisUsadas('f2', 'despesa'));
    await waitFor(() => expect(transacaoService.listar).toHaveBeenCalledTimes(6));
  });

  it('se a busca falha, devolve as primeiras do tipo e tenta de novo na próxima vez', async () => {
    vi.mocked(transacaoService.listar).mockRejectedValue(new Error('rede'));
    const { result, unmount } = renderHook(() => useCategoriasMaisUsadas('f1', 'despesa'));
    await waitFor(() => expect(transacaoService.listar).toHaveBeenCalled());
    expect(nomes(result.current)).toEqual(['Alimentação', 'Mercado']);
    unmount();
    await new Promise((r) => setTimeout(r, 0));

    vi.mocked(transacaoService.listar).mockResolvedValue({ transacoes: [] });
    vi.mocked(transacaoService.listar).mockClear();
    renderHook(() => useCategoriasMaisUsadas('f1', 'despesa'));
    await waitFor(() => expect(transacaoService.listar).toHaveBeenCalledTimes(3));
  });

  it('sem família não busca', () => {
    renderHook(() => useCategoriasMaisUsadas('', 'despesa'));
    expect(transacaoService.listar).not.toHaveBeenCalled();
  });
});
