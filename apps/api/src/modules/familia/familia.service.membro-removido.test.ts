import { describe, expect, it } from 'vitest';

import { FamiliaLifecyclePublisherFake } from '../../shared/familia-lifecycle/tests/familia-lifecycle-publisher-fake.js';
import { InMemoryFamiliaRepository } from './familia.repository.js';
import {
  FamiliaMemberNotFoundError,
  FamiliaService,
  ForbiddenFamiliaMemberRemovalError,
  SelfMemberRemovalError,
} from './familia.service.js';

async function cenario() {
  const repo = new InMemoryFamiliaRepository();
  const publisher = new FamiliaLifecyclePublisherFake();
  const service = new FamiliaService(repo, undefined, undefined, publisher);
  const familia = await service.create({ nome: 'Silva', usuarioId: 'admin' });
  const convite = await service.createInvite({ familiaId: familia.id, usuarioId: 'admin' });
  await service.joinByInvite({ codigo: convite.codigo, usuarioId: 'membro' });
  return { repo, service, publisher, familia };
}

describe('FamiliaService.removeMember — ciclo de vida (#119)', () => {
  it('publica a remoção (família + usuário removido) depois de remover o vínculo', async () => {
    const { service, publisher, familia } = await cenario();

    await service.removeMember({ familiaId: familia.id, usuarioId: 'membro', actorId: 'admin' });

    expect(publisher.membrosRemovidos).toEqual([{ familiaId: familia.id, usuarioId: 'membro' }]);
  });

  it('não publica quando quem pede não é admin', async () => {
    const { service, publisher, familia } = await cenario();

    await expect(
      service.removeMember({ familiaId: familia.id, usuarioId: 'admin', actorId: 'membro' }),
    ).rejects.toBeInstanceOf(ForbiddenFamiliaMemberRemovalError);

    expect(publisher.membrosRemovidos).toEqual([]);
  });

  it('não publica quando o admin tenta remover a si mesmo', async () => {
    const { service, publisher, familia } = await cenario();

    await expect(
      service.removeMember({ familiaId: familia.id, usuarioId: 'admin', actorId: 'admin' }),
    ).rejects.toBeInstanceOf(SelfMemberRemovalError);

    expect(publisher.membrosRemovidos).toEqual([]);
  });

  it('não publica quando o membro não existe na família', async () => {
    const { service, publisher, familia } = await cenario();

    await expect(
      service.removeMember({ familiaId: familia.id, usuarioId: 'fantasma', actorId: 'admin' }),
    ).rejects.toBeInstanceOf(FamiliaMemberNotFoundError);

    expect(publisher.membrosRemovidos).toEqual([]);
  });

  it('não publica quando a remoção falha no repositório (rollback: nada fecha sockets)', async () => {
    const { repo, service, publisher, familia } = await cenario();
    repo.removeMember = async () => {
      throw new Error('conexão perdida antes do commit');
    };

    await expect(
      service.removeMember({ familiaId: familia.id, usuarioId: 'membro', actorId: 'admin' }),
    ).rejects.toThrow('conexão perdida');

    expect(publisher.membrosRemovidos).toEqual([]);
  });
});
