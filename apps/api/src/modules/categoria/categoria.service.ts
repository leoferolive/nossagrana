import type { CategoriaRepository } from './categoria.types.js';

export class CategoriaService {
  constructor(private readonly categoriaRepository: CategoriaRepository) {}

  async listByFamiliaId(input: { familiaId: string }) {
    return this.categoriaRepository.listByFamiliaId({
      familiaId: input.familiaId,
    });
  }

  async create(input: { familiaId: string; nome: string; tipo: 'receita' | 'despesa'; criadoPor: string }) {
    return this.categoriaRepository.create({
      familiaId: input.familiaId,
      nome: input.nome,
      tipo: input.tipo,
      criadoPor: input.criadoPor,
    });
  }
}
