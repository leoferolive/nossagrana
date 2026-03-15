import { describe, expect, it, beforeEach } from 'vitest';
import { HistoricoService } from './historico.service.js';
import { InMemoryHistoricoRepository } from './historico.repository.js';

const FAM = 'fam-1';

describe('HistoricoService', () => {
  let repo: InMemoryHistoricoRepository;
  let service: HistoricoService;

  beforeEach(() => {
    repo = new InMemoryHistoricoRepository();
    service = new HistoricoService(repo);
  });

  describe('list', () => {
    it('retorna lista vazia quando não há transações nem snapshots', async () => {
      const result = await service.list(FAM);
      expect(result.meses).toHaveLength(0);
    });

    it('retorna meses com transações sem snapshot', async () => {
      repo.seedTransacao({ familiaId: FAM, mesReferencia: '2026-01', totalReceitas: '1000.00', totalDespesas: '500.00' });
      const result = await service.list(FAM);
      expect(result.meses).toHaveLength(1);
      expect(result.meses[0]).toMatchObject({
        mesReferencia: '2026-01',
        totalReceitas: '1000.00',
        totalDespesas: '500.00',
        saldo: '500.00',
        temSnapshot: false,
        divergente: false,
        geradoEm: null,
      });
    });

    it('retorna meses com snapshot com temSnapshot=true e dados do snapshot', async () => {
      repo.seedSnapshot({
        familiaId: FAM,
        mesReferencia: '2026-01',
        totalReceitas: '1000.00',
        totalDespesas: '600.00',
        saldo: '400.00',
        divergente: false,
        dadosCategorias: [],
        dadosUsuarios: [],
        geradoEm: new Date('2026-01-31'),
      });
      const result = await service.list(FAM);
      expect(result.meses).toHaveLength(1);
      expect(result.meses[0]).toMatchObject({
        mesReferencia: '2026-01',
        temSnapshot: true,
        divergente: false,
      });
    });

    it('indica divergente=true quando snapshot está divergente', async () => {
      repo.seedSnapshot({
        familiaId: FAM,
        mesReferencia: '2025-12',
        totalReceitas: '500.00',
        totalDespesas: '300.00',
        saldo: '200.00',
        divergente: true,
        dadosCategorias: [],
        dadosUsuarios: [],
        geradoEm: new Date('2025-12-31'),
      });
      const result = await service.list(FAM);
      expect(result.meses[0].divergente).toBe(true);
    });

    it('retorna meses em ordem decrescente', async () => {
      repo.seedTransacao({ familiaId: FAM, mesReferencia: '2026-01', totalReceitas: '100.00', totalDespesas: '50.00' });
      repo.seedTransacao({ familiaId: FAM, mesReferencia: '2026-03', totalReceitas: '200.00', totalDespesas: '100.00' });
      repo.seedSnapshot({
        familiaId: FAM,
        mesReferencia: '2026-02',
        totalReceitas: '150.00',
        totalDespesas: '75.00',
        saldo: '75.00',
        divergente: false,
        dadosCategorias: [],
        dadosUsuarios: [],
        geradoEm: new Date('2026-02-28'),
      });
      const result = await service.list(FAM);
      expect(result.meses.map((m) => m.mesReferencia)).toEqual(['2026-03', '2026-02', '2026-01']);
    });
  });

  describe('detalhe', () => {
    it('retorna atual calculado e snapshot null quando não há snapshot', async () => {
      repo.seedTransacao({ familiaId: FAM, mesReferencia: '2026-02', totalReceitas: '800.00', totalDespesas: '400.00' });
      const result = await service.detalhe(FAM, '2026-02');
      expect(result.mesReferencia).toBe('2026-02');
      expect(result.atual.totalReceitas).toBe('800.00');
      expect(result.snapshot).toBeNull();
    });

    it('retorna snapshot quando existe', async () => {
      repo.seedTransacao({ familiaId: FAM, mesReferencia: '2026-01', totalReceitas: '900.00', totalDespesas: '500.00' });
      repo.seedSnapshot({
        familiaId: FAM,
        mesReferencia: '2026-01',
        totalReceitas: '850.00',
        totalDespesas: '480.00',
        saldo: '370.00',
        divergente: true,
        dadosCategorias: [{ categoriaId: 'cat-1', categoriaNome: 'Alimentação', total: '480.00' }],
        dadosUsuarios: [{ usuarioId: 'usr-1', usuarioNome: 'João', total: '480.00' }],
        geradoEm: new Date('2026-01-31'),
      });
      const result = await service.detalhe(FAM, '2026-01');
      expect(result.snapshot).not.toBeNull();
      expect(result.snapshot!.totalReceitas).toBe('850.00');
      expect(result.snapshot!.divergente).toBe(true);
      expect(result.snapshot!.dadosCategorias).toHaveLength(1);
    });
  });
});
