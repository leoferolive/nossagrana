import type { FaturaResponse } from '@nossagrana/types';

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

  async getFatura(
    familiaId: string,
    metodoPagamentoId: string,
    mesReferencia: string,
  ): Promise<FaturaResponse> {
    const metodo = await this.repository.findById({ id: metodoPagamentoId, familiaId });
    if (!metodo) throw new MetodoPagamentoNotFoundError();

    const rows = await this.repository.getFatura(familiaId, metodoPagamentoId, mesReferencia);
    const total = rows.reduce((acc, r) => acc + parseFloat(r.valor), 0).toFixed(2);

    return {
      metodoPagamentoId,
      mesReferencia,
      total,
      transacoes: rows,
    };
  }
}
