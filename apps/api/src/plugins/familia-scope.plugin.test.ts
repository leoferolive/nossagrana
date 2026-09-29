import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockInnerJoin = vi.fn();
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
      innerJoin: mockInnerJoin,
      where: mockWhere,
    });
    mockInnerJoin.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({
      limit: mockLimit,
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  async function requestFamily() {
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

    await app.close();
    return response;
  }

  it('allows an active family membership', async () => {
    mockLimit.mockResolvedValue([{ deletedAt: null }]);

    const response = await requestFamily();

    expect(response.statusCode).toBe(200);
  });

  it('returns 403 when family has been soft-deleted', async () => {
    mockLimit.mockResolvedValue([{ deletedAt: new Date('2026-09-01') }]);

    const response = await requestFamily();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: { message: 'Familia excluida', code: 'FAMILIA_EXCLUIDA' },
    });
  });

  it('serializes a deleted-family 403 on a protected category route', async () => {
    mockLimit.mockResolvedValue([{ deletedAt: new Date('2026-09-01') }]);
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.decorate('authenticate', async (request) => {
      Object.assign(request, { user: { sub: 'u1', email: 'user@example.com' } });
    });

    const { familiaScopePlugin } = await import('./familia-scope.plugin.js');
    const { categoriaRoutes } = await import('../modules/categoria/categoria.routes.js');
    await app.register(familiaScopePlugin);
    await app.register(categoriaRoutes);
    await app.ready();

    const response = await app.inject({
      method: 'PATCH',
      url: '/categorias/22222222-2222-2222-2222-222222222222',
      headers: { 'x-familia-id': '11111111-1111-1111-1111-111111111111' },
      payload: { nome: 'Mercado', tipo: 'despesa' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: { message: 'Familia excluida', code: 'FAMILIA_EXCLUIDA' },
    });
    await app.close();
  });

  it.each([
    {
      membership: [{ deletedAt: new Date('2026-09-01') }],
      expected: { error: { message: 'Familia excluida', code: 'FAMILIA_EXCLUIDA' } },
    },
    {
      membership: [],
      expected: { message: 'Usuario sem acesso a familia informada' },
    },
  ])(
    'serializes family-scope 403 on a protected family route',
    async ({ membership, expected }) => {
      mockLimit.mockResolvedValue(membership);
      const app = Fastify();
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);
      app.decorate('authenticate', async (request) => {
        Object.assign(request, { user: { sub: 'u1', email: 'user@example.com' } });
      });

      const { familiaScopePlugin } = await import('./familia-scope.plugin.js');
      const { familiaRoutes } = await import('../modules/familia/familia.routes.js');
      await app.register(familiaScopePlugin);
      await app.register(familiaRoutes);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/familias/convites',
        headers: { 'x-familia-id': '11111111-1111-1111-1111-111111111111' },
        payload: {},
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual(expected);
      await app.close();
    },
  );

  it('returns 403 when authenticated user has no membership for family', async () => {
    mockLimit.mockResolvedValue([]);

    const response = await requestFamily();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      message: 'Usuario sem acesso a familia informada',
    });
  });
});
