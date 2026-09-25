import { describe, expect, it } from 'vitest';

import { InMemoryReferenciaOwnershipRepository } from '../../shared/referencia-ownership/referencia-ownership.repository.js';
import {
  ReferenciaInvalidaError,
  ReferenciaOwnershipValidator,
} from '../../shared/referencia-ownership/referencia-ownership.validator.js';
import { InMemoryUnitOfWork } from '../../shared/unit-of-work/in-memory-unit-of-work.js';
import { InMemoryTransacaoRepository } from './transacao.repository.js';
import { TransacaoService } from './transacao.service.js';
import { InMemoryIdempotenciaRepository } from '../../shared/idempotencia/idempotencia.repository.js';

const FAMILIA_A = 'familia-a';
const FAMILIA_B = 'familia-b';

function setup() {
  const referencias = new InMemoryReferenciaOwnershipRepository();
  referencias.addCategoria({ id: 'cat-a', familiaId: FAMILIA_A, tipo: 'despesa', ativo: true });
  referencias.addCategoria({ id: 'cat-a2', familiaId: FAMILIA_A, tipo: 'despesa', ativo: true });
  referencias.addCategoria({
    id: 'cat-a-inativa',
    familiaId: FAMILIA_A,
    tipo: 'despesa',
    ativo: false,
  });
  referencias.addCategoria({
    id: 'cat-a-receita',
    familiaId: FAMILIA_A,
    tipo: 'receita',
    ativo: true,
  });
  referencias.addCategoria({ id: 'cat-b', familiaId: FAMILIA_B, tipo: 'despesa', ativo: true });
  referencias.addMetodoPagamento({ id: 'mp-a', familiaId: FAMILIA_A, ativo: true });
  referencias.addMetodoPagamento({ id: 'mp-b', familiaId: FAMILIA_B, ativo: true });

  const repository = new InMemoryTransacaoRepository();
  const service = new TransacaoService(
    repository,
    new ReferenciaOwnershipValidator(referencias),
    new InMemoryUnitOfWork({
      transacoes: repository,
      idempotencia: new InMemoryIdempotenciaRepository(),
    }),
  );
  return { repository, service, referencias };
}

const base = {
  familiaId: FAMILIA_A,
  tipo: 'despesa' as const,
  valor: '100.00',
  categoriaId: 'cat-a',
  descricao: 'Mercado',
  data: '2026-03-10',
  metodoPagamentoId: 'mp-a',
  metodoPagamentoTipo: null,
  dataFechamento: null,
  usuarioRegistrouId: 'u1',
};

async function totalGravado(repository: InMemoryTransacaoRepository, familiaId: string) {
  return (await repository.list({ familiaId })).length;
}

describe('TransacaoService — ownership de referências (#55)', () => {
  describe('registrar', () => {
    it('grava quando categoria e método são da família', async () => {
      const { service, repository } = setup();

      await service.registrar(base);

      expect(await totalGravado(repository, FAMILIA_A)).toBe(1);
    });

    it.each([
      ['categoria de outra família', { categoriaId: 'cat-b' }, 'categoria'],
      ['método de pagamento de outra família', { metodoPagamentoId: 'mp-b' }, 'metodoPagamento'],
      ['categoria inativa', { categoriaId: 'cat-a-inativa' }, 'categoria'],
      ['categoria de receita numa despesa', { categoriaId: 'cat-a-receita' }, 'categoria'],
    ])('rejeita %s sem gravar nada', async (_caso, override, entidade) => {
      const { service, repository } = setup();

      const erro = await service.registrar({ ...base, ...override }).catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(ReferenciaInvalidaError);
      expect((erro as ReferenciaInvalidaError).entidade).toBe(entidade);
      expect(await totalGravado(repository, FAMILIA_A)).toBe(0);
    });

    it('rejeita parcelada com referência de outra família antes de criar pai ou parcelas', async () => {
      const { service, repository } = setup();

      await expect(
        service.registrar({ ...base, categoriaId: 'cat-b', parcelado: true, numeroParcelas: 3 }),
      ).rejects.toBeInstanceOf(ReferenciaInvalidaError);

      expect(await totalGravado(repository, FAMILIA_A)).toBe(0);
    });

    it('rejeita recorrente com referência de outra família antes de gerar a série', async () => {
      const { service, repository } = setup();

      await expect(
        service.registrar({
          ...base,
          metodoPagamentoId: 'mp-b',
          recorrente: true,
          frequencia: 'mensal',
          dataFimRecorrencia: '2026-06-10',
        }),
      ).rejects.toBeInstanceOf(ReferenciaInvalidaError);

      expect(await totalGravado(repository, FAMILIA_A)).toBe(0);
    });
  });

  describe('editar', () => {
    it('rejeita trocar para categoria de outra família e mantém o registro intacto', async () => {
      const { service } = setup();
      const t = await service.registrar(base);

      await expect(
        service.editar({ ...base, id: t.id, categoriaId: 'cat-b' }),
      ).rejects.toBeInstanceOf(ReferenciaInvalidaError);

      expect((await service.detalhe({ id: t.id, familiaId: FAMILIA_A })).categoriaId).toBe('cat-a');
    });

    it('rejeita trocar para método de pagamento de outra família', async () => {
      const { service } = setup();
      const t = await service.registrar(base);

      await expect(
        service.editar({ ...base, id: t.id, metodoPagamentoId: 'mp-b' }),
      ).rejects.toBeInstanceOf(ReferenciaInvalidaError);
    });

    it('permite editar mantendo categoria que foi desativada depois do lançamento', async () => {
      const { service, referencias } = setup();
      const t = await service.registrar({ ...base, categoriaId: 'cat-a2' });
      referencias.setCategoriaAtiva('cat-a2', false);

      const editada = await service.editar({
        ...base,
        id: t.id,
        categoriaId: 'cat-a2',
        valor: '120.00',
      });

      expect(editada.valor).toBe('120.00');
    });

    it('rejeita trocar para uma categoria inativa', async () => {
      const { service } = setup();
      const t = await service.registrar(base);

      await expect(
        service.editar({ ...base, id: t.id, categoriaId: 'cat-a-inativa' }),
      ).rejects.toMatchObject({ motivo: 'inativa' });
    });
  });
});
