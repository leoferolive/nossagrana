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

  it('rejects invalid refresh token on logout', async () => {
    const logoutResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      payload: {
        refreshToken: 'invalid-token',
      },
    });

    expect(logoutResponse.statusCode).toBe(401);
    expect(logoutResponse.json()).toMatchObject({
      message: 'Refresh token invalido',
    });
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

    const [pending] = (
      pendingResponse.json() as {
        solicitacoes: Array<{ id: string }>;
      }
    ).solicitacoes;

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

  it('removes a member from family as admin', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Admin Remove',
        email: 'admin-family-remove-member@example.com',
        senha: 'password123',
      },
    });

    const adminLoginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin-family-remove-member@example.com',
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
        nome: 'Familia Remover Membro',
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
        nome: 'Membro Remove',
        email: 'member-family-remove-member@example.com',
        senha: 'password123',
      },
    });

    const memberLoginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'member-family-remove-member@example.com',
        senha: 'password123',
      },
    });

    const { accessToken: memberAccessToken } = memberLoginResponse.json() as {
      accessToken: string;
    };

    await app.inject({
      method: 'POST',
      url: `/api/familias/entrar/${convite.codigo}`,
      headers: {
        authorization: `Bearer ${memberAccessToken}`,
      },
      payload: {},
    });

    const membersBeforeResponse = await app.inject({
      method: 'GET',
      url: `/api/familias/${familia.id}/membros`,
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
        'x-familia-id': familia.id,
      },
    });

    const membersBefore = (
      membersBeforeResponse.json() as {
        membros: Array<{ usuarioId: string; role: string }>;
      }
    ).membros;
    const removableMember = membersBefore.find((membro) => membro.role === 'membro');

    const removeResponse = await app.inject({
      method: 'DELETE',
      url: `/api/familias/${familia.id}/membros/${removableMember?.usuarioId}`,
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
        'x-familia-id': familia.id,
      },
    });

    expect(removeResponse.statusCode).toBe(204);

    const membersAfterResponse = await app.inject({
      method: 'GET',
      url: `/api/familias/${familia.id}/membros`,
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
        'x-familia-id': familia.id,
      },
    });

    expect(membersAfterResponse.statusCode).toBe(200);
    expect(membersAfterResponse.json()).toMatchObject({
      membros: [
        {
          role: 'admin',
        },
      ],
    });
  });

  it('switches active family for authenticated member', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Admin Alternar',
        email: 'admin-family-switch@example.com',
        senha: 'password123',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin-family-switch@example.com',
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
        nome: 'Familia Alternar',
      },
    });

    const { familia } = familyResponse.json() as { familia: { id: string } };

    const switchResponse = await app.inject({
      method: 'POST',
      url: '/api/familias/alternar',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        familiaId: familia.id,
      },
    });

    expect(switchResponse.statusCode).toBe(200);
    expect(switchResponse.json()).toMatchObject({
      familiaIdAtiva: familia.id,
    });
  });

  it('deletes family as admin and revokes family access', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Admin Delete',
        email: 'admin-family-delete@example.com',
        senha: 'password123',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin-family-delete@example.com',
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
        nome: 'Familia Excluir',
      },
    });

    const { familia } = familyResponse.json() as { familia: { id: string } };

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/familias/${familia.id}`,
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-familia-id': familia.id,
      },
    });

    expect(deleteResponse.statusCode).toBe(204);

    const switchAfterDeleteResponse = await app.inject({
      method: 'POST',
      url: '/api/familias/alternar',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        familiaId: familia.id,
      },
    });

    expect(switchAfterDeleteResponse.statusCode).toBe(403);
  });

  it('lists categories for active family', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Admin Categorias',
        email: 'admin-family-categories@example.com',
        senha: 'password123',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin-family-categories@example.com',
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
        nome: 'Familia Categorias',
      },
    });

    const { familia } = familyResponse.json() as { familia: { id: string } };

    const categoriesResponse = await app.inject({
      method: 'GET',
      url: '/api/categorias',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-familia-id': familia.id,
      },
    });

    expect(categoriesResponse.statusCode).toBe(200);
    expect(categoriesResponse.json()).toMatchObject({
      categorias: [],
    });
  });

  it('creates a category for active family', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Admin Categoria Create',
        email: 'admin-family-category-create@example.com',
        senha: 'password123',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin-family-category-create@example.com',
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
        nome: 'Familia Categoria Create',
      },
    });

    const { familia } = familyResponse.json() as { familia: { id: string } };

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/categorias',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-familia-id': familia.id,
      },
      payload: {
        nome: 'Alimentacao',
        tipo: 'despesa',
      },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json()).toMatchObject({
      categoria: {
        familiaId: familia.id,
        nome: 'Alimentacao',
        tipo: 'despesa',
        ativo: true,
      },
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/categorias',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-familia-id': familia.id,
      },
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      categorias: [
        {
          nome: 'Alimentacao',
          tipo: 'despesa',
        },
      ],
    });
  });

  it('updates a category from active family', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Admin Categoria Update',
        email: 'admin-family-category-update@example.com',
        senha: 'password123',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin-family-category-update@example.com',
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
        nome: 'Familia Categoria Update',
      },
    });

    const { familia } = familyResponse.json() as { familia: { id: string } };

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/categorias',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-familia-id': familia.id,
      },
      payload: {
        nome: 'Mercado',
        tipo: 'despesa',
      },
    });

    const { categoria } = createResponse.json() as { categoria: { id: string } };

    const updateResponse = await app.inject({
      method: 'PATCH',
      url: `/api/categorias/${categoria.id}`,
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-familia-id': familia.id,
      },
      payload: {
        nome: 'Supermercado',
        tipo: 'despesa',
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({
      categoria: {
        id: categoria.id,
        nome: 'Supermercado',
      },
    });
  });

  it('retorna 404 ao atualizar categoria inexistente', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { nome: 'Admin Cat 404', email: 'cat-update-404@example.com', senha: 'password123' },
    });
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'cat-update-404@example.com', senha: 'password123' },
    });
    const { accessToken } = loginResponse.json() as { accessToken: string };
    const familyResponse = await app.inject({
      method: 'POST',
      url: '/api/familias',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { nome: 'Familia Cat 404' },
    });
    const { familia } = familyResponse.json() as { familia: { id: string } };

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/categorias/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familia.id },
      payload: { nome: 'X', tipo: 'despesa' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('desativa categoria e retorna 404 ao tentar desativar inexistente', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { nome: 'Admin Cat Del', email: 'cat-delete@example.com', senha: 'password123' },
    });
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'cat-delete@example.com', senha: 'password123' },
    });
    const { accessToken } = loginResponse.json() as { accessToken: string };
    const familyResponse = await app.inject({
      method: 'POST',
      url: '/api/familias',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { nome: 'Familia Cat Del' },
    });
    const { familia } = familyResponse.json() as { familia: { id: string } };

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/categorias',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familia.id },
      payload: { nome: 'Categoria Para Deletar', tipo: 'despesa' },
    });
    const { categoria } = createResponse.json() as { categoria: { id: string } };

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/categorias/${categoria.id}`,
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familia.id },
    });
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json().categoria.ativo).toBe(false);

    const notFoundResponse = await app.inject({
      method: 'DELETE',
      url: '/api/categorias/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familia.id },
    });
    expect(notFoundResponse.statusCode).toBe(404);
  });
});

