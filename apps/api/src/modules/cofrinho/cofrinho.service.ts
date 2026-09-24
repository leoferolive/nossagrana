import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.types.js';
import {
  AporteRecorrenteIndisponivelError,
  AporteRecorrenteNotFoundError,
  CancelamentoRecorrenteIndisponivelError,
  CofrinhoEncerradoError,
  CofrinhoNotFoundError,
} from './cofrinho.errors.js';
import {
  aportarNoEscopo,
  encerrarNoEscopo,
  exigirSemAporteRecorrente,
  retirarNoEscopo,
  type LancamentoCofrinho,
  type RegistrarTransacaoDoAporte,
} from './cofrinho.operacoes.js';
import type {
  AporteRecorrenteAtivo,
  BuscarCategoriaCofrinho,
  Cofrinho,
  CofrinhoRepositorios,
  CofrinhoRepositoriosLeitura,
  CreateCofrinhoInput,
  MovimentacaoCofrinho,
  ResultadoMovimentacao,
  TransacaoRecorrenteCreator,
  UpdateCofrinhoInput,
} from './cofrinho.types.js';

type Frequencia = 'mensal' | 'semanal' | 'quinzenal';

interface AportarInput {
  cofrinhoId: string;
  familiaId: string;
  valor: string;
  descricao?: string | null;
  registradoPor: string;
  recorrente?: boolean;
  frequencia?: Frequencia | null;
  dataFimRecorrencia?: string | null;
  mesReferencia?: string;
  data?: string;
}

interface RetirarInput {
  cofrinhoId: string;
  familiaId: string;
  valor: string;
  descricao?: string | null;
  voltarAoSaldo: boolean;
  registradoPor: string;
}

interface EncerrarInput {
  id: string;
  familiaId: string;
  voltarAoSaldo: boolean;
  registradoPor: string;
}

