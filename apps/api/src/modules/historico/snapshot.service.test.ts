import { describe, expect, it, beforeEach } from 'vitest';
import { SnapshotService } from './snapshot.service.js';
import { InMemoryHistoricoRepository } from './historico.repository.js';

const FAM = 'fam-1';

/** Logger fake: registra as chamadas `info` do snapshot service. */
class LogDoSnapshotFake {
  readonly infos: { dados: object; mensagem: string }[] = [];
  info(dados: object, mensagem: string): void {
    this.infos.push({ dados, mensagem });
  }
}

/** Simula a corrida: o `findSnapshot` inicial não enxerga a linha que o outro processo acabou de inserir. */
class RepositorioComCorridaFake extends InMemoryHistoricoRepository {
  private primeiraBusca = false;
  armarCorrida(): void {
    this.primeiraBusca = true;
  }
  override async findSnapshot(familiaId: string, mes: string) {
    if (this.primeiraBusca) {
      this.primeiraBusca = false;
      return null;
    }
    return super.findSnapshot(familiaId, mes);
  }
}

function snapshotManual(totalReceitas: string) {
  return {
    familiaId: FAM,
    mesReferencia: '2026-01',
    totalReceitas,
    totalDespesas: '0.00',
    saldo: totalReceitas,
    dadosCategorias: [],
    dadosUsuarios: [],
  };
}

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

    const { snapshot: snap, criado } = await service.gerarSnapshot(FAM, '2026-01');
    expect(criado).toBe(true);
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
    expect(snap1.snapshot.id).toBe(snap2.snapshot.id);
    expect([snap1.criado, snap2.criado]).toEqual([true, false]);
  });

  describe('conflito na criação (corrida entre processos)', () => {
    const seed = {
      totalReceitas: '1000.00',
      totalDespesas: '500.00',
      porCategoria: [],
      porUsuario: [],
    };

    it('devolve o existente sem alterá-lo e loga o conflito estruturado', async () => {
      const log = new LogDoSnapshotFake();
      const corrida = new RepositorioComCorridaFake();
      corrida.seedTransacaoParaSnapshot(FAM, '2026-01', seed);
      const existente = await corrida.insertSnapshot(snapshotManual('111.00'));
      corrida.armarCorrida();
      const racing = new SnapshotService(corrida, log);

      const resultado = await racing.gerarSnapshot(FAM, '2026-01');

      expect(resultado.criado).toBe(false);
      expect(resultado.snapshot.id).toBe(existente.snapshot.id);
      expect(resultado.snapshot.totalReceitas).toBe('111.00');
      expect(log.infos).toEqual([
        {
          dados: { familiaId: FAM, mesReferencia: '2026-01', snapshotId: existente.snapshot.id },
          mensagem: 'Snapshot mensal já existia: criação concorrente ignorada',
        },
      ]);
    });

    it('não loga quando o snapshot é criado ou já era conhecido', async () => {
      const log = new LogDoSnapshotFake();
      const comLog = new SnapshotService(repo, log);
      repo.seedTransacaoParaSnapshot(FAM, '2026-01', seed);

      await comLog.gerarSnapshot(FAM, '2026-01');
      await comLog.gerarSnapshot(FAM, '2026-01');

      expect(log.infos).toEqual([]);
    });

    it('não vaza o snapshot de outra família', async () => {
      repo.seedTransacaoParaSnapshot('fam-2', '2026-01', seed);
      const outra = await service.gerarSnapshot('fam-2', '2026-01');
      const minha = await service.gerarSnapshot(FAM, '2026-01');

      expect(minha.criado).toBe(true);
      expect(minha.snapshot.id).not.toBe(outra.snapshot.id);
    });
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