// ─── Métodos de Pagamento ────────────────────────────────────────────────────

describe('métodos de pagamento routes', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  async function setupUserAndFamily(email: string) {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { nome: 'User MP', email, senha: 'password123' },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, senha: 'password123' },
    });
    const { accessToken } = loginRes.json() as { accessToken: string };
    const familyRes = await app.inject({
      method: 'POST',
      url: '/api/familias',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { nome: 'Familia MP' },
    });
    const { familia } = familyRes.json() as { familia: { id: string } };
    return { accessToken, familiaId: familia.id };
  }

  it('cria, lista, atualiza e desativa método de pagamento', async () => {
    const { accessToken, familiaId } = await setupUserAndFamily('mp-crud@example.com');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/metodos-pagamento',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
      payload: { nome: 'Nubank', tipo: 'credito', dataFechamento: 15, dataVencimento: 22 },
    });
    expect(createRes.statusCode).toBe(201);
    const { metodoPagamento } = createRes.json() as { metodoPagamento: { id: string } };

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/metodos-pagamento',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().metodosPagamento).toHaveLength(1);

    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/metodos-pagamento/${metodoPagamento.id}`,
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
      payload: { nome: 'Nubank Black', tipo: 'credito', dataFechamento: 20, dataVencimento: 27 },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().metodoPagamento.nome).toBe('Nubank Black');

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/metodos-pagamento/${metodoPagamento.id}`,
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
    });
    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.json().metodoPagamento.ativo).toBe(false);
  });

  it('retorna 404 ao atualizar método inexistente', async () => {
    const { accessToken, familiaId } = await setupUserAndFamily('mp-notfound@example.com');
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/metodos-pagamento/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
      payload: { nome: 'X', tipo: 'pix', dataFechamento: null, dataVencimento: null },
    });
    expect(res.statusCode).toBe(404);
  });

  it('retorna 404 ao desativar método inexistente', async () => {
    const { accessToken, familiaId } = await setupUserAndFamily('mp-del-notfound@example.com');
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/metodos-pagamento/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ─── Transações ──────────────────────────────────────────────────────────────

describe('transacao routes', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  async function setupUserFamilyAndCategory(email: string) {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { nome: 'User TX', email, senha: 'password123' },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, senha: 'password123' },
    });
    const { accessToken } = loginRes.json() as { accessToken: string };
    const familyRes = await app.inject({
      method: 'POST',
      url: '/api/familias',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { nome: 'Familia TX' },
    });
    const { familia } = familyRes.json() as { familia: { id: string } };

    // Criar categoria via API (InMemory repo da rota de categorias é instância separada)
    const createCatRes = await app.inject({
      method: 'POST',
      url: '/api/categorias',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familia.id },
      payload: { nome: 'Alimentacao', tipo: 'despesa' },
    });
    const { categoria } = createCatRes.json() as { categoria: { id: string } };

    return { accessToken, familiaId: familia.id, categoriaId: categoria.id };
  }

  it('cria, lista, detalha, edita e exclui transação simples', async () => {
    const { accessToken, familiaId, categoriaId } =
      await setupUserFamilyAndCategory('tx-crud@example.com');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/transacoes',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
      payload: {
        tipo: 'despesa',
        valor: '150.00',
        categoriaId,
        data: '2026-03-10',
        parcelado: false,
        recorrente: false,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { transacao } = createRes.json() as { transacao: { id: string } };

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/transacoes',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().transacoes.length).toBeGreaterThan(0);

    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/transacoes/${transacao.id}`,
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
    });
    expect(detailRes.statusCode).toBe(200);
    expect(detailRes.json().transacao.id).toBe(transacao.id);

    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/transacoes/${transacao.id}`,
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
      payload: {
        tipo: 'despesa',
        valor: '200.00',
        categoriaId,
        data: '2026-03-10',
      },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().transacao.valor).toBe('200.00');

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/transacoes/${transacao.id}`,
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
    });
    expect(deleteRes.statusCode).toBe(204);
  });

  it('lista transações com filtros de querystring', async () => {
    const { accessToken, familiaId, categoriaId } = await setupUserFamilyAndCategory(
      'tx-list-filters@example.com',
    );

    await app.inject({
      method: 'POST',
      url: '/api/transacoes',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
      payload: {
        tipo: 'receita',
        valor: '5000.00',
        categoriaId,
        data: '2026-03-01',
        parcelado: false,
        recorrente: false,
      },
    });

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/transacoes?tipo=receita&mesReferencia=2026-03`,
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().transacoes.length).toBeGreaterThan(0);
  });

  it('retorna 404 ao detalhar transação inexistente', async () => {
    const { accessToken, familiaId } = await setupUserFamilyAndCategory(
      'tx-detail-404@example.com',
    );
    const res = await app.inject({
      method: 'GET',
      url: '/api/transacoes/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
    });
    expect(res.statusCode).toBe(404);
  });

  it('retorna 404 ao editar transação inexistente', async () => {
    const { accessToken, familiaId, categoriaId } = await setupUserFamilyAndCategory(
      'tx-update-404@example.com',
    );
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/transacoes/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
      payload: { tipo: 'despesa', valor: '10.00', categoriaId, data: '2026-03-10' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('retorna 404 ao excluir transação inexistente', async () => {
    const { accessToken, familiaId } = await setupUserFamilyAndCategory(
      'tx-delete-404@example.com',
    );
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/transacoes/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
    });
    expect(res.statusCode).toBe(404);
  });

  it('cria transação parcelada gerando parcelas', async () => {
    const { accessToken, familiaId, categoriaId } = await setupUserFamilyAndCategory(
      'tx-parcelada@example.com',
    );

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/transacoes',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
      payload: {
        tipo: 'despesa',
        valor: '600.00',
        categoriaId,
        data: '2026-03-10',
        parcelado: true,
        numeroParcelas: 3,
        recorrente: false,
      },
    });
    expect(createRes.statusCode).toBe(201);

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/transacoes',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
    });
    expect(listRes.json().transacoes.length).toBe(3);
  });

  it('adianta parcelas com POST /antecipar', async () => {
    const { accessToken, familiaId, categoriaId } = await setupUserFamilyAndCategory(
      'tx-antecipar@example.com',
    );

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/transacoes',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
      payload: {
        tipo: 'despesa',
        valor: '400.00',
        categoriaId,
        data: '2026-03-10',
        parcelado: true,
        numeroParcelas: 2,
        recorrente: false,
      },
    });
    const { transacao } = createRes.json() as { transacao: { id: string } };

    const anteciparRes = await app.inject({
      method: 'POST',
      url: `/api/transacoes/${transacao.id}/antecipar`,
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
      payload: { novoMesReferencia: '2026-03', dataMinima: '2026-03-10' },
    });
    expect(anteciparRes.statusCode).toBe(200);
  });

  it('retorna 404 ao antecipar transação inexistente', async () => {
    const { accessToken, familiaId } = await setupUserFamilyAndCategory(
      'tx-antecipar-404@example.com',
    );
    const res = await app.inject({
      method: 'POST',
      url: '/api/transacoes/00000000-0000-0000-0000-000000000000/antecipar',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
      payload: { novoMesReferencia: '2026-03', dataMinima: '2026-03-10' },
    });
    expect(res.statusCode).toBe(404);
  });
});
