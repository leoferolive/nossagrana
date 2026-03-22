import { describe, it, expect, beforeEach } from 'vitest';

import { InMemoryCategoriaRepository } from './categoria.repository.js';
import { CategoriaService, CategoriaNotFoundError, CategoriaSistemaError } from './categoria.service.js';

describe('CategoriaService', () => {
  let service: CategoriaService;
  let repo: InMemoryCategoriaRepository;

  beforeEach(() => {
    repo = new InMemoryCategoriaRepository();
    service = new CategoriaService(repo);
  });

  describe('update', () => {
    it('deve atualizar uma categoria normal', async () => {
      const categoria = await repo.create({
        familiaId: 'fam-1',
        nome: 'Alimentacao',
        tipo: 'despesa',
        criadoPor: 'user-1',
      });

      const updated = await service.update({
        id: categoria.id,
        familiaId: 'fam-1',
        nome: 'Alimentacao Editada',
        tipo: 'despesa',
      });

      expect(updated.nome).toBe('Alimentacao Editada');
    });

    it('deve lançar CategoriaSistemaError ao atualizar categoria sistema=true', async () => {
      const categoria = await repo.create({
        familiaId: 'fam-1',
        nome: 'Cofrinho',
        tipo: 'despesa',
        criadoPor: 'user-1',
        sistema: true,
      });

      await expect(
        service.update({
          id: categoria.id,
          familiaId: 'fam-1',
          nome: 'Cofrinho Editado',
          tipo: 'despesa',
        }),
      ).rejects.toThrow(CategoriaSistemaError);
    });

    it('deve lançar CategoriaNotFoundError ao atualizar categoria inexistente', async () => {
      await expect(
        service.update({
          id: 'inexistente',
          familiaId: 'fam-1',
          nome: 'Qualquer',
          tipo: 'despesa',
        }),
      ).rejects.toThrow(CategoriaNotFoundError);
    });
  });

  describe('deactivate', () => {
    it('deve desativar uma categoria normal', async () => {
      const categoria = await repo.create({
        familiaId: 'fam-1',
        nome: 'Lazer',
        tipo: 'despesa',
        criadoPor: 'user-1',
      });

      const deactivated = await service.deactivate({
        id: categoria.id,
        familiaId: 'fam-1',
      });

      expect(deactivated.ativo).toBe(false);
    });

    it('deve lançar CategoriaSistemaError ao desativar categoria sistema=true', async () => {
      const categoria = await repo.create({
        familiaId: 'fam-1',
        nome: 'Cofrinho',
        tipo: 'despesa',
        criadoPor: 'user-1',
        sistema: true,
      });

      await expect(
        service.deactivate({
          id: categoria.id,
          familiaId: 'fam-1',
        }),
      ).rejects.toThrow(CategoriaSistemaError);
    });

    it('deve lançar CategoriaNotFoundError ao desativar categoria inexistente', async () => {
      await expect(
        service.deactivate({
          id: 'inexistente',
          familiaId: 'fam-1',
        }),
      ).rejects.toThrow(CategoriaNotFoundError);
    });
  });

  describe('create', () => {
    it('deve criar categoria com sistema=false por padrão', async () => {
      const categoria = await service.create({
        familiaId: 'fam-1',
        nome: 'Nova Categoria',
        tipo: 'receita',
        criadoPor: 'user-1',
      });

      expect(categoria.sistema).toBe(false);
      expect(categoria.nome).toBe('Nova Categoria');
    });
  });

  describe('listByFamiliaId', () => {
    it('deve retornar categorias com campo sistema', async () => {
      await repo.create({
        familiaId: 'fam-1',
        nome: 'Cofrinho',
        tipo: 'despesa',
        criadoPor: 'user-1',
        sistema: true,
      });

      await repo.create({
        familiaId: 'fam-1',
        nome: 'Alimentacao',
        tipo: 'despesa',
        criadoPor: 'user-1',
      });

      const categorias = await service.listByFamiliaId({ familiaId: 'fam-1' });

      expect(categorias).toHaveLength(2);
      const cofrinho = categorias.find((c) => c.nome === 'Cofrinho');
      const alimentacao = categorias.find((c) => c.nome === 'Alimentacao');
      expect(cofrinho?.sistema).toBe(true);
      expect(alimentacao?.sistema).toBe(false);
    });
  });
});
