import { adicionarDias, adicionarMeses } from '../../utils/date.js';
import { calcularMesReferencia } from './mes-referencia.service.js';
import type { CreateTransacaoInput, RegistrarTransacaoInput } from './transacao.types.js';

/** Maximo de recorrencias quando ha data fim definida */
const MAX_RECORRENCIAS_COM_FIM = 120;
/** Maximo de recorrencias adicionais quando nao ha data fim */
const MAX_RECORRENCIAS_SEM_FIM = 24;

type Frequencia = 'mensal' | 'semanal' | 'quinzenal';
type FilhaSemPai = Omit<CreateTransacaoInput, 'transacaoPaiId'>;

/**
 * Tudo que o registro vai gravar, montado ANTES de abrir a transação (#85):
 * datas, mês de referência e quantidade de filhas já estão decididos quando
 * a primeira escrita acontece; só `transacaoPaiId` depende do insert do pai.
 */
export interface PlanoRegistro {
  pai: CreateTransacaoInput;
  filhas: FilhaSemPai[];
  /** Cofrinho movimentado por filha — hoje só recorrências com cofrinho. */
  cofrinhoDasFilhas: string | null;
}

function calcularValorParcela(valorTotal: string, numeroParcelas: number): string {
  const total = parseFloat(valorTotal);
  const parcela = Math.round((total / numeroParcelas) * 100) / 100;
  return parcela.toFixed(2);
}

function mesReferenciaDe(input: RegistrarTransacaoInput, data: string): string {
  return calcularMesReferencia({
    data: new Date(`${data}T12:00:00Z`),
    tipo: input.metodoPagamentoTipo ?? null,
    dataFechamento: input.dataFechamento ?? null,
  });
}

/** Campos comuns a pai e filhas de qualquer modalidade, para a `data` dada. */
function lancamentoEm(input: RegistrarTransacaoInput, data: string): CreateTransacaoInput {
  return {
    familiaId: input.familiaId,
    tipo: input.tipo,
    valor: input.valor,
    categoriaId: input.categoriaId,
    descricao: input.descricao ?? null,
    data,
    mesReferencia: mesReferenciaDe(input, data),
    metodoPagamentoId: input.metodoPagamentoId ?? null,
    usuarioRegistrouId: input.usuarioRegistrouId,
  };
}

function planejarParcelado(input: RegistrarTransacaoInput, numeroParcelas: number): PlanoRegistro {
  const valorParcela = calcularValorParcela(input.valor, numeroParcelas);
  const parcela = { parcelado: true, numeroParcelas, valorTotal: input.valor, valorParcela };
  const pai = { ...lancamentoEm(input, input.data), ...parcela, parcelaAtual: 1 };
  // Parcelas 2..N: a 1ª é o próprio pai
  const filhas = Array.from({ length: numeroParcelas - 1 }, (_, indice) => ({
    ...lancamentoEm(input, adicionarMeses(input.data, indice + 1)),
    ...parcela,
    valor: valorParcela,
    parcelaAtual: indice + 2,
  }));
  return { pai, filhas, cofrinhoDasFilhas: null };
}

function proximaData(data: string, frequencia: Frequencia): string {
  if (frequencia === 'mensal') return adicionarMeses(data, 1);
  if (frequencia === 'quinzenal') return adicionarDias(data, 15);
  return adicionarDias(data, 7); // semanal
}

function datasDasRecorrencias(inicio: string, frequencia: Frequencia, fim: string | null) {
  const limite = fim ? MAX_RECORRENCIAS_COM_FIM : MAX_RECORRENCIAS_SEM_FIM;
  const datas: string[] = [];
  let data = proximaData(inicio, frequencia);
  while (datas.length < limite && (!fim || data <= fim)) {
    datas.push(data);
    data = proximaData(data, frequencia);
  }
  return datas;
}

function planejarRecorrente(input: RegistrarTransacaoInput, frequencia: Frequencia): PlanoRegistro {
  const dataFimRecorrencia = input.dataFimRecorrencia ?? null;
  const cofrinhoId = input.cofrinhoId ?? null;
  const serie = { recorrente: true, frequencia, dataFimRecorrencia, cofrinhoId };
  const filhas = datasDasRecorrencias(input.data, frequencia, dataFimRecorrencia).map((data) => ({
    ...lancamentoEm(input, data),
    ...serie,
  }));
  return {
    pai: { ...lancamentoEm(input, input.data), ...serie },
    filhas,
    cofrinhoDasFilhas: cofrinhoId,
  };
}

/** Parcelamento só vale com 2+ parcelas; senão cai nas demais modalidades. */
function parcelasDe(input: RegistrarTransacaoInput): number | null {
  if (!input.parcelado || !input.numeroParcelas || input.numeroParcelas <= 1) return null;
  return input.numeroParcelas;
}

/** Monta o plano de gravação (parcelada, recorrente ou simples) sem tocar no banco. */
export function planejarRegistro(input: RegistrarTransacaoInput): PlanoRegistro {
  const numeroParcelas = parcelasDe(input);
  if (numeroParcelas) return planejarParcelado(input, numeroParcelas);
  if (input.recorrente && input.frequencia) return planejarRecorrente(input, input.frequencia);
  const pai = { ...lancamentoEm(input, input.data), cofrinhoId: input.cofrinhoId ?? null };
  return { pai, filhas: [], cofrinhoDasFilhas: null };
}
