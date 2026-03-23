import { describe, expect, it } from 'vitest';

import { InMemoryDashboardRepository } from './dashboard.repository.js';
import { DashboardService } from './dashboard.service.js';

const buildService = () => {
  const repo = new InMemoryDashboardRepository();
  const service = new DashboardService(repo);
  return { repo, service };
};

describe('DashboardService.getResumo', () => {
  it('retorna zeros e mesAnterior null quando sem dados', async () => {
    const { service } = buildService();
    const r = await service.getResumo('f1', '2026-03');
    expect(r.totalReceitas).toBe('0.00');
    expect(r.totalDespesas).toBe('0.00');
    expect(r.saldo).toBe('0.00');
    expect(r.mesAnterior).toBeNull();
  });

  it('usa snapshot para mês anterior quando disponível', async () => {
    const { repo, service } = buildService();
    repo.seed({
      snapshots: [
        {
          familiaId: 'f1',
          mesReferencia: '2026-02',
          totalReceitas: '4000.00',
          totalDespesas: '3000.00',
          saldo: '1000.00',
        },
      ],
    });
    const r = await service.getResumo('f1', '2026-03');
    expect(r.mesAnterior?.fonteSnapshot).toBe(true);
    expect(r.mesAnterior?.totalReceitas).toBe('4000.00');
  });

  it('re-agrega mês anterior quando sem snapshot', async () => {
    const { repo, service } = buildService();
    repo.seed({
      transacoes: [
        {
          familiaId: 'f1',
          mesReferencia: '2026-02',
          tipo: 'receita',
          valor: '3000.00',
          data: '2026-02-10',
          categoriaId: 'c1',
        },
      ],
    });
    const r = await service.getResumo('f1', '2026-03');
    expect(r.mesAnterior?.fonteSnapshot).toBe(false);
    expect(r.mesAnterior?.totalReceitas).toBe('3000.00');
  });

  it('mesAnterior null quando sem snapshot e sem transações no mês anterior', async () => {
    const { service } = buildService();
    const r = await service.getResumo('f1', '2026-03');
    expect(r.mesAnterior).toBeNull();
  });
});

describe('DashboardService.getGraficos', () => {
  it('retorna distribuicaoCategorias vazio quando sem despesas', async () => {
    const { service } = buildService();
    const g = await service.getGraficos('f1', '2026-03');
    expect(g.distribuicaoCategorias).toEqual([]);
  });

  it('calcula percentual corretamente', async () => {
    const { repo, service } = buildService();
    repo.seed({
      transacoes: [
        {
          familiaId: 'f1',
          mesReferencia: '2026-03',
          tipo: 'despesa',
          valor: '300.00',
          data: '2026-03-01',
          categoriaId: 'c1',
          categoriaNome: 'Alimentação',
        },
        {
          familiaId: 'f1',
          mesReferencia: '2026-03',
          tipo: 'despesa',
          valor: '700.00',
          data: '2026-03-02',
          categoriaId: 'c2',
          categoriaNome: 'Lazer',
        },
      ],
    });
    const g = await service.getGraficos('f1', '2026-03');
    const lazer = g.distribuicaoCategorias.find((d) => d.categoriaId === 'c2');
    const alim = g.distribuicaoCategorias.find((d) => d.categoriaId === 'c1');
    expect(lazer?.percentual).toBe(70);
    expect(alim?.percentual).toBe(30);
  });

  it('distribuicaoCategorias exclui categorias com sistema=true', async () => {
    const { repo, service } = buildService();
    repo.seed({
      transacoes: [
        {
          familiaId: 'f1',
          mesReferencia: '2026-03',
          tipo: 'despesa',
          valor: '300.00',
          data: '2026-03-01',
          categoriaId: 'c1',
          categoriaNome: 'Alimentação',
          categoriaSistema: false,
        },
        {
          familiaId: 'f1',
          mesReferencia: '2026-03',
          tipo: 'despesa',
          valor: '500.00',
          data: '2026-03-02',
          categoriaId: 'c-sys',
          categoriaNome: 'Cofrinho',
          categoriaSistema: true,
        },
      ],
    });
    const g = await service.getGraficos('f1', '2026-03');
    expect(g.distribuicaoCategorias).toHaveLength(1);
    expect(g.distribuicaoCategorias[0].categoriaId).toBe('c1');
    expect(g.distribuicaoCategorias[0].total).toBe('300.00');
    expect(g.distribuicaoCategorias[0].percentual).toBe(100);
  });

  it('evolucaoDiaria é array denso com zeros para dias sem transação', async () => {
    const { repo, service } = buildService();
    repo.seed({
      transacoes: [
        {
          familiaId: 'f1',
          mesReferencia: '2026-03',
          tipo: 'despesa',
          valor: '100.00',
          data: '2026-03-15',
          categoriaId: 'c1',
        },
      ],
    });
    const g = await service.getGraficos('f1', '2026-03');
    // Março 2026 tem 31 dias
    expect(g.evolucaoDiaria).toHaveLength(31);
    const dia1 = g.evolucaoDiaria.find((d) => d.dia === '2026-03-01');
    expect(dia1?.totalDespesas).toBe('0.00');
    expect(dia1?.totalReceitas).toBe('0.00');
    const dia15 = g.evolucaoDiaria.find((d) => d.dia === '2026-03-15');
    expect(dia15?.totalDespesas).toBe('100.00');
  });
});

