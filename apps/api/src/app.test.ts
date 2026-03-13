import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';

describe('API health endpoint', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns ok health payload', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      app: 'api',
    });
  });

  it('registers a user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Leo',
        email: 'leo@example.com',
        senha: 'password123',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      user: {
        nome: 'Leo',
        email: 'leo@example.com',
      },
    });
  });

  it('logs in a user with access and refresh token', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Leo',
        email: 'leo-login@example.com',
        senha: 'password123',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'leo-login@example.com',
        senha: 'password123',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });
  });

  it('refreshes access token with refresh token', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Leo',
        email: 'leo-refresh@example.com',
        senha: 'password123',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'leo-refresh@example.com',
        senha: 'password123',
      },
    });

    const { refreshToken } = loginResponse.json() as { refreshToken: string };

    const refreshResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: {
        refreshToken,
      },
    });

    expect(refreshResponse.statusCode).toBe(200);
    expect(refreshResponse.json()).toMatchObject({
      accessToken: expect.any(String),
    });
  });

  it('invalidates refresh token on logout', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Leo',
        email: 'leo-logout@example.com',
        senha: 'password123',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'leo-logout@example.com',
        senha: 'password123',
      },
    });

    const { refreshToken } = loginResponse.json() as { refreshToken: string };

    const logoutResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      payload: {
        refreshToken,
      },
    });

    expect(logoutResponse.statusCode).toBe(204);

    const refreshAfterLogoutResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: {
        refreshToken,
      },
    });

    expect(refreshAfterLogoutResponse.statusCode).toBe(401);
  });

  it('protects private route with JWT authentication', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Leo',
        email: 'leo-private@example.com',
        senha: 'password123',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'leo-private@example.com',
        senha: 'password123',
      },
    });

    const { accessToken } = loginResponse.json() as { accessToken: string };

    const unauthorizedResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });
    expect(unauthorizedResponse.statusCode).toBe(401);

    const authorizedResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(authorizedResponse.statusCode).toBe(200);
    expect(authorizedResponse.json()).toMatchObject({
      user: {
        email: 'leo-private@example.com',
      },
    });
  });

  it('enforces familia scope middleware on protected routes', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Leo',
        email: 'leo-family@example.com',
        senha: 'password123',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'leo-family@example.com',
        senha: 'password123',
      },
    });

    const { accessToken } = loginResponse.json() as { accessToken: string };

    const missingHeaderResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/familia-context',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    expect(missingHeaderResponse.statusCode).toBe(400);

    const validHeaderResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/familia-context',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-familia-id': '11111111-1111-1111-1111-111111111111',
      },
    });
    expect(validHeaderResponse.statusCode).toBe(200);
    expect(validHeaderResponse.json()).toMatchObject({
      familiaId: '11111111-1111-1111-1111-111111111111',
    });
  });

  it('creates a family for authenticated user', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Leo',
        email: 'leo-family-create@example.com',
        senha: 'password123',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'leo-family-create@example.com',
        senha: 'password123',
      },
    });

    const { accessToken } = loginResponse.json() as { accessToken: string };

    const unauthorizedResponse = await app.inject({
      method: 'POST',
      url: '/api/familias',
      payload: {
        nome: 'Familia Silva',
      },
    });
    expect(unauthorizedResponse.statusCode).toBe(401);

    const response = await app.inject({
      method: 'POST',
      url: '/api/familias',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        nome: 'Familia Silva',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      familia: {
        nome: 'Familia Silva',
      },
    });
  });
});
