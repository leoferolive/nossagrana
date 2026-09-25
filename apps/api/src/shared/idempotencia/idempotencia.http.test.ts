import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { registrarRespostaReferenciaInvalida } from '../referencia-ownership/referencia-ownership.http.js';
import {
  ChaveIdempotenciaInvalidaError,
  IdempotenciaConflitoError,
} from './idempotencia.errors.js';
import {
  hashDoPayload,
  jsonCanonico,
  lerChaveIdempotencia,
  pedidoIdempotenteDe,
  responderIdempotente,
} from './idempotencia.http.js';
import type { ResultadoIdempotente } from './idempotencia.types.js';

describe('lerChaveIdempotencia', () => {
  it('sem header → null (sem deduplicação)', () => {
    expect(lerChaveIdempotencia({})).toBeNull();
  });

  it.each(['12345678', 'a'.repeat(128), '3f1c2b9e-0d4a-4b7e-9a51-2f6c8d0e1a23', 'A_b-9_zZ'])(
    'aceita "%s"',
    (chave) => {
      expect(lerChaveIdempotencia({ 'idempotency-key': chave })).toBe(chave);
    },
  );

  it.each([
    ['curta demais (7)', '1234567'],
    ['longa demais (129)', 'a'.repeat(129)],
    ['caractere fora do formato', 'chave com espaço'],
    ['vazia', ''],
  ])('rejeita chave %s com ChaveIdempotenciaInvalidaError (400)', (_caso, chave) => {
    const erro = (() => {
      try {
        lerChaveIdempotencia({ 'idempotency-key': chave });
      } catch (e) {
        return e;
      }
    })();

    expect(erro).toBeInstanceOf(ChaveIdempotenciaInvalidaError);
    expect(erro).toMatchObject({ statusHttp: 400, code: 'IDEMPOTENCIA_CHAVE_INVALIDA' });
    expect((erro as Error).message).toContain(`${chave.length} caractere(s)`);
    expect((erro as Error).message).not.toContain(chave || '\u0000');
  });

  it('header repetido (array) é rejeitado', () => {
    expect(() => lerChaveIdempotencia({ 'idempotency-key': ['chave-0001', 'chave-0002'] })).toThrow(
      ChaveIdempotenciaInvalidaError,
    );
  });
});

describe('hashDoPayload / jsonCanonico', () => {
  it('ordem das chaves não muda o hash; valores diferentes mudam', () => {
    const a = hashDoPayload({ corpo: { valor: '10.00', tipo: 'despesa' }, usuarioId: 'u1' });
    const b = hashDoPayload({ usuarioId: 'u1', corpo: { tipo: 'despesa', valor: '10.00' } });
    const c = hashDoPayload({ usuarioId: 'u1', corpo: { tipo: 'despesa', valor: '10.01' } });

    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('serializa arrays na ordem, aninhados ordenados, e ignora undefined como o JSON', () => {
    expect(jsonCanonico({ b: [{ d: 1, c: 2 }, null], a: undefined, e: 'x' })).toBe(
      '{"b":[{"c":2,"d":1},null],"e":"x"}',
    );
  });
});

describe('pedidoIdempotenteDe', () => {
  const base = {
    operacao: 'POST /api/cofrinhos/:id/aportes',
    familiaId: 'fA',
    usuarioId: 'u1',
    params: { id: 'c1' },
    corpo: { valor: '10.00' },
  };

  it('sem header → null', () => {
    expect(pedidoIdempotenteDe({ ...base, headers: {} })).toBeNull();
  });

  it('com header → pedido com hash de usuário + params + corpo (sem corpo em claro)', () => {
    const pedido = pedidoIdempotenteDe({ ...base, headers: { 'idempotency-key': 'chave-0001' } });

    expect(pedido).toEqual({
      familiaId: 'fA',
      chave: 'chave-0001',
      operacao: 'POST /api/cofrinhos/:id/aportes',
      hashPayload: hashDoPayload({
        usuarioId: 'u1',
        params: { id: 'c1' },
        corpo: { valor: '10.00' },
      }),
    });
  });

  it('outro cofrinho (params) com o mesmo corpo gera hash diferente', () => {
    const headers = { 'idempotency-key': 'chave-0001' };
    const c1 = pedidoIdempotenteDe({ ...base, headers });
    const c2 = pedidoIdempotenteDe({ ...base, headers, params: { id: 'c2' } });

    expect(c1?.hashPayload).not.toBe(c2?.hashPayload);
  });
});

function appQueResponde(resultado: ResultadoIdempotente<{ id: string }>) {
  const app = Fastify({ logger: false });
  app.post('/op', async (_request, reply) =>
    responderIdempotente(reply, resultado, (valor) => ({ statusCode: 201, corpo: { valor } })),
  );
  return app;
}

describe('responderIdempotente', () => {
  it('executada: status/corpo do responder, sem header de replay', async () => {
    const res = await appQueResponde({ tipo: 'executada', valor: { id: 't1' } }).inject({
      method: 'POST',
      url: '/op',
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ valor: { id: 't1' } });
    expect(res.headers['idempotent-replayed']).toBeUndefined();
  });

  it('repetida: status e corpo gravados + Idempotent-Replayed: true', async () => {
    const res = await appQueResponde({
      tipo: 'repetida',
      resposta: { statusCode: 200, corpo: { gravado: true } },
    }).inject({ method: 'POST', url: '/op' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ gravado: true });
    expect(res.headers['idempotent-replayed']).toBe('true');
  });
});

describe('handler central: erros de idempotência no envelope { error: { message, code } }', () => {
  it.each([
    ['chave inválida', new ChaveIdempotenciaInvalidaError(3), 400, 'IDEMPOTENCIA_CHAVE_INVALIDA'],
    [
      'conflito',
      new IdempotenciaConflitoError('chave-0001', 'POST /a', 'POST /b'),
      422,
      'IDEMPOTENCIA_CONFLITO',
    ],
  ] as const)('%s → %i', async (_caso, erro, status, code) => {
    const app = Fastify({ logger: false });
    registrarRespostaReferenciaInvalida(app);
    app.get('/falha', async () => {
      throw erro;
    });

    const res = await app.inject({ method: 'GET', url: '/falha' });

    expect(res.statusCode).toBe(status);
    expect(res.json()).toEqual({ error: { message: erro.message, code } });
  });
});
