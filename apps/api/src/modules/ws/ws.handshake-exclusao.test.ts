import Fastify from 'fastify';
import type { WebSocket } from 'ws';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLimit = vi.hoisted(() => vi.fn());

vi.mock('../../config/env.js', () => ({ env: { NODE_ENV: 'development' } }));
vi.mock('../../db/client.js', () => ({
  db: {
    select: () => ({
      from: () => ({ innerJoin: () => ({ where: () => ({ limit: mockLimit }) }) }),
    }),
  },
}));

const familiaId = '11111111-1111-1111-1111-111111111111';
const ATIVA = [{ deletedAt: null }];
const EXCLUIDA = [{ deletedAt: new Date('2026-09-30') }];
const SEM_VINCULO: never[] = [];
const SOCKET_FECHANDO = 2; // readyState CLOSING do ws (>= 2: já não está OPEN)
// Teste negativo: dá tempo ao handler de (indevidamente) entrar no room após a liberação.
const ESPERA_DO_HANDSHAKE_MS = 50;

/**
 * Fake nomeada de `verificarAcessoFamilia`: responde as consultas na ordem em
 * que chegam. Uma resposta pode ser adiada (`adiar`) para prender o handshake
 * entre a checagem de acesso e o `join`, reproduzindo a corrida com a exclusão.
 */
class AcessoFamiliaSequenciado {
  private readonly fila: Array<() => Promise<unknown>> = [];
  consultas = 0;

  responder(linhas: unknown[]): this {
    this.fila.push(() => Promise.resolve(linhas));
    return this;
  }

  falhar(erro: Error): this {
    this.fila.push(() => Promise.reject(erro));
    return this;
  }

  /** Enfileira uma resposta que só resolve quando `liberar()` for chamado. */
  adiar(linhas: unknown[]): { liberar: () => void } {
    let liberar!: () => void;
    const pendente = new Promise<unknown>((resolve) => {
      liberar = () => resolve(linhas);
    });
    this.fila.push(() => pendente);
    return { liberar };
  }

  proxima(): Promise<unknown> {
    this.consultas += 1;
    const resposta = this.fila.shift();
    if (!resposta) throw new Error(`consulta de acesso #${this.consultas} sem resposta preparada`);
    return resposta();
  }
}

async function createApp() {
  const app = Fastify();
  await app.register(import('@fastify/jwt'), { secret: 'test-jwt-secret-must-be-32-chars!' });
  const { websocketPlugin } = await import('../../plugins/websocket.plugin.js');
  const { sessaoRevogacaoPlugin } = await import('../../plugins/sessao-revogacao.plugin.js');
  const { InMemoryRevokedTokenRepository } = await import('../auth/revoked-token.repository.js');
  const { wsRoutes } = await import('./ws.routes.js');
  await app.register(websocketPlugin);
  await app.register(sessaoRevogacaoPlugin, {
    tokensRevogados: new InMemoryRevokedTokenRepository(),
  });
  await app.register(wsRoutes);
  await app.ready();
  return app;
}

async function conectar(app: Awaited<ReturnType<typeof createApp>>) {
  const token = app.jwt.sign({ sub: 'user-1', email: 'user@example.com' });
  return app.injectWS(`/ws?token=${token}&familiaId=${familiaId}`);
}

function codigoDeFechamento(ws: Awaited<ReturnType<typeof conectar>>) {
  return new Promise<number>((resolve, reject) => {
    const limite = setTimeout(() => reject(new Error('WebSocket permaneceu aberto')), 1000);
    ws.on('close', (code: number) => {
      clearTimeout(limite);
      resolve(code);
    });
  });
}

/** Simula a publicação pós-commit da exclusão, como o `FamiliaService` faz. */
const excluirFamilia = (app: Awaited<ReturnType<typeof createApp>>) =>
  app.eventBus!.emit('familia:excluida', { familiaId });

