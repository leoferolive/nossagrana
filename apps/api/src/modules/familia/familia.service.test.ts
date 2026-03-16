import { describe, expect, it, vi } from 'vitest';

import { InMemoryCategoriaRepository } from '../categoria/categoria.repository.js';
import {
  CATEGORIAS_PADRAO_DESPESA,
  CATEGORIAS_PADRAO_RECEITA,
} from '../../db/seeds/categorias-padrao.js';
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
  createWithAdminMembership: vi.fn().mockResolvedValue({ id: 'f1', nome: 'Familia Teste' }),
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
  buscarPorNome: vi.fn().mockResolvedValue([]),
  ...overrides,
});

describe('FamiliaService', () => {
  it('seeds default categories when creating a family', async () => {
    const familiaRepository = buildRepository();
    const categoriaRepository = new InMemoryCategoriaRepository();
    const service = new FamiliaService(familiaRepository, categoriaRepository);

    await service.create({ nome: 'Familia Teste', usuarioId: 'u1' });

    const categorias = await categoriaRepository.listByFamiliaId({ familiaId: 'f1' });
    const expectedTotal = CATEGORIAS_PADRAO_RECEITA.length + CATEGORIAS_PADRAO_DESPESA.length;
    expect(categorias).toHaveLength(expectedTotal);

    const nomes = categorias.map((c) => c.nome);
    expect(nomes).toContain('Salario');
    expect(nomes).toContain('Moradia');
  });

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

  it('buscarPorNome delegates to repository', async () => {
    const mockResult = [{ id: 'f1', nome: 'Familia Silva' }];
    const repository = buildRepository({
      buscarPorNome: vi.fn().mockResolvedValue(mockResult),
    });
    const service = new FamiliaService(repository);

    const result = await service.buscarPorNome({ nome: 'Silva' });
    expect(result).toEqual(mockResult);
    expect(repository.buscarPorNome).toHaveBeenCalledWith('Silva');
  });
});
