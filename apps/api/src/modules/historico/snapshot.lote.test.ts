import { describe, expect, it } from 'vitest';

import {
  LIMITE_MENSAGEM_ERRO,
  executarSnapshotsEmLote,
  type DependenciasDoLote,
  type GeradorDeSnapshot,
  type LogDoJobSnapshot,
} from './snapshot.lote.js';

class FakeLog implements LogDoJobSnapshot {
  readonly infos: { dados: object; mensagem: string }[] = [];
  readonly erros: { dados: Record<string, unknown>; mensagem: string }[] = [];
  info(dados: object, mensagem: string): void {
    this.infos.push({ dados, mensagem });
  }
  warn(): void {}
  error(dados: Record<string, unknown>, mensagem: string): void {
    this.erros.push({ dados, mensagem });
  }
}

class FakeAguardar {
  readonly esperas: number[] = [];
  readonly aguardar = (ms: number): Promise<void> => {
    this.esperas.push(ms);
    return Promise.resolve();
  };
}

/** Gerador com roteiro por família: cada item é `criado`, `existente` ou um erro a lançar. */
class FakeGerador implements GeradorDeSnapshot {
  readonly chamadas: string[] = [];
  constructor(private readonly roteiro: Record<string, (Error | 'criado' | 'existente')[]> = {}) {}
  async gerarSnapshot(familiaId: string): Promise<{ criado: boolean }> {
    this.chamadas.push(familiaId);
    const passo = this.roteiro[familiaId]?.shift() ?? 'criado';
    if (passo instanceof Error) throw passo;
    return { criado: passo === 'criado' };
  }
}

function montar(
  roteiro: Record<string, (Error | 'criado' | 'existente')[]> = {},
  extra: Partial<DependenciasDoLote> = {},
) {
  const log = new FakeLog();
  const espera = new FakeAguardar();
  const gerador = new FakeGerador(roteiro);
  const deps: DependenciasDoLote = {
    gerador,
    log,
    aguardar: espera.aguardar,
    tentativasMaximas: 3,
    backoffBaseMs: 100,
    tamanhoDoLote: 2,
    ...extra,
  };
  return { deps, log, espera, gerador };
}

describe('executarSnapshotsEmLote', () => {
  it('agrega criados e existentes sem falha', async () => {
    const { deps } = montar({ f2: ['existente'] });
    const r = await executarSnapshotsEmLote(['f1', 'f2', 'f3'], '2026-03', deps);
    expect(r).toMatchObject({
      mesReferencia: '2026-03',
      total: 3,
      criados: 2,
      existentes: 1,
      falhou: false,
    });
    expect(r.falhas).toEqual([]);
    expect(r.resultados.map((x) => x.status)).toEqual(['criado', 'existente', 'criado']);
  });

  it('falha 2x e passa na 3ª tentativa, com backoff exponencial', async () => {
    const { deps, espera } = montar({ f1: [new Error('x'), new Error('y'), 'criado'] });
    const r = await executarSnapshotsEmLote(['f1'], '2026-03', deps);
    expect(r.resultados[0]).toEqual({ familiaId: 'f1', status: 'criado', tentativas: 3 });
    expect(espera.esperas).toEqual([100, 200]);
    expect(r.falhou).toBe(false);
  });

  it('falha sempre: para no limite, não espera após a última e marca o job como falho', async () => {
    const { deps, espera, gerador, log } = montar({
      f1: [new Error('a'), new Error('b'), new Error('c'), new Error('nunca')],
    });
    const r = await executarSnapshotsEmLote(['f1'], '2026-03', deps);
    expect(gerador.chamadas).toEqual(['f1', 'f1', 'f1']);
    expect(espera.esperas).toEqual([100, 200]);
    expect(r.falhou).toBe(true);
    expect(r.falhas).toEqual([{ familiaId: 'f1', status: 'falhou', tentativas: 3, erro: 'c' }]);
    expect(log.erros).toHaveLength(2); // 1 por família + 1 resumo do job
  });

  it('falha de uma família não impede as demais', async () => {
    const e = new Error('boom');
    const { deps } = montar({ f1: [e, e, e] });
    const r = await executarSnapshotsEmLote(['f1', 'f2', 'f3'], '2026-03', deps);
    expect(r.criados).toBe(2);
    expect(r.falhas.map((f) => f.familiaId)).toEqual(['f1']);
  });

  it('log de falha traz só familiaId, mesReferencia, tentativas e a 1ª linha do erro', async () => {
    const erro = new Error('Failed query: select x from y\nparams: 123456.78,token-secreto');
    const { deps, log } = montar({ f1: [erro, erro, erro] });
    await executarSnapshotsEmLote(['f1'], '2026-03', deps);
    expect(log.erros[0]!.dados).toEqual({
      familiaId: 'f1',
      mesReferencia: '2026-03',
      tentativas: 3,
      erro: 'Failed query: select x from y',
    });
    expect(JSON.stringify(log.erros)).not.toContain('token-secreto');
  });

  it('trunca em 200 caracteres a mensagem de erro de 300', async () => {
    const erro = new Error('x'.repeat(300));
    const { deps } = montar({ f1: [erro, erro, erro] });
    const r = await executarSnapshotsEmLote(['f1'], '2026-03', deps);
    expect(r.falhas[0]!.erro).toBe('x'.repeat(LIMITE_MENSAGEM_ERRO));
    expect(LIMITE_MENSAGEM_ERRO).toBe(200);
  });

  it('log final em error resume o job falho; sem falha não loga error', async () => {
    const ok = montar();
    await executarSnapshotsEmLote(['f1'], '2026-03', ok.deps);
    expect(ok.log.erros).toEqual([]);

    const ruim = montar({ f1: [new Error('a'), new Error('a'), new Error('a')] });
    await executarSnapshotsEmLote(['f1'], '2026-03', ruim.deps);
    expect(ruim.log.erros.at(-1)).toMatchObject({
      dados: { mesReferencia: '2026-03', total: 1, criados: 0, falhas: 1 },
    });
  });

  it('sem famílias devolve relatório vazio e não falho', async () => {
    const { deps } = montar();
    const r = await executarSnapshotsEmLote([], '2026-03', deps);
    expect(r).toMatchObject({ total: 0, criados: 0, existentes: 0, falhou: false });
  });
});
