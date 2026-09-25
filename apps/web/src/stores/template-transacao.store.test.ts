import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockService = vi.hoisted(() => ({
  templateTransacaoService: { listar: vi.fn(), aplicar: vi.fn() },
}));

vi.mock('../services/template-transacao.service', () => mockService);

import { useTemplateTransacaoStore } from './template-transacao.store';

describe('useTemplateTransacaoStore.aplicar — Idempotency-Key (#90)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockService.templateTransacaoService.aplicar.mockResolvedValue({
      transacoesCriadas: 1,
      aportesCriados: 0,
      total: 1,
    });
    useTemplateTransacaoStore.setState({ valores: { t1: '10,50' }, mesReferencia: '2026-03' });
  });

  it('cada clique em salvar envia uma chave nova junto com o lote', async () => {
    await useTemplateTransacaoStore.getState().aplicar('fam-1');
    await useTemplateTransacaoStore.getState().aplicar('fam-1');

    const chamadas = mockService.templateTransacaoService.aplicar.mock.calls;
    expect(chamadas[0]?.slice(0, 2)).toEqual([
      'fam-1',
      { mesReferencia: '2026-03', itens: [{ templateId: 't1', valor: '10.50' }] },
    ]);
    expect(chamadas[0]?.[2]).toMatch(/^[0-9a-f-]{36}$/);
    expect(chamadas[1]?.[2]).toMatch(/^[0-9a-f-]{36}$/);
    expect(chamadas[0]?.[2]).not.toBe(chamadas[1]?.[2]);
  });
});
