import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryRelatorioRepository } from './relatorio.repository.js';
import { RelatorioService } from './relatorio.service.js';

describe('RelatorioService', () => {
  let repo: InMemoryRelatorioRepository;
  let service: RelatorioService;
  const familiaId = 'fam-1';

  beforeEach(() => {
    repo = new InMemoryRelatorioRepository();
    service = new RelatorioService(repo);
  });

  it('distribuicao retorna lista vazia quando nao ha despesas', async () => {
    const result = await service.distribuicao(familiaId, '2026-03');
    expect(result.distribuicao).toEqual([]);
    expect(result.mesReferencia).toBe('2026-03');
  });

  it('distribuicao calcula percentual por categoria', async () => {
    repo.seed({
      transacoes: [
        {
          familiaId,
          tipo: 'despesa',
          valor: '200.00',
          categoriaId: 'cat-1',
          categoriaNome: 'Alimentação',
          mesReferencia: '2026-03',
          usuarioId: 'usr-1',
          usuarioNome: 'Leo',
        },
        {
          familiaId,
          tipo: 'despesa',
          valor: '100.00',
          categoriaId: 'cat-2',
          categoriaNome: 'Lazer',
          mesReferencia: '2026-03',
          usuarioId: 'usr-1',
          usuarioNome: 'Leo',
        },
      ],
    });
    const result = await service.distribuicao(familiaId, '2026-03');
    expect(result.distribuicao).toHaveLength(2);
    const alimentacao = result.distribuicao.find((d) => d.categoriaNome === 'Alimentação')!;
    expect(alimentacao.percentual).toBeCloseTo(66.7, 0);
  });

  it('porUsuario retorna gastos agrupados por usuario', async () => {
    repo.seed({
      transacoes: [
        {
          familiaId,
          tipo: 'despesa',
          valor: '300.00',
          categoriaId: 'cat-1',
          categoriaNome: 'Alimentação',
          mesReferencia: '2026-03',
          usuarioId: 'usr-1',
          usuarioNome: 'Leo',
        },
        {
          familiaId,
          tipo: 'despesa',
          valor: '100.00',
          categoriaId: 'cat-1',
          categoriaNome: 'Alimentação',
          mesReferencia: '2026-03',
          usuarioId: 'usr-2',
          usuarioNome: 'Ana',
        },
      ],
    });
    const result = await service.porUsuario(familiaId, '2026-03');
    expect(result.porUsuario).toHaveLength(2);
    const leo = result.porUsuario.find((u) => u.usuarioNome === 'Leo')!;
    expect(leo.total).toBe('300.00');
    expect(leo.percentual).toBe(75);
  });

  it('tendencias retorna N meses regressivos com totais', async () => {
    repo.seed({
      transacoes: [
        {
          familiaId,
          tipo: 'receita',
          valor: '5000.00',
          categoriaId: 'cat-1',
          categoriaNome: 'Salário',
          mesReferencia: '2026-03',
          usuarioId: 'usr-1',
          usuarioNome: 'Leo',
        },
        {
          familiaId,
          tipo: 'despesa',
          valor: '2000.00',
          categoriaId: 'cat-2',
          categoriaNome: 'Alimentação',
          mesReferencia: '2026-03',
          usuarioId: 'usr-1',
          usuarioNome: 'Leo',
        },
      ],
    });
    const result = await service.tendencias(familiaId, '2026-03', 3);
    expect(result.meses).toHaveLength(3);
    const marco = result.meses.find((m) => m.mesReferencia === '2026-03')!;
    expect(marco.totalReceitas).toBe('5000.00');
    expect(marco.totalDespesas).toBe('2000.00');
    expect(marco.saldo).toBe('3000.00');
  });
});
