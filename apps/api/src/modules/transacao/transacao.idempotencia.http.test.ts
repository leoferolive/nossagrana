import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../../app.js';
import { InMemoryTransacaoRepositoryFalhaNoEnesimoInsert } from './transacao.fakes.js';

/**
 * Contrato HTTP da `Idempotency-Key` em POST /api/transacoes (#90), com os
 * repositórios InMemory compartilhados da app de teste.
 */
describe('POST /api/transacoes — Idempotency-Key', () => {
  const app = buildApp();
  let headers: Record<string, string>;
  let familiaId: string;
  let categoriaId: string;

  const parcelada = () => ({
    tipo: 'despesa',
    valor: '300.00',
    categoriaId,
    data: '2026-03-10',
    parcelado: true,
    numeroParcelas: 3,
  });

  beforeAll(async () => {
    await app.ready();
    const email = 'idempotencia-tx@example.com';
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { nome: 'Idem', email, senha: 'password123' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, senha: 'password123' },
    });
    const token = login.json<{ accessToken: string }>().accessToken;
    const familia = await app.inject({
      method: 'POST',
      url: '/api/familias',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Familia Idem' },
    });
    familiaId = familia.json<{ familia: { id: string } }>().familia.id;
    headers = { authorization: `Bearer ${token}`, 'x-familia-id': familiaId };
    const categoria = await app.inject({
      method: 'POST',
      url: '/api/categorias',
      headers,
      payload: { nome: 'Casa', tipo: 'despesa' },
    });
    categoriaId = categoria.json<{ categoria: { id: string } }>().categoria.id;
  });

  afterEach(() => vi.restoreAllMocks());
  afterAll(() => app.close());

  const repos = () => {
    const r = app.repositoriosInMemory;
    if (!r || !app.eventBus) throw new Error('app de teste sem InMemory/eventBus');
    return { ...r, eventBus: app.eventBus };
  };
  const totalTransacoes = async () => (await repos().transacoes.list({ familiaId })).length;

  const enviar = (payload: object, chave?: string) =>
    app.inject({
      method: 'POST',
      url: '/api/transacoes',
      headers: chave ? { ...headers, 'idempotency-key': chave } : headers,
      payload,
    });

  it('replay: mesmo status e corpo, Idempotent-Replayed, sem nova série nem novo evento', async () => {
    const emit = vi.spyOn(repos().eventBus, 'emit');
    const chave = randomUUID();
    const antes = await totalTransacoes();

    const primeira = await enviar(parcelada(), chave);
    const replay = await enviar(parcelada(), chave);

    expect(primeira.statusCode).toBe(201);
    expect(primeira.headers['idempotent-replayed']).toBeUndefined();
    expect(replay.statusCode).toBe(201);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.json()).toEqual(primeira.json());
    expect(await totalTransacoes()).toBe(antes + 3);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('mesma chave com payload diferente → 422 IDEMPOTENCIA_CONFLITO, nada gravado', async () => {
    const chave = randomUUID();
    await enviar(parcelada(), chave);
    const antes = await totalTransacoes();

    const res = await enviar({ ...parcelada(), valor: '301.00' }, chave);

    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('IDEMPOTENCIA_CONFLITO');
    expect(await totalTransacoes()).toBe(antes);
  });

  it('chave fora do formato → 400 no envelope, nada gravado', async () => {
    const antes = await totalTransacoes();

    const res = await enviar(parcelada(), 'curta');

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: {
        message: expect.stringContaining('Idempotency-Key'),
        code: 'IDEMPOTENCIA_CHAVE_INVALIDA',
      },
    });
    expect(await totalTransacoes()).toBe(antes);
  });

  it('sem header (documentado): dois envios iguais gravam duas séries e emitem dois eventos', async () => {
    const emit = vi.spyOn(repos().eventBus, 'emit');
    const antes = await totalTransacoes();

    await enviar(parcelada());
    await enviar(parcelada());

    expect(await totalTransacoes()).toBe(antes + 6);
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('falha na 3ª parcela: 500, sem evento nem chave; retry com a mesma chave grava a série', async () => {
    const base = repos().transacoes;
    const abrirReal = base.abrirStaging.bind(base);
    const falhar = vi.spyOn(base, 'abrirStaging').mockImplementationOnce(() => {
      const falha = new InMemoryTransacaoRepositoryFalhaNoEnesimoInsert(3);
      falha.publicar(abrirReal());
      return falha;
    });
    const emit = vi.spyOn(repos().eventBus, 'emit');
    const chave = randomUUID();
    const antes = await totalTransacoes();

    const falhou = await enviar(parcelada(), chave);
    expect(falhou.statusCode).toBe(500);
    expect(repos().idempotencia.chavesDa(familiaId)).not.toContain(chave);
    expect(emit).not.toHaveBeenCalled();
    falhar.mockRestore();

    const retry = await enviar(parcelada(), chave);
    expect(retry.statusCode).toBe(201);
    expect(retry.headers['idempotent-replayed']).toBeUndefined();
    expect(await totalTransacoes()).toBe(antes + 3);
    expect(emit).toHaveBeenCalledTimes(1);
  });
});
