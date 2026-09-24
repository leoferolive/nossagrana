/**
 * Erros de domínio do cofrinho. Mensagens citam o ID/valor recebido e o
 * esperado, sem dados de outra família: "não encontrado" cobre tanto o
 * inexistente quanto o de outra família (não revela que o ID existe).
 */
export class CofrinhoNotFoundError extends Error {
  constructor(cofrinhoId?: string) {
    const detalhe = cofrinhoId ? `: recebido "${cofrinhoId}"` : '';
    super(`Cofrinho nao encontrado${detalhe}, esperado ID de cofrinho da família ativa`);
  }
}

export class CofrinhoEncerradoError extends Error {
  constructor(cofrinhoId?: string) {
    const detalhe = cofrinhoId ? ` (${cofrinhoId})` : '';
    super(`Cofrinho esta encerrado${detalhe}: esperado cofrinho com status "ativo"`);
  }
}

export class SaldoInsuficienteError extends Error {
  constructor(valor?: string) {
    const detalhe = valor ? `: solicitado ${valor}` : '';
    super(`Saldo insuficiente para esta retirada${detalhe}, esperado valor <= saldo do cofrinho`);
  }
}

export class AporteRecorrenteJaAtivoError extends Error {
  constructor() {
    super('Este cofrinho ja possui um aporte recorrente ativo');
  }
}

export class AporteRecorrenteNotFoundError extends Error {
  constructor() {
    super('Nenhum aporte recorrente ativo encontrado');
  }
}

/**
 * Aporte recorrente pedido sem a porta `TransacaoRecorrenteCreator` injetada
 * (produção hoje): falha ANTES de qualquer escrita, em vez de TypeError/500.
 */
export class AporteRecorrenteIndisponivelError extends Error {
  constructor(frequencia: string) {
    super(
      `Aporte recorrente indisponível: recebido recorrente=true com frequencia "${frequencia}", ` +
        'esperado aporte simples (recorrente=false)',
    );
  }
}

/**
 * DELETE da série recorrente sem a porta `TransacaoRecorrenteCreator`
 * injetada (produção hoje): a série existe, mas não há como cancelá-la aqui.
 */
export class CancelamentoRecorrenteIndisponivelError extends Error {
  constructor(transacaoPaiId: string) {
    super(
      `Cancelamento de aporte recorrente indisponível: série "${transacaoPaiId}" encontrada, ` +
        'esperado serviço de recorrência configurado para cancelá-la',
    );
  }
}
