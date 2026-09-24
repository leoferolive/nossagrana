import { randomUUID } from 'node:crypto';

import type { ParticipanteInMemory } from '../../shared/unit-of-work/unit-of-work.types.js';
import { deCentavos, paraCentavos } from './cofrinho.centavos.js';
import type {
  AporteRecorrenteAtivo,
  BuscaAporteRecorrente,
  Cofrinho,
  CofrinhoDaFamilia,
  CofrinhoRepository,
  CreateCofrinhoInput,
  UpdateCofrinhoInput,
  VariacaoSaldo,
} from './cofrinho.types.js';

const chaveAporte = (busca: BuscaAporteRecorrente) => `${busca.familiaId}:${busca.cofrinhoId}`;

/**
 * InMemory para testes e NODE_ENV=test. Participa da `InMemoryUnitOfWork`:
 * toda alteração SUBSTITUI o objeto (`{ ...c, campo }`), nunca muta no lugar,
 * senão a mudança vazaria do staging para a base antes do commit.
 */
export class InMemoryCofrinhoRepository
  implements CofrinhoRepository, ParticipanteInMemory<InMemoryCofrinhoRepository>
{
  private cofrinhos: Cofrinho[] = [];
  private aportesRecorrentes = new Map<string, AporteRecorrenteAtivo>();

  abrirStaging(): InMemoryCofrinhoRepository {
    const staging = new InMemoryCofrinhoRepository();
    staging.cofrinhos = [...this.cofrinhos];
    staging.aportesRecorrentes = new Map(this.aportesRecorrentes);
    return staging;
  }

  publicar(staging: InMemoryCofrinhoRepository): void {
    this.cofrinhos = [...staging.cofrinhos];
    this.aportesRecorrentes = new Map(staging.aportesRecorrentes);
  }

  /** A série recorrente vive em `transacoes`; aqui o teste declara que ela existe. */
  definirAporteRecorrenteAtivo(busca: BuscaAporteRecorrente, aporte: AporteRecorrenteAtivo): void {
    this.aportesRecorrentes.set(chaveAporte(busca), aporte);
  }

  async list(input: { familiaId: string; status: 'ativo' | 'encerrado' }): Promise<Cofrinho[]> {
    return this.cofrinhos.filter(
      (c) => c.familiaId === input.familiaId && c.status === input.status,
    );
  }

  async findById(input: CofrinhoDaFamilia): Promise<Cofrinho | null> {
    return this.cofrinhos.find((c) => c.id === input.id && c.familiaId === input.familiaId) ?? null;
  }

  async bloquearParaAtualizacao(input: CofrinhoDaFamilia): Promise<Cofrinho | null> {
    return this.findById(input);
  }

  async create(input: CreateCofrinhoInput): Promise<Cofrinho> {
    const created: Cofrinho = {
      id: randomUUID(),
      familiaId: input.familiaId,
      nome: input.nome,
      emoji: input.emoji ?? null,
      descricao: input.descricao ?? null,
      metaValor: input.metaValor ?? null,
      saldoAtual: '0',
      status: 'ativo',
      criadoPor: input.criadoPor,
      criadoEm: new Date(),
      encerradoEm: null,
    };
    this.cofrinhos = [...this.cofrinhos, created];
    return created;
  }

  async update(input: UpdateCofrinhoInput): Promise<Cofrinho | null> {
    return this.substituirAtivo(input, (c) => ({
      ...c,
      ...(input.nome !== undefined && { nome: input.nome }),
      ...(input.emoji !== undefined && { emoji: input.emoji ?? null }),
      ...(input.descricao !== undefined && { descricao: input.descricao ?? null }),
      ...(input.metaValor !== undefined && { metaValor: input.metaValor ?? null }),
    }));
  }

  async incrementarSaldo(input: VariacaoSaldo): Promise<Cofrinho | null> {
    return this.variarSaldo(input, paraCentavos(input.valor));
  }

  async decrementarSaldo(input: VariacaoSaldo): Promise<Cofrinho | null> {
    return this.variarSaldo(input, -paraCentavos(input.valor));
  }

  async encerrar(input: CofrinhoDaFamilia): Promise<Cofrinho | null> {
    return this.substituirAtivo(input, (c) => ({
      ...c,
      status: 'encerrado',
      encerradoEm: new Date(),
    }));
  }

  async findAporteRecorrenteAtivo(
    input: BuscaAporteRecorrente,
  ): Promise<AporteRecorrenteAtivo | null> {
    return this.aportesRecorrentes.get(chaveAporte(input)) ?? null;
  }

  /** Mesma guarda do UPDATE condicional do Drizzle: ativo e saldo final >= 0. */
  private variarSaldo(input: CofrinhoDaFamilia, deltaCentavos: number): Cofrinho | null {
    const atual = this.cofrinhos.find((c) => this.ehAtivoDaFamilia(c, input));
    const novoSaldo = atual ? paraCentavos(atual.saldoAtual) + deltaCentavos : -1;
    if (novoSaldo < 0) return null;
    return this.substituirAtivo(input, (c) => ({ ...c, saldoAtual: deCentavos(novoSaldo) }));
  }

  private substituirAtivo(
    input: CofrinhoDaFamilia,
    alterar: (c: Cofrinho) => Cofrinho,
  ): Cofrinho | null {
    const index = this.cofrinhos.findIndex((c) => this.ehAtivoDaFamilia(c, input));
    if (index === -1) return null;
    const alterado = alterar(this.cofrinhos[index]);
    this.cofrinhos = this.cofrinhos.map((c, i) => (i === index ? alterado : c));
    return alterado;
  }

  private ehAtivoDaFamilia(c: Cofrinho, input: CofrinhoDaFamilia): boolean {
    return c.id === input.id && c.familiaId === input.familiaId && c.status === 'ativo';
  }
}
