import { ErroComEnvelopeHttp } from '../http/erro-com-envelope.js';

/** Formato aceito para `Idempotency-Key`: 8–128 caracteres `[A-Za-z0-9_-]` (UUID v4 serve). */
export const FORMATO_CHAVE_IDEMPOTENCIA = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Header presente mas fora do formato. O valor não é ecoado: é controlado
 * pelo cliente e pode ser longo; basta dizer o tamanho e o formato esperado.
 */
export class ChaveIdempotenciaInvalidaError extends ErroComEnvelopeHttp {
  readonly statusHttp = 400;
  readonly code = 'IDEMPOTENCIA_CHAVE_INVALIDA';

  constructor(tamanhoRecebido: number) {
    super(
      `Header Idempotency-Key inválido: recebido valor com ${tamanhoRecebido} caractere(s), ` +
        'esperado 8 a 128 caracteres entre A-Z, a-z, 0-9, "_" e "-" (ex.: um UUID)',
    );
    this.name = 'ChaveIdempotenciaInvalidaError';
  }
}

/** Mesma chave já usada (na mesma família) para outra operação ou outro payload. */
export class IdempotenciaConflitoError extends ErroComEnvelopeHttp {
  readonly statusHttp = 422;
  readonly code = 'IDEMPOTENCIA_CONFLITO';

  constructor(chave: string, operacaoGravada: string, operacaoRecebida: string) {
    super(
      `Idempotency-Key "${chave}" já usada nas últimas 24h em outra requisição da família ` +
        `(gravada: ${operacaoGravada}; recebida: ${operacaoRecebida}, com operação ou payload ` +
        'diferente). Esperado: repetir a chave só para reenviar exatamente a mesma requisição — ' +
        'gere uma chave nova para uma nova operação',
    );
    this.name = 'IdempotenciaConflitoError';
  }
}
