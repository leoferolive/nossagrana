import { beforeEach, describe, expect, it } from 'vitest';

import { ClientePostgresFake } from '../../db/tests/cliente-postgres-fake.js';
import { DrizzleConviteCriador } from './familia-convite-criacao.repository.js';

const AGORA = new Date('2026-09-30T12:00:00.000Z');
const DATA_CRIACAO = new Date('2026-09-30T12:00:00.100Z');

describe('DrizzleConviteCriador (SQL gerado)', () => {
  let cliente: ClientePostgresFake;
  let criador: DrizzleConviteCriador;

  beforeEach(() => {
    cliente = new ClientePostgresFake();
    criador = new DrizzleConviteCriador(cliente.executor());
  });

  it('trava a linha da família ATIVA com FOR SHARE antes de inserir (coordena com a exclusão)', async () => {
    cliente.responderCom({ id: 'fA' }).responderCom({
      id: 'c1',
      familiaId: 'fA',
      codigo: 'ABC',
      expiraEm: new Date(AGORA.getTime() + 1),
      criadoPor: 'u1',
      dataCriacao: DATA_CRIACAO,
    });

    await criador.criar({ familiaId: 'fA', criadoPor: 'u1' }, AGORA);

    const travamento = cliente.consultas[0]!;
    expect(travamento.sql).toMatch(/^select "id" from "familias" where/);
    expect(travamento.sql).toContain('"familias"."id" = $1');
    expect(travamento.sql).toContain('"familias"."deleted_at" is null');
    expect(travamento.sql).toMatch(/for share$/);
    expect(travamento.params).toEqual(['fA']);
    expect(cliente.consultas[1]!.sql).toMatch(/^insert into "convites"/);
  });

  it('insere com a validade de 7 dias e devolve o convite criado', async () => {
    const criado = {
      id: 'c1',
      familiaId: 'fA',
      codigo: 'ABC',
      expiraEm: new Date('2026-10-07T12:00:00.000Z'),
      criadoPor: 'u1',
      dataCriacao: DATA_CRIACAO,
    };
    cliente.responderCom({ id: 'fA' }).responderCom(criado);

    const convite = await criador.criar({ familiaId: 'fA', criadoPor: 'u1' }, AGORA);

    const insercao = cliente.consultas[1]!;
    expect(insercao.params).toContain('fA');
    expect(insercao.params).toContain('u1');
    expect(insercao.params).toContain('2026-10-07T12:00:00.000Z');
    expect(convite).toMatchObject({ id: 'c1', familiaId: 'fA', codigo: 'ABC' });
  });

  it('família excluída ou inexistente: retorna null e não insere', async () => {
    cliente.responderCom();

    const convite = await criador.criar({ familiaId: 'fX', criadoPor: 'u1' }, AGORA);

    expect(convite).toBeNull();
    expect(cliente.consultas).toHaveLength(1);
  });

  it('insert que não devolve linha lança erro com o familiaId (rollback)', async () => {
    cliente.responderCom({ id: 'fA' });

    await expect(criador.criar({ familiaId: 'fA', criadoPor: 'u1' }, AGORA)).rejects.toThrow(
      /Convite da família fA não retornou linha/,
    );
  });
});
