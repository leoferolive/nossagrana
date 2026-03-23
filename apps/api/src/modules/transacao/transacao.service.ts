import { calcularMesReferencia } from './mes-referencia.service.js';
import type {
  CofrinhoHandler,
  CreateTransacaoInput,
  SnapshotNotifier,
  TransacaoFiltros,
  TransacaoRepository,
} from './transacao.types.js';

export class TransacaoNotFoundError extends Error {
  constructor() {
    super('Transacao nao encontrada');
  }
}

interface RegistrarInput {
  familiaId: string;
  tipo: 'receita' | 'despesa';
  valor: string;
  categoriaId: string;
  descricao?: string | null;
  data: string;
  metodoPagamentoId?: string | null;
  metodoPagamentoTipo?: 'credito' | 'debito' | 'pix' | 'dinheiro' | null;
  dataFechamento?: number | null;
  usuarioRegistrouId: string;
  parcelado?: boolean;
  numeroParcelas?: number;
  recorrente?: boolean;
  frequencia?: 'mensal' | 'semanal' | 'quinzenal' | null;
  dataFimRecorrencia?: string | null;
  cofrinhoId?: string | null;
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

/** Adiciona meses a uma data no formato "YYYY-MM-DD" */
function adicionarMeses(dataStr: string, meses: number): string {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1 + meses, dia));
  return d.toISOString().slice(0, 10);
}

/** Adiciona dias a uma data no formato "YYYY-MM-DD" */
function adicionarDias(dataStr: string, dias: number): string {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return d.toISOString().slice(0, 10);
}

function calcularValorParcela(valorTotal: string, numeroParcelas: number): string {
  const total = parseFloat(valorTotal);
  const parcela = Math.round((total / numeroParcelas) * 100) / 100;
  return parcela.toFixed(2);
}

export class TransacaoService {
  constructor(
    private readonly repository: TransacaoRepository,
    private readonly snapshotNotifier?: SnapshotNotifier,
    private readonly cofrinhoHandler?: CofrinhoHandler,
  ) {}

  async registrar(input: RegistrarInput) {
    const dataObj = new Date(`${input.data}T12:00:00Z`);
    const mesReferencia = calcularMesReferencia({
      data: dataObj,
      tipo: input.metodoPagamentoTipo ?? null,
      dataFechamento: input.dataFechamento ?? null,
    });

    // Transação parcelada
    if (input.parcelado && input.numeroParcelas && input.numeroParcelas > 1) {
      const valorParcela = calcularValorParcela(input.valor, input.numeroParcelas);

      const pai = await this.repository.create({
        familiaId: input.familiaId,
        tipo: input.tipo,
        valor: input.valor,
        categoriaId: input.categoriaId,
        descricao: input.descricao ?? null,
        data: input.data,
        mesReferencia,
        metodoPagamentoId: input.metodoPagamentoId ?? null,
        usuarioRegistrouId: input.usuarioRegistrouId,
        parcelado: true,
        numeroParcelas: input.numeroParcelas,
        parcelaAtual: 1,
        valorTotal: input.valor,
        valorParcela,
      });

      // Gerar parcelas 2..N
      const parcelas: CreateTransacaoInput[] = [];
      for (let i = 2; i <= input.numeroParcelas; i++) {
        const dataParc = adicionarMeses(input.data, i - 1);
        const dataObj2 = new Date(`${dataParc}T12:00:00Z`);
        const mesRef = calcularMesReferencia({
          data: dataObj2,
          tipo: input.metodoPagamentoTipo ?? null,
          dataFechamento: input.dataFechamento ?? null,
        });

        parcelas.push({
          familiaId: input.familiaId,
          tipo: input.tipo,
          valor: valorParcela,
          categoriaId: input.categoriaId,
          descricao: input.descricao ?? null,
          data: dataParc,
          mesReferencia: mesRef,
          metodoPagamentoId: input.metodoPagamentoId ?? null,
          usuarioRegistrouId: input.usuarioRegistrouId,
          parcelado: true,
          numeroParcelas: input.numeroParcelas,
          parcelaAtual: i,
          valorTotal: input.valor,
          valorParcela,
          transacaoPaiId: pai.id,
        });
      }

      await this.repository.createMany(parcelas);
      return pai;
    }

    // Transação recorrente
    if (input.recorrente && input.frequencia) {
      const pai = await this.repository.create({
        familiaId: input.familiaId,
        tipo: input.tipo,
        valor: input.valor,
        categoriaId: input.categoriaId,
        descricao: input.descricao ?? null,
        data: input.data,
        mesReferencia,
        metodoPagamentoId: input.metodoPagamentoId ?? null,
        usuarioRegistrouId: input.usuarioRegistrouId,
        recorrente: true,
        frequencia: input.frequencia,
        dataFimRecorrencia: input.dataFimRecorrencia ?? null,
        cofrinhoId: input.cofrinhoId ?? null,
      });

      const recorrencias: CreateTransacaoInput[] = [];
      let dataAtual = input.data;

      const incrementar = (d: string): string => {
        if (input.frequencia === 'mensal') return adicionarMeses(d, 1);
        if (input.frequencia === 'quinzenal') return adicionarDias(d, 15);
        return adicionarDias(d, 7); // semanal
      };

      dataAtual = incrementar(dataAtual);

      const limite = 120; // segurança: máximo de 120 recorrências
      let count = 0;

      while (count < limite) {
        if (input.dataFimRecorrencia && dataAtual > input.dataFimRecorrencia) break;
        if (!input.dataFimRecorrencia && count >= 24) break; // sem prazo: gerar 24 adicionais

        const dataObj2 = new Date(`${dataAtual}T12:00:00Z`);
        const mesRef = calcularMesReferencia({
          data: dataObj2,
          tipo: input.metodoPagamentoTipo ?? null,
          dataFechamento: input.dataFechamento ?? null,
        });

        recorrencias.push({
          familiaId: input.familiaId,
          tipo: input.tipo,
          valor: input.valor,
          categoriaId: input.categoriaId,
          descricao: input.descricao ?? null,
          data: dataAtual,
          mesReferencia: mesRef,
          metodoPagamentoId: input.metodoPagamentoId ?? null,
          usuarioRegistrouId: input.usuarioRegistrouId,
          recorrente: true,
          frequencia: input.frequencia,
          dataFimRecorrencia: input.dataFimRecorrencia ?? null,
          transacaoPaiId: pai.id,
          cofrinhoId: input.cofrinhoId ?? null,
        });

        dataAtual = incrementar(dataAtual);
        count++;
      }

      const filhas = await this.repository.createMany(recorrencias);

      // Processar movimentações de cofrinho para filhas recorrentes
      if (input.cofrinhoId && this.cofrinhoHandler) {
        for (const filha of filhas) {
          await this.cofrinhoHandler.processarTransacaoComCofrinho({
            id: filha.id,
            familiaId: filha.familiaId,
            valor: filha.valor,
            cofrinhoId: input.cofrinhoId,
            usuarioRegistrouId: filha.usuarioRegistrouId,
            mesReferencia: filha.mesReferencia,
            descricao: filha.descricao,
          });
        }
      }

      return pai;
    }

    // Transação simples
    return this.repository.create({
      familiaId: input.familiaId,
      tipo: input.tipo,
      valor: input.valor,
      categoriaId: input.categoriaId,
      descricao: input.descricao ?? null,
      data: input.data,
      mesReferencia,
      metodoPagamentoId: input.metodoPagamentoId ?? null,
      usuarioRegistrouId: input.usuarioRegistrouId,
      cofrinhoId: input.cofrinhoId ?? null,
    });
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
