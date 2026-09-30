import { describe, expect, it } from 'vitest';

import type { FamiliaLifecyclePublisher } from '../../shared/familia-lifecycle/familia-lifecycle.events.js';
import { InMemoryFamiliaRepository } from './familia.repository.js';
import {
  FamiliaNotFoundError,
  FamiliaService,
  ForbiddenFamiliaDeletionError,
  InvalidFamiliaInviteCodeError,
} from './familia.service.js';

/** Fake nomeada do barramento: registra as famílias excluídas. */
class FamiliaLifecyclePublisherFake implements FamiliaLifecyclePublisher {
  readonly excluidas: string[] = [];

  familiaExcluida(familiaId: string): void {
    this.excluidas.push(familiaId);
  }
}

async function cenario(publisher = new FamiliaLifecyclePublisherFake()) {
  const repo = new InMemoryFamiliaRepository();
  const service = new FamiliaService(repo, undefined, undefined, publisher);
  const familia = await service.create({ nome: 'Silva', usuarioId: 'admin' });
  const convite = await service.createInvite({ familiaId: familia.id, usuarioId: 'admin' });
  return { repo, service, publisher, familia, codigo: convite.codigo };
}

describe('FamiliaService.deleteFamily — ciclo de vida (#66)', () => {
  it('publica a exclusão (só o familiaId) depois de excluir a família', async () => {
    const { service, publisher, familia } = await cenario();

    await service.deleteFamily({ familiaId: familia.id, usuarioId: 'admin' });

    expect(publisher.excluidas).toEqual([familia.id]);
  });

  it('não publica quando o usuário não é admin', async () => {
    const { service, publisher, familia, codigo } = await cenario();
    await service.joinByInvite({ codigo, usuarioId: 'u2' });

    await expect(
      service.deleteFamily({ familiaId: familia.id, usuarioId: 'u2' }),
    ).rejects.toBeInstanceOf(ForbiddenFamiliaDeletionError);

    expect(publisher.excluidas).toEqual([]);
  });

  it('não publica quando a exclusão falha no repositório (rollback: nada fecha sockets)', async () => {
    const { repo, service, publisher, familia } = await cenario();
    const falhaNoCommit = new Error('conexão perdida antes do commit');
    repo.deleteFamily = async () => {
      throw falhaNoCommit;
    };

    await expect(service.deleteFamily({ familiaId: familia.id, usuarioId: 'admin' })).rejects.toBe(
      falhaNoCommit,
    );

    expect(publisher.excluidas).toEqual([]);
  });

  it('não publica quando a família não existe mais', async () => {
    const { repo, service, publisher, familia } = await cenario();
    repo.deleteFamily = async () => false;

    await expect(
      service.deleteFamily({ familiaId: familia.id, usuarioId: 'admin' }),
    ).rejects.toBeInstanceOf(FamiliaNotFoundError);

    expect(publisher.excluidas).toEqual([]);
  });

  // Não discrimina a invalidação: o InMemory apaga os convites fisicamente. A cobertura
  // real (expira_em na mesma transação, com rollback) está em db/tests/exclusao-familia.pg.test.ts.
  it('convite pendente da família excluída não pode mais ser usado nem cria membership', async () => {
    const { repo, service, familia, codigo } = await cenario();

    await service.deleteFamily({ familiaId: familia.id, usuarioId: 'admin' });

    await expect(service.joinByInvite({ codigo, usuarioId: 'u9' })).rejects.toBeInstanceOf(
      InvalidFamiliaInviteCodeError,
    );
    expect(await repo.hasMembership({ familiaId: familia.id, usuarioId: 'u9' })).toBe(false);
  });
});
