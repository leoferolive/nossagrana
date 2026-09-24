import { Writable } from 'node:stream';

import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { ConflitoDeConcorrenciaError } from './conflito-concorrencia.js';
import { responderConflitoDeConcorrencia } from './conflito-concorrencia.http.js';

/** Fake nomeada do destino de log: guarda as linhas JSON do pino. */
class DestinoDeLogFake extends Writable {
  readonly linhas: Array<Record<string, unknown>> = [];

  override _write(chunk: Buffer, _enc: BufferEncoding, pronto: () => void): void {
    this.linhas.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
    pronto();
  }
}

describe('responderConflitoDeConcorrencia', () => {
  it('responde 409 e registra warn com sqlstate e operação (rota template, sem IDs nem valores)', async () => {
    const destino = new DestinoDeLogFake();
    const app = Fastify({ logger: { level: 'warn', stream: destino } });
    app.post('/cofrinhos/:id/retiradas', async (request, reply) =>
      responderConflitoDeConcorrencia(new ConflitoDeConcorrenciaError('55P03'), request, reply),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/cofrinhos/c0ffee00-0000-4000-8000-000000000001/retiradas',
      payload: { valor: '123.45' },
    });
    await app.close();

    expect(res.statusCode).toBe(409);
    expect(res.json().message).toMatch(/nada foi gravado/);
    const aviso = destino.linhas.find((l) => l.sqlstate === '55P03');
    expect(aviso).toMatchObject({ level: 40, operacao: 'POST /cofrinhos/:id/retiradas' });
    expect(JSON.stringify(aviso)).not.toMatch(/c0ffee00|123\.45/);
  });
});
