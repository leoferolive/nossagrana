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
      codigo: invite.codigo,
      usuarioId: memberId,
    });
    expect(joined?.id).toBe(familia.id);
    expect(await repository.hasMembership({ familiaId: familia.id, usuarioId: memberId })).toBe(
      true,
    );

    const invalidJoin = await repository.joinByInvite({
      codigo: 'INVALID',
      usuarioId: 'u3',
    });
    expect(invalidJoin).toBeNull();

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

    const insertReturningMock = vi.fn().mockResolvedValue([
      {
        id: 'c1',
        familiaId: 'f1',
        codigo: 'CODE123',
        expiraEm: new Date('2026-01-08T00:00:00.000Z'),
        criadoPor: 'u1',
        dataCriacao: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: insertReturningMock,
      }),
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
        where: listWhereMock,
      }),
    });

    const repository = new DrizzleFamiliaRepository();

    expect(await repository.isUserAdmin({ familiaId: 'f1', usuarioId: 'u1' })).toBe(true);
    expect(await repository.isUserAdmin({ familiaId: 'f1', usuarioId: 'u2' })).toBe(false);
    expect(await repository.hasMembership({ familiaId: 'f1', usuarioId: 'u1' })).toBe(true);

    const invite = await repository.createInvite({
      familiaId: 'f1',
      criadoPor: 'u1',
    });
    expect(invite.codigo).toBe('CODE123');

    const members = await repository.listMembers({ familiaId: 'f1' });
    expect(members).toHaveLength(1);
  });

  it('joins, reviews and removes records in transactional methods', async () => {
    const joinTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'invite1',
                  familiaId: 'f1',
                  familiaNome: 'Familia Drizzle',
                  familiaDataCriacao: new Date('2026-01-01T00:00:00.000Z'),
                },
              ]),
            }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    };

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

    let deleteCallCount = 0;
    const deleteTx = {
      delete: vi.fn().mockImplementation(() => {
        deleteCallCount += 1;
        if (deleteCallCount === 9) {
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 'f1' }]),
            }),
          };
        }

        return {
          where: vi.fn().mockResolvedValue(undefined),
        };
      }),
    };

    mockDb.transaction
      .mockImplementationOnce(async (callback) => callback(joinTx as never))
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

    const repository = new DrizzleFamiliaRepository();

    const joined = await repository.joinByInvite({
      codigo: 'CODE123',
      usuarioId: 'u2',
    });
    expect(joined?.id).toBe('f1');

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
