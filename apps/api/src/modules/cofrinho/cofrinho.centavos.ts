/**
 * Faixa de `numeric(12,2)` (até 10 dígitos inteiros, 2 casas), com sinal
 * opcional porque saldos intermediários e diferenças podem ser negativos. O
 * schema Zod de aporte/retirada é mais estrito (só positivos, sem sinal).
 */
const DECIMAL_2_CASAS = /^(-?)(\d{1,10})(?:\.(\d{1,2}))?$/;

/**
 * Converte decimal em string para centavos inteiros, sem ponto flutuante
 * (0.1 + 0.2 = 0.30 exato). Usado pelo InMemory e pela reconciliação; no
 * PostgreSQL a aritmética é feita em `numeric`.
 *
 * @example paraCentavos('12.3') // 1230
 */
export function paraCentavos(valor: string): number {
  const partes = DECIMAL_2_CASAS.exec(valor);
  if (!partes) {
    throw new Error(
      `Valor monetário inválido: recebido "${valor}", esperado decimal com até 2 casas`,
    );
  }
  const [, sinal, inteiro, fracao = ''] = partes;
  const centavos = Number(inteiro) * 100 + Number(fracao.padEnd(2, '0'));
  return sinal ? -centavos : centavos;
}

/** @example deCentavos(1230) // '12.30' */
export function deCentavos(centavos: number): string {
  const sinal = centavos < 0 ? '-' : '';
  const absoluto = Math.abs(centavos);
  const fracao = String(absoluto % 100).padStart(2, '0');
  return `${sinal}${Math.floor(absoluto / 100)}.${fracao}`;
}
