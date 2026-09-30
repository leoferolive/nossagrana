import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../../db/client.js', () => ({
  db: mockDb,
}));

import { DrizzleFamiliaRepository, InMemoryFamiliaRepository } from './familia.repository.js';

describe('InMemoryFamiliaRepository', () => {
  it('handles family lifecycle flows', async () => {
    const repository = new InMemoryFamiliaRepository();
    const adminId = 'u-admin';
    const memberId = 'u-member';

    const familia = await repository.createWithAdminMembership({
      nome: 'Familia Teste',
      usuarioId: adminId,
    });

    expect(await repository.isUserAdmin({ familiaId: familia.id, usuarioId: adminId })).toBe(true);
    expect(await repository.isUserAdmin({ familiaId: familia.id, usuarioId: memberId })).toBe(
      false,
    );
    expect(await repository.hasMembership({ familiaId: familia.id, usuarioId: adminId })).toBe(
      true,
    );
    expect(await repository.hasMembership({ familiaId: 'missing', usuarioId: adminId })).toBe(
      false,
    );

    const invite = await repository.createInvite({
      familiaId: familia.id,
      criadoPor: adminId,
    });

    const joined = await repository.joinByInvite({
      codigo: invite!.codigo,
      usuarioId: memberId,
    });
    expect(joined).toMatchObject({ status: 'entrou', familia: { id: familia.id } });
    expect(await repository.hasMembership({ familiaId: familia.id, usuarioId: memberId })).toBe(
      true,
    );

    const invalidJoin = await repository.joinByInvite({
      codigo: 'INVALID',
      usuarioId: 'u3',
    });
    expect(invalidJoin).toEqual({ status: 'invalido' });

    const request = await repository.requestJoin({
      familiaId: familia.id,
      usuarioId: 'u4',
    });
    const pending = await repository.listPendingJoinRequests({ familiaId: familia.id });
    expect(pending).toHaveLength(1);

    const reviewed = await repository.reviewJoinRequest({
      solicitacaoId: request.id,
      familiaId: familia.id,
      adminId,
      acao: 'aprovar',
    });
    expect(reviewed?.status).toBe('aprovada');

    const reviewedMissing = await repository.reviewJoinRequest({
      solicitacaoId: 'missing',
      familiaId: familia.id,
      adminId,
      acao: 'rejeitar',
    });
    expect(reviewedMissing).toBeNull();

    const members = await repository.listMembers({ familiaId: familia.id });
    expect(members.length).toBeGreaterThanOrEqual(2);

    const removed = await repository.removeMember({
      familiaId: familia.id,
      usuarioId: memberId,
    });
    expect(removed).toBe(true);

    const removedMissing = await repository.removeMember({
      familiaId: 'missing',
      usuarioId: 'u404',
    });
    expect(removedMissing).toBe(false);

    expect(await repository.deleteFamily({ familiaId: familia.id })).toBe(true);
    expect(await repository.deleteFamily({ familiaId: 'missing' })).toBe(false);
  });

  it('createInvite retorna null para família excluída ou inexistente', async () => {
    const repo = new InMemoryFamiliaRepository();
    const familia = await repo.createWithAdminMembership({ nome: 'Familia X', usuarioId: 'u1' });
    await repo.deleteFamily({ familiaId: familia.id });

    expect(await repo.createInvite({ familiaId: familia.id, criadoPor: 'u1' })).toBeNull();
    expect(await repo.createInvite({ familiaId: 'nunca-existiu', criadoPor: 'u1' })).toBeNull();
  });

  it('createInvite de uma família não vaza para outra (multi-tenant)', async () => {
    const repo = new InMemoryFamiliaRepository();
    const a = await repo.createWithAdminMembership({ nome: 'A', usuarioId: 'u1' });
    const b = await repo.createWithAdminMembership({ nome: 'B', usuarioId: 'u2' });
    const convite = await repo.createInvite({ familiaId: a.id, criadoPor: 'u1' });

    expect(convite?.familiaId).toBe(a.id);
    const entrada = await repo.joinByInvite({ codigo: convite!.codigo, usuarioId: 'u9' });
    expect(entrada).toMatchObject({ status: 'entrou', familia: { id: a.id } });
    expect(await repo.hasMembership({ familiaId: b.id, usuarioId: 'u9' })).toBe(false);
  });

  it('listFamiliasByUsuarioId returns families for user', async () => {
    const repo = new InMemoryFamiliaRepository();
    const userId = 'u1';

    const familia1 = await repo.createWithAdminMembership({ nome: 'Familia A', usuarioId: userId });
    const familia2 = await repo.createWithAdminMembership({ nome: 'Familia B', usuarioId: userId });
    await repo.createWithAdminMembership({ nome: 'Familia C', usuarioId: 'u2' });

    const result = await repo.listFamiliasByUsuarioId({ usuarioId: userId });
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.id)).toContain(familia1.id);
    expect(result.map((f) => f.id)).toContain(familia2.id);
    expect(result[0].role).toBe('admin');
  });

  it('listFamiliasByUsuarioId returns empty for user with no families', async () => {
    const repo = new InMemoryFamiliaRepository();
    const result = await repo.listFamiliasByUsuarioId({ usuarioId: 'u-nenhum' });
    expect(result).toHaveLength(0);
  });

  it('buscarPorNome returns matching families case-insensitively', async () => {
    const repo = new InMemoryFamiliaRepository();
    await repo.createWithAdminMembership({ nome: 'Familia Silva', usuarioId: 'u1' });
    await repo.createWithAdminMembership({ nome: 'Familia Santos', usuarioId: 'u2' });
    await repo.createWithAdminMembership({ nome: 'Outros Membros', usuarioId: 'u3' });

    const result = await repo.buscarPorNome('familia');
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.nome)).toContain('Familia Silva');
    expect(result.map((f) => f.nome)).toContain('Familia Santos');

    const noResult = await repo.buscarPorNome('inexistente');
    expect(noResult).toHaveLength(0);
  });
});

