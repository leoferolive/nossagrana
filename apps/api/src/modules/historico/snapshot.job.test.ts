import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock('../../db/client.js', () => ({ db: mockDb }));

vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }));

vi.mock('./historico.repository.js', () => ({
  DrizzleHistoricoRepository: vi.fn().mockImplementation(() => ({})),
}));

const mockGerarSnapshot = vi.fn().mockResolvedValue(undefined);

vi.mock('./snapshot.service.js', () => ({
  SnapshotService: vi.fn().mockImplementation(() => ({
    gerarSnapshot: mockGerarSnapshot,
  })),
}));

import cron from 'node-cron';
import { gerarSnapshotsParaTodasFamilias, iniciarSnapshotJob } from './snapshot.job.js';

describe('gerarSnapshotsParaTodasFamilias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGerarSnapshot.mockResolvedValue(undefined);
  });

  it('calls gerarSnapshot for each familia', async () => {
    const familias = [{ id: 'f1' }, { id: 'f2' }];
    const fromMock = vi.fn().mockResolvedValue(familias);
    mockDb.select.mockReturnValue({ from: fromMock });

    await gerarSnapshotsParaTodasFamilias();

    expect(mockGerarSnapshot).toHaveBeenCalledTimes(2);
    expect(mockGerarSnapshot).toHaveBeenCalledWith('f1', expect.any(String));
    expect(mockGerarSnapshot).toHaveBeenCalledWith('f2', expect.any(String));
  });

  it('does nothing when there are no familias', async () => {
    const fromMock = vi.fn().mockResolvedValue([]);
    mockDb.select.mockReturnValue({ from: fromMock });

    await gerarSnapshotsParaTodasFamilias();

    expect(mockGerarSnapshot).not.toHaveBeenCalled();
  });
});

describe('iniciarSnapshotJob', () => {
  it('registers a cron job with schedule', () => {
    iniciarSnapshotJob();
    expect(cron.schedule).toHaveBeenCalledWith(
      '55 23 28-31 * *',
      expect.any(Function),
      expect.objectContaining({ timezone: 'America/Sao_Paulo' }),
    );
  });
});
