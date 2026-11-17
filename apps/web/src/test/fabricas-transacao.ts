import type { TransacaoCreateResponse, TransacaoListResponse } from '@nossagrana/types';

type Transacao = TransacaoListResponse['transacoes'][number];

/** Lançamento completo e tipado para os testes; sobrescreva só o que importa para o cenário. */
export const transacaoDeTeste = (sobrescritos: Partial<Transacao> = {}): Transacao => ({
  id: 'tx-1',
  familiaId: 'f1',
  tipo: 'despesa',
  valor: '10.00',
  categoriaId: 'c1',
  descricao: null,
  data: '2026-11-10',
  mesReferencia: '2026-11',
  metodoPagamentoId: null,
  usuarioRegistrouId: 'u1',
  recorrente: false,
  frequencia: null,
  dataFimRecorrencia: null,
  parcelado: false,
  numeroParcelas: null,
  parcelaAtual: null,
  valorTotal: null,
  valorParcela: null,
  transacaoPaiId: null,
  criadoEm: '2026-11-10T00:00:00Z',
  atualizadoEm: '2026-11-10T00:00:00Z',
  ...sobrescritos,
});

/** Resposta de `registrar` (e de `editar`, que tem o mesmo formato) com o id dado. */
export const respostaDeGravacao = (id: string): TransacaoCreateResponse => ({
  transacao: transacaoDeTeste({ id }),
});
