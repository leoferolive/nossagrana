import type {
  Cofrinho,
  CofrinhoRepository,
  MovimentacaoCofrinho,
  TransacaoCreator,
  TransacaoRecorrenteCreator,
} from './cofrinho.types.js';

export class CofrinhoNotFoundError extends Error {
  constructor() {
    super('Cofrinho nao encontrado');
  }
}

export class CofrinhoEncerradoError extends Error {
  constructor() {
    super('Cofrinho esta encerrado');
  }
}

export class SaldoInsuficienteError extends Error {
  constructor() {
    super('Saldo insuficiente para esta retirada');
  }
}

export class AporteRecorrenteJaAtivoError extends Error {
  constructor() {
    super('Este cofrinho ja possui um aporte recorrente ativo');
  }
}

export class AporteRecorrenteNotFoundError extends Error {
  constructor() {
    super('Nenhum aporte recorrente ativo encontrado');
  }
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

function somaSaldo(saldoAtual: string, valor: string): string {
  const resultado = parseFloat(saldoAtual) + parseFloat(valor);
  return resultado.toFixed(2);
}

function subtraiSaldo(saldoAtual: string, valor: string): string {
  const resultado = parseFloat(saldoAtual) - parseFloat(valor);
  return resultado.toFixed(2);
}

export class CofrinhoService {
  constructor(
    private readonly repository: CofrinhoRepository,
    private readonly transacaoCreator: TransacaoCreator,
    private readonly getCategoriaCofrinho: (familiaId: string) => Promise<{ id: string }>,
    private readonly transacaoRecorrenteCreator?: TransacaoRecorrenteCreator,
  ) {}

  async criar(input: {
    familiaId: string;
    nome: string;
    emoji?: string | null;
    descricao?: string | null;
    metaValor?: string | null;
    criadoPor: string;
  }): Promise<Cofrinho> {
    return this.repository.create(input);
  }

  async editar(input: {
    id: string;
    familiaId: string;
    nome?: string;
    emoji?: string | null;
    descricao?: string | null;
    metaValor?: string | null;
  }): Promise<Cofrinho> {
    const cofrinho = await this.repository.findById({
      id: input.id,
      familiaId: input.familiaId,
    });

    if (!cofrinho) {
      throw new CofrinhoNotFoundError();
    }

    if (cofrinho.status === 'encerrado') {
      throw new CofrinhoEncerradoError();
    }

    const updated = await this.repository.update(input);
    if (!updated) {
      throw new CofrinhoNotFoundError();
    }

    return updated;
  }

  async aportar(input: {
    cofrinhoId: string;
    familiaId: string;
    valor: string;
    descricao?: string | null;
    registradoPor: string;
    recorrente?: boolean;
    frequencia?: 'mensal' | 'semanal' | 'quinzenal' | null;
    dataFimRecorrencia?: string | null;
  }): Promise<{ cofrinho: Cofrinho; movimentacao: MovimentacaoCofrinho }> {
    const cofrinho = await this.repository.findById({
      id: input.cofrinhoId,
      familiaId: input.familiaId,
    });

    if (!cofrinho) {
      throw new CofrinhoNotFoundError();
    }

    if (cofrinho.status === 'encerrado') {
      throw new CofrinhoEncerradoError();
    }

    const categoria = await this.getCategoriaCofrinho(input.familiaId);
    const mesReferencia = getMesReferencia();
    const data = getDataHoje();

    let transacaoId: string;

    if (input.recorrente && input.frequencia) {
      // Check if there's already an active recurring aporte
      const aporteExistente = await this.repository.findAporteRecorrenteAtivo({
        cofrinhoId: input.cofrinhoId,
        familiaId: input.familiaId,
      });

      if (aporteExistente) {
        throw new AporteRecorrenteJaAtivoError();
      }

      const transacao = await this.transacaoRecorrenteCreator!.criarRecorrente({
        familiaId: input.familiaId,
        tipo: 'despesa',
        valor: input.valor,
        categoriaId: categoria.id,
        descricao: input.descricao ?? null,
        data,
        mesReferencia,
        usuarioRegistrouId: input.registradoPor,
        cofrinhoId: input.cofrinhoId,
        frequencia: input.frequencia,
        dataFimRecorrencia: input.dataFimRecorrencia ?? null,
      });

      transacaoId = transacao.id;
    } else {
      const transacao = await this.transacaoCreator.criar({
        familiaId: input.familiaId,
        tipo: 'despesa',
        valor: input.valor,
        categoriaId: categoria.id,
        descricao: input.descricao ?? null,
        data,
        mesReferencia,
        usuarioRegistrouId: input.registradoPor,
        cofrinhoId: input.cofrinhoId,
      });

      transacaoId = transacao.id;
    }

    const movimentacao = await this.repository.createMovimentacao({
      cofrinhoId: input.cofrinhoId,
      familiaId: input.familiaId,
      tipo: 'aporte',
      valor: input.valor,
      descricao: input.descricao ?? null,
      transacaoId,
      registradoPor: input.registradoPor,
      mesReferencia,
    });

    const novoSaldo = somaSaldo(cofrinho.saldoAtual, input.valor);
    const cofrinhoAtualizado = await this.repository.updateSaldo({
      id: input.cofrinhoId,
      familiaId: input.familiaId,
      novoSaldo,
    });

    return {
      cofrinho: cofrinhoAtualizado!,
      movimentacao,
    };
  }

