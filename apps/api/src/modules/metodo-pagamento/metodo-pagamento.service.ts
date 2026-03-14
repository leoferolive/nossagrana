import type { MetodoPagamentoRepository } from './metodo-pagamento.types.js';

export class MetodoPagamentoNotFoundError extends Error {
  constructor() {
    super('Metodo de pagamento nao encontrado');
  }
}

export class MetodoPagamentoService {
  constructor(private readonly repository: MetodoPagamentoRepository) {}

  async listByFamiliaId(input: { familiaId: string }) {
    return this.repository.listByFamiliaId({ familiaId: input.familiaId });
  }

  async create(input: {
    familiaId: string;
    nome: string;
    tipo: 'credito' | 'debito' | 'pix' | 'dinheiro';
    dataFechamento: number | null;
    dataVencimento: number | null;
    usuarioDonoId: string;
  }) {
    return this.repository.create(input);
  }

  async update(input: {
    id: string;
    familiaId: string;
    nome: string;
    tipo: 'credito' | 'debito' | 'pix' | 'dinheiro';
    dataFechamento: number | null;
    dataVencimento: number | null;
  }) {
    const updated = await this.repository.update(input);
    if (!updated) throw new MetodoPagamentoNotFoundError();
    return updated;
  }

  async deactivate(input: { id: string; familiaId: string }) {
    const deactivated = await this.repository.deactivate(input);
    if (!deactivated) throw new MetodoPagamentoNotFoundError();
    return deactivated;
  }
}
