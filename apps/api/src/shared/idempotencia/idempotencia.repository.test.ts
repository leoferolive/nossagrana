import { describe, expect, it } from 'vitest';

import { ClientePostgresFake } from '../../db/tests/cliente-postgres-fake.js';
import { InMemoryUnitOfWork } from '../unit-of-work/in-memory-unit-of-work.js';
import {
  DrizzleIdempotenciaRepository,
  InMemoryIdempotenciaRepository,
  JANELA_REPLAY_MS,
} from './idempotencia.repository.js';
import type { PedidoIdempotente } from './idempotencia.types.js';

const pedido = (familiaId = 'fA', chave = 'chave-0001'): PedidoIdempotente => ({
  familiaId,
  chave,
  operacao: 'POST /api/transacoes',
  hashPayload: 'hash-1',
});

const resposta = { statusCode: 201, corpo: { transacao: { id: 't1' } } };

/** Relógio controlável: testes de expiração sem esperar 24h. */
class RelogioFake {
  constructor(private atual = new Date('2026-09-24T12:00:00Z')) {}
  agora = (): Date => this.atual;
  avancar(ms: number): void {
    this.atual = new Date(this.atual.getTime() + ms);
  }
}

describe('InMemoryIdempotenciaRepository', () => {
  it('1ª reserva da chave reserva; a 2ª devolve o registro com a resposta gravada', async () => {
    const repo = new InMemoryIdempotenciaRepository();

    expect(await repo.reservar(pedido())).toEqual({ reservada: true });
    await repo.gravarResposta({ familiaId: 'fA', chave: 'chave-0001', resposta });
    const segunda = await repo.reservar(pedido());

    expect(segunda).toMatchObject({ reservada: false, existente: { ...pedido(), resposta } });
  });

  it('mesma chave em famílias diferentes são registros independentes', async () => {
    const repo = new InMemoryIdempotenciaRepository();

    await repo.reservar(pedido('fA'));

    expect(await repo.reservar(pedido('fB'))).toEqual({ reservada: true });
    expect(repo.chavesDa('fA')).toEqual(['chave-0001']);
    expect(repo.chavesDa('fB')).toEqual(['chave-0001']);
  });

  it('chave expirada (fora da janela de 24h) é reaproveitada como nova reserva', async () => {
    const relogio = new RelogioFake();
    const repo = new InMemoryIdempotenciaRepository(relogio.agora);
    await repo.reservar(pedido());
    await repo.gravarResposta({ familiaId: 'fA', chave: 'chave-0001', resposta });

    relogio.avancar(JANELA_REPLAY_MS + 1);

    expect(await repo.reservar({ ...pedido(), hashPayload: 'outro' })).toEqual({ reservada: true });
    expect(repo.chavesDa('fA')).toEqual(['chave-0001']);
  });

  it('removerExpiradas apaga só as chaves fora da janela', async () => {
    const relogio = new RelogioFake();
    const repo = new InMemoryIdempotenciaRepository(relogio.agora);
    await repo.reservar(pedido('fA', 'antiga-0001'));
    relogio.avancar(JANELA_REPLAY_MS + 1);
    await repo.reservar(pedido('fB', 'recente-001'));

    expect(await repo.removerExpiradas()).toBe(1);
    expect(repo.chavesDa('fA')).toEqual([]);
    expect(repo.chavesDa('fB')).toEqual(['recente-001']);
  });

  it('gravarResposta sem reserva prévia falha citando família e chave', async () => {
    const repo = new InMemoryIdempotenciaRepository();

    await expect(
      repo.gravarResposta({ familiaId: 'fA', chave: 'nao-reservada', resposta }),
    ).rejects.toThrow(/"nao-reservada" da família fA: esperado reservar a chave antes/);
  });

  it('participa da InMemoryUnitOfWork: rollback descarta a reserva', async () => {
    const idempotencia = new InMemoryIdempotenciaRepository();
    const uow = new InMemoryUnitOfWork({ idempotencia });

    await expect(
      uow.executar(async ({ repos }) => {
        await repos.idempotencia.reservar(pedido());
        throw new Error('falha depois da reserva');
      }),
    ).rejects.toThrow('falha depois da reserva');
    await uow.executar(({ repos }) => repos.idempotencia.reservar(pedido('fA', 'confirmada-1')));

    expect(idempotencia.chavesDa('fA')).toEqual(['confirmada-1']);
  });
});