function getMesReferencia(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getDataHoje(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Aporte, retirada e encerramento rodam, cada um, numa única Unit of Work
 * (#59–#62): saldo, movimentação e transação confirmam ou desfazem juntos.
 * Leituras e cadastro usam os repositórios de `leitura`, fora da unidade.
 */
export class CofrinhoService {
  constructor(
    private readonly leitura: CofrinhoRepositoriosLeitura,
    private readonly unitOfWork: UnitOfWork<CofrinhoRepositorios>,
    private readonly buscarCategoriaCofrinho: BuscarCategoriaCofrinho,
    private readonly transacaoRecorrente?: TransacaoRecorrenteCreator,
  ) {}

  async criar(input: CreateCofrinhoInput): Promise<Cofrinho> {
    return this.leitura.cofrinhos.create(input);
  }

  async editar(input: UpdateCofrinhoInput): Promise<Cofrinho> {
    await this.exigirAtivo(input);
    const updated = await this.leitura.cofrinhos.update(input);
    if (!updated) throw new CofrinhoNotFoundError(input.id);
    return updated;
  }

  async aportar(input: AportarInput): Promise<ResultadoMovimentacao> {
    // Antes da unidade: recorrência sem porta falha sem abrir transação.
    const registrarTransacao = this.transacaoDoAporte(input);
    const { id: categoriaId } = await this.buscarCategoriaCofrinho(input.familiaId);
    const aporte = { ...lancamentoDe(input), categoriaId };
    return this.unitOfWork.executar(({ repos }) =>
      aportarNoEscopo(repos, aporte, registrarTransacao),
    );
  }

  async retirar(input: RetirarInput): Promise<ResultadoMovimentacao> {
    const retorno = await this.retornoAoSaldo(input.familiaId, input.voltarAoSaldo);
    const retirada = { ...lancamentoDe(input), retorno };
    return this.unitOfWork.executar(({ repos }) => retirarNoEscopo(repos, retirada));
  }

  async encerrar(input: EncerrarInput): Promise<Cofrinho> {
    const retorno = await this.retornoAoSaldo(input.familiaId, input.voltarAoSaldo);
    const encerramento = {
      cofrinhoId: input.id,
      familiaId: input.familiaId,
      registradoPor: input.registradoPor,
      mesReferencia: getMesReferencia(),
      data: getDataHoje(),
      retorno,
    };
    return this.unitOfWork.executar(({ repos }) => encerrarNoEscopo(repos, encerramento));
  }

  async listar(input: { familiaId: string; status: 'ativo' | 'encerrado' }): Promise<Cofrinho[]> {
    return this.leitura.cofrinhos.list(input);
  }

  async detalhe(input: { id: string; familiaId: string }): Promise<{
    cofrinho: Cofrinho;
    movimentacoes: MovimentacaoCofrinho[];
    aporteRecorrenteAtivo: AporteRecorrenteAtivo | null;
  }> {
    const cofrinho = await this.leitura.cofrinhos.findById(input);
    if (!cofrinho) throw new CofrinhoNotFoundError(input.id);
    const busca = { cofrinhoId: input.id, familiaId: input.familiaId };
    const movimentacoes = await this.leitura.movimentacoes.listByCofrinho(busca);
    const aporteRecorrenteAtivo = await this.leitura.cofrinhos.findAporteRecorrenteAtivo(busca);
    return { cofrinho, movimentacoes, aporteRecorrenteAtivo };
  }

  async cancelarAporteRecorrente(input: { cofrinhoId: string; familiaId: string }): Promise<void> {
    const cofrinho = await this.leitura.cofrinhos.findById({
      id: input.cofrinhoId,
      familiaId: input.familiaId,
    });
    if (!cofrinho) throw new CofrinhoNotFoundError(input.cofrinhoId);
    const aporteRecorrente = await this.leitura.cofrinhos.findAporteRecorrenteAtivo(input);
    if (!aporteRecorrente) throw new AporteRecorrenteNotFoundError();
    const porta = this.transacaoRecorrente;
    if (!porta) throw new CancelamentoRecorrenteIndisponivelError(aporteRecorrente.transacaoPaiId);
    await porta.cancelarRecorrencia({
      transacaoPaiId: aporteRecorrente.transacaoPaiId,
      familiaId: input.familiaId,
    });
  }

  private async exigirAtivo(input: { id: string; familiaId: string }): Promise<void> {
    const cofrinho = await this.leitura.cofrinhos.findById(input);
    if (!cofrinho) throw new CofrinhoNotFoundError(input.id);
    if (cofrinho.status === 'encerrado') throw new CofrinhoEncerradoError(input.id);
  }

  /** Categoria de sistema "Cofrinho" só é necessária quando há transação de retorno. */
  private async retornoAoSaldo(familiaId: string, voltarAoSaldo: boolean) {
    if (!voltarAoSaldo) return null;
    const { id: categoriaId } = await this.buscarCategoriaCofrinho(familiaId);
    return { categoriaId };
  }

  /** Aporte simples usa a despesa padrão (undefined); recorrente exige a porta injetada. */
  private transacaoDoAporte(input: AportarInput): RegistrarTransacaoDoAporte | undefined {
    if (!input.recorrente || !input.frequencia) return undefined;
    const porta = this.transacaoRecorrente;
    if (!porta) throw new AporteRecorrenteIndisponivelError(input.frequencia);
    const serie = {
      frequencia: input.frequencia,
      dataFimRecorrencia: input.dataFimRecorrencia ?? null,
    };
    return async (repos, transacao) => {
      await exigirSemAporteRecorrente(repos.cofrinhos, transacao);
      return porta.criarRecorrente({ ...transacao, ...serie }, repos.transacoes);
    };
  }
}

function lancamentoDe(input: {
  cofrinhoId: string;
  familiaId: string;
  valor: string;
  descricao?: string | null;
  registradoPor: string;
  mesReferencia?: string;
  data?: string;
}): LancamentoCofrinho {
  return {
    cofrinhoId: input.cofrinhoId,
    familiaId: input.familiaId,
    valor: input.valor,
    descricao: input.descricao ?? null,
    registradoPor: input.registradoPor,
    mesReferencia: input.mesReferencia ?? getMesReferencia(),
    data: input.data ?? getDataHoje(),
  };
}
