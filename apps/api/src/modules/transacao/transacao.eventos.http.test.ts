import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../../app.js';
import { InMemoryTransacaoRepositoryFalhaNoEnesimoInsert } from './transacao.fakes.js';
import type { Transacao } from './transacao.types.js';

/**
 * `transacao:alterada` (WebSocket) só pode sair depois do commit do registro
 * (#85): nunca em falha, e quando sai os dados já estão visíveis.
 */
describe('POST /api/transacoes — evento só após sucesso', () => {
  const app = buildApp();
  let headers: Record<string, string>;
  let familiaId: string;
  let categoriaId: string;

  async function autenticar(email: string) {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { nome: 'Eventos', email, senha: 'password123' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, senha: 'password123' },
    });
    return login.json<{ accessToken: string }>().accessToken;
  }

  beforeAll(async () => {
    await app.ready();
    const token = await autenticar('eventos-tx@example.com');
    const familia = await app.inject({
      method: 'POST',
      url: '/api/familias',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Familia Eventos' },
    });
    familiaId = familia.json<{ familia: { id: string } }>().familia.id;
    headers = { authorization: `Bearer ${token}`, 'x-familia-id': familiaId };
    const categoria = await app.inject({
      method: 'POST',
      url: '/api/categorias',
      headers,
      payload: { nome: 'Eletrônicos', tipo: 'despesa' },
    });
    categoriaId = categoria.json<{ categoria: { id: string } }>().categoria.id;
  });

  afterEach(() => vi.restoreAllMocks());
  afterAll(() => app.close());

  function espiarEventos() {
    const { eventBus, repositoriosInMemory } = app;
    if (!eventBus || !repositoriosInMemory) throw new Error('app de teste sem eventBus/InMemory');
    const visiveisNoEvento: Promise<Transacao[]>[] = [];
    const emit = vi.spyOn(eventBus, 'emit').mockImplementation(() => {
      visiveisNoEvento.push(repositoriosInMemory.transacoes.list({ familiaId }));
      return true;
    });
    return { emit, visiveisNoEvento };
  }

  it('parcelada com sucesso: 201, um evento, e pai + parcelas já confirmados no momento do evento', async () => {
    const { emit, visiveisNoEvento } = espiarEventos();

    const res = await app.inject({
      method: 'POST',
      url: '/api/transacoes',
      headers,
      payload: {
        tipo: 'despesa',
        valor: '300.00',
        categoriaId,
        data: '2026-03-10',
        parcelado: true,
        numeroParcelas: 3,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().transacao).toMatchObject({ parcelaAtual: 1, numeroParcelas: 3 });
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('transacao:alterada', { familiaId });
    const [visiveis] = await Promise.all(visiveisNoEvento);
    expect(visiveis).toHaveLength(3);
  });

  it('falha antes do registro (ownership, 422) não emite evento', async () => {
    const { emit } = espiarEventos();

    const res = await app.inject({
      method: 'POST',
      url: '/api/transacoes',
      headers,
      payload: {
        tipo: 'despesa',
        valor: '300.00',
        categoriaId: randomUUID(),
        data: '2026-03-10',
        parcelado: true,
        numeroParcelas: 3,
      },
    });

    expect(res.statusCode).toBe(422);
    expect(emit).not.toHaveBeenCalled();
  });

  /** Staging da UoW da app passa a ser a fake que falha no N-ésimo insert (com os dados atuais). */
  function falharNoInsertDentroDaUoW(falharNoInsert: number) {
    const base = app.repositoriosInMemory?.transacoes;
    if (!base) throw new Error('app de teste sem repositório InMemory de transações');
    const abrirReal = base.abrirStaging.bind(base);
    vi.spyOn(base, 'abrirStaging').mockImplementation(() => {
      const falha = new InMemoryTransacaoRepositoryFalhaNoEnesimoInsert(falharNoInsert);
      falha.publicar(abrirReal());
      return falha;
    });
    return base;
  }

  it('falha DENTRO da unidade (3ª parcela) não emite evento e não grava nada', async () => {
    const base = falharNoInsertDentroDaUoW(3);
    const antes = (await base.list({ familiaId })).length;
    const { emit } = espiarEventos();

    const res = await app.inject({
      method: 'POST',
      url: '/api/transacoes',
      headers,
      payload: {
        tipo: 'despesa',
        valor: '300.00',
        categoriaId,
        data: '2026-03-10',
        parcelado: true,
        numeroParcelas: 3,
      },
    });

    expect(res.statusCode).toBe(500);
    expect(emit).not.toHaveBeenCalled();
    expect(await base.list({ familiaId })).toHaveLength(antes);
  });
});
