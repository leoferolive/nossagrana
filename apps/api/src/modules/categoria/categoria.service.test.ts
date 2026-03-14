import { describe, expect, it } from 'vitest';

import { InMemoryCategoriaRepository } from './categoria.repository.js';
import { CategoriaNotFoundError, CategoriaService } from './categoria.service.js';

describe('CategoriaService', () => {
  it('deactivates a category (soft delete)', async () => {
    const repository = new InMemoryCategoriaRepository();
    const service = new CategoriaService(repository);

    const created = await repository.create({
      familiaId: 'f1',
      nome: 'Alimentacao',
      tipo: 'despesa',
      criadoPor: 'u1',
    });

    const deactivated = await service.deactivate({ id: created.id, familiaId: 'f1' });
    expect(deactivated.ativo).toBe(false);

    const listed = await service.listByFamiliaId({ familiaId: 'f1' });
    expect(listed).toHaveLength(0);
  });

  it('throws CategoriaNotFoundError when deactivating non-existent category', async () => {
    const repository = new InMemoryCategoriaRepository();
    const service = new CategoriaService(repository);

    await expect(service.deactivate({ id: 'nao-existe', familiaId: 'f1' })).rejects.toThrow(
      CategoriaNotFoundError,
    );
  });

  it('does not deactivate category from another family', async () => {
    const repository = new InMemoryCategoriaRepository();
    const service = new CategoriaService(repository);

    const created = await repository.create({
      familiaId: 'f1',
      nome: 'Alimentacao',
      tipo: 'despesa',
      criadoPor: 'u1',
    });

    await expect(
      service.deactivate({ id: created.id, familiaId: 'outra-familia' }),
    ).rejects.toThrow(CategoriaNotFoundError);
  });
});
