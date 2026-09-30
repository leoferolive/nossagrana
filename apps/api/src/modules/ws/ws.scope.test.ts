import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLimit = vi.fn();
const mockWhere = vi.fn();
const mockInnerJoin = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();

vi.mock('../../config/env.js', () => ({ env: { NODE_ENV: 'development' } }));
vi.mock('../../db/client.js', () => ({ db: { select: mockSelect } }));

const familiaId = '11111111-1111-1111-1111-111111111111';

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

async function closeCode(
  ws: Awaited<ReturnType<Awaited<ReturnType<typeof createApp>>['injectWS']>>,
) {
  return new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WebSocket permaneceu aberto')), 1000);
    ws.on('close', (code: number) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });
}

describe('WebSocket family scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ innerJoin: mockInnerJoin, where: mockWhere });
    mockInnerJoin.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
  });

  it('joins the room for an active family', async () => {
    mockLimit.mockResolvedValue([{ deletedAt: null }]);
    const app = await createApp();
    try {
      const token = app.jwt.sign({ sub: 'user-1', email: 'user@example.com' });
      const ws = await app.injectWS(`/ws?token=${token}&familiaId=${familiaId}`);
      await vi.waitFor(() => expect([...app.wsManager.entries()]).toHaveLength(1));
      expect(ws.readyState).toBe(1);
      const closed = new Promise<void>((resolve) => ws.once('close', () => resolve()));
      ws.close();
      await closed;
    } finally {
      await app.close();
    }
  });

  it('closes with 4004 for a soft-deleted family', async () => {
    mockLimit.mockResolvedValue([{ deletedAt: new Date('2026-09-01') }]);
    const app = await createApp();
    try {
      const token = app.jwt.sign({ sub: 'user-1', email: 'user@example.com' });
      const ws = await app.injectWS(`/ws?token=${token}&familiaId=${familiaId}`);
      expect(await closeCode(ws)).toBe(4004);
      expect([...app.wsManager.entries()]).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('keeps 4003 for a user without membership', async () => {
    mockLimit.mockResolvedValue([]);
    const app = await createApp();
    try {
      const token = app.jwt.sign({ sub: 'user-1', email: 'user@example.com' });
      const ws = await app.injectWS(`/ws?token=${token}&familiaId=${familiaId}`);
      expect(await closeCode(ws)).toBe(4003);
    } finally {
      await app.close();
    }
  });
});
