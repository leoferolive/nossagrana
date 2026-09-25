import { describe, expect, it } from 'vitest';

import {
  CRON_LIMPEZA_IDEMPOTENCIA,
  iniciarLimpezaIdempotenciaJob,
  limparChavesExpiradas,
  type AgendadorCron,
  type LogDaLimpeza,
} from './idempotencia-limpeza.job.js';

/** Fake nomeada do repositório: só a operação de manutenção usada pelo job. */
class ChavesExpiradasFake {
  chamadas = 0;
  constructor(private readonly resultado: number | Error) {}
  async removerExpiradas(): Promise<number> {
    this.chamadas++;
    if (this.resultado instanceof Error) throw this.resultado;
    return this.resultado;
  }
}

/** Fake nomeada do logger estruturado (subconjunto de `app.log`). */
class LogFake implements LogDaLimpeza {
  readonly infos: Array<[object, string]> = [];
  readonly erros: Array<[object, string]> = [];
  info(dados: object, mensagem: string): void {
    this.infos.push([dados, mensagem]);
  }
  error(dados: object, mensagem: string): void {
    this.erros.push([dados, mensagem]);
  }
}

/** Fake nomeada do node-cron: guarda a expressão e a tarefa para o teste disparar. */
class AgendadorFake {
  expressao = '';
  opcoes: object = {};
  tarefa: () => Promise<void> = async () => undefined;
  agendar: AgendadorCron = (expressao, tarefa, opcoes) => {
    this.expressao = expressao;
    this.tarefa = tarefa;
    this.opcoes = opcoes;
  };
}

describe('limparChavesExpiradas', () => {
  it('remove as expiradas e loga a contagem em JSON estruturado', async () => {
    const repo = new ChavesExpiradasFake(3);
    const log = new LogFake();

    expect(await limparChavesExpiradas(repo, log)).toBe(3);
    expect(log.infos).toEqual([[{ removidas: 3 }, 'Chaves de idempotência expiradas removidas']]);
  });

  it('nada a remover: não loga', async () => {
    const log = new LogFake();

    expect(await limparChavesExpiradas(new ChavesExpiradasFake(0), log)).toBe(0);
    expect(log.infos).toEqual([]);
  });

  it('falha do banco é logada e não derruba o processo (próxima execução tenta de novo)', async () => {
    const log = new LogFake();

    expect(await limparChavesExpiradas(new ChavesExpiradasFake(new Error('db fora')), log)).toBe(0);
    expect(log.erros).toEqual([[{ erro: 'db fora' }, 'Falha ao limpar chaves de idempotência']]);
  });
});

describe('iniciarLimpezaIdempotenciaJob', () => {
  it('agenda de hora em hora no fuso da família e a tarefa chama a limpeza', async () => {
    const agendador = new AgendadorFake();
    const repo = new ChavesExpiradasFake(1);

    iniciarLimpezaIdempotenciaJob(new LogFake(), repo, agendador.agendar);
    await agendador.tarefa();

    expect(agendador.expressao).toBe(CRON_LIMPEZA_IDEMPOTENCIA);
    expect(agendador.opcoes).toEqual({ timezone: 'America/Sao_Paulo' });
    expect(repo.chamadas).toBe(1);
  });
});
