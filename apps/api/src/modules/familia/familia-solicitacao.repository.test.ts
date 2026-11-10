import { beforeEach, describe, expect, it } from 'vitest';

import { ClientePostgresFake } from '../../db/tests/cliente-postgres-fake.js';
import { DrizzleSolicitacaoEntrada } from './familia-solicitacao.repository.js';

const AGORA = new Date('2026-09-30T12:00:00.000Z');
const SOLICITADO_EM = new Date('2026-09-29T12:00:00.000Z');

describe('DrizzleSolicitacaoEntrada (SQL gerado)', () => {
  let cliente: ClientePostgresFake;
  let solicitacoes: DrizzleSolicitacaoEntrada;

  beforeEach(() => {
    cliente = new ClientePostgresFake();
    solicitacoes = new DrizzleSolicitacaoEntrada(cliente.executor());
  });

  function esperarTravaDaFamiliaAtiva() {
    const travamento = cliente.consultas[0]!;
    expect(travamento.sql).toMatch(/^select "id" from "familias" where/);
    expect(travamento.sql).toContain('"familias"."deleted_at" is null');
    expect(travamento.sql).toMatch(/for share$/);
    expect(travamento.params).toEqual(['fA']);
  }

  it('solicitar: trava a família ATIVA com FOR SHARE antes de inserir', async () => {
    cliente
      .responderCom({ id: 'fA' })
      .responderCom({ id: 's1', familiaId: 'fA', usuarioId: 'u2', solicitadoEm: SOLICITADO_EM });

    const criada = await solicitacoes.solicitar({ familiaId: 'fA', usuarioId: 'u2' });

    esperarTravaDaFamiliaAtiva();
    expect(cliente.consultas[1]!.sql).toMatch(/^insert into "solicitacoes_entrada"/);
    expect(criada).toEqual({
      id: 's1',
      familiaId: 'fA',
      usuarioId: 'u2',
      status: 'pendente',
      solicitadoEm: SOLICITADO_EM,
    });
  });

  it('solicitar: família excluída ou inexistente retorna null e não insere', async () => {
    cliente.responderCom();

    const criada = await solicitacoes.solicitar({ familiaId: 'fX', usuarioId: 'u2' });

    expect(criada).toBeNull();
    expect(cliente.consultas).toHaveLength(1);
  });

  it('solicitar: insert sem linha lança erro com usuário e família (rollback)', async () => {
    cliente.responderCom({ id: 'fA' });

    await expect(solicitacoes.solicitar({ familiaId: 'fA', usuarioId: 'u2' })).rejects.toThrow(
      /Solicitação do usuário u2 na família fA não retornou linha/,
    );
  });

  it('revisar: trava a família ativa e só então busca a solicitação pendente da família', async () => {
    cliente.responderCom({ id: 'fA' }).responderCom();

    const revisada = await solicitacoes.revisar(
      { solicitacaoId: 's1', familiaId: 'fA', adminId: 'u1', acao: 'aprovar' },
      AGORA,
    );

    esperarTravaDaFamiliaAtiva();
    const busca = cliente.consultas[1]!;
    expect(busca.sql).toContain('"solicitacoes_entrada"."familia_id" = $2');
    expect(busca.params).toContain('fA');
    expect(revisada).toBeNull();
    expect(cliente.consultas).toHaveLength(2);
  });

  it('revisar: família excluída retorna null sem consultar nem alterar a solicitação', async () => {
    cliente.responderCom();

    const revisada = await solicitacoes.revisar({
      solicitacaoId: 's1',
      familiaId: 'fX',
      adminId: 'u1',
      acao: 'aprovar',
    });

    expect(revisada).toBeNull();
    expect(cliente.consultas).toHaveLength(1);
  });

  it('revisar aprovar: atualiza a solicitação e vincula o membro', async () => {
    cliente
      .responderCom({ id: 'fA' })
      .responderCom({ id: 's1', familiaId: 'fA', usuarioId: 'u2' })
      .responderCom({ id: 's1', familiaId: 'fA', usuarioId: 'u2', solicitadoEm: SOLICITADO_EM });

    const revisada = await solicitacoes.revisar(
      { solicitacaoId: 's1', familiaId: 'fA', adminId: 'u1', acao: 'aprovar' },
      AGORA,
    );

    expect(revisada).toEqual({
      id: 's1',
      familiaId: 'fA',
      usuarioId: 'u2',
      status: 'aprovada',
      solicitadoEm: SOLICITADO_EM,
      respondidoEm: AGORA,
      respondidoPor: 'u1',
    });
    expect(cliente.consultas[3]!.sql).toMatch(/^insert into "usuario_familia"/);
    expect(cliente.consultas[3]!.sql).toContain('on conflict do nothing');
  });

  it('revisar rejeitar: não vincula membro', async () => {
    cliente
      .responderCom({ id: 'fA' })
      .responderCom({ id: 's1', familiaId: 'fA', usuarioId: 'u2' })
      .responderCom({ id: 's1', familiaId: 'fA', usuarioId: 'u2', solicitadoEm: SOLICITADO_EM });

    const revisada = await solicitacoes.revisar(
      { solicitacaoId: 's1', familiaId: 'fA', adminId: 'u1', acao: 'rejeitar' },
      AGORA,
    );

    expect(revisada?.status).toBe('rejeitada');
    expect(cliente.consultas).toHaveLength(3);
  });
});
