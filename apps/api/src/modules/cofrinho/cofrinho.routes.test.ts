import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';

describe('Cofrinho Routes', () => {
  const app = buildApp();
  let validToken: string;
  const familiaId = randomUUID();

  const authHeaders = () => ({
    Authorization: `Bearer ${validToken}`,
    'x-familia-id': familiaId,
  });

  beforeAll(async () => {
    await app.ready();

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nome: 'Cofrinho User',
        email: 'cofrinho@example.com',
        senha: 'password123',
      },
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'cofrinho@example.com', senha: 'password123' },
    });

    validToken = loginRes.json().accessToken;
  });

  afterAll(() => app.close());

  describe('POST /api/cofrinhos', () => {
    it('retorna 201 e cria cofrinho', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/cofrinhos',
        headers: authHeaders(),
        payload: { nome: 'Viagem' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toHaveProperty('cofrinho');
      expect(body.cofrinho.nome).toBe('Viagem');
      expect(body.cofrinho.saldoAtual).toBe('0');
      expect(body.cofrinho.status).toBe('ativo');
      expect(body.cofrinho.familiaId).toBe(familiaId);
    });

    it('retorna 201 com campos opcionais', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/cofrinhos',
        headers: authHeaders(),
        payload: {
          nome: 'Reserva',
          emoji: '🏖️',
          descricao: 'Fundo de reserva',
          metaValor: '5000.00',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.cofrinho.emoji).toBe('🏖️');
      expect(body.cofrinho.descricao).toBe('Fundo de reserva');
      expect(body.cofrinho.metaValor).toBe('5000.00');
    });

    it('retorna 401 sem autenticação', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/cofrinhos',
        headers: { 'x-familia-id': familiaId },
        payload: { nome: 'Teste' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/cofrinhos', () => {
    it('retorna 200 com lista de cofrinhos', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/cofrinhos',
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('cofrinhos');
      expect(Array.isArray(body.cofrinhos)).toBe(true);
      expect(body.cofrinhos.length).toBeGreaterThanOrEqual(1);
    });

    it('retorna 200 com filtro de status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/cofrinhos?status=encerrado',
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.cofrinhos).toHaveLength(0);
    });
  });

  describe('GET /api/cofrinhos/:id', () => {
    it('retorna 200 com detalhe do cofrinho e movimentacoes', async () => {
      // criar cofrinho primeiro
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/cofrinhos',
        headers: authHeaders(),
        payload: { nome: 'Detalhe Test' },
      });
      const cofrinhoId = createRes.json().cofrinho.id;

      const res = await app.inject({
        method: 'GET',
        url: `/api/cofrinhos/${cofrinhoId}`,
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('cofrinho');
      expect(body).toHaveProperty('movimentacoes');
      expect(body).toHaveProperty('aporteRecorrenteAtivo');
      expect(body.cofrinho.id).toBe(cofrinhoId);
      expect(Array.isArray(body.movimentacoes)).toBe(true);
    });

    it('retorna 404 para cofrinho inexistente', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/cofrinhos/${randomUUID()}`,
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/cofrinhos/:id', () => {
    it('retorna 200 e atualiza cofrinho', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/cofrinhos',
        headers: authHeaders(),
        payload: { nome: 'Original' },
      });
      const cofrinhoId = createRes.json().cofrinho.id;

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/cofrinhos/${cofrinhoId}`,
        headers: authHeaders(),
        payload: { nome: 'Atualizado' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.cofrinho.nome).toBe('Atualizado');
    });
  });

  describe('POST /api/cofrinhos/:id/aportes', () => {
    it('retorna 201 e registra aporte', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/cofrinhos',
        headers: authHeaders(),
        payload: { nome: 'Aporte Test' },
      });
      const cofrinhoId = createRes.json().cofrinho.id;

      const res = await app.inject({
        method: 'POST',
        url: `/api/cofrinhos/${cofrinhoId}/aportes`,
        headers: authHeaders(),
        payload: { valor: '100.00' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toHaveProperty('cofrinho');
      expect(body).toHaveProperty('movimentacao');
      expect(body.cofrinho.saldoAtual).toBe('100.00');
      expect(body.movimentacao.tipo).toBe('aporte');
      expect(body.movimentacao.valor).toBe('100.00');
    });

    it('grava a transação do aporte no mesmo repositório visto por /transacoes', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/cofrinhos',
        headers: authHeaders(),
        payload: { nome: 'Aporte Visivel' },
      });
      const cofrinhoId = createRes.json().cofrinho.id;

      const res = await app.inject({
        method: 'POST',
        url: `/api/cofrinhos/${cofrinhoId}/aportes`,
        headers: authHeaders(),
        payload: { valor: '12.34' },
      });
      const lista = await app.inject({
        method: 'GET',
        url: '/api/transacoes',
        headers: authHeaders(),
      });

      const transacaoId = res.json().movimentacao.transacaoId;
      const ids = (lista.json().transacoes as Array<{ id: string }>).map((t) => t.id);
      expect(ids).toContain(transacaoId);
    });

    it('retorna 400 para aporte recorrente (porta não configurada) sem alterar o saldo', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/cofrinhos',
        headers: authHeaders(),
        payload: { nome: 'Recorrente Indisponivel' },
      });
      const cofrinhoId = createRes.json().cofrinho.id;

      const res = await app.inject({
        method: 'POST',
        url: `/api/cofrinhos/${cofrinhoId}/aportes`,
        headers: authHeaders(),
        payload: { valor: '10.00', recorrente: true, frequencia: 'mensal' },
      });
      const detalhe = await app.inject({
        method: 'GET',
        url: `/api/cofrinhos/${cofrinhoId}`,
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain('recorrente');
      expect(detalhe.json().cofrinho.saldoAtual).toBe('0');
    });

    it('retorna 404 para cofrinho inexistente', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/cofrinhos/${randomUUID()}/aportes`,
        headers: authHeaders(),
        payload: { valor: '50.00' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/cofrinhos/:id/retiradas', () => {
    it('retorna 201 e registra retirada', async () => {
      // criar e aportar
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/cofrinhos',
        headers: authHeaders(),
        payload: { nome: 'Retirada Test' },
      });
      const cofrinhoId = createRes.json().cofrinho.id;

      await app.inject({
        method: 'POST',
        url: `/api/cofrinhos/${cofrinhoId}/aportes`,
        headers: authHeaders(),
        payload: { valor: '200.00' },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/cofrinhos/${cofrinhoId}/retiradas`,
        headers: authHeaders(),
        payload: { valor: '50.00', voltarAoSaldo: false },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.cofrinho.saldoAtual).toBe('150.00');
      expect(body.movimentacao.tipo).toBe('retirada');
      expect(body.movimentacao.valor).toBe('50.00');
    });

    it('retorna 400 para saldo insuficiente', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/cofrinhos',
        headers: authHeaders(),
        payload: { nome: 'Saldo Insuficiente Test' },
      });
      const cofrinhoId = createRes.json().cofrinho.id;

      const res = await app.inject({
        method: 'POST',
        url: `/api/cofrinhos/${cofrinhoId}/retiradas`,
        headers: authHeaders(),
        payload: { valor: '100.00', voltarAoSaldo: false },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('validação de valor (aporte e retirada)', () => {
    async function cofrinhoComSaldo() {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/cofrinhos',
        headers: authHeaders(),
        payload: { nome: 'Validacao Valor' },
      });
      const cofrinhoId = createRes.json().cofrinho.id as string;
      await app.inject({
        method: 'POST',
        url: `/api/cofrinhos/${cofrinhoId}/aportes`,
        headers: authHeaders(),
        payload: { valor: '10.00' },
      });
      return cofrinhoId;
    }

    it.each([
      ['aportes', '12345678901', {}],
      ['aportes', '0', {}],
      ['aportes', '0.00', {}],
      ['retiradas', '12345678901', { voltarAoSaldo: false }],
      ['retiradas', '0', { voltarAoSaldo: false }],
    ])('POST %s com valor "%s" → 400 sem SQL e sem alterar saldo', async (rota, valor, extra) => {
      const cofrinhoId = await cofrinhoComSaldo();

      const res = await app.inject({
        method: 'POST',
        url: `/api/cofrinhos/${cofrinhoId}/${rota}`,
        headers: authHeaders(),
        payload: { valor, ...extra },
      });
      const detalhe = await app.inject({
        method: 'GET',
        url: `/api/cofrinhos/${cofrinhoId}`,
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(400);
      expect(res.body).not.toMatch(/insert|update|select|cofrinhos"|numeric/i);
      expect(detalhe.json().cofrinho.saldoAtual).toBe('10.00');
    });

    it('aceita o maior valor de numeric(12,2): 10 dígitos inteiros', async () => {
      const cofrinhoId = await cofrinhoComSaldo();

      const res = await app.inject({
        method: 'POST',
        url: `/api/cofrinhos/${cofrinhoId}/retiradas`,
        headers: authHeaders(),
        payload: { valor: '9999999999.99', voltarAoSaldo: false },
      });

      expect(res.statusCode).toBe(400); // saldo insuficiente, mas passou da validação de formato
      expect(res.json().message).toMatch(/Saldo insuficiente/);
    });
  });

  describe('POST /api/cofrinhos/:id/encerrar', () => {
    it('retorna 200 e encerra cofrinho', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/cofrinhos',
        headers: authHeaders(),
        payload: { nome: 'Encerrar Test' },
      });
      const cofrinhoId = createRes.json().cofrinho.id;

      const res = await app.inject({
        method: 'POST',
        url: `/api/cofrinhos/${cofrinhoId}/encerrar`,
        headers: authHeaders(),
        payload: { voltarAoSaldo: false },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.cofrinho.status).toBe('encerrado');
      expect(body.cofrinho.encerradoEm).toBeTruthy();
    });

    it('retorna 400 ao encerrar cofrinho já encerrado', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/cofrinhos',
        headers: authHeaders(),
        payload: { nome: 'Duplo Encerrar' },
      });
      const cofrinhoId = createRes.json().cofrinho.id;

      await app.inject({
        method: 'POST',
        url: `/api/cofrinhos/${cofrinhoId}/encerrar`,
        headers: authHeaders(),
        payload: { voltarAoSaldo: false },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/cofrinhos/${cofrinhoId}/encerrar`,
        headers: authHeaders(),
        payload: { voltarAoSaldo: false },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/cofrinhos/:id/aporte-recorrente', () => {
    it('retorna 404 quando nao existe aporte recorrente', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/cofrinhos',
        headers: authHeaders(),
        payload: { nome: 'Recorrente Test' },
      });
      const cofrinhoId = createRes.json().cofrinho.id;

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/cofrinhos/${cofrinhoId}/aporte-recorrente`,
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
