/**
 * Datas dos testes no fuso do app (America/Sao_Paulo). `toISOString()` é UTC: das 21h às 24h do
 * último dia do mês ele já devolve o mês seguinte, e o teste olharia o mês errado.
 */

/** Data de hoje (AAAA-MM-DD) em São Paulo. */
export const hojeEmSaoPaulo = (): string =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
