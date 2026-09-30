import cron from 'node-cron';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { iniciarRevokedTokenCleanupJob } from './revoked-token-cleanup.job.js';
import { DrizzleRevokedTokenRepository } from './revoked-token.repository.js';

vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }));
vi.mock('../../db/client.js', () => ({ db: {} }));

type Tarefa = () => Promise<void>;

function tarefaAgendada(): Tarefa {
  iniciarRevokedTokenCleanupJob();
  const [expressao, tarefa, opcoes] = vi.mocked(cron.schedule).mock.calls[0] as unknown as [
    string,
    Tarefa,
    { timezone: string },
  ];
  expect(expressao).toBe('0 0 * * *');
  expect(opcoes.timezone).toBe('America/Sao_Paulo');
  return tarefa;
}

describe('iniciarRevokedTokenCleanupJob', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('agenda a limpeza diária e remove os tokens expirados ao disparar', async () => {
    const limpar = vi
      .spyOn(DrizzleRevokedTokenRepository.prototype, 'cleanupExpired')
      .mockResolvedValue(3);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await tarefaAgendada()();

    expect(limpar).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Removidos 3 tokens expirados'));
  });

  it('não loga nada quando não há tokens expirados', async () => {
    vi.spyOn(DrizzleRevokedTokenRepository.prototype, 'cleanupExpired').mockResolvedValue(0);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await tarefaAgendada()();

    expect(log).not.toHaveBeenCalled();
  });
});
