import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiClient } from './api-client';
import { cofrinhoService } from './cofrinho.service';
import { lazyApiClient, transacaoService } from './core-financeiro.service';
import { cabecalhoIdempotencia, novaChaveIdempotencia } from './idempotencia';
import { templateTransacaoService } from './template-transacao.service';

/** Idempotency-Key (#90): uma chave por envio; a mesma requisição reenviada leva a mesma chave. */
const chaveEnviada = (init: RequestInit | undefined) =>
  new Headers(init?.headers).get('Idempotency-Key');

describe('helpers de idempotência', () => {
  it('novaChaveIdempotencia gera UUIDs distintos', () => {
    const a = novaChaveIdempotencia();

    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(novaChaveIdempotencia()).not.toBe(a);
  });

  describe('fora de contexto seguro (HTTP): crypto.randomUUID ausente', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('gera UUID v4 válido e único via crypto.getRandomValues', () => {
      const real = globalThis.crypto;
      vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });

      const chaves = Array.from({ length: 200 }, () => novaChaveIdempotencia());

      for (const chave of chaves) {
        expect(chave).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
      }
      expect(new Set(chaves).size).toBe(chaves.length);
    });
  });

  it('cabecalhoIdempotencia só inclui o header quando há chave', () => {
    expect(cabecalhoIdempotencia('k-123456')).toEqual({ 'Idempotency-Key': 'k-123456' });
    expect(cabecalhoIdempotencia(undefined)).toEqual({});
  });
});

describe('ApiClient — retry após refresh do token', () => {
  it('reenvia a MESMA Idempotency-Key na nova tentativa do mesmo envio', async () => {
    const json = (body: object, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(json({ accessToken: 'novo', refreshToken: 'rt2' }))
      .mockResolvedValueOnce(json({ ok: true }, 201));
    const api = new ApiClient({
      baseUrl: '',
      fetchFn: fetchMock,
      getAccessToken: () => 'velho',
      getRefreshToken: () => 'rt',
      setAccessToken: vi.fn(),
      setRefreshToken: vi.fn(),
      clearSession: vi.fn(),
    });

    await api.request('/api/transacoes', {
      method: 'POST',
      headers: cabecalhoIdempotencia('chave-envio-1'),
      body: '{}',
    });

    expect(chaveEnviada(fetchMock.mock.calls[0]?.[1])).toBe('chave-envio-1');
    expect(chaveEnviada(fetchMock.mock.calls[2]?.[1])).toBe('chave-envio-1');
  });
});

describe('services das 4 operações', () => {
  afterEach(() => vi.restoreAllMocks());

  const espiar = () => vi.spyOn(lazyApiClient, 'request').mockResolvedValue({});
  const headersDa = (request: ReturnType<typeof espiar>) =>
    new Headers(request.mock.calls[0]?.[1]?.headers);

  it.each([
    ['transacao.registrar', (k?: string) => transacaoService.registrar({} as never, 'f1', k)],
    ['cofrinho.aportar', (k?: string) => cofrinhoService.aportar('f1', 'c1', {} as never, k)],
    ['cofrinho.retirar', (k?: string) => cofrinhoService.retirar('f1', 'c1', {} as never, k)],
    ['templates.aplicar', (k?: string) => templateTransacaoService.aplicar('f1', {} as never, k)],
  ])('%s envia a chave recebida e o header de família', async (_op, chamar) => {
    const request = espiar();

    await chamar('chave-0001');

    expect(headersDa(request).get('Idempotency-Key')).toBe('chave-0001');
    expect(headersDa(request).get('X-Familia-Id')).toBe('f1');
  });

  it('sem chave, não envia o header (sem deduplicação no servidor)', async () => {
    const request = espiar();

    await transacaoService.registrar({} as never, 'f1');

    expect(headersDa(request).has('Idempotency-Key')).toBe(false);
  });
});
