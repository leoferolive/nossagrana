/** Adiciona meses a uma data no formato "YYYY-MM-DD" */
export function adicionarMeses(dataStr: string, meses: number): string {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1 + meses, dia));
  return d.toISOString().slice(0, 10);
}

/** Adiciona dias a uma data no formato "YYYY-MM-DD" */
export function adicionarDias(dataStr: string, dias: number): string {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return d.toISOString().slice(0, 10);
}

/** Compute YYYY-MM that is N months before mesReferencia */
export function mesAntesN(mesReferencia: string, n: number): string {
  const [ano, mes] = mesReferencia.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1 - n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Subtrai 1 mes de YYYY-MM */
export function mesAnterior(mesReferencia: string): string {
  const [ano, mes] = mesReferencia.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Retorna numero de dias do mes YYYY-MM */
export function diasNoMes(mesReferencia: string): number {
  const [ano, mes] = mesReferencia.split('-').map(Number);
  return new Date(ano, mes, 0).getDate();
}
