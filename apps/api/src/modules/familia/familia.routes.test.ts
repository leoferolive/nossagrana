import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';

describe('Familia Routes', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // Helper: registra e faz login, retorna accessToken
  const registrarELogar = async (email: string) => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { nome: 'Usuario Teste', email, senha: 'password123' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, senha: 'password123' },
    });
    return (login.json() as { accessToken: string }).accessToken;
  };

  let emailCounter = 0;
  const nextEmail = () => `user${++emailCounter}@familia-test.com`;

  beforeEach(() => {
    emailCounter = 0;
  });

  // ─── UC05: Criar família ─────────────────────────────────────────────────
  describe('POST /familias', () => {
    it('cria família e retorna 201 com role admin', async () => {
      const token = await registrarELogar(nextEmail());

      const response = await app.inject({
        method: 'POST',
        url: '/api/familias',
        headers: { authorization: `Bearer ${token}` },
        payload: { nome: 'Família Teste' },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ nome: 'Família Teste', role: 'admin' });
    });

    it('retorna 401 sem token', async () => {
      const response = await app.inject({ method: 'POST', url: '/api/familias', payload: { nome: 'X' } });
      expect(response.statusCode).toBe(401);
    });
  });

  // ─── GET /familias ───────────────────────────────────────────────────────
  describe('GET /familias', () => {
    it('lista famílias do usuário autenticado', async () => {
      const token = await registrarELogar(nextEmail());
      await app.inject({
        method: 'POST',
        url: '/api/familias',
        headers: { authorization: `Bearer ${token}` },
        payload: { nome: 'Minha Família' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/familias',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const familias = response.json() as unknown[];
      expect(familias.length).toBeGreaterThan(0);
    });
  });

  // ─── UC21: Gerar convite ─────────────────────────────────────────────────
  describe('POST /familias/:id/convites', () => {
    it('gera convite como admin e retorna 201 com código', async () => {
      const token = await registrarELogar(nextEmail());
      const criarRes = await app.inject({
        method: 'POST',
        url: '/api/familias',
        headers: { authorization: `Bearer ${token}` },
        payload: { nome: 'Família Convite' },
      });
      const { id } = criarRes.json() as { id: string };

      const response = await app.inject({
        method: 'POST',
        url: `/api/familias/${id}/convites`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ codigo: expect.any(String), expiraEm: expect.any(String) });
    });

    it('retorna 403 se não é admin', async () => {
      const adminToken = await registrarELogar(nextEmail());
      const membroToken = await registrarELogar(nextEmail());
      const criarRes = await app.inject({
        method: 'POST',
        url: '/api/familias',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { nome: 'Família Admin' },
      });
      const { id } = criarRes.json() as { id: string };

      const response = await app.inject({
        method: 'POST',
        url: `/api/familias/${id}/convites`,
        headers: { authorization: `Bearer ${membroToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  // ─── UC03: Entrar via convite ────────────────────────────────────────────
  describe('POST /familias/entrar', () => {
    it('entra na família com convite válido e retorna 200', async () => {
      const adminToken = await registrarELogar(nextEmail());
      const membroToken = await registrarELogar(nextEmail());

      const criarRes = await app.inject({
        method: 'POST',
        url: '/api/familias',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { nome: 'Família Convite' },
      });
      const { id } = criarRes.json() as { id: string };

      const conviteRes = await app.inject({
        method: 'POST',
        url: `/api/familias/${id}/convites`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const { codigo } = conviteRes.json() as { codigo: string };

      const response = await app.inject({
        method: 'POST',
        url: '/api/familias/entrar',
        headers: { authorization: `Bearer ${membroToken}` },
        payload: { codigo },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ familiaId: id, role: 'membro' });
    });

    it('retorna 400 para código inválido', async () => {
      const token = await registrarELogar(nextEmail());
      const response = await app.inject({
        method: 'POST',
        url: '/api/familias/entrar',
        headers: { authorization: `Bearer ${token}` },
        payload: { codigo: 'INVALIDO' },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  // ─── UC04: Solicitar entrada ─────────────────────────────────────────────
  describe('POST /familias/solicitar', () => {
    it('cria solicitação pendente e retorna 201', async () => {
      const adminToken = await registrarELogar(nextEmail());
      const solicitanteToken = await registrarELogar(nextEmail());

      const criarRes = await app.inject({
        method: 'POST',
        url: '/api/familias',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { nome: 'Família Solicitar' },
      });
      const { id } = criarRes.json() as { id: string };

      const response = await app.inject({
        method: 'POST',
        url: '/api/familias/solicitar',
        headers: { authorization: `Bearer ${solicitanteToken}` },
        payload: { familiaId: id },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ status: 'pendente', familiaId: id });
    });
  });

  // ─── UC22: Aprovar/rejeitar ──────────────────────────────────────────────
  describe('PATCH /familias/:id/solicitacoes/:solicitacaoId', () => {
    it('aprova solicitação como admin', async () => {
      const adminToken = await registrarELogar(nextEmail());
      const solicitanteToken = await registrarELogar(nextEmail());

      const criarRes = await app.inject({
        method: 'POST',
        url: '/api/familias',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { nome: 'Família Aprovar' },
      });
      const { id } = criarRes.json() as { id: string };

      const solRes = await app.inject({
        method: 'POST',
        url: '/api/familias/solicitar',
        headers: { authorization: `Bearer ${solicitanteToken}` },
        payload: { familiaId: id },
      });
      const { id: solicitacaoId } = solRes.json() as { id: string };

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/familias/${id}/solicitacoes/${solicitacaoId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { acao: 'aprovar' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ status: 'aprovada' });
    });
  });

  // ─── UC23: Remover membro ────────────────────────────────────────────────
  describe('DELETE /familias/:id/membros/:usuarioId', () => {
    it('remove membro como admin e retorna 204', async () => {
      const adminToken = await registrarELogar(nextEmail());
      const membroToken = await registrarELogar(nextEmail());

      const criarRes = await app.inject({
        method: 'POST',
        url: '/api/familias',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { nome: 'Família Remover' },
      });
      const { id } = criarRes.json() as { id: string };

      const conviteRes = await app.inject({
        method: 'POST',
        url: `/api/familias/${id}/convites`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const { codigo } = conviteRes.json() as { codigo: string };
      await app.inject({
        method: 'POST',
        url: '/api/familias/entrar',
        headers: { authorization: `Bearer ${membroToken}` },
        payload: { codigo },
      });

      // Precisa do usuarioId do membro
      const membrosRes = await app.inject({
        method: 'GET',
        url: `/api/familias/${id}/membros`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const membros = membrosRes.json() as Array<{ usuarioId: string; role: string }>;
      const membro = membros.find((m) => m.role === 'membro')!;

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/familias/${id}/membros/${membro.usuarioId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(204);
    });
  });

  // ─── UC24: Excluir família ───────────────────────────────────────────────
  describe('DELETE /familias/:id', () => {
    it('exclui família como admin e retorna 204', async () => {
      const adminToken = await registrarELogar(nextEmail());

      const criarRes = await app.inject({
        method: 'POST',
        url: '/api/familias',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { nome: 'Família Excluir' },
      });
      const { id } = criarRes.json() as { id: string };

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/familias/${id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(204);
    });

    it('retorna 403 se não é admin', async () => {
      const adminToken = await registrarELogar(nextEmail());
      const membroToken = await registrarELogar(nextEmail());

      const criarRes = await app.inject({
        method: 'POST',
        url: '/api/familias',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { nome: 'Família Excluir2' },
      });
      const { id } = criarRes.json() as { id: string };

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/familias/${id}`,
        headers: { authorization: `Bearer ${membroToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  // ─── UC20: Alternar família ──────────────────────────────────────────────
  describe('POST /familias/alternar', () => {
    it('retorna 200 com familiaId quando usuário é membro', async () => {
      const token = await registrarELogar(nextEmail());

      const criarRes = await app.inject({
        method: 'POST',
        url: '/api/familias',
        headers: { authorization: `Bearer ${token}` },
        payload: { nome: 'Família Alternar' },
      });
      const { id } = criarRes.json() as { id: string };

      const response = await app.inject({
        method: 'POST',
        url: '/api/familias/alternar',
        headers: { authorization: `Bearer ${token}` },
        payload: { familiaId: id },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ familiaId: id });
    });

    it('retorna 403 se usuário não é membro da família', async () => {
      const token = await registrarELogar(nextEmail());
      const outroToken = await registrarELogar(nextEmail());

      const criarRes = await app.inject({
        method: 'POST',
        url: '/api/familias',
        headers: { authorization: `Bearer ${token}` },
        payload: { nome: 'Família Outra' },
      });
      const { id } = criarRes.json() as { id: string };

      const response = await app.inject({
        method: 'POST',
        url: '/api/familias/alternar',
        headers: { authorization: `Bearer ${outroToken}` },
        payload: { familiaId: id },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