describe('WebSocket — handshake concorrente à exclusão da família (#147)', () => {
  let acesso: AcessoFamiliaSequenciado;

  beforeEach(() => {
    acesso = new AcessoFamiliaSequenciado();
    mockLimit.mockReset();
    mockLimit.mockImplementation(() => acesso.proxima());
  });

  it('exclusão publicada entre a checagem e o join: revalida após o join e fecha com 4004', async () => {
    const primeira = acesso.adiar(ATIVA);
    acesso.responder(EXCLUIDA);
    const app = await createApp();
    try {
      const ws = await conectar(app);
      await vi.waitFor(() => expect(acesso.consultas).toBe(1));
      excluirFamilia(app);
      const fechamento = codigoDeFechamento(ws);
      primeira.liberar();

      expect(await fechamento).toBe(4004);
      expect(app.wsManager.roomSize(familiaId)).toBe(0);
    } finally {
      await app.close();
    }
  });

  it('exclusão publicada depois do join: closeFamily fecha o socket (sem depender da revalidação)', async () => {
    acesso.responder(ATIVA).responder(ATIVA);
    const app = await createApp();
    try {
      const ws = await conectar(app);
      await vi.waitFor(() => expect(app.wsManager.roomSize(familiaId)).toBe(1));
      await vi.waitFor(() => expect(acesso.consultas).toBe(2));
      const fechamento = codigoDeFechamento(ws);

      excluirFamilia(app);

      expect(await fechamento).toBe(4004);
      expect(app.wsManager.roomSize(familiaId)).toBe(0);
    } finally {
      await app.close();
    }
  });

  it('família ativa nas duas checagens: o socket permanece conectado no room', async () => {
    acesso.responder(ATIVA).responder(ATIVA);
    const app = await createApp();
    try {
      const ws = await conectar(app);
      await vi.waitFor(() => expect(acesso.consultas).toBe(2));

      expect(ws.readyState).toBe(1);
      expect(app.wsManager.roomSize(familiaId)).toBe(1);
      ws.close();
    } finally {
      await app.close();
    }
  });

  it('família restaurada: novo handshake depois de uma exclusão volta a entrar no room', async () => {
    acesso.responder(ATIVA).responder(ATIVA);
    const app = await createApp();
    try {
      excluirFamilia(app);
      const ws = await conectar(app);
      await vi.waitFor(() => expect(acesso.consultas).toBe(2));

      expect(ws.readyState).toBe(1);
      expect(app.wsManager.roomSize(familiaId)).toBe(1);
      ws.close();
    } finally {
      await app.close();
    }
  });

  it('vínculo removido entre a checagem e o join: fecha com 4003 e sai do room', async () => {
    acesso.responder(ATIVA).responder(SEM_VINCULO);
    const app = await createApp();
    try {
      const ws = await conectar(app);

      expect(await codigoDeFechamento(ws)).toBe(4003);
      expect(app.wsManager.roomSize(familiaId)).toBe(0);
    } finally {
      await app.close();
    }
  });

  it('falha ao revalidar: falha fechada (1011) e o socket não fica no room', async () => {
    acesso.responder(ATIVA).falhar(new Error('conexão com o banco perdida'));
    const app = await createApp();
    try {
      const ws = await conectar(app);

      expect(await codigoDeFechamento(ws)).toBe(1011);
      expect(app.wsManager.roomSize(familiaId)).toBe(0);
    } finally {
      await app.close();
    }
  });

  it('falha na 1ª checagem: também falha fechada (1011), sem terminate, e fora do room', async () => {
    acesso.falhar(new Error('conexão com o banco perdida'));
    const app = await createApp();
    try {
      const ws = await conectar(app);

      expect(await codigoDeFechamento(ws)).toBe(1011);
      expect(app.wsManager.roomSize(familiaId)).toBe(0);
    } finally {
      await app.close();
    }
  });

  it('cliente desconecta durante a 1ª checagem: o socket não entra no room', async () => {
    const primeira = acesso.adiar(ATIVA);
    const app = await createApp();
    try {
      let ladoServidor: WebSocket | undefined;
      app.websocketServer.on('connection', (socket: WebSocket) => (ladoServidor = socket));
      const ws = await conectar(app);
      await vi.waitFor(() => expect(acesso.consultas).toBe(1));
      ws.close();
      await vi.waitFor(() =>
        expect(ladoServidor?.readyState).toBeGreaterThanOrEqual(SOCKET_FECHANDO),
      );

      primeira.liberar();
      await new Promise((resolve) => setTimeout(resolve, ESPERA_DO_HANDSHAKE_MS));

      expect(app.wsManager.roomSize(familiaId)).toBe(0);
      expect(acesso.consultas).toBe(1);
    } finally {
      await app.close();
    }
  });
});
