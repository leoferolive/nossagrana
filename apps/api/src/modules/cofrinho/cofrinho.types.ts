import type { TransacaoRepository } from '../transacao/transacao.types.js';

export interface Cofrinho {
  id: string;
  familiaId: string;
  nome: string;
  emoji: string | null;
  descricao: string | null;
  metaValor: string | null;
  saldoAtual: string;
  status: 'ativo' | 'encerrado';
  criadoPor: string;
  criadoEm: Date;
  encerradoEm: Date | null;
}

export interface MovimentacaoCofrinho {
  id: string;
  cofrinhoId: string;
  familiaId: string;
  tipo: 'aporte' | 'retirada';
  valor: string;
  descricao: string | null;
  transacaoId: string | null;
  registradoPor: string;
  registradoEm: Date;
  mesReferencia: string;
}

export interface CofrinhoDaFamilia {
  id: string;
  familiaId: string;
}

/** Variação de saldo: `valor` é decimal positivo com até 2 casas (ex.: "150.25"). */
export interface VariacaoSaldo extends CofrinhoDaFamilia {
  valor: string;
}

export interface CreateCofrinhoInput {
  familiaId: string;
  nome: string;
  emoji?: string | null;
  descricao?: string | null;
  metaValor?: string | null;
  criadoPor: string;
}

export interface UpdateCofrinhoInput extends CofrinhoDaFamilia {
  nome?: string;
  emoji?: string | null;
  descricao?: string | null;
  metaValor?: string | null;
}

export interface AporteRecorrenteAtivo {
  transacaoPaiId: string;
  valor: string;
  frequencia: 'mensal' | 'semanal' | 'quinzenal';
  dataFimRecorrencia: string | null;
}

export interface BuscaAporteRecorrente {
  cofrinhoId: string;
  familiaId: string;
}

/**
 * Saldo só muda por operação atômica no banco (#59): não há "setar saldo" —
 * incremento/decremento condicionais evitam lost update e saldo negativo.
 * Toda operação filtra por `familia_id`; zero linhas afetadas devolve `null`.
 */
export interface CofrinhoRepository {
  list(input: { familiaId: string; status: 'ativo' | 'encerrado' }): Promise<Cofrinho[]>;
  findById(input: CofrinhoDaFamilia): Promise<Cofrinho | null>;
  create(input: CreateCofrinhoInput): Promise<Cofrinho>;
  update(input: UpdateCofrinhoInput): Promise<Cofrinho | null>;
  /** `SELECT ... FOR UPDATE` da linha (id + família): segura o cofrinho até o commit. */
  bloquearParaAtualizacao(input: CofrinhoDaFamilia): Promise<Cofrinho | null>;
  /** `saldo = saldo + valor` só se ativo; `null` se inexistente/outra família/encerrado. */
  incrementarSaldo(input: VariacaoSaldo): Promise<Cofrinho | null>;
  /** `saldo = saldo - valor` só se ativo E `saldo >= valor`; senão `null`. */
  decrementarSaldo(input: VariacaoSaldo): Promise<Cofrinho | null>;
  encerrar(input: CofrinhoDaFamilia): Promise<Cofrinho | null>;
  findAporteRecorrenteAtivo(input: BuscaAporteRecorrente): Promise<AporteRecorrenteAtivo | null>;
}

export interface CreateMovimentacaoInput {
  cofrinhoId: string;
  familiaId: string;
  tipo: 'aporte' | 'retirada';
  valor: string;
  descricao?: string | null;
  transacaoId?: string | null;
  registradoPor: string;
  mesReferencia: string;
}

/** Ledger do cofrinho: fonte para reconciliar o saldo materializado. */
export interface MovimentacaoCofrinhoRepository {
  create(input: CreateMovimentacaoInput): Promise<MovimentacaoCofrinho>;
  listByCofrinho(input: BuscaAporteRecorrente): Promise<MovimentacaoCofrinho[]>;
}

/**
 * Tudo que aporte, retirada e encerramento escrevem, construído sobre o MESMO
 * executor da Unit of Work (#60): saldo, ledger e transação no mesmo commit.
 * `type` (não `interface`) para satisfazer o `Record<string, object>` da UoW.
 */
export type CofrinhoRepositorios = {
  cofrinhos: CofrinhoRepository;
  movimentacoes: MovimentacaoCofrinhoRepository;
  transacoes: TransacaoRepository;
};

/** Repositórios para leituras e cadastro fora da Unit of Work. */
export type CofrinhoRepositoriosLeitura = Pick<CofrinhoRepositorios, 'cofrinhos' | 'movimentacoes'>;

export type BuscarCategoriaCofrinho = (familiaId: string) => Promise<{ id: string }>;

export interface TransacaoRecorrenteInput {
  familiaId: string;
  tipo: 'receita' | 'despesa';
  valor: string;
  categoriaId: string;
  descricao: string | null;
  data: string;
  mesReferencia: string;
  usuarioRegistrouId: string;
  cofrinhoId: string;
  frequencia: 'mensal' | 'semanal' | 'quinzenal';
  dataFimRecorrencia?: string | null;
}

/**
 * Porta do aporte recorrente. Sem implementação em produção hoje (nenhuma
 * rota injeta); quando existir, grava pelo `transacoes` recebido — o do tx do
 * aporte — para a série entrar no mesmo commit do saldo e da movimentação.
 */
export interface TransacaoRecorrenteCreator {
  criarRecorrente(
    input: TransacaoRecorrenteInput,
    transacoes: TransacaoRepository,
  ): Promise<{ id: string }>;
  cancelarRecorrencia(input: { transacaoPaiId: string; familiaId: string }): Promise<void>;
}

export interface ResultadoMovimentacao {
  cofrinho: Cofrinho;
  movimentacao: MovimentacaoCofrinho;
}
