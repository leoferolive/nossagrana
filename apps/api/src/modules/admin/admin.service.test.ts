import { describe, expect, it, vi } from 'vitest';

import { AdminService, FamiliaNotFoundOrActiveError } from './admin.service.js';

const buildAdminRepo = (overrides = {}) => ({
  findFamiliaDeleted: vi.fn().mockResolvedValue(null),
  recuperarFamilia: vi.fn().mockResolvedValue(true),
  findUserById: vi.fn().mockResolvedValue({ id: 'u1', email: 'a@a.com' }),
  ...overrides,
});

describe('AdminService.recuperarFamilia', () => {
  it('lança FamiliaNotFoundOrActiveError se família não encontrada como excluída', async () => {
    const repo = buildAdminRepo({ findFamiliaDeleted: vi.fn().mockResolvedValue(null) });
    const svc = new AdminService(repo);
    await expect(svc.recuperarFamilia('fam-1')).rejects.toBeInstanceOf(
      FamiliaNotFoundOrActiveError,
    );
  });

  it('chama recuperarFamilia no repositório quando família existe', async () => {
    const familia = { id: 'fam-1', nome: 'Família Teste', deletedAt: new Date() };
    const repo = buildAdminRepo({ findFamiliaDeleted: vi.fn().mockResolvedValue(familia) });
    const svc = new AdminService(repo);
    await svc.recuperarFamilia('fam-1');
    expect(repo.recuperarFamilia).toHaveBeenCalledWith('fam-1');
  });

  it('retorna dados da família recuperada', async () => {
    const familia = { id: 'fam-1', nome: 'Família Teste', deletedAt: new Date() };
    const repo = buildAdminRepo({ findFamiliaDeleted: vi.fn().mockResolvedValue(familia) });
    const svc = new AdminService(repo);
    const result = await svc.recuperarFamilia('fam-1');
    expect(result.id).toBe('fam-1');
    expect(result.nome).toBe('Família Teste');
  });
});

describe('AdminService.impersonarUsuario', () => {
  it('lança erro se usuário não encontrado', async () => {
    const repo = buildAdminRepo({ findUserById: vi.fn().mockResolvedValue(null) });
    const svc = new AdminService(repo);
    await expect(svc.impersonarUsuario('u-nao-existe')).rejects.toThrow();
  });

  it('retorna dados do usuário para impersonação', async () => {
    const user = { id: 'u1', email: 'maria@example.com', nome: 'Maria' };
    const repo = buildAdminRepo({ findUserById: vi.fn().mockResolvedValue(user) });
    const svc = new AdminService(repo);
    const result = await svc.impersonarUsuario('u1');
    expect(result.userId).toBe('u1');
    expect(result.email).toBe('maria@example.com');
  });
});
