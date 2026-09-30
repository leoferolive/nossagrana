import { beforeEach, describe, expect, it } from 'vitest';

import { ClientePostgresFake } from '../../db/tests/cliente-postgres-fake.js';
import { DrizzleFamiliaExclusao } from './familia-exclusao.repository.js';

const AGORA = new Date('2026-09-30T12:00:00.000Z');

/** Fake nomeada: o UPDATE da família passa; a 2ª consulta (convites) falha. */
class ClienteFalhaNaSegundaConsulta extends ClientePostgresFake {
  private chamadas = 0;

  constructor(private readonly falha: Error) {
    super();
  }

  override unsafe(query: string, params: unknown[] = []) {
    this.chamadas += 1;
    if (this.chamadas === 2) this.falharNaProxima(this.falha);
    return super.unsafe(query, params);
  }
}

describe('DrizzleFamiliaExclusao (SQL gerado)', () => {
  let cliente: ClientePostgresFake;
  let exclusao: DrizzleFamiliaExclusao;

  beforeEach(() => {
    cliente = new ClientePostgresFake();
    exclusao = new DrizzleFamiliaExclusao(cliente.executor());
  });

  it('marca a família como excluída só se ainda estiver ativa (idempotente)', async () => {
    cliente.responderCom({ id: 'fA' });

    const excluida = await exclusao.excluir({ familiaId: 'fA' }, AGORA);

    const update = cliente.consultas[0]!;
    expect(update.sql).toMatch(/^update "familias" set "deleted_at" = \$1 where/);
    expect(update.sql).toContain('"familias"."id" = $2');
    expect(update.sql).toContain('"familias"."deleted_at" is null');
    expect(update.params).toEqual([AGORA.toISOString(), 'fA']);
    expect(excluida).toBe(true);
  });

  it('invalida na mesma transação os convites pendentes da própria família (expira_em = agora)', async () => {
    cliente.responderCom({ id: 'fA' });

    await exclusao.excluir({ familiaId: 'fA' }, AGORA);

    const convites = cliente.consultas[1]!;
    expect(convites.sql).toMatch(/^update "convites" set "expira_em" = \$1 where/);
    expect(convites.sql).toContain('"convites"."familia_id" = $2');
    expect(convites.sql).toContain('"convites"."usado_por" is null');
    expect(convites.sql).toContain('"convites"."expira_em" > $3');
    expect(convites.params).toEqual([AGORA.toISOString(), 'fA', AGORA.toISOString()]);
  });

  it('família inexistente ou já excluída: retorna false e não mexe em convites', async () => {
    cliente.responderCom();

    const excluida = await exclusao.excluir({ familiaId: 'fX' }, AGORA);

    expect(excluida).toBe(false);
    expect(cliente.consultas).toHaveLength(1);
  });

  it('falha ao invalidar convites propaga o erro (a transação faz rollback da exclusão)', async () => {
    const falha = new Error('deadlock ao invalidar convites');
    const clienteComFalha = new ClienteFalhaNaSegundaConsulta(falha).responderCom({ id: 'fA' });

    await expect(
      new DrizzleFamiliaExclusao(clienteComFalha.executor()).excluir({ familiaId: 'fA' }, AGORA),
    ).rejects.toMatchObject({ cause: falha });
  });
});
