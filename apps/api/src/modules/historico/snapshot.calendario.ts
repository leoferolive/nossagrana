/** Fuso do negócio: o fechamento mensal é decidido no calendário de Brasília, nunca no do processo. */
export const FUSO_FECHAMENTO = 'America/Sao_Paulo';

export interface DataLocal {
  ano: number;
  mes: number;
  dia: number;
}

/** Ano/mês/dia de `instante` no fuso `timeZone`, independente do TZ do processo (o pod roda em UTC). */
export function dataLocalDe(instante: Date, timeZone: string): DataLocal {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instante);
  const valor = (tipo: string): number => Number(partes.find((p) => p.type === tipo)!.value);
  return { ano: valor('year'), mes: valor('month'), dia: valor('day') };
}

/** `true` se, no fuso dado, `agora` cai no último dia do mês (considera fevereiro bissexto). */
export function ehUltimoDiaDoMes(agora: Date, timeZone: string = FUSO_FECHAMENTO): boolean {
  const { ano, mes, dia } = dataLocalDe(agora, timeZone);
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return dia === diasNoMes;
}

/** Mês (`YYYY-MM`) do dia que está fechando, no fuso dado. */
export function getMesReferencia(agora: Date, timeZone: string = FUSO_FECHAMENTO): string {
  const { ano, mes } = dataLocalDe(agora, timeZone);
  return `${ano}-${String(mes).padStart(2, '0')}`;
}
