/**
 * UC31 — Calcular Mês de Referência
 *
 * - Métodos não-crédito: mês da data da transação
 * - Crédito sem dataFechamento: mês da data da transação
 * - Crédito com dataFechamento:
 *   - dia da transação <= dataFechamento → mês atual
 *   - dia da transação > dataFechamento  → próximo mês
 *
 * Retorna string no formato "YYYY-MM"
 */
export function calcularMesReferencia(input: {
  data: Date;
  tipo?: 'credito' | 'debito' | 'pix' | 'dinheiro' | null;
  dataFechamento?: number | null;
}): string {
  const { data, tipo, dataFechamento } = input;

  const ano = data.getUTCFullYear();
  const mes = data.getUTCMonth(); // 0-indexed
  const dia = data.getUTCDate();

  const formatarMes = (y: number, m: number) => {
    const mesFormatado = String(m + 1).padStart(2, '0');
    return `${y}-${mesFormatado}`;
  };

  if (tipo === 'credito' && dataFechamento != null) {
    if (dia > dataFechamento) {
      // próximo mês
      const proximoMes = mes + 1;
      if (proximoMes > 11) {
        return formatarMes(ano + 1, 0);
      }
      return formatarMes(ano, proximoMes);
    }
  }

  return formatarMes(ano, mes);
}