  async retirar(input: {
    cofrinhoId: string;
    familiaId: string;
    valor: string;
    descricao?: string | null;
    voltarAoSaldo: boolean;
    registradoPor: string;
  }): Promise<{ cofrinho: Cofrinho; movimentacao: MovimentacaoCofrinho }> {
    const cofrinho = await this.repository.findById({
      id: input.cofrinhoId,
      familiaId: input.familiaId,
    });

    if (!cofrinho) {
      throw new CofrinhoNotFoundError();
    }

    if (cofrinho.status === 'encerrado') {
      throw new CofrinhoEncerradoError();
    }

    if (parseFloat(cofrinho.saldoAtual) < parseFloat(input.valor)) {
      throw new SaldoInsuficienteError();
    }

    const mesReferencia = getMesReferencia();
    let transacaoId: string | null = null;

    if (input.voltarAoSaldo) {
      const categoria = await this.getCategoriaCofrinho(input.familiaId);
      const data = getDataHoje();

      const transacao = await this.transacaoCreator.criar({
        familiaId: input.familiaId,
        tipo: 'receita',
        valor: input.valor,
        categoriaId: categoria.id,
        descricao: input.descricao ?? null,
        data,
        mesReferencia,
        usuarioRegistrouId: input.registradoPor,
        cofrinhoId: input.cofrinhoId,
      });

      transacaoId = transacao.id;
    }

    const movimentacao = await this.repository.createMovimentacao({
      cofrinhoId: input.cofrinhoId,
      familiaId: input.familiaId,
      tipo: 'retirada',
      valor: input.valor,
      descricao: input.descricao ?? null,
      transacaoId,
      registradoPor: input.registradoPor,
      mesReferencia,
    });

    const novoSaldo = subtraiSaldo(cofrinho.saldoAtual, input.valor);
    const cofrinhoAtualizado = await this.repository.updateSaldo({
      id: input.cofrinhoId,
      familiaId: input.familiaId,
      novoSaldo,
    });

    return {
      cofrinho: cofrinhoAtualizado!,
      movimentacao,
    };
  }

  async encerrar(input: {
    id: string;
    familiaId: string;
    voltarAoSaldo: boolean;
    registradoPor: string;
  }): Promise<Cofrinho> {
    const cofrinho = await this.repository.findById({
      id: input.id,
      familiaId: input.familiaId,
    });

    if (!cofrinho) {
      throw new CofrinhoNotFoundError();
    }

    if (cofrinho.status === 'encerrado') {
      throw new CofrinhoEncerradoError();
    }

    const saldo = parseFloat(cofrinho.saldoAtual);

    if (saldo > 0) {
      if (input.voltarAoSaldo) {
        // Create withdrawal transaction to return money to balance
        await this.retirar({
          cofrinhoId: input.id,
          familiaId: input.familiaId,
          valor: cofrinho.saldoAtual,
          voltarAoSaldo: true,
          registradoPor: input.registradoPor,
        });
      } else {
        // Just zero out the balance without creating a transaction
        const mesReferencia = getMesReferencia();
        await this.repository.createMovimentacao({
          cofrinhoId: input.id,
          familiaId: input.familiaId,
          tipo: 'retirada',
          valor: cofrinho.saldoAtual,
          descricao: null,
          transacaoId: null,
          registradoPor: input.registradoPor,
          mesReferencia,
        });
        await this.repository.updateSaldo({
          id: input.id,
          familiaId: input.familiaId,
          novoSaldo: '0',
        });
      }
    }

    const encerrado = await this.repository.encerrar({
      id: input.id,
      familiaId: input.familiaId,
    });

    return encerrado!;
  }

  async listar(input: { familiaId: string; status: 'ativo' | 'encerrado' }): Promise<Cofrinho[]> {
    return this.repository.list(input);
  }

  async detalhe(input: { id: string; familiaId: string }): Promise<{
    cofrinho: Cofrinho;
    movimentacoes: MovimentacaoCofrinho[];
    aporteRecorrenteAtivo: {
      transacaoPaiId: string;
      valor: string;
      frequencia: 'mensal' | 'semanal' | 'quinzenal';
      dataFimRecorrencia: string | null;
    } | null;
  }> {
    const cofrinho = await this.repository.findById(input);

    if (!cofrinho) {
      throw new CofrinhoNotFoundError();
    }

    const movimentacoes = await this.repository.listMovimentacoes({
      cofrinhoId: input.id,
      familiaId: input.familiaId,
    });

    const aporteRecorrenteAtivo = await this.repository.findAporteRecorrenteAtivo({
      cofrinhoId: input.id,
      familiaId: input.familiaId,
    });

    return { cofrinho, movimentacoes, aporteRecorrenteAtivo };
  }

  async cancelarAporteRecorrente(input: { cofrinhoId: string; familiaId: string }): Promise<void> {
    const cofrinho = await this.repository.findById({
      id: input.cofrinhoId,
      familiaId: input.familiaId,
    });

    if (!cofrinho) {
      throw new CofrinhoNotFoundError();
    }

    const aporteRecorrente = await this.repository.findAporteRecorrenteAtivo({
      cofrinhoId: input.cofrinhoId,
      familiaId: input.familiaId,
    });

    if (!aporteRecorrente) {
      throw new AporteRecorrenteNotFoundError();
    }

    await this.transacaoRecorrenteCreator!.cancelarRecorrencia({
      transacaoPaiId: aporteRecorrente.transacaoPaiId,
      familiaId: input.familiaId,
    });
  }
}
