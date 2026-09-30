import Fastify from 'fastify';
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { opcoesDoLogger, redigirUrl } from './log-redaction.js';

/** Fake nomeada do destino de logs: guarda cada linha JSON emitida pelo pino. */
class DestinoDeLogFake extends Writable {
  readonly linhas: string[] = [];

  _write(chunk: Buffer, _encoding: string, callback: () => void): void {
    this.linhas.push(chunk.toString());
    callback();
  }

  get texto(): string {
    return this.linhas.join('\n');
  }
}

describe('redigirUrl', () => {
  it('redige o ticket do WebSocket, preservando o resto da URL', () => {
    const url = '/api/ws?ticket=abcDEF_123-xyz&familiaId=11111111-1111-4111-8111-111111111111';

    expect(redigirUrl(url)).toBe(
      '/api/ws?ticket=[REDACTED]&familiaId=11111111-1111-4111-8111-111111111111',
    );
  });

  it('redige token legado, access e refresh em qualquer posição da query', () => {
    const url = '/x?a=1&token=jwt.payload.assinatura&accessToken=aaa&refreshToken=bbb&b=2';

    expect(redigirUrl(url)).toBe(
      '/x?a=1&token=[REDACTED]&accessToken=[REDACTED]&refreshToken=[REDACTED]&b=2',
    );
  });

  it('não altera URLs sem parâmetro sensível', () => {
    expect(redigirUrl('/api/transacoes?mes=2026-09&page=1')).toBe(
      '/api/transacoes?mes=2026-09&page=1',
    );
    expect(redigirUrl('/api/health')).toBe('/api/health');
  });

  it('redige o nome do parâmetro escrito com percent-encoding (o Fastify decodifica a chave)', () => {
    expect(redigirUrl('/api/ws?%74icket=SEGREDO&familiaId=f1')).toBe(
      '/api/ws?%74icket=[REDACTED]&familiaId=f1',
    );
    expect(redigirUrl('/x?a=1&to%6Ben=JWT&%61ccess%54oken=AAA&refresh%54oken=BBB')).toBe(
      '/x?a=1&to%6Ben=[REDACTED]&%61ccess%54oken=[REDACTED]&refresh%54oken=[REDACTED]',
    );
  });

  it('chave malformada (percent-encoding inválido) não quebra nem é alterada', () => {
    expect(redigirUrl('/x?%E0%A4%A=1&a=2')).toBe('/x?%E0%A4%A=1&a=2');
  });

  it('o fragmento depois de # não é tratado como query', () => {
    expect(redigirUrl('/x?a=1#ticket=abc')).toBe('/x?a=1#ticket=abc');
  });

  it('não confunde parâmetros que apenas terminam com o nome sensível', () => {
    expect(redigirUrl('/x?meuticket=1&ticketing=2')).toBe('/x?meuticket=1&ticketing=2');
  });
});

describe('opcoesDoLogger', () => {
  it('o log de requisição de um handshake WS nunca contém o ticket bruto', async () => {
    const destino = new DestinoDeLogFake();
    const app = Fastify({ logger: { ...opcoesDoLogger(), stream: destino } });
    app.get('/api/ws', async () => ({ ok: true }));

    await app.inject({ method: 'GET', url: '/api/ws?ticket=SEGREDO-DO-TICKET&token=SEGREDO-JWT' });
    await app.close();

    expect(destino.texto).toContain('[REDACTED]');
    expect(destino.texto).not.toContain('SEGREDO-DO-TICKET');
    expect(destino.texto).not.toContain('SEGREDO-JWT');
  });

  it('nem quando o nome do parâmetro vem percent-encoded e o Fastify o decodifica', async () => {
    const destino = new DestinoDeLogFake();
    const app = Fastify({ logger: { ...opcoesDoLogger(), stream: destino } });
    let ticketLido: unknown;
    app.get('/api/ws', async (request) => {
      ticketLido = (request.query as Record<string, unknown>).ticket;
      return { ok: true };
    });

    await app.inject({ method: 'GET', url: '/api/ws?%74icket=SEGREDO-CODIFICADO' });
    await app.close();

    expect(ticketLido).toBe('SEGREDO-CODIFICADO');
    expect(destino.texto).not.toContain('SEGREDO-CODIFICADO');
  });
});
