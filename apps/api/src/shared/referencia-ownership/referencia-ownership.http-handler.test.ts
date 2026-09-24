import { DrizzleQueryError } from 'drizzle-orm/errors';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { registrarRespostaReferenciaInvalida } from './referencia-ownership.http.js';
import { ReferenciaInvalidaError } from './referencia-ownership.validator.js';

function appQueLanca(erro: Error) {
  const app = Fastify({ logger: false });
  registrarRespostaReferenciaInvalida(app);
  app.get('/falha', async () => {
    throw erro;
  });
  return app;
}

describe('registrarRespostaReferenciaInvalida', () => {
  it('responde 422 no envelope { error: { message, code } }', async () => {
    const app = appQueLanca(
      new ReferenciaInvalidaError('categoria', 'nao_encontrada', 'Referência inválida (categoria)'),
    );

    const res = await app.inject({ method: 'GET', url: '/falha' });

    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({
      error: { message: 'Referência inválida (categoria)', code: 'REFERENCIA_INVALIDA' },
    });
  });

  it('delega outros erros ao handler padrão do Fastify sem mudar o formato', async () => {
    const semHandler = Fastify({ logger: false });
    semHandler.get('/falha', async () => {
      throw Object.assign(new Error('conflito qualquer'), { statusCode: 409 });
    });
    const comHandler = appQueLanca(
      Object.assign(new Error('conflito qualquer'), { statusCode: 409 }),
    );

    const esperado = await semHandler.inject({ method: 'GET', url: '/falha' });
    const res = await comHandler.inject({ method: 'GET', url: '/falha' });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual(esperado.json());
  });

  it('responde 422 sem expor SQL quando o banco rejeita a FK composta por família', async () => {
    const sql = 'insert into "transacoes" ("categoria_id", "familia_id") values ($1, $2)';
    const violacao = Object.assign(
      new Error(
        'insert or update on table "transacoes" violates foreign key constraint "transacoes_categoria_familia_fk"',
      ),
      { code: '23503', constraint_name: 'transacoes_categoria_familia_fk', query: sql },
    );

    const res = await appQueLanca(new DrizzleQueryError(sql, ['x'], violacao)).inject({
      method: 'GET',
      url: '/falha',
    });

    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({
      error: {
        message: 'Referência inválida (categoria): o ID informado não existe na família ativa',
        code: 'REFERENCIA_INVALIDA',
      },
    });
    expect(res.body).not.toMatch(/insert|foreign key|_fk/i);
  });

  it('mantém 500 para erros inesperados', async () => {
    const res = await appQueLanca(new Error('boom')).inject({ method: 'GET', url: '/falha' });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ statusCode: 500, message: 'boom' });
  });
});
