import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockService = vi.hoisted(() => ({
  getDashboardResumo: vi.fn(),
  getDashboardGraficos: vi.fn(),
  getDashboardOrcamento: vi.fn(),
}));

vi.mock('../services/core-financeiro.service', () => ({
  coreFinanceiroService: mockService,
}));

import { act, renderHook } from '@testing-library/react';
import { useDashboardStore } from './dashboard.store';

describe('useDashboardStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDashboardStore.setState({ resumo: null, graficos: null, orcamento: [], loading: false, error: null });
  });

  it('estado inicial é null/vazio', () => {
    const { result } = renderHook(() => useDashboardStore());
    expect(result.current.resumo).toBeNull();
    expect(result.current.orcamento).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('fetchAll popula resumo, graficos e orcamento', async () => {
    const resumo = { mesReferencia: '2026-03', totalReceitas: '5000.00', totalDespesas: '3000.00', saldo: '2000.00', mesAnterior: null };
    const graficos = { distribuicaoCategorias: [], evolucaoDiaria: [] };
    const orcamento: never[] = [];
    mockService.getDashboardResumo.mockResolvedValue(resumo);
    mockService.getDashboardGraficos.mockResolvedValue(graficos);
    mockService.getDashboardOrcamento.mockResolvedValue(orcamento);

    const { result } = renderHook(() => useDashboardStore());
    await act(() => result.current.fetchAll('f1'));

    expect(result.current.resumo).toEqual(resumo);
    expect(result.current.graficos).toEqual(graficos);
    expect(result.current.loading).toBe(false);
  });

  it('fetchAll seta error em caso de falha', async () => {
    mockService.getDashboardResumo.mockRejectedValue(new Error('network'));
    mockService.getDashboardGraficos.mockRejectedValue(new Error('network'));
    mockService.getDashboardOrcamento.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useDashboardStore());
    await act(() => result.current.fetchAll('f1'));

    expect(result.current.error).toBeTruthy();
  });
});
