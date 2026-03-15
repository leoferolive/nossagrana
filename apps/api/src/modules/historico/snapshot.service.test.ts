import { describe, expect, it, beforeEach } from 'vitest';
import { SnapshotService } from './snapshot.service.js';
import { InMemoryHistoricoRepository } from './historico.repository.js';

const FAM = 'fam-1';

describe('SnapshotService', () => {
  let repo: InMemoryHistoricoRepository;
  let service: SnapshotService;

  beforeEach(() => {
    repo = new InMemoryHistoricoRepository();
    service = new SnapshotService(repo);
  });

  it('gera snapshot com totais corretos', async () => {
    repo.seedTransacaoParaSnapshot(FAM, '2026-01', {
      totalReceitas: '1200.00',
      totalDespesas: '800.00',
      porCategoria: [{ categoriaId: 'cat-1', categoriaNome: 'Alimentação', total: '800.00' }],
      porUsuario: [{ usuarioId: 'usr-1', usuarioNome: 'Maria', total: '800.00' }],
    });

    const snap = await service.gerarSnapshot(FAM, '2026-01');
    expect(snap.totalReceitas).toBe('1200.00');
    expect(snap.totalDespesas).toBe('800.00');
    expect(snap.saldo).toBe('400.00');
    expect(snap.dadosCategorias).toHaveLength(1);
    expect(snap.dadosUsuarios).toHaveLength(1);
    expect(snap.divergente).toBe(false);
  });

  it('não regera snapshot se já existe (retorna o existente)', async () => {
    repo.seedTransacaoParaSnapshot(FAM, '2026-01', {
      totalReceitas: '1000.00',
      totalDespesas: '500.00',
      porCategoria: [],
      porUsuario: [],
    });
    const snap1 = await service.gerarSnapshot(FAM, '2026-01');
    const snap2 = await service.gerarSnapshot(FAM, '2026-01');
    expect(snap1.id).toBe(snap2.id);
  });

  describe('marcarDivergente', () => {
    it('não faz nada se não houver snapshot para o mês', async () => {
      await expect(service.marcarDivergente(FAM, '2026-02')).resolves.not.toThrow();
    });

    it('marca snapshot existente como divergente', async () => {
      repo.seedTransacaoParaSnapshot(FAM, '2026-01', {
        totalReceitas: '500.00',
        totalDespesas: '200.00',
        porCategoria: [],
        porUsuario: [],
      });
      await service.gerarSnapshot(FAM, '2026-01');
      await service.marcarDivergente(FAM, '2026-01');

      const snap = await repo.findSnapshot(FAM, '2026-01');
      expect(snap!.divergente).toBe(true);
    });
  });
});