describe('DrizzleFamiliaRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates family and admin membership in transaction', async () => {
    const createdFamily = {
      id: 'f1',
      nome: 'Familia Drizzle',
      dataCriacao: new Date('2026-01-01T00:00:00.000Z'),
    };

    const tx = {
      insert: vi
        .fn()
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([createdFamily]),
          }),
        })
        .mockReturnValueOnce({
          values: vi.fn().mockResolvedValue(undefined),
        }),
    };

    mockDb.transaction.mockImplementation(async (callback) => callback(tx as never));

    const repository = new DrizzleFamiliaRepository();
    const result = await repository.createWithAdminMembership({
      nome: 'Familia Drizzle',
      usuarioId: 'u1',
    });

    expect(result).toEqual(createdFamily);
  });

  it('reads membership, invite and member listing operations', async () => {
    const limitMock = vi
      .fn()
      .mockResolvedValueOnce([{ role: 'admin' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ usuarioId: 'u1' }]);
    const whereMock = vi.fn().mockReturnValue({
      limit: limitMock,
    });
    const fromMock = vi.fn().mockReturnValue({
      where: whereMock,
    });
    mockDb.select.mockReturnValue({
      from: fromMock,
    });

    whereMock.mockReturnValueOnce({
      limit: limitMock,
    });

    const listWhereMock = vi.fn().mockResolvedValue([
      {
        usuarioId: 'u1',
        familiaId: 'f1',
        role: 'admin',
        dataEntrada: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    mockDb.select.mockReturnValueOnce({
      from: fromMock,
    });
    mockDb.select.mockReturnValueOnce({
      from: fromMock,
    });
    mockDb.select.mockReturnValueOnce({
      from: fromMock,
    });
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: listWhereMock,
        }),
      }),
    });

    const repository = new DrizzleFamiliaRepository();

    expect(await repository.isUserAdmin({ familiaId: 'f1', usuarioId: 'u1' })).toBe(true);
    expect(await repository.isUserAdmin({ familiaId: 'f1', usuarioId: 'u2' })).toBe(false);
    expect(await repository.hasMembership({ familiaId: 'f1', usuarioId: 'u1' })).toBe(true);

    const members = await repository.listMembers({ familiaId: 'f1' });
    expect(members).toHaveLength(1);
  });

  it('createInvite delega à criação coordenada com a exclusão (null se a família não está ativa)', async () => {
    const travarFamilia = vi.fn().mockResolvedValue([]);
    const tx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ for: travarFamilia }),
        }),
      }),
    };
    mockDb.transaction.mockImplementation(async (callback) => callback(tx as never));

    const convite = await new DrizzleFamiliaRepository().createInvite({
      familiaId: 'f1',
      criadoPor: 'u1',
    });

    expect(convite).toBeNull();
    expect(travarFamilia).toHaveBeenCalledWith('share');
  });

  it('requests, reviews and removes records in transactional methods', async () => {
    const reviewTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'r1',
                familiaId: 'f1',
                usuarioId: 'u2',
                solicitadoEm: new Date('2026-01-01T00:00:00.000Z'),
              },
            ]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: 'r1',
                familiaId: 'f1',
                usuarioId: 'u2',
                status: 'aprovada',
                solicitadoEm: new Date('2026-01-01T00:00:00.000Z'),
                respondidoEm: new Date('2026-01-02T00:00:00.000Z'),
                respondidoPor: 'u1',
              },
            ]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    };

    const deleteTx = {
      update: vi
        .fn()
        .mockReturnValueOnce({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 'f1' }]),
            }),
          }),
        })
        .mockReturnValueOnce({
          set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
    };

    mockDb.transaction
      .mockImplementationOnce(async (callback) => callback(reviewTx as never))
      .mockImplementationOnce(async (callback) => callback(deleteTx as never));

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'r1',
            familiaId: 'f1',
            usuarioId: 'u2',
            status: 'pendente',
            solicitadoEm: new Date('2026-01-01T00:00:00.000Z'),
          },
        ]),
      }),
    });

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            id: 'r1',
            familiaId: 'f1',
            usuarioId: 'u2',
            status: 'pendente',
            solicitadoEm: new Date('2026-01-01T00:00:00.000Z'),
          },
        ]),
      }),
    });

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ usuarioId: 'u2' }]),
      }),
    });

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'f1' }]),
        }),
      }),
    });

    const repository = new DrizzleFamiliaRepository();

    const joinRequest = await repository.requestJoin({
      familiaId: 'f1',
      usuarioId: 'u2',
    });
    expect(joinRequest.status).toBe('pendente');

    const pending = await repository.listPendingJoinRequests({ familiaId: 'f1' });
    expect(pending).toHaveLength(1);

    const reviewed = await repository.reviewJoinRequest({
      solicitacaoId: 'r1',
      familiaId: 'f1',
      adminId: 'u1',
      acao: 'aprovar',
    });
    expect(reviewed?.status).toBe('aprovada');

    const removed = await repository.removeMember({
      familiaId: 'f1',
      usuarioId: 'u2',
    });
    expect(removed).toBe(true);

    const deleted = await repository.deleteFamily({ familiaId: 'f1' });
    expect(deleted).toBe(true);
  });
});
