import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { classificarConvite } from './familia-convite.js';
import { InMemoryFamiliaRepository } from './familia.repository.js';
import type { ConsumoConviteResultado } from './familia.types.js';

const AGORA = new Date('2026-09-30T12:00:00.000Z');
const DIA_MS = 24 * 60 * 60 * 1000;

describe('classificarConvite', () => {
  it('convite inexistente é inválido', () => {
    expect(classificarConvite(null, AGORA)).toBe('invalido');
  });

  it('convite sem consumidor e dentro da validade é elegível', () => {
    const convite = { usadoPor: null, expiraEm: new Date(AGORA.getTime() + DIA_MS) };
    expect(classificarConvite(convite, AGORA)).toBe('elegivel');
  });

  it('convite com expiração no passado ou exatamente agora é expirado', () => {
    expect(classificarConvite({ usadoPor: null, expiraEm: AGORA }, AGORA)).toBe('expirado');
    expect(
      classificarConvite({ usadoPor: null, expiraEm: new Date(AGORA.getTime() - 1) }, AGORA),
    ).toBe('expirado');
  });

  it('convite já consumido é usado, mesmo que também esteja expirado', () => {
    const vencido = new Date(AGORA.getTime() - DIA_MS);
    expect(classificarConvite({ usadoPor: 'u1', expiraEm: vencido }, AGORA)).toBe('usado');
  });
});

describe('consumo de convite no InMemoryFamiliaRepository', () => {
  let repo: InMemoryFamiliaRepository;
  let familiaId: string;
  let codigo: string;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AGORA);
    repo = new InMemoryFamiliaRepository();
    const familia = await repo.createWithAdminMembership({ nome: 'Silva', usuarioId: 'admin' });
    familiaId = familia.id;
    codigo = (await repo.createInvite({ familiaId, criadoPor: 'admin' })).codigo;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const entrar = (usuarioId: string, cod = codigo) => repo.joinByInvite({ codigo: cod, usuarioId });
  const tem = (usuarioId: string, id = familiaId) =>
    repo.hasMembership({ familiaId: id, usuarioId });

  it('primeiro uso cria a membership e devolve a família', async () => {
    const resultado = await entrar('u1');

    expect(resultado).toMatchObject({ status: 'entrou', familia: { id: familiaId } });
    expect(await tem('u1')).toBe(true);
  });

  it('segundo usuário com o mesmo código recebe "usado" e não entra', async () => {
    await entrar('u1');

    expect(await entrar('u2')).toEqual({ status: 'usado' });
    expect(await tem('u2')).toBe(false);
  });

  it('repetição pelo mesmo usuário é "ja_membro" e não altera a membership existente', async () => {
    await entrar('u1');
    const antes = await repo.listMembers({ familiaId });

    expect(await entrar('u1')).toMatchObject({ status: 'ja_membro', familia: { id: familiaId } });
    expect(await repo.listMembers({ familiaId })).toEqual(antes);
  });

  it('repetição pelo mesmo usuário depois de removido da família volta a ser "usado"', async () => {
    await entrar('u1');
    await repo.removeMember({ familiaId, usuarioId: 'u1' });

    expect(await entrar('u1')).toEqual({ status: 'usado' });
    expect(await tem('u1')).toBe(false);
  });

  it('código desconhecido é "invalido"', async () => {
    expect(await entrar('u1', 'NAOEXISTE')).toEqual({ status: 'invalido' });
  });

  it('convite expirado é "expirado" e não cria membership', async () => {
    vi.setSystemTime(new Date(AGORA.getTime() + 8 * DIA_MS));

    expect(await entrar('u1')).toEqual({ status: 'expirado' });
    expect(await tem('u1')).toBe(false);
  });

  it('convite de família excluída é "invalido"', async () => {
    await repo.deleteFamily({ familiaId });

    expect(await entrar('u1')).toEqual({ status: 'invalido' });
  });

  it('quem já é membro recebe "ja_membro" e o convite continua utilizável', async () => {
    const resultado = await entrar('admin');

    expect(resultado).toMatchObject({ status: 'ja_membro', familia: { id: familiaId } });
    expect(await repo.isUserAdmin({ familiaId, usuarioId: 'admin' })).toBe(true);
    expect(await entrar('u2')).toMatchObject({ status: 'entrou' });
  });

  it('duas requisições concorrentes: exatamente uma entra, a outra recebe "usado"', async () => {
    const resultados = await Promise.all([entrar('u1'), entrar('u2')]);

    const status = resultados.map((r: ConsumoConviteResultado) => r.status).sort();
    expect(status).toEqual(['entrou', 'usado']);
    const membros = await repo.listMembers({ familiaId });
    expect(membros.filter((m) => m.role === 'membro')).toHaveLength(1);
  });

  it('isolamento multi-tenant: convite da família A nunca cria membership na família B', async () => {
    const familiaB = await repo.createWithAdminMembership({ nome: 'Souza', usuarioId: 'adminB' });

    await entrar('u1');

    expect(await tem('u1', familiaB.id)).toBe(false);
    expect(await repo.listMembers({ familiaId: familiaB.id })).toHaveLength(1);
  });
});
