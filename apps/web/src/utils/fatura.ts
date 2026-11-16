import { shiftMonth } from './date';

const doisDigitos = (n: number): string => String(n).padStart(2, '0');

const ultimoDiaDoMes = (mesReferencia: string): number => {
  const [ano, mes] = mesReferencia.split('-').map(Number);
  return new Date(ano, mes, 0).getDate();
};

/**
 * Quando vence a fatura do mês de referência (`DD/MM`), ou `null` se o cartão não tem
 * vencimento cadastrado. Vencimento no dia do fechamento ou antes dele cai no mês seguinte
 * (fecha dia 28, vence dia 5); dia que o mês não tem vence no último dia do mês.
 */
export const vencimentoDaFatura = (
  mesReferencia: string,
  fechamento: number | null,
  vencimento: number | null,
): string | null => {
  if (vencimento === null) return null;
  const venceNoMesSeguinte = fechamento !== null && vencimento <= fechamento;
  const mesDoVencimento = venceNoMesSeguinte ? shiftMonth(mesReferencia, 1) : mesReferencia;
  const dia = Math.min(vencimento, ultimoDiaDoMes(mesDoVencimento));
  return `${doisDigitos(dia)}/${mesDoVencimento.slice(5)}`;
};
