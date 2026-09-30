import { describe, expect, it } from 'vitest';

import { InMemoryFamiliaRepository } from './familia.repository.js';
import {
  FamiliaInviteAlreadyUsedError,
  FamiliaService,
  InvalidFamiliaInviteCodeError,
} from './familia.service.js';

async function cenario() {
  const repo = new InMemoryFamiliaRepository();
  const service = new FamiliaService(repo);
  const familia = await service.create({ nome: 'Silva', usuarioId: 'admin' });
  const convite = await service.createInvite({ familiaId: familia.id, usuarioId: 'admin' });
  return { repo, service, familia, codigo: convite.codigo };
}

describe('FamiliaService.joinByInvite', () => {
  it('devolve a família quando o convite é elegível', async () => {
    const { service, familia, codigo } = await cenario();

    const entrou = await service.joinByInvite({ codigo, usuarioId: 'u1' });

    expect(entrou.id).toBe(familia.id);
  });

  it('é idempotente para quem já é membro: devolve a família sem consumir o convite', async () => {
    const { service, familia, codigo } = await cenario();

    const repetido = await service.joinByInvite({ codigo, usuarioId: 'admin' });
    const outro = await service.joinByInvite({ codigo, usuarioId: 'u2' });

    expect(repetido.id).toBe(familia.id);
    expect(outro.id).toBe(familia.id);
  });

  it('convite já consumido lança FamiliaInviteAlreadyUsedError', async () => {
    const { service, codigo } = await cenario();
    await service.joinByInvite({ codigo, usuarioId: 'u1' });

    await expect(service.joinByInvite({ codigo, usuarioId: 'u2' })).rejects.toBeInstanceOf(
      FamiliaInviteAlreadyUsedError,
    );
  });

  it('código inexistente lança InvalidFamiliaInviteCodeError', async () => {
    const { service } = await cenario();

    await expect(
      service.joinByInvite({ codigo: 'NAOEXISTE', usuarioId: 'u1' }),
    ).rejects.toBeInstanceOf(InvalidFamiliaInviteCodeError);
  });

  it('convite de família excluída lança InvalidFamiliaInviteCodeError', async () => {
    const { service, familia, codigo } = await cenario();
    await service.deleteFamily({ familiaId: familia.id, usuarioId: 'admin' });

    await expect(service.joinByInvite({ codigo, usuarioId: 'u1' })).rejects.toBeInstanceOf(
      InvalidFamiliaInviteCodeError,
    );
  });

  it('concorrência: só uma das duas requisições entra; a outra recebe "já utilizado"', async () => {
    const { service, codigo } = await cenario();

    const resultados = await Promise.allSettled([
      service.joinByInvite({ codigo, usuarioId: 'u1' }),
      service.joinByInvite({ codigo, usuarioId: 'u2' }),
    ]);

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejeitada = resultados.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejeitada?.reason).toBeInstanceOf(FamiliaInviteAlreadyUsedError);
  });
});
