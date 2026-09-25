import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { describe, expect, it } from 'vitest';

import { IdempotenciaConflitoError } from '../../shared/idempotencia/idempotencia.errors.js';
import { registrarRespostaReferenciaInvalida } from '../../shared/referencia-ownership/referencia-ownership.http.js';
import { ReferenciaInvalidaError } from '../../shared/referencia-ownership/referencia-ownership.validator.js';
import { cofrinhoAporteSchema, cofrinhoRetiradaSchema } from './cofrinho.schema.js';

/**
 * 422 de aporte/retirada serializa os dois envelopes possíveis: conflito de
 * idempotência (#90) e referência inválida (FK composta, #58) — um schema só
 * com um deles faria o outro virar 500 na serialização da resposta.
 */
function appQueLanca(schema: { response: object }, erro: Error) {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registrarRespostaReferenciaInvalida(app);
  app.post('/cofrinhos/:id/op', { schema: { response: schema.response } }, async () => {
    throw erro;
  });
  return app;
}

const erros: Array<[string, Error, string]> = [
  [
    'REFERENCIA_INVALIDA',
    new ReferenciaInvalidaError('cofrinho', 'nao_encontrada', 'Referência inválida (cofrinho)'),
    'REFERENCIA_INVALIDA',
  ],
  [
    'IDEMPOTENCIA_CONFLITO',
    new IdempotenciaConflitoError('chave-0001', 'POST /a', 'POST /b'),
    'IDEMPOTENCIA_CONFLITO',
  ],
];

describe.each([
  ['aporte', cofrinhoAporteSchema],
  ['retirada', cofrinhoRetiradaSchema],
])('schema de resposta 422 — %s', (_rota, schema) => {
  it.each(erros)('%s é serializado como 422 no envelope', async (_caso, erro, code) => {
    const res = await appQueLanca(schema, erro).inject({ method: 'POST', url: '/cofrinhos/c1/op' });

    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: { message: erro.message, code } });
  });
});
