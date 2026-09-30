import { beforeEach, describe, expect, it } from 'vitest';

import { ClientePostgresFake } from '../../db/tests/cliente-postgres-fake.js';
import { DrizzleConviteConsumer } from './familia-convite.repository.js';

const AGORA = new Date('2026-09-30T12:00:00.000Z');
const FAMILIA = { id: 'fA', nome: 'Silva', dataCriacao: new Date('2026-01-01T00:00:00.000Z') };
/** Fake nomeada: o UPDATE do consumo passa; a 2ª consulta (insert da membership) falha. */
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

const entrada = { codigo: 'ABC123', usuarioId: 'u1' };

describe('DrizzleConviteConsumer (SQL gerado)', () => {
  let cliente: ClientePostgresFake;
  let consumidor: DrizzleConviteConsumer;

  beforeEach(() => {
    cliente = new ClientePostgresFake();
    consumidor = new DrizzleConviteConsumer(cliente.executor());
  });

  it('consome com UPDATE condicional atômico (não usado, não expirado, família ativa)', async () => {
    cliente
      .responderCom({ familiaId: 'fA' })
      .responderCom({ usuarioId: 'u1' })
      .responderCom(FAMILIA);

    const resultado = await consumidor.consumir(entrada, AGORA);

    const update = cliente.consultas[0]!;
    expect(update.sql).toMatch(/^update "convites" set "usado_por" = \$1, "usado_em" = \$2 where/);
    expect(update.sql).toContain('"convites"."codigo" = $3');
    expect(update.sql).toContain('"convites"."usado_por" is null');
    expect(update.sql).toContain('"convites"."expira_em" > $4');
    expect(update.sql).toMatch(
      /exists \(select 1 from "familias" where .*"familias"."deleted_at" is null/,
    );
    expect(update.sql).toMatch(/returning "familia_id"$/);
    expect(update.params.slice(0, 4)).toEqual([
      'u1',
      AGORA.toISOString(),
      'ABC123',
      AGORA.toISOString(),
    ]);
    expect(resultado).toEqual({ status: 'entrou', familia: FAMILIA });
  });

  it('insere a membership como "membro" na família do convite, sem duplicar vínculo', async () => {
    cliente
      .responderCom({ familiaId: 'fA' })
      .responderCom({ usuarioId: 'u1' })
      .responderCom(FAMILIA);

    await consumidor.consumir(entrada, AGORA);

    const insert = cliente.consultas[1]!;
    expect(insert.sql).toMatch(/^insert into "usuario_familia"/);
    expect(insert.sql).toContain('on conflict do nothing');
    expect(insert.sql).toMatch(/returning "usuario_id"$/);
    expect(insert.params).toEqual(expect.arrayContaining(['u1', 'fA', 'membro']));
  });

  it('já é membro: reverte o consumo (exceção interna) e devolve "ja_membro"', async () => {
    cliente.responderCom({ familiaId: 'fA' }).responderCom().responderCom(FAMILIA);

    const resultado = await consumidor.consumir(entrada, AGORA);

    expect(resultado).toEqual({ status: 'ja_membro', familia: FAMILIA });
  });

  it('UPDATE sem linhas: convite inexistente vira "invalido"', async () => {
    cliente.responderCom().responderCom();

    expect(await consumidor.consumir(entrada, AGORA)).toEqual({ status: 'invalido' });
    expect(cliente.consultas).toHaveLength(2);
    expect(cliente.consultas[1]!.sql).toMatch(/^select .* from "convites" inner join "familias"/);
  });

  it('UPDATE sem linhas: convite já consumido vira "usado"', async () => {
    const expiraEm = new Date(AGORA.getTime() + 1000);
    cliente
      .responderCom()
      .responderCom({ familiaId: 'fA', usadoPor: 'u9', expiraEm, familiaExcluidaEm: null });

    expect(await consumidor.consumir(entrada, AGORA)).toEqual({ status: 'usado' });
  });

  it('UPDATE sem linhas: repetição pelo próprio consumidor que ainda é membro vira "ja_membro"', async () => {
    const expiraEm = new Date(AGORA.getTime() + 1000);
    cliente
      .responderCom()
      .responderCom({ familiaId: 'fA', usadoPor: 'u1', expiraEm, familiaExcluidaEm: null })
      .responderCom({ usuarioId: 'u1' })
      .responderCom(FAMILIA);

    expect(await consumidor.consumir(entrada, AGORA)).toEqual({
      status: 'ja_membro',
      familia: FAMILIA,
    });
    const vinculo = cliente.consultas[2]!;
    expect(vinculo.sql).toMatch(/^select .* from "usuario_familia"/);
    expect(vinculo.params).toEqual(expect.arrayContaining(['u1', 'fA']));
  });

  it('UPDATE sem linhas: consumidor que foi removido da família continua "usado"', async () => {
    const expiraEm = new Date(AGORA.getTime() + 1000);
    cliente
      .responderCom()
      .responderCom({ familiaId: 'fA', usadoPor: 'u1', expiraEm, familiaExcluidaEm: null })
      .responderCom();

    expect(await consumidor.consumir(entrada, AGORA)).toEqual({ status: 'usado' });
  });

  it('UPDATE sem linhas: convite vencido vira "expirado"', async () => {
    const expiraEm = new Date(AGORA.getTime() - 1000);
    cliente
      .responderCom()
      .responderCom({ familiaId: 'fA', usadoPor: null, expiraEm, familiaExcluidaEm: null });

    expect(await consumidor.consumir(entrada, AGORA)).toEqual({ status: 'expirado' });
  });

  it('UPDATE sem linhas: família excluída vira "invalido" mesmo com convite livre', async () => {
    const expiraEm = new Date(AGORA.getTime() + 1000);
    cliente.responderCom().responderCom({
      familiaId: 'fA',
      usadoPor: null,
      expiraEm,
      familiaExcluidaEm: new Date('2026-09-01'),
    });

    expect(await consumidor.consumir(entrada, AGORA)).toEqual({ status: 'invalido' });
  });

  it('UPDATE sem linhas mas convite parece elegível (corrida com restauração): "invalido" determinístico', async () => {
    const expiraEm = new Date(AGORA.getTime() + 1000);
    cliente
      .responderCom()
      .responderCom({ familiaId: 'fA', usadoPor: null, expiraEm, familiaExcluidaEm: null });

    expect(await consumidor.consumir(entrada, AGORA)).toEqual({ status: 'invalido' });
  });

  it('falha na etapa posterior propaga o erro (a transação inteira é revertida pelo banco)', async () => {
    const comFalha = new ClienteFalhaNaSegundaConsulta(new Error('violação de FK'));
    comFalha.responderCom({ familiaId: 'fA' });

    await expect(
      new DrizzleConviteConsumer(comFalha.executor()).consumir(entrada, AGORA),
    ).rejects.toThrow(/Failed query: insert into "usuario_familia"/);
  });
});
