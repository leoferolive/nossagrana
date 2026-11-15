import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/client.js', () => ({ db: undefined }));
vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }));

import cron from 'node-cron';
import { InMemoryHistoricoRepository } from './historico.repository.js';
import {
  executarCicloMensal,
  gerarSnapshotsParaTodasFamilias,
  iniciarSnapshotJob,
  type DependenciasDoJob,
} from './snapshot.job.js';
import type { LogDoJobSnapshot } from './snapshot.lote.js';

class FakeLog implements LogDoJobSnapshot {
  readonly erros: string[] = [];
  info(): void {}
  warn(): void {}
  error(_dados: object, mensagem: string): void {
    this.erros.push(mensagem);
  }
}

function montar(agora: Date) {
  const repo = new InMemoryHistoricoRepository();
  const log = new FakeLog();
  const deps: DependenciasDoJob = {
    repo,
    log,
    agora: () => agora,
    aguardar: () => Promise.resolve(),
  };
  return { repo, log, deps };
}

describe('gerarSnapshotsParaTodasFamilias', () => {
  beforeEach(() => vi.clearAllMocks());

  it('processa só famílias ativas', async () => {
    const { repo, deps } = montar(new Date('2026-04-01T02:55:00Z'));
    repo.seedFamilia('ativa');
    repo.seedFamilia('excluida', { excluida: true });
    const r = await gerarSnapshotsParaTodasFamilias({}, deps);
    expect(r.resultados.map((x) => x.familiaId)).toEqual(['ativa']);
    expect(r.mesReferencia).toBe('2026-03');
  });

  it('reprocessa um mês passado via mesReferencia sem recalcular snapshot existente', async () => {
    const { repo, deps } = montar(new Date('2026-09-10T12:00:00Z'));
    repo.seedFamilia('f1');
    repo.seedFamilia('f2');
    repo.seedSnapshot({
      familiaId: 'f1',
      mesReferencia: '2026-05',
      totalReceitas: '1.00',
      totalDespesas: '0.00',
      saldo: '1.00',
      divergente: false,
      dadosCategorias: [],
      dadosUsuarios: [],
      geradoEm: new Date('2026-06-01T02:55:00Z'),
    });
    const r = await gerarSnapshotsParaTodasFamilias({ mesReferencia: '2026-05' }, deps);
    expect(r.mesReferencia).toBe('2026-05');
    expect(r.resultados.map((x) => x.status)).toEqual(['existente', 'criado']);
    const f1 = await repo.findSnapshot('f1', '2026-05');
    expect(f1!.totalReceitas).toBe('1.00');
  });
});

describe('validação de mesReferencia', () => {
  it.each(['2026-13', '2026-00', '26-05', '2026-5', 'abc', '2026-05-01'])(
    'recusa formato inválido %s com erro acionável',
    async (mes) => {
      const { deps } = montar(new Date('2026-09-10T12:00:00Z'));
      await expect(gerarSnapshotsParaTodasFamilias({ mesReferencia: mes }, deps)).rejects.toThrow(
        new RegExp(`recebido "${mes}".*YYYY-MM`),
      );
    },
  );

  it('recusa mês posterior ao mês que está fechando agora', async () => {
    const { deps } = montar(new Date('2026-09-10T12:00:00Z'));
    await expect(
      gerarSnapshotsParaTodasFamilias({ mesReferencia: '2026-10' }, deps),
    ).rejects.toThrow(/posterior.*recebido "2026-10".*2026-09/);
  });

  it('aceita o mês atual e meses passados', async () => {
    const { deps } = montar(new Date('2026-09-10T12:00:00Z'));
    await expect(
      gerarSnapshotsParaTodasFamilias({ mesReferencia: '2026-09' }, deps),
    ).resolves.toBeDefined();
    await expect(
      gerarSnapshotsParaTodasFamilias({ mesReferencia: '2026-05' }, deps),
    ).resolves.toBeDefined();
  });
});

describe('executarCicloMensal', () => {
  it('não gera snapshot em 30/03 23:55 BRT (02:55Z do dia 31)', async () => {
    const { repo, deps } = montar(new Date('2026-03-31T02:55:00Z'));
    repo.seedFamilia('f1');
    expect(await executarCicloMensal(deps)).toBeNull();
    expect(await repo.findSnapshot('f1', '2026-03')).toBeNull();
  });

  it('gera o snapshot de 2026-03 em 31/03 23:55 BRT (02:55Z do dia 1)', async () => {
    const { repo, deps } = montar(new Date('2026-04-01T02:55:00Z'));
    repo.seedFamilia('f1');
    const r = await executarCicloMensal(deps);
    expect(r).toMatchObject({ mesReferencia: '2026-03', criados: 1 });
    expect(await repo.findSnapshot('f1', '2026-03')).not.toBeNull();
  });

  it('erro ao listar famílias é logado em error e não propaga', async () => {
    const { repo, log, deps } = montar(new Date('2026-04-01T02:55:00Z'));
    repo.listFamiliaIdsAtivas = () => Promise.reject(new Error('db fora'));
    expect(await executarCicloMensal(deps)).toBeNull();
    expect(log.erros).toHaveLength(1);
  });
});

describe('iniciarSnapshotJob', () => {
  it('registra o cron no fuso America/Sao_Paulo', () => {
    iniciarSnapshotJob();
    expect(cron.schedule).toHaveBeenCalledWith(
      '55 23 28-31 * *',
      expect.any(Function),
      expect.objectContaining({ timezone: 'America/Sao_Paulo' }),
    );
  });
});
