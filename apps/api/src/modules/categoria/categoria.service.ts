import type { CategoriaRepository } from './categoria.types.js';

export class CategoriaService {
  constructor(private readonly categoriaRepository: CategoriaRepository) {}

  async listByFamiliaId(input: { familiaId: string }) {
    return this.categoriaRepository.listByFamiliaId({
      familiaId: input.familiaId,
    });
  }
}
