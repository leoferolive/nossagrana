import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

vi.mock('../db/client.js', () => ({
  db: {
    select: mockSelect,
  },
}));

vi.mock('../config/env.js', () => ({
  env: {
    NODE_ENV: 'development',
  },
}));

describe('familiaScopePlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({
      from: mockFrom,
    });
    mockFrom.mockReturnValue({
      where: mockWhere,
    });
    mockWhere.mockReturnValue({
      limit: mockLimit,
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('returns 403 when authenticated user has no membership for family', async () => {
    mockLimit.mockResolvedValue([]);

    const app = Fastify();
    app.decorate('authenticate', async () => undefined);

    app.get('/protected', { preHandler: [app.authenticate] }, async () => ({ ok: true }));

    const { familiaScopePlugin } = await import('./familia-scope.plugin.js');
    await app.register(familiaScopePlugin);

    app.get(
      '/needs-family',
      {
        preHandler: [
          async (request, reply) => {
            Object.assign(request, { user: { sub: 'u1', email: 'user@example.com' } });
            await app.requireFamiliaScope(request, reply);
          },
        ],
      },
      async () => ({ ok: true }),
    );

    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/needs-family',
      headers: {
        'x-familia-id': '11111111-1111-1111-1111-111111111111',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      message: 'Usuario sem acesso a familia informada',
    });

    await app.close();
  });
});
