import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryOrcamentoRepository } from './orcamento.repository.js';
import { OrcamentoService } from './orcamento.service.js';

describe('OrcamentoService', () => {
  let repo: InMemoryOrcamentoRepository;
  let service: OrcamentoService;
  const familiaId = 'fam-1';
  const categoriaId = 'cat-1';
  const usuarioId = 'usr-1';

  beforeEach(() => {
    repo = new InMemoryOrcamentoRepository();
    service = new OrcamentoService(repo);
  });

  it('retorna lista vazia quando nao ha orcamentos', async () => {
    const result = await service.list(familiaId, '2026-03');
    expect(result.orcamentos).toEqual([]);
  });

  it('define orcamento para categoria e retorna na listagem', async () => {
    await service.set({
      familiaId,
      categoriaId,
      usuarioId,
      valorLimite: '500.00',
      vigenciaInicio: '2026-03',
    });
    const result = await service.list(familiaId, '2026-03');
    expect(result.orcamentos).toHaveLength(1);
    expect(result.orcamentos[0].categoriaId).toBe(categoriaId);
    expect(result.orcamentos[0].valorLimite).toBe('500.00');
    expect(result.orcamentos[0].totalGasto).toBe('0.00');
    expect(result.orcamentos[0].percentual).toBe(0);
    expect(result.orcamentos[0].status).toBe('ok');
  });

  it('calcula percentual e status warning quando gasto >= 80%', async () => {
    repo.seedTransacao({ familiaId, categoriaId, mesReferencia: '2026-03', valor: '420.00' });
    await service.set({
      familiaId,
      categoriaId,
      usuarioId,
      valorLimite: '500.00',
      vigenciaInicio: '2026-03',
    });
    const result = await service.list(familiaId, '2026-03');
    expect(result.orcamentos[0].percentual).toBe(84);
    expect(result.orcamentos[0].status).toBe('warning');
  });

  it('calcula status exceeded quando gasto >= 100%', async () => {
    repo.seedTransacao({ familiaId, categoriaId, mesReferencia: '2026-03', valor: '600.00' });
    await service.set({
      familiaId,
      categoriaId,
      usuarioId,
      valorLimite: '500.00',
      vigenciaInicio: '2026-03',
    });
    const result = await service.list(familiaId, '2026-03');
    expect(result.orcamentos[0].status).toBe('exceeded');
  });

  it('encerra orcamento anterior ao definir novo com vigencia posterior', async () => {
    await service.set({
      familiaId,
      categoriaId,
      usuarioId,
      valorLimite: '500.00',
      vigenciaInicio: '2026-01',
    });
    await service.set({
      familiaId,
      categoriaId,
      usuarioId,
      valorLimite: '800.00',
      vigenciaInicio: '2026-03',
    });
    const historico = await service.historico(familiaId, categoriaId);
    expect(historico.historico).toHaveLength(2);
    const anterior = historico.historico.find((h) => h.valorLimite === '500.00');
    expect(anterior?.vigenciaFim).toBe('2026-02');
    const novo = historico.historico.find((h) => h.valorLimite === '800.00');
    expect(novo?.vigenciaFim).toBeNull();
  });

  it('retorna historico por categoria ordenado por vigenciaInicio desc', async () => {
    await service.set({
      familiaId,
      categoriaId,
      usuarioId,
      valorLimite: '300.00',
      vigenciaInicio: '2026-01',
    });
    await service.set({
      familiaId,
      categoriaId,
      usuarioId,
      valorLimite: '500.00',
      vigenciaInicio: '2026-03',
    });
    const result = await service.historico(familiaId, categoriaId);
    expect(result.historico[0].valorLimite).toBe('500.00');
    expect(result.historico[1].valorLimite).toBe('300.00');
  });
});
