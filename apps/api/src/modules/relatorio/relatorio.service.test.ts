import { beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('distribuicao exclui categorias com sistema=true', async () => {
    repo.seed({
      transacoes: [
        {
          familiaId,
          tipo: 'despesa',
          valor: '200.00',
          categoriaId: 'cat-1',
          categoriaNome: 'Alimentação',
          categoriaSistema: false,
          mesReferencia: '2026-03',
          usuarioId: 'usr-1',
          usuarioNome: 'Leo',
        },
        {
          familiaId,
          tipo: 'despesa',
          valor: '500.00',
          categoriaId: 'cat-sys',
          categoriaNome: 'Cofrinho',
          categoriaSistema: true,
          mesReferencia: '2026-03',
          usuarioId: 'usr-1',
          usuarioNome: 'Leo',
        },
      ],
    });
    const result = await service.distribuicao(familiaId, '2026-03');
    expect(result.distribuicao).toHaveLength(1);
    expect(result.distribuicao[0].categoriaNome).toBe('Alimentação');
    expect(result.distribuicao[0].total).toBe('200.00');
    expect(result.distribuicao[0].percentual).toBe(100);
  });

  it('porUsuario exclui categorias com sistema=true', async () => {
    repo.seed({
      transacoes: [
        {
          familiaId,
          tipo: 'despesa',
          valor: '300.00',
          categoriaId: 'cat-1',
          categoriaNome: 'Alimentação',
          categoriaSistema: false,
          mesReferencia: '2026-03',
          usuarioId: 'usr-1',
          usuarioNome: 'Leo',
        },
        {
          familiaId,
          tipo: 'despesa',
          valor: '500.00',
          categoriaId: 'cat-sys',
          categoriaNome: 'Cofrinho',
          categoriaSistema: true,
          mesReferencia: '2026-03',
          usuarioId: 'usr-1',
          usuarioNome: 'Leo',
        },
      ],
    });
    const result = await service.porUsuario(familiaId, '2026-03');
    expect(result.porUsuario).toHaveLength(1);
    expect(result.porUsuario[0].total).toBe('300.00');
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

  it('tendencias usa getTransacoesBatch em vez de N queries individuais', async () => {
    repo.seed({
      transacoes: [
        {
          familiaId,
          tipo: 'receita',
          valor: '3000.00',
          categoriaId: 'cat-1',
          categoriaNome: 'Salário',
          mesReferencia: '2026-01',
          usuarioId: 'usr-1',
          usuarioNome: 'Leo',
        },
        {
          familiaId,
          tipo: 'despesa',
          valor: '1000.00',
          categoriaId: 'cat-2',
          categoriaNome: 'Alimentação',
          mesReferencia: '2026-02',
          usuarioId: 'usr-1',
          usuarioNome: 'Leo',
        },
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
      ],
    });

    const batchSpy = vi.spyOn(repo, 'getTransacoesBatch');
    const singleSpy = vi.spyOn(repo, 'getTransacoes');

    const result = await service.tendencias(familiaId, '2026-03', 3);

    // Deve usar batch (1 chamada) e nao N chamadas individuais
    expect(batchSpy).toHaveBeenCalledTimes(1);
    expect(singleSpy).not.toHaveBeenCalled();

    expect(result.meses).toHaveLength(3);
    const jan = result.meses.find((m) => m.mesReferencia === '2026-01')!;
    expect(jan.totalReceitas).toBe('3000.00');
    expect(jan.totalDespesas).toBe('0.00');
    const fev = result.meses.find((m) => m.mesReferencia === '2026-02')!;
    expect(fev.totalReceitas).toBe('0.00');
    expect(fev.totalDespesas).toBe('1000.00');
    const mar = result.meses.find((m) => m.mesReferencia === '2026-03')!;
    expect(mar.totalReceitas).toBe('5000.00');
    expect(mar.totalDespesas).toBe('0.00');
  });
});
