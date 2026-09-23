import { describe, expect, it } from 'vitest';

import { InMemoryReferenciaOwnershipRepository } from './referencia-ownership.repository.js';
import {
  ReferenciaInvalidaError,
  ReferenciaOwnershipValidator,
  referenciaEsperada,
} from './referencia-ownership.validator.js';

const FAMILIA_A = '00000000-0000-4000-8000-00000000000a';
const FAMILIA_B = '00000000-0000-4000-8000-00000000000b';

function setup() {
  const repository = new InMemoryReferenciaOwnershipRepository();
  repository.addCategoria({ id: 'cat-a', familiaId: FAMILIA_A, tipo: 'despesa', ativo: true });
  repository.addCategoria({
    id: 'cat-a-inativa',
    familiaId: FAMILIA_A,
    tipo: 'despesa',
    ativo: false,
  });
  repository.addCategoria({ id: 'cat-b', familiaId: FAMILIA_B, tipo: 'despesa', ativo: true });
  repository.addMetodoPagamento({ id: 'mp-a', familiaId: FAMILIA_A, ativo: true });
  repository.addMetodoPagamento({ id: 'mp-a-inativo', familiaId: FAMILIA_A, ativo: false });
  repository.addMetodoPagamento({ id: 'mp-b', familiaId: FAMILIA_B, ativo: true });
  repository.addCofrinho({ id: 'cf-a', familiaId: FAMILIA_A, ativo: true });
  repository.addCofrinho({ id: 'cf-a-encerrado', familiaId: FAMILIA_A, ativo: false });
  repository.addCofrinho({ id: 'cf-b', familiaId: FAMILIA_B, ativo: true });
  return new ReferenciaOwnershipValidator(repository);
}

async function rejeicao(promise: Promise<void>): Promise<ReferenciaInvalidaError> {
  const erro = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(erro).toBeInstanceOf(ReferenciaInvalidaError);
  return erro as ReferenciaInvalidaError;
}

describe('ReferenciaOwnershipValidator', () => {
  it('aceita referências ativas da própria família', async () => {
    const validator = setup();

    await expect(
      validator.validar({
        familiaId: FAMILIA_A,
        categoria: { id: 'cat-a', exigirAtiva: true, tipo: 'despesa' },
        metodoPagamento: { id: 'mp-a', exigirAtiva: true },
        cofrinho: { id: 'cf-a', exigirAtiva: true },
      }),
    ).resolves.toBeUndefined();
  });

  it('aceita quando nenhuma referência é informada', async () => {
    await expect(setup().validar({ familiaId: FAMILIA_A })).resolves.toBeUndefined();
  });

  it.each([
    ['categoria', { categoria: { id: 'cat-b', exigirAtiva: true } }, 'cat-b'],
    ['metodoPagamento', { metodoPagamento: { id: 'mp-b', exigirAtiva: true } }, 'mp-b'],
    ['cofrinho', { cofrinho: { id: 'cf-b', exigirAtiva: true } }, 'cf-b'],
  ] as const)('rejeita %s de outra família como não encontrado', async (entidade, refs, id) => {
    const erro = await rejeicao(setup().validar({ familiaId: FAMILIA_A, ...refs }));

    expect(erro.entidade).toBe(entidade);
    expect(erro.motivo).toBe('nao_encontrada');
    expect(erro.statusCode).toBe(422);
    expect(erro.code).toBe('REFERENCIA_INVALIDA');
    expect(erro.message).toContain(`"${id}"`);
    expect(erro.message).toContain(FAMILIA_A);
    // Nunca revela a família dona do registro.
    expect(erro.message).not.toContain(FAMILIA_B);
  });

  it('trata ID de outra família exatamente como ID inexistente', async () => {
    const validator = setup();
    const outraFamilia = await rejeicao(
      validator.validar({ familiaId: FAMILIA_A, categoria: { id: 'cat-b', exigirAtiva: true } }),
    );
    const inexistente = await rejeicao(
      validator.validar({ familiaId: FAMILIA_A, categoria: { id: 'cat-x', exigirAtiva: true } }),
    );

    expect(outraFamilia.message.replace('cat-b', 'ID')).toBe(
      inexistente.message.replace('cat-x', 'ID'),
    );
  });

  it.each([
    ['categoria', { categoria: { id: 'cat-a-inativa', exigirAtiva: true } }],
    ['metodoPagamento', { metodoPagamento: { id: 'mp-a-inativo', exigirAtiva: true } }],
    ['cofrinho', { cofrinho: { id: 'cf-a-encerrado', exigirAtiva: true } }],
  ] as const)('rejeita %s inativo quando a referência é nova', async (entidade, refs) => {
    const erro = await rejeicao(setup().validar({ familiaId: FAMILIA_A, ...refs }));

    expect(erro.entidade).toBe(entidade);
    expect(erro.motivo).toBe('inativa');
  });

  it('aceita referências inativas quando não são exigidas ativas (vínculo já existente)', async () => {
    await expect(
      setup().validar({
        familiaId: FAMILIA_A,
        categoria: { id: 'cat-a-inativa', exigirAtiva: false },
        metodoPagamento: { id: 'mp-a-inativo', exigirAtiva: false },
        cofrinho: { id: 'cf-a-encerrado', exigirAtiva: false },
      }),
    ).resolves.toBeUndefined();
  });

  it('continua rejeitando outra família mesmo sem exigir ativa', async () => {
    const erro = await rejeicao(
      setup().validar({ familiaId: FAMILIA_A, categoria: { id: 'cat-b', exigirAtiva: false } }),
    );

    expect(erro.motivo).toBe('nao_encontrada');
  });

  it('rejeita categoria de tipo incompatível com o lançamento', async () => {
    const erro = await rejeicao(
      setup().validar({
        familiaId: FAMILIA_A,
        categoria: { id: 'cat-a', exigirAtiva: true, tipo: 'receita' },
      }),
    );

    expect(erro.entidade).toBe('categoria');
    expect(erro.motivo).toBe('tipo_incompativel');
    expect(erro.message).toContain('despesa');
    expect(erro.message).toContain('receita');
  });
});

describe('referenciaEsperada', () => {
  it('retorna undefined quando o ID não foi informado', () => {
    expect(referenciaEsperada(undefined)).toBeUndefined();
    expect(referenciaEsperada(null)).toBeUndefined();
  });

  it('exige ativa para referência nova', () => {
    expect(referenciaEsperada('cat-a')).toEqual({ id: 'cat-a', exigirAtiva: true });
  });

  it('exige ativa quando a referência mudou', () => {
    expect(referenciaEsperada('cat-nova', 'cat-antiga')).toEqual({
      id: 'cat-nova',
      exigirAtiva: true,
    });
  });

  it('não exige ativa quando a referência é a mesma já gravada', () => {
    expect(referenciaEsperada('cat-a', 'cat-a')).toEqual({ id: 'cat-a', exigirAtiva: false });
  });
});
