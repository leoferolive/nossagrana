import type { ReferenciaOwnershipChecker } from '../../shared/referencia-ownership/referencia-ownership.types.js';
import { referenciaEsperada } from '../../shared/referencia-ownership/referencia-ownership.validator.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.types.js';
import { calcularMesReferencia } from './mes-referencia.service.js';
import { planejarRegistro, type PlanoRegistro } from './transacao.plano-registro.js';
import type {
  CofrinhoHandler,
  RegistrarTransacaoInput,
  SnapshotNotifier,
  Transacao,
  TransacaoFiltros,
  TransacaoRepositorios,
  TransacaoRepository,
} from './transacao.types.js';

export class TransacaoNotFoundError extends Error {
  constructor() {
    super('Transacao nao encontrada');
  }
}

interface EditarInput {
  id: string;
  familiaId: string;
  tipo: 'receita' | 'despesa';
  valor: string;
  categoriaId: string;
  descricao?: string | null;
  data: string;
  metodoPagamentoId?: string | null;
  metodoPagamentoTipo?: 'credito' | 'debito' | 'pix' | 'dinheiro' | null;
  dataFechamento?: number | null;
}

export class TransacaoService {
  constructor(
    private readonly repository: TransacaoRepository,
    private readonly referencias: ReferenciaOwnershipChecker,
    private readonly unitOfWork: UnitOfWork<TransacaoRepositorios>,
    private readonly snapshotNotifier?: SnapshotNotifier,
    private readonly cofrinhoHandler?: CofrinhoHandler,
  ) {}

  /**
   * Pai, filhas (parcelas/recorrências) e movimentações de cofrinho são
   * gravados numa única Unit of Work (#85): falha em qualquer ponto desfaz
   * tudo, e a promise só resolve depois do commit.
   */
  async registrar(input: RegistrarTransacaoInput): Promise<Transacao> {
    // Antes de qualquer escrita: parcelas/séries não podem ficar parcialmente gravadas.
    await this.referencias.validar({
      familiaId: input.familiaId,
      categoria: { id: input.categoriaId, exigirAtiva: true, tipo: input.tipo },
      metodoPagamento: referenciaEsperada(input.metodoPagamentoId),
      cofrinho: referenciaEsperada(input.cofrinhoId),
    });

    const plano = planejarRegistro(input);
    return this.unitOfWork.executar(({ repos }) => this.gravarPlano(repos, plano));
  }

  private async gravarPlano(repos: TransacaoRepositorios, plano: PlanoRegistro) {
    const pai = await repos.transacoes.create(plano.pai);
    if (plano.filhas.length === 0) return pai;

    const filhas = await repos.transacoes.createMany(
      plano.filhas.map((filha) => ({ ...filha, transacaoPaiId: pai.id })),
    );
    await this.movimentarCofrinho(repos, filhas, plano.cofrinhoDasFilhas);
    return pai;
  }

  /**
   * Processar movimentações de cofrinho para filhas recorrentes. Roda dentro
   * da unidade: se falhar, as transações são desfeitas. O handler recebe os
   * `repos` do tx (#59), então o que ele grava entra no mesmo commit/rollback.
   */
  private async movimentarCofrinho(
    repos: TransacaoRepositorios,
    filhas: Transacao[],
    cofrinhoId: string | null,
  ) {
    if (!cofrinhoId || !this.cofrinhoHandler) return;
    for (const filha of filhas) {
      const { id, familiaId, valor, usuarioRegistrouId, mesReferencia, descricao } = filha;
      await this.cofrinhoHandler.processarTransacaoComCofrinho(
        { id, familiaId, valor, cofrinhoId, usuarioRegistrouId, mesReferencia, descricao },
        repos,
      );
    }
  }

  async listar(filtros: TransacaoFiltros) {
    return this.repository.list(filtros);
  }

  async detalhe(input: { id: string; familiaId: string }) {
    const t = await this.repository.findById(input);
    if (!t) throw new TransacaoNotFoundError();
    return t;
  }

  async editar(input: EditarInput) {
    const dataObj = new Date(`${input.data}T12:00:00Z`);
    const mesReferencia = calcularMesReferencia({
      data: dataObj,
      tipo: input.metodoPagamentoTipo ?? null,
      dataFechamento: input.dataFechamento ?? null,
    });

    const existing = await this.repository.findById({ id: input.id, familiaId: input.familiaId });
    if (!existing) throw new TransacaoNotFoundError();

    await this.referencias.validar({
      familiaId: input.familiaId,
      // Mesma categoria já gravada pode seguir inativa; troca exige categoria ativa.
      categoria: {
        id: input.categoriaId,
        exigirAtiva: input.categoriaId !== existing.categoriaId,
        tipo: input.tipo,
      },
      metodoPagamento: referenciaEsperada(input.metodoPagamentoId, existing.metodoPagamentoId),
    });

    const updated = await this.repository.update({
      id: input.id,
      familiaId: input.familiaId,
      tipo: input.tipo,
      valor: input.valor,
      categoriaId: input.categoriaId,
      descricao: input.descricao ?? null,
      data: input.data,
      mesReferencia,
      metodoPagamentoId: input.metodoPagamentoId ?? null,
    });

    if (!updated) throw new TransacaoNotFoundError();

    await this.snapshotNotifier?.marcarDivergente(input.familiaId, existing.mesReferencia);

    return updated;
  }

  async excluir(input: { id: string; familiaId: string }) {
    const existing = await this.repository.findById(input);
    if (!existing) throw new TransacaoNotFoundError();

    const deleted = await this.repository.delete(input);
    if (!deleted) throw new TransacaoNotFoundError();

    await this.snapshotNotifier?.marcarDivergente(input.familiaId, existing.mesReferencia);
  }

  async anteciparParcelas(input: {
    transacaoPaiId: string;
    familiaId: string;
    novoMesReferencia: string;
    dataMinima: string;
  }) {
    const updated = await this.repository.updateManyByPaiId({
      transacaoPaiId: input.transacaoPaiId,
      familiaId: input.familiaId,
      dataMinima: input.dataMinima,
      fields: { mesReferencia: input.novoMesReferencia },
    });

    if (updated === 0) throw new TransacaoNotFoundError();
    return updated;
  }
}
