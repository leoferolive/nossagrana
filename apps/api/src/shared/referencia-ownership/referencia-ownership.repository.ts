import { and, eq } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { categorias, cofrinhos, metodosPagamento } from '../../db/schema.js';
import type { CategoriaRepository } from '../../modules/categoria/categoria.types.js';
import type { CofrinhoRepository } from '../../modules/cofrinho/cofrinho.types.js';
import type { MetodoPagamentoRepository } from '../../modules/metodo-pagamento/metodo-pagamento.types.js';
import type {
  CategoriaReferenciada,
  CofrinhoReferenciado,
  MetodoPagamentoReferenciado,
  ReferenciaOwnershipRepository,
  TipoLancamento,
} from './referencia-ownership.types.js';

interface BuscaPorFamilia {
  familiaId: string;
  id: string;
}

export class DrizzleReferenciaOwnershipRepository implements ReferenciaOwnershipRepository {
  async findCategoria(input: BuscaPorFamilia): Promise<CategoriaReferenciada | null> {
    const [found] = await db
      .select({ id: categorias.id, tipo: categorias.tipo, ativo: categorias.ativo })
      .from(categorias)
      .where(and(eq(categorias.id, input.id), eq(categorias.familiaId, input.familiaId)))
      .limit(1);
    return found ? { ...found, tipo: found.tipo as TipoLancamento } : null;
  }

  async findMetodoPagamento(input: BuscaPorFamilia): Promise<MetodoPagamentoReferenciado | null> {
    const [found] = await db
      .select({ id: metodosPagamento.id, ativo: metodosPagamento.ativo })
      .from(metodosPagamento)
      .where(
        and(eq(metodosPagamento.id, input.id), eq(metodosPagamento.familiaId, input.familiaId)),
      )
      .limit(1);
    return found ?? null;
  }

  async findCofrinho(input: BuscaPorFamilia): Promise<CofrinhoReferenciado | null> {
    const [found] = await db
      .select({ id: cofrinhos.id, status: cofrinhos.status })
      .from(cofrinhos)
      .where(and(eq(cofrinhos.id, input.id), eq(cofrinhos.familiaId, input.familiaId)))
      .limit(1);
    return found ? { id: found.id, ativo: found.status === 'ativo' } : null;
  }
}

interface RegistroDaFamilia {
  familiaId: string;
}

export class InMemoryReferenciaOwnershipRepository implements ReferenciaOwnershipRepository {
  private readonly categorias: Array<CategoriaReferenciada & RegistroDaFamilia> = [];
  private readonly metodos: Array<MetodoPagamentoReferenciado & RegistroDaFamilia> = [];
  private readonly cofrinhos: Array<CofrinhoReferenciado & RegistroDaFamilia> = [];

  addCategoria(categoria: CategoriaReferenciada & RegistroDaFamilia): void {
    this.categorias.push(categoria);
  }

  /** Simula a desativação posterior de uma categoria já vinculada. */
  setCategoriaAtiva(id: string, ativo: boolean): void {
    const categoria = this.categorias.find((c) => c.id === id);
    if (categoria) categoria.ativo = ativo;
  }

  addMetodoPagamento(metodo: MetodoPagamentoReferenciado & RegistroDaFamilia): void {
    this.metodos.push(metodo);
  }

  addCofrinho(cofrinho: CofrinhoReferenciado & RegistroDaFamilia): void {
    this.cofrinhos.push(cofrinho);
  }

  async findCategoria(input: BuscaPorFamilia): Promise<CategoriaReferenciada | null> {
    const found = buscarNaFamilia(this.categorias, input);
    return found ? { id: found.id, tipo: found.tipo, ativo: found.ativo } : null;
  }

  async findMetodoPagamento(input: BuscaPorFamilia): Promise<MetodoPagamentoReferenciado | null> {
    const found = buscarNaFamilia(this.metodos, input);
    return found ? { id: found.id, ativo: found.ativo } : null;
  }

  async findCofrinho(input: BuscaPorFamilia): Promise<CofrinhoReferenciado | null> {
    const found = buscarNaFamilia(this.cofrinhos, input);
    return found ? { id: found.id, ativo: found.ativo } : null;
  }
}

function buscarNaFamilia<T extends { id: string } & RegistroDaFamilia>(
  registros: T[],
  input: BuscaPorFamilia,
): T | undefined {
  return registros.find((r) => r.id === input.id && r.familiaId === input.familiaId);
}

interface RepositoriosDosModulos {
  categorias: Pick<CategoriaRepository, 'findById'>;
  metodosPagamento: Pick<MetodoPagamentoRepository, 'findById'>;
  cofrinhos: Pick<CofrinhoRepository, 'findById'>;
}

/**
 * Lê as referências pelos repositórios dos próprios módulos. Usado no ambiente
 * de teste da API para o validador enxergar o que as rotas de categoria, método
 * e cofrinho gravaram. Limitação: o InMemory de método só devolve ativos, então
 * lá um método inativo aparece como inexistente.
 */
export class ModulosReferenciaOwnershipRepository implements ReferenciaOwnershipRepository {
  constructor(private readonly repositorios: RepositoriosDosModulos) {}

  async findCategoria(input: BuscaPorFamilia): Promise<CategoriaReferenciada | null> {
    const found = await this.repositorios.categorias.findById(input);
    return found ? { id: found.id, tipo: found.tipo, ativo: found.ativo } : null;
  }

  async findMetodoPagamento(input: BuscaPorFamilia): Promise<MetodoPagamentoReferenciado | null> {
    const found = await this.repositorios.metodosPagamento.findById(input);
    return found ? { id: found.id, ativo: found.ativo } : null;
  }

  async findCofrinho(input: BuscaPorFamilia): Promise<CofrinhoReferenciado | null> {
    const found = await this.repositorios.cofrinhos.findById(input);
    return found ? { id: found.id, ativo: found.status === 'ativo' } : null;
  }
}
