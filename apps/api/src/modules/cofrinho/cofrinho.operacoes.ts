import { paraCentavos } from './cofrinho.centavos.js';
import {
  AporteRecorrenteJaAtivoError,
  CofrinhoEncerradoError,
  CofrinhoNotFoundError,
  SaldoInsuficienteError,
} from './cofrinho.errors.js';
import type {
  BuscaAporteRecorrente,
  Cofrinho,
  CofrinhoRepositorios,
  CofrinhoRepository,
  ResultadoMovimentacao,
  TransacaoRecorrenteInput,
} from './cofrinho.types.js';

/**
 * Operações de saldo do cofrinho DENTRO de uma Unit of Work já aberta (#59):
 * recebem os `repos` do tx e nunca abrem outra unidade (aninhamento é
 * proibido). Ordem: primeiro o UPDATE atômico do saldo — que trava a linha
 * até o commit —, só depois transação e movimentação; qualquer erro desfaz tudo.
 */

/** Dados de um aporte/retirada com datas e categoria já resolvidas antes da unidade. */
export interface LancamentoCofrinho {
  cofrinhoId: string;
  familiaId: string;
  valor: string;
  descricao: string | null;
  registradoPor: string;
  mesReferencia: string;
  data: string;
}

interface AporteNoEscopo extends LancamentoCofrinho {
  categoriaId: string;
}

/** `retorno` = transação de receita que devolve o valor ao saldo da família (voltarAoSaldo). */
interface RetiradaNoEscopo extends LancamentoCofrinho {
  retorno: { categoriaId: string } | null;
}

type TransacaoDoCofrinho = Omit<TransacaoRecorrenteInput, 'frequencia' | 'dataFimRecorrencia'>;

/**
 * Grava a transação ligada ao aporte; o padrão é uma despesa simples. Roda
 * DEPOIS do UPDATE do saldo, com a linha do cofrinho já travada: checagens
 * aqui (ex.: série recorrente única) ficam serializadas entre requisições.
 */
export type RegistrarTransacaoDoAporte = (
  repos: CofrinhoRepositorios,
  transacao: TransacaoDoCofrinho,
) => Promise<{ id: string }>;

const despesaSimples: RegistrarTransacaoDoAporte = (repos, transacao) =>
  repos.transacoes.create(transacao);

function transacaoDo(
  lancamento: LancamentoCofrinho,
  tipo: 'receita' | 'despesa',
  categoriaId: string,
): TransacaoDoCofrinho {
  const { cofrinhoId, familiaId, valor, descricao, registradoPor, mesReferencia, data } =
    lancamento;
  const base = { familiaId, tipo, valor, categoriaId, descricao, data, mesReferencia };
  return { ...base, usuarioRegistrouId: registradoPor, cofrinhoId };
}

/**
 * Zero linhas no UPDATE condicional: lê na MESMA transação para dizer o
 * motivo. Outra família lê `null` → "não encontrado", sem revelar o cofrinho.
 */
async function motivoDaRecusa(cofrinhos: CofrinhoRepository, l: LancamentoCofrinho) {
  const atual = await cofrinhos.findById({ id: l.cofrinhoId, familiaId: l.familiaId });
  if (!atual) return new CofrinhoNotFoundError(l.cofrinhoId);
  if (atual.status === 'encerrado') return new CofrinhoEncerradoError(l.cofrinhoId);
  return new SaldoInsuficienteError(l.valor);
}

async function registrarMovimentacao(
  repos: CofrinhoRepositorios,
  l: LancamentoCofrinho,
  tipo: 'aporte' | 'retirada',
  transacaoId: string | null,
) {
  const { cofrinhoId, familiaId, valor, descricao, registradoPor, mesReferencia } = l;
  const campos = { cofrinhoId, familiaId, valor, descricao, registradoPor, mesReferencia };
  return repos.movimentacoes.create({ ...campos, tipo, transacaoId });
}

/** Aporte: `saldo + valor` atômico, depois transação de despesa e movimentação. */
export async function aportarNoEscopo(
  repos: CofrinhoRepositorios,
  aporte: AporteNoEscopo,
  registrarTransacao: RegistrarTransacaoDoAporte = despesaSimples,
): Promise<ResultadoMovimentacao> {
  const { cofrinhoId: id, familiaId, valor } = aporte;
  const cofrinho = await repos.cofrinhos.incrementarSaldo({ id, familiaId, valor });
  if (!cofrinho) throw await motivoDaRecusa(repos.cofrinhos, aporte);
  const transacao = await registrarTransacao(
    repos,
    transacaoDo(aporte, 'despesa', aporte.categoriaId),
  );
  const movimentacao = await registrarMovimentacao(repos, aporte, 'aporte', transacao.id);
  return { cofrinho, movimentacao };
}

/** Retirada: `saldo - valor` só se coberto; efeitos derivados só depois do UPDATE válido. */
export async function retirarNoEscopo(
  repos: CofrinhoRepositorios,
  retirada: RetiradaNoEscopo,
): Promise<ResultadoMovimentacao> {
  const { cofrinhoId: id, familiaId, valor, retorno } = retirada;
  const cofrinho = await repos.cofrinhos.decrementarSaldo({ id, familiaId, valor });
  if (!cofrinho) throw await motivoDaRecusa(repos.cofrinhos, retirada);
  const transacao = retorno
    ? await repos.transacoes.create(transacaoDo(retirada, 'receita', retorno.categoriaId))
    : null;
  const movimentacao = await registrarMovimentacao(
    repos,
    retirada,
    'retirada',
    transacao?.id ?? null,
  );
  return { cofrinho, movimentacao };
}

type EncerramentoNoEscopo = Omit<RetiradaNoEscopo, 'valor' | 'descricao'>;

/**
 * Encerramento: trava a linha (`FOR UPDATE`) antes de ler o saldo, retira
 * tudo pelo mesmo caminho da retirada e só então muda o status — uma
 * retirada concorrente espera o lock e depois vê o cofrinho encerrado.
 */
export async function encerrarNoEscopo(
  repos: CofrinhoRepositorios,
  encerramento: EncerramentoNoEscopo,
): Promise<Cofrinho> {
  const { cofrinhoId: id, familiaId } = encerramento;
  const atual = await repos.cofrinhos.bloquearParaAtualizacao({ id, familiaId });
  if (!atual) throw new CofrinhoNotFoundError(id);
  if (atual.status === 'encerrado') throw new CofrinhoEncerradoError(id);
  if (paraCentavos(atual.saldoAtual) > 0) {
    await retirarNoEscopo(repos, { ...encerramento, valor: atual.saldoAtual, descricao: null });
  }
  const encerrado = await repos.cofrinhos.encerrar({ id, familiaId });
  if (!encerrado) throw new CofrinhoNotFoundError(id);
  return encerrado;
}

/**
 * Aporte recorrente é único por cofrinho: verificado dentro da unidade, com a
 * linha já travada pelo UPDATE do saldo — duas requisições concorrentes não
 * passam ambas pela checagem.
 */
export async function exigirSemAporteRecorrente(
  cofrinhos: CofrinhoRepository,
  busca: BuscaAporteRecorrente,
): Promise<void> {
  const ativo = await cofrinhos.findAporteRecorrenteAtivo(busca);
  if (ativo) throw new AporteRecorrenteJaAtivoError();
}
