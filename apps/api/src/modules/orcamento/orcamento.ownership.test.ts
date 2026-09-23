import { describe, expect, it } from 'vitest';

import { InMemoryReferenciaOwnershipRepository } from '../../shared/referencia-ownership/referencia-ownership.repository.js';
import {
  ReferenciaInvalidaError,
  ReferenciaOwnershipValidator,
} from '../../shared/referencia-ownership/referencia-ownership.validator.js';
import { InMemoryOrcamentoRepository } from './orcamento.repository.js';
import { OrcamentoService } from './orcamento.service.js';

const FAMILIA_A = 'familia-a';
const FAMILIA_B = 'familia-b';

function setup() {
  const referencias = new InMemoryReferenciaOwnershipRepository();
  referencias.addCategoria({ id: 'cat-a', familiaId: FAMILIA_A, tipo: 'despesa', ativo: true });
  referencias.addCategoria({
    id: 'cat-a-inativa',
    familiaId: FAMILIA_A,
    tipo: 'despesa',
    ativo: false,
  });
  referencias.addCategoria({ id: 'cat-b', familiaId: FAMILIA_B, tipo: 'despesa', ativo: true });
  const repo = new InMemoryOrcamentoRepository();
  const service = new OrcamentoService(repo, new ReferenciaOwnershipValidator(referencias));
  return { repo, service, referencias };
}

const definir = (categoriaId: string, valorLimite = '500.00') => ({
  familiaId: FAMILIA_A,
  categoriaId,
  usuarioId: 'u1',
  valorLimite,
  vigenciaInicio: '2026-03',
});

describe('OrcamentoService — ownership de categoria (#55)', () => {
  it('define orçamento para categoria da própria família', async () => {
    const { service } = setup();

    await service.set(definir('cat-a'));

    expect((await service.historico(FAMILIA_A, 'cat-a')).historico).toHaveLength(1);
  });

  it('rejeita categoria de outra família sem gravar orçamento', async () => {
    const { service } = setup();

    await expect(service.set(definir('cat-b'))).rejects.toBeInstanceOf(ReferenciaInvalidaError);

    expect((await service.historico(FAMILIA_A, 'cat-b')).historico).toHaveLength(0);
  });

  it('rejeita novo orçamento para categoria inativa', async () => {
    const { service } = setup();

    await expect(service.set(definir('cat-a-inativa'))).rejects.toMatchObject({
      motivo: 'inativa',
    });
  });

  it('permite ajustar orçamento já existente de categoria desativada depois', async () => {
    const { service, referencias } = setup();
    await service.set(definir('cat-a'));
    referencias.setCategoriaAtiva('cat-a', false);

    await service.set({ ...definir('cat-a', '800.00'), vigenciaInicio: '2026-04' });

    const { historico } = await service.historico(FAMILIA_A, 'cat-a');
    expect(historico.map((h) => h.valorLimite)).toContain('800.00');
  });
});