describe('DashboardService.getOrcamento', () => {
  it('retorna [] quando sem orçamentos', async () => {
    const { service } = buildService();
    const o = await service.getOrcamento('f1', '2026-03');
    expect(o).toEqual([]);
  });

  it('calcula percentual e status corretamente', async () => {
    const { repo, service } = buildService();
    repo.seed({
      orcamentos: [
        {
          familiaId: 'f1',
          categoriaId: 'c1',
          categoriaNome: 'Alimentação',
          valorLimite: '1000.00',
          vigenciaInicio: '2026-01',
          vigenciaFim: null,
        },
        {
          familiaId: 'f1',
          categoriaId: 'c2',
          categoriaNome: 'Lazer',
          valorLimite: '500.00',
          vigenciaInicio: '2026-01',
          vigenciaFim: null,
        },
        {
          familiaId: 'f1',
          categoriaId: 'c3',
          categoriaNome: 'Transporte',
          valorLimite: '300.00',
          vigenciaInicio: '2026-01',
          vigenciaFim: null,
        },
      ],
      transacoes: [
        {
          familiaId: 'f1',
          mesReferencia: '2026-03',
          tipo: 'despesa',
          valor: '600.00',
          data: '2026-03-01',
          categoriaId: 'c1',
        }, // 60% → ok
        {
          familiaId: 'f1',
          mesReferencia: '2026-03',
          tipo: 'despesa',
          valor: '425.00',
          data: '2026-03-01',
          categoriaId: 'c2',
        }, // 85% → warning
        {
          familiaId: 'f1',
          mesReferencia: '2026-03',
          tipo: 'despesa',
          valor: '315.00',
          data: '2026-03-01',
          categoriaId: 'c3',
        }, // 105% → exceeded
      ],
    });
    const o = await service.getOrcamento('f1', '2026-03');
    expect(o.find((i) => i.categoriaId === 'c1')?.status).toBe('ok');
    expect(o.find((i) => i.categoriaId === 'c2')?.status).toBe('warning');
    expect(o.find((i) => i.categoriaId === 'c3')?.status).toBe('exceeded');
  });

  it('categoria com orçamento e zero gastos retorna totalGasto 0.00 e status ok', async () => {
    const { repo, service } = buildService();
    repo.seed({
      orcamentos: [
        {
          familiaId: 'f1',
          categoriaId: 'c1',
          categoriaNome: 'Poupança',
          valorLimite: '1000.00',
          vigenciaInicio: '2026-01',
          vigenciaFim: null,
        },
      ],
    });
    const o = await service.getOrcamento('f1', '2026-03');
    expect(o[0].totalGasto).toBe('0.00');
    expect(o[0].percentual).toBe(0);
    expect(o[0].status).toBe('ok');
  });
});

describe('DashboardService.getMesReferencia', () => {
  it('retorna formato YYYY-MM para data conhecida', () => {
    const { service } = buildService();
    // 2026-03-14T15:00:00Z = 12:00 em America/Sao_Paulo (UTC-3)
    const mes = service.getMesReferenciaAtual(new Date('2026-03-14T15:00:00.000Z'));
    expect(mes).toBe('2026-03');
  });
});
