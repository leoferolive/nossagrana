import { describe, expect, it, vi } from 'vitest';

import {
  FamiliaMemberNotFoundError,
  FamiliaNotFoundError,
  FamiliaService,
  ForbiddenActiveFamilySwitchError,
  ForbiddenFamiliaDeletionError,
  ForbiddenFamiliaInviteError,
  ForbiddenFamiliaMemberRemovalError,
  JoinRequestNotFoundError,
  SelfMemberRemovalError,
} from './familia.service.js';
import type { FamiliaRepository } from './familia.types.js';

const buildRepository = (overrides?: Partial<FamiliaRepository>): FamiliaRepository => ({
  createWithAdminMembership: vi.fn(),
  isUserAdmin: vi.fn().mockResolvedValue(true),
  hasMembership: vi.fn().mockResolvedValue(true),
  createInvite: vi.fn(),
  joinByInvite: vi.fn(),
  requestJoin: vi.fn(),
  listPendingJoinRequests: vi.fn(),
  reviewJoinRequest: vi.fn().mockResolvedValue(null),
  listMembers: vi.fn(),
  removeMember: vi.fn().mockResolvedValue(true),
  deleteFamily: vi.fn().mockResolvedValue(true),
  ...overrides,
});

describe('FamiliaService', () => {
  it('blocks invite creation for non-admin user', async () => {
    const repository = buildRepository({
      isUserAdmin: vi.fn().mockResolvedValue(false),
    });
    const service = new FamiliaService(repository);

    await expect(
      service.createInvite({
        familiaId: 'f1',
        usuarioId: 'u1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenFamiliaInviteError);
  });

  it('throws when reviewed request is not found', async () => {
    const repository = buildRepository({
      reviewJoinRequest: vi.fn().mockResolvedValue(null),
    });
    const service = new FamiliaService(repository);

    await expect(
      service.reviewJoinRequest({
        solicitacaoId: 'r1',
        familiaId: 'f1',
        usuarioId: 'u1',
        acao: 'aprovar',
      }),
    ).rejects.toBeInstanceOf(JoinRequestNotFoundError);
  });

  it('blocks remove member for non-admin actor', async () => {
    const repository = buildRepository({
      isUserAdmin: vi.fn().mockResolvedValue(false),
    });
    const service = new FamiliaService(repository);

    await expect(
      service.removeMember({
        familiaId: 'f1',
        usuarioId: 'u2',
        actorId: 'u1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenFamiliaMemberRemovalError);
  });

  it('blocks self-removal for admin actor', async () => {
    const repository = buildRepository();
    const service = new FamiliaService(repository);

    await expect(
      service.removeMember({
        familiaId: 'f1',
        usuarioId: 'u1',
        actorId: 'u1',
      }),
    ).rejects.toBeInstanceOf(SelfMemberRemovalError);
  });

  it('throws when target member is not found', async () => {
    const repository = buildRepository({
      removeMember: vi.fn().mockResolvedValue(false),
    });
    const service = new FamiliaService(repository);

    await expect(
      service.removeMember({
        familiaId: 'f1',
        usuarioId: 'u2',
        actorId: 'u1',
      }),
    ).rejects.toBeInstanceOf(FamiliaMemberNotFoundError);
  });

  it('blocks active family switch without membership', async () => {
    const repository = buildRepository({
      hasMembership: vi.fn().mockResolvedValue(false),
    });
    const service = new FamiliaService(repository);

    await expect(
      service.switchActiveFamily({
        familiaId: 'f1',
        usuarioId: 'u1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenActiveFamilySwitchError);
  });

  it('blocks family deletion for non-admin user', async () => {
    const repository = buildRepository({
      isUserAdmin: vi.fn().mockResolvedValue(false),
    });
    const service = new FamiliaService(repository);

    await expect(
      service.deleteFamily({
        familiaId: 'f1',
        usuarioId: 'u1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenFamiliaDeletionError);
  });

  it('throws when family is not found during deletion', async () => {
    const repository = buildRepository({
      deleteFamily: vi.fn().mockResolvedValue(false),
    });
    const service = new FamiliaService(repository);

    await expect(
      service.deleteFamily({
        familiaId: 'f1',
        usuarioId: 'u1',
      }),
    ).rejects.toBeInstanceOf(FamiliaNotFoundError);
  });
});
