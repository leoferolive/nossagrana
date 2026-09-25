import { describe, expect, it } from 'vitest';

import { ClientePostgresFake } from '../../db/tests/cliente-postgres-fake.js';
import { DrizzleIdempotenciaRepository } from '../../shared/idempotencia/idempotencia.repository.js';
import { DrizzleTransacaoRepository } from './transacao.repository.js';
import {
  criarRepositoriosTransacaoDrizzle,
  criarUnitOfWorkTransacaoDrizzle,
} from './transacao.unit-of-work.js';

describe('fábricas de Unit of Work da transação (produção)', () => {
  it('transações e chave de idempotência sobre o mesmo executor', () => {
    const repos = criarRepositoriosTransacaoDrizzle(new ClientePostgresFake().executor());

    expect(repos.transacoes).toBeInstanceOf(DrizzleTransacaoRepository);
    expect(repos.idempotencia).toBeInstanceOf(DrizzleIdempotenciaRepository);
  });

  it('reserva da chave roda dentro da transação aberta pela unidade', async () => {
    const cliente = new ClientePostgresFake().responderCom({ chave: 'chave-0001' });
    const uow = criarUnitOfWorkTransacaoDrizzle(cliente.executor());

    const reserva = await uow.executar(({ repos }) =>
      repos.idempotencia.reservar({
        familiaId: 'fA',
        chave: 'chave-0001',
        operacao: 'POST /api/transacoes',
        hashPayload: 'h',
      }),
    );

    expect(reserva).toEqual({ reservada: true });
    expect(cliente.consultas[0]?.sql).toMatch(/^insert into "chaves_idempotencia"/);
  });
});