/** Mesma ordem das colunas selecionadas por `colunasRegistro`. */
const linhaRegistro = {
  familiaId: 'fA',
  chave: 'chave-0001',
  operacao: 'POST /api/transacoes',
  hashPayload: 'hash-1',
  statusCode: 201,
  resposta: { transacao: { id: 't1' } },
  criadoEm: new Date('2026-09-24T12:00:00Z'),
};

describe('DrizzleIdempotenciaRepository (SQL gerado)', () => {
  it('reservar: INSERT ... ON CONFLICT (familia_id, chave) só sobrescreve chave expirada', async () => {
    const cliente = new ClientePostgresFake().responderCom({ chave: 'chave-0001' });
    const repo = new DrizzleIdempotenciaRepository(cliente.executor());

    expect(await repo.reservar(pedido())).toEqual({ reservada: true });

    const [insert] = cliente.consultas;
    expect(insert?.sql).toMatch(/^insert into "chaves_idempotencia"/);
    expect(insert?.sql).toMatch(
      /on conflict \("familia_id","chave"\) do update set .* where "chaves_idempotencia"\."criado_em" < now\(\) - interval '24 hours' returning "chave"/,
    );
    expect(insert?.params).toEqual(expect.arrayContaining(['fA', 'chave-0001', 'hash-1']));
    expect(cliente.consultas).toHaveLength(1);
  });

  it('reservar com conflito lê o registro confirmado filtrando família + chave', async () => {
    const cliente = new ClientePostgresFake().responderCom().responderCom(linhaRegistro);
    const repo = new DrizzleIdempotenciaRepository(cliente.executor());

    const reserva = await repo.reservar(pedido());

    expect(reserva).toEqual({
      reservada: false,
      existente: { ...pedido(), resposta, criadoEm: linhaRegistro.criadoEm },
    });
    expect(cliente.consultas[1]?.sql).toMatch(
      /where \("chaves_idempotencia"\."familia_id" = \$1 and "chaves_idempotencia"\."chave" = \$2\)/,
    );
  });

  it('registro sem status (reserva não concluída) vira resposta null', async () => {
    const pendente = { ...linhaRegistro, statusCode: null, resposta: null };
    const cliente = new ClientePostgresFake().responderCom().responderCom(pendente);

    const reserva = await new DrizzleIdempotenciaRepository(cliente.executor()).reservar(pedido());

    expect(reserva).toMatchObject({ reservada: false, existente: { resposta: null } });
  });

  it('conflito sem linha visível (apagada entre as consultas) falha com mensagem acionável', async () => {
    const cliente = new ClientePostgresFake().responderCom().responderCom();

    await expect(
      new DrizzleIdempotenciaRepository(cliente.executor()).reservar(pedido()),
    ).rejects.toThrow(/"chave-0001" da família fA: esperado registro visível após conflito/);
  });

  it('gravarResposta atualiza status e resposta da chave da família', async () => {
    const cliente = new ClientePostgresFake().responderCom({ chave: 'chave-0001' });

    await new DrizzleIdempotenciaRepository(cliente.executor()).gravarResposta({
      familiaId: 'fA',
      chave: 'chave-0001',
      resposta,
    });

    expect(cliente.consultas[0]?.sql).toMatch(
      /^update "chaves_idempotencia" set "status_code" = \$1, "resposta" = \$2 where \("chaves_idempotencia"\."familia_id" = \$3 and "chaves_idempotencia"\."chave" = \$4\)/,
    );
  });

  it('gravarResposta sem linha afetada falha (reserva ausente)', async () => {
    const cliente = new ClientePostgresFake();

    await expect(
      new DrizzleIdempotenciaRepository(cliente.executor()).gravarResposta({
        familiaId: 'fA',
        chave: 'chave-0001',
        resposta,
      }),
    ).rejects.toThrow(/esperado reservar a chave antes/);
  });

  it('removerExpiradas apaga pela janela de 24h e devolve a contagem', async () => {
    const cliente = new ClientePostgresFake().responderCom({ chave: 'a' }, { chave: 'b' });

    expect(await new DrizzleIdempotenciaRepository(cliente.executor()).removerExpiradas()).toBe(2);
    expect(cliente.consultas[0]?.sql).toMatch(
      /^delete from "chaves_idempotencia" where "chaves_idempotencia"\."criado_em" < now\(\) - interval '24 hours'/,
    );
  });
});
