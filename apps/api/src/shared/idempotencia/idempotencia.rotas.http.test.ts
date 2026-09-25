import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';

/**
 * Contrato HTTP da `Idempotency-Key` (#90) em aporte, retirada e aplicar
 * templates, com os repositórios InMemory compartilhados da app de teste.
 */
describe('Idempotency-Key em aportes, retiradas e aplicar templates', () => {
  const app = buildApp();
  const familiaId = randomUUID();
  let headers: Record<string, string>;
  let cofrinhoId: string;
  let templateId: string;

  beforeAll(async () => {
    await app.ready();
    const email = 'idempotencia-cofrinho@example.com';
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { nome: 'Idem Cofrinho', email, senha: 'password123' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, senha: 'password123' },
    });
    headers = {
      authorization: `Bearer ${login.json<{ accessToken: string }>().accessToken}`,
      'x-familia-id': familiaId,
    };
    const cofrinho = await app.inject({
      method: 'POST',
      url: '/api/cofrinhos',
      headers,
      payload: { nome: 'Viagem' },
    });
    cofrinhoId = cofrinho.json<{ cofrinho: { id: string } }>().cofrinho.id;
    const template = await app.inject({
      method: 'POST',
      url: '/api/templates-transacao',
      headers,
      payload: { nome: 'Reserva mensal', tipo: 'despesa', cofrinhoId },
    });
    templateId = template.json<{ template: { id: string } }>().template.id;
  });

  afterAll(() => app.close());

  const saldo = async () => {
    const res = await app.inject({ method: 'GET', url: `/api/cofrinhos/${cofrinhoId}`, headers });
    return res.json<{ cofrinho: { saldoAtual: string } }>().cofrinho.saldoAtual;
  };

  const post = (url: string, payload: object, chave?: string) =>
    app.inject({
      method: 'POST',
      url,
      headers: chave ? { ...headers, 'idempotency-key': chave } : headers,
      payload,
    });

  const aporte = (chave?: string, valor = '100.00') =>
    post(`/api/cofrinhos/${cofrinhoId}/aportes`, { valor }, chave);
  const retirada = (chave?: string) =>
    post(`/api/cofrinhos/${cofrinhoId}/retiradas`, { valor: '10.00', voltarAoSaldo: false }, chave);
  const aplicar = (chave?: string) =>
    post(
      '/api/templates-transacao/aplicar',
      { mesReferencia: '2026-03', itens: [{ templateId, valor: '5.00' }] },
      chave,
    );

  it('aporte: replay devolve 201 idêntico com Idempotent-Replayed e soma o saldo uma vez', async () => {
    const chave = randomUUID();
    const antes = Number(await saldo());

    const primeira = await aporte(chave);
    const replay = await aporte(chave);

    expect(primeira.statusCode).toBe(201);
    expect(replay.statusCode).toBe(201);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.json()).toEqual(primeira.json());
    expect(Number(await saldo())).toBe(antes + 100);
  });

  it('retirada: replay não retira de novo', async () => {
    await aporte();
    const chave = randomUUID();
    const antes = Number(await saldo());

    await retirada(chave);
    const replay = await retirada(chave);

    expect(replay.statusCode).toBe(201);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(Number(await saldo())).toBe(antes - 10);
  });

  it('aplicar: replay devolve 200 com o resultado gravado e aporta uma vez', async () => {
    const chave = randomUUID();
    const antes = Number(await saldo());

    const primeira = await aplicar(chave);
    const replay = await aplicar(chave);

    expect(primeira.statusCode).toBe(200);
    expect(replay.statusCode).toBe(200);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.json()).toEqual({ transacoesCriadas: 0, aportesCriados: 1, total: 1 });
    expect(Number(await saldo())).toBe(antes + 5);
  });

  it('mesma chave em outra rota → 422 IDEMPOTENCIA_CONFLITO, saldo intacto', async () => {
    const chave = randomUUID();
    await aporte(chave);
    const antes = await saldo();

    const res = await retirada(chave);

    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('IDEMPOTENCIA_CONFLITO');
    expect(await saldo()).toBe(antes);
  });

  it('aporte com valor diferente e mesma chave → 422', async () => {
    const chave = randomUUID();
    await aporte(chave);

    const res = await aporte(chave, '101.00');

    expect(res.statusCode).toBe(422);
  });

  it.each([
    ['aporte', () => aporte('x')],
    ['retirada', () => retirada('com espaço inválido')],
    ['aplicar', () => aplicar('a'.repeat(129))],
  ])('%s com chave inválida → 400 no envelope', async (_rota, enviar) => {
    const antes = await saldo();

    const res = await enviar();

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('IDEMPOTENCIA_CHAVE_INVALIDA');
    expect(await saldo()).toBe(antes);
  });

  it('sem header (documentado): dois aportes iguais somam duas vezes', async () => {
    const antes = Number(await saldo());

    await aporte(undefined, '1.00');
    await aporte(undefined, '1.00');

    expect(Number(await saldo())).toBe(antes + 2);
  });
});
