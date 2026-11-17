import type { TransacaoListResponse } from '@nossagrana/types';

import { formatBRLNumber } from './formatting';

type Transacao = TransacaoListResponse['transacoes'][number];

export interface DiaDoExtrato {
  data: string;
  transacoes: Transacao[];
  /** Entradas menos saídas do dia, em centavos. */
  totalCentavos: number;
}

export interface ResumoDoPeriodo {
  entradasCentavos: number;
  saidasCentavos: number;
  saldoCentavos: number;
}

/**
 * Converte o valor da API (texto com ponto decimal, ex. `'129.90'`) em centavos inteiros.
 * Somar centavos evita o erro de ponto flutuante de somar reais (0,10 + 0,20).
 */
export const paraCentavos = (valor: string): number => Math.round(parseFloat(valor) * 100);

/** Valor do lançamento em centavos, positivo na receita e negativo na despesa. */
export const valorAssinadoCentavos = (t: Transacao): number =>
  t.tipo === 'receita' ? paraCentavos(t.valor) : -paraCentavos(t.valor);

/**
 * Agrupa por dia (`data` é AAAA-MM-DD, comparada como texto, sem fuso), do mais recente para o
 * mais antigo. Dentro do dia mantém a ordem que a API devolveu.
 */
export const agruparPorDia = (transacoes: Transacao[]): DiaDoExtrato[] => {
  const porData = new Map<string, Transacao[]>();
  for (const t of transacoes) {
    const doDia = porData.get(t.data);
    if (doDia) doDia.push(t);
    else porData.set(t.data, [t]);
  }
  return [...porData.keys()]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .map((data) => {
      const doDia = porData.get(data) ?? [];
      const totalCentavos = doDia.reduce((soma, t) => soma + valorAssinadoCentavos(t), 0);
      return { data, transacoes: doDia, totalCentavos };
    });
};

/** Data local ao meio-dia: fora da virada de horário de verão, e nunca a data UTC de `new Date('AAAA-MM-DD')`. */
const dataLocal = (dataISO: string, deslocamentoDias = 0): Date => {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  return new Date(ano, mes - 1, dia + deslocamentoDias, 12);
};

const paraISO = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const semPonto = (texto: string): string => texto.replace('.', '');

const maiuscula = (texto: string): string => texto.charAt(0).toUpperCase() + texto.slice(1);

const formatarDiaEMes = (d: Date): string => {
  const semana = semPonto(d.toLocaleDateString('pt-BR', { weekday: 'short' }));
  const mes = semPonto(d.toLocaleDateString('pt-BR', { month: 'short' }));
  return `${semana}, ${d.getDate()} ${mes}`;
};

/**
 * Rótulo do cabeçalho de dia: "Hoje · seg, 16 nov", "Ontem · dom, 15 nov" e "Sex, 13 nov".
 * `hoje` vem de `getTodayLocalISO`, para o rótulo seguir o dia do aparelho.
 */
export const rotuloDoDia = (data: string, hoje: string): string => {
  const rotulo = formatarDiaEMes(dataLocal(data));
  if (data === hoje) return `Hoje · ${rotulo}`;
  if (data === paraISO(dataLocal(hoje, -1))) return `Ontem · ${rotulo}`;
  return maiuscula(rotulo);
};

/** Entradas, saídas e saldo de um conjunto de lançamentos, em centavos. */
export const resumoDoPeriodo = (transacoes: Transacao[]): ResumoDoPeriodo => {
  let entradasCentavos = 0;
  let saidasCentavos = 0;
  for (const t of transacoes) {
    if (t.tipo === 'receita') entradasCentavos += paraCentavos(t.valor);
    else saidasCentavos += paraCentavos(t.valor);
  }
  return { entradasCentavos, saidasCentavos, saldoCentavos: entradasCentavos - saidasCentavos };
};

const formatarCentavos = (centavos: number): string => formatBRLNumber(centavos / 100);

/** "+R$ 120,00" para entrada, "−R$ 45,50" para saída e "R$ 0,00" para zero. */
export const formatarComSinal = (centavos: number): string => {
  if (centavos > 0) return `+${formatarCentavos(centavos)}`;
  if (centavos < 0) return `\u2212${formatarCentavos(-centavos)}`;
  return formatarCentavos(0);
};

/** Nome do mês por extenso e em minúsculo ("novembro"), a partir de AAAA-MM. */
export const nomeDoMes = (mesReferencia: string): string => {
  const [ano, mes] = mesReferencia.split('-').map(Number);
  return new Date(ano, mes - 1, 1, 12).toLocaleDateString('pt-BR', { month: 'long' });
};

/** CSV do extrato (sem o BOM, que quem grava o arquivo acrescenta): uma linha por lançamento. */
export const montarCsv = (
  transacoes: Transacao[],
  nomeDaCategoria: (id: string | null) => string,
  nomeDoMetodo: (id: string | null) => string,
): string => {
  const cabecalho = ['Data', 'Descrição', 'Categoria', 'Pagamento', 'Tipo', 'Valor'];
  const linhas = transacoes.map((t) => [
    t.data,
    t.descricao ?? '',
    nomeDaCategoria(t.categoriaId),
    nomeDoMetodo(t.metodoPagamentoId),
    t.tipo,
    t.valor,
  ]);
  return [cabecalho, ...linhas].map((linha) => linha.map((c) => `"${c}"`).join(',')).join('\n');
};
