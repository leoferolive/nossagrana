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

  it('creates invite code for active family when requester is admin', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Leo',
        email: 'leo-family-invite@example.com',
        senha: 'password123',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'leo-family-invite@example.com',
        senha: 'password123',
      },
    });

    const { accessToken } = loginResponse.json() as { accessToken: string };

    const familyResponse = await app.inject({
      method: 'POST',
      url: '/api/familias',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        nome: 'Familia Convite',
      },
    });

    const { familia } = familyResponse.json() as { familia: { id: string } };

    const inviteResponse = await app.inject({
      method: 'POST',
      url: '/api/familias/convites',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-familia-id': familia.id,
      },
      payload: {},
    });

    expect(inviteResponse.statusCode).toBe(201);
    expect(inviteResponse.json()).toMatchObject({
      convite: {
        id: expect.any(String),
        familiaId: familia.id,
        codigo: expect.any(String),
      },
    });
  });

  it('joins family through invite code', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Admin',
        email: 'admin-family-join@example.com',
        senha: 'password123',
      },
    });

    const adminLoginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin-family-join@example.com',
        senha: 'password123',
      },
    });

    const { accessToken: adminAccessToken } = adminLoginResponse.json() as {
      accessToken: string;
    };

    const familyResponse = await app.inject({
      method: 'POST',
      url: '/api/familias',
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
      payload: {
        nome: 'Familia Entrar',
      },
    });

    const { familia } = familyResponse.json() as { familia: { id: string } };

    const inviteResponse = await app.inject({
      method: 'POST',
      url: '/api/familias/convites',
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
        'x-familia-id': familia.id,
      },
      payload: {},
    });

    const { convite } = inviteResponse.json() as { convite: { codigo: string } };

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Membro',
        email: 'member-family-join@example.com',
        senha: 'password123',
      },
    });

    const memberLoginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'member-family-join@example.com',
        senha: 'password123',
      },
    });

    const { accessToken: memberAccessToken } = memberLoginResponse.json() as {
      accessToken: string;
    };

    const joinResponse = await app.inject({
      method: 'POST',
      url: `/api/familias/entrar/${convite.codigo}`,
      headers: {
        authorization: `Bearer ${memberAccessToken}`,
      },
      payload: {},
    });

    expect(joinResponse.statusCode).toBe(200);
    expect(joinResponse.json()).toMatchObject({
      familia: {
        id: familia.id,
        nome: 'Familia Entrar',
      },
    });
  });

  it('creates pending join request for a family', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Admin Solic',
        email: 'admin-family-request@example.com',
        senha: 'password123',
      },
    });

    const adminLoginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin-family-request@example.com',
        senha: 'password123',
      },
    });

    const { accessToken: adminAccessToken } = adminLoginResponse.json() as {
      accessToken: string;
    };

    const familyResponse = await app.inject({
      method: 'POST',
      url: '/api/familias',
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
      payload: {
        nome: 'Familia Solicitar',
      },
    });

    const { familia } = familyResponse.json() as { familia: { id: string } };

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Solicitante',
        email: 'requester-family-request@example.com',
        senha: 'password123',
      },
    });

    const requesterLoginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'requester-family-request@example.com',
        senha: 'password123',
      },
    });

    const { accessToken: requesterAccessToken } = requesterLoginResponse.json() as {
      accessToken: string;
    };

    const requestResponse = await app.inject({
      method: 'POST',
      url: '/api/familias/solicitar',
      headers: {
        authorization: `Bearer ${requesterAccessToken}`,
      },
      payload: {
        familiaId: familia.id,
      },
    });

    expect(requestResponse.statusCode).toBe(201);
    expect(requestResponse.json()).toMatchObject({
      solicitacao: {
        familiaId: familia.id,
        usuarioId: expect.any(String),
        status: 'pendente',
      },
    });
  });

  it('lists pending join requests for admin user', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Admin Lista',
        email: 'admin-family-list-requests@example.com',
        senha: 'password123',
      },
    });

    const adminLoginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin-family-list-requests@example.com',
        senha: 'password123',
      },
    });

    const { accessToken: adminAccessToken } = adminLoginResponse.json() as {
      accessToken: string;
    };

    const familyResponse = await app.inject({
      method: 'POST',
      url: '/api/familias',
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
      payload: {
        nome: 'Familia Lista Solicitacoes',
      },
    });

    const { familia } = familyResponse.json() as { familia: { id: string } };

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Solicitante Lista',
        email: 'requester-family-list-requests@example.com',
        senha: 'password123',
      },
    });

    const requesterLoginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'requester-family-list-requests@example.com',
        senha: 'password123',
      },
    });

    const { accessToken: requesterAccessToken } = requesterLoginResponse.json() as {
      accessToken: string;
    };

    await app.inject({
      method: 'POST',
      url: '/api/familias/solicitar',
      headers: {
        authorization: `Bearer ${requesterAccessToken}`,
      },
      payload: {
        familiaId: familia.id,
      },
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/familias/solicitacoes',
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
        'x-familia-id': familia.id,
      },
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      solicitacoes: [
        {
          familiaId: familia.id,
          status: 'pendente',
        },
      ],
    });
  });

  it('approves a join request as admin', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Admin Aprova',
        email: 'admin-family-approve-request@example.com',
        senha: 'password123',
      },
    });

    const adminLoginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin-family-approve-request@example.com',
        senha: 'password123',
      },
    });

    const { accessToken: adminAccessToken } = adminLoginResponse.json() as {
      accessToken: string;
    };

    const familyResponse = await app.inject({
      method: 'POST',
      url: '/api/familias',
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
      payload: {
        nome: 'Familia Aprovar Solicitacao',
      },
    });

    const { familia } = familyResponse.json() as { familia: { id: string } };

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Solicitante Aprova',
        email: 'requester-family-approve-request@example.com',
        senha: 'password123',
      },
    });

    const requesterLoginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'requester-family-approve-request@example.com',
        senha: 'password123',
      },
    });

    const { accessToken: requesterAccessToken } = requesterLoginResponse.json() as {
      accessToken: string;
    };

    await app.inject({
      method: 'POST',
      url: '/api/familias/solicitar',
      headers: {
        authorization: `Bearer ${requesterAccessToken}`,
      },
      payload: {
        familiaId: familia.id,
      },
    });

    const pendingResponse = await app.inject({
      method: 'GET',
      url: '/api/familias/solicitacoes',
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
        'x-familia-id': familia.id,
      },
    });

    const [pending] = (pendingResponse.json() as {
      solicitacoes: Array<{ id: string }>;
    }).solicitacoes;

    const approveResponse = await app.inject({
      method: 'PATCH',
      url: `/api/familias/solicitacoes/${pending.id}`,
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
        'x-familia-id': familia.id,
      },
      payload: {
        acao: 'aprovar',
      },
    });

    expect(approveResponse.statusCode).toBe(200);
    expect(approveResponse.json()).toMatchObject({
      solicitacao: {
        id: pending.id,
        familiaId: familia.id,
        status: 'aprovada',
      },
    });

    const pendingAfterApproveResponse = await app.inject({
      method: 'GET',
      url: '/api/familias/solicitacoes',
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
        'x-familia-id': familia.id,
      },
    });

    expect(pendingAfterApproveResponse.statusCode).toBe(200);
    expect(pendingAfterApproveResponse.json()).toMatchObject({
      solicitacoes: [],
    });
  });

  it('lists family members by family id', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Admin Membros',
        email: 'admin-family-members@example.com',
        senha: 'password123',
      },
    });

    const adminLoginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin-family-members@example.com',
        senha: 'password123',
      },
    });

    const { accessToken: adminAccessToken } = adminLoginResponse.json() as {
      accessToken: string;
    };

    const familyResponse = await app.inject({
      method: 'POST',
      url: '/api/familias',
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
      payload: {
        nome: 'Familia Membros',
      },
    });

    const { familia } = familyResponse.json() as { familia: { id: string } };

    const listMembersResponse = await app.inject({
      method: 'GET',
      url: `/api/familias/${familia.id}/membros`,
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
        'x-familia-id': familia.id,
      },
    });

    expect(listMembersResponse.statusCode).toBe(200);
    expect(listMembersResponse.json()).toMatchObject({
      membros: [
        {
          familiaId: familia.id,
          role: 'admin',
        },
      ],
    });
  });
});
