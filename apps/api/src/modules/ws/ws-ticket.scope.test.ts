import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLimit = vi.hoisted(() => vi.fn());

// Fora de NODE_ENV=test o `requireFamiliaScope` consulta o vínculo de verdade.
vi.mock('../../config/env.js', () => ({ env: { NODE_ENV: 'development' } }));
vi.mock('../../db/client.js', () => ({
  db: {
    select: () => ({
      from: () => ({ innerJoin: () => ({ where: () => ({ limit: mockLimit }) }) }),
    }),
  },
}));

const FAMILIA = '11111111-1111-4111-8111-111111111111';
const ATIVA = [{ deletedAt: null }];
const EXCLUIDA = [{ deletedAt: new Date('2026-09-01') }];
const SEM_VINCULO: never[] = [];
const LIMITE_POR_MINUTO = 20;

async function createApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  // Limite global frouxo: prova que o limite da própria rota (20/min) é o que vale.
  await app.register(import('@fastify/rate-limit'), { max: 1000, timeWindow: '1 minute' });
  app.decorate('authenticate', async (request) => {
    const sub = String(request.headers['x-test-user'] ?? 'user-1');
    Object.assign(request, { user: { sub, email: 'user@example.com', iat: 1000 } });
  });
  const { familiaScopePlugin } = await import('../../plugins/familia-scope.plugin.js');
  const { websocketPlugin } = await import('../../plugins/websocket.plugin.js');
  const { sessaoRevogacaoPlugin } = await import('../../plugins/sessao-revogacao.plugin.js');
  const { wsTicketPlugin } = await import('../../plugins/ws-ticket.plugin.js');
  const { InMemoryRevokedTokenRepository } = await import('../auth/revoked-token.repository.js');
  const { wsTicketRoutes } = await import('./ws-ticket.routes.js');
  await app.register(familiaScopePlugin);
  await app.register(websocketPlugin);
  await app.register(sessaoRevogacaoPlugin, {
    tokensRevogados: new InMemoryRevokedTokenRepository(),
  });
  await app.register(wsTicketPlugin);
  await app.register(wsTicketRoutes);
  await app.ready();
  return app;
}

const pedirTicket = (app: Awaited<ReturnType<typeof createApp>>, usuario = 'user-1') =>
  app.inject({
    method: 'POST',
    url: '/ws/ticket',
    headers: { 'x-familia-id': FAMILIA, 'x-test-user': usuario },
  });

describe('POST /ws/ticket — membership e rate limit (#118)', () => {
  beforeEach(() => {
    mockLimit.mockReset();
  });

  it('membro de família ativa recebe ticket', async () => {
    mockLimit.mockResolvedValue(ATIVA);
    const app = await createApp();
    try {
      const resposta = await pedirTicket(app);

      expect(resposta.statusCode).toBe(200);
      expect(await app.wsTickets.consumir(resposta.json().ticket, FAMILIA)).toMatchObject({
        userId: 'user-1',
        familiaId: FAMILIA,
      });
    } finally {
      await app.close();
    }
  });

  it('usuário sem vínculo com a família: 403 e nenhum ticket emitido', async () => {
    mockLimit.mockResolvedValue(SEM_VINCULO);
    const app = await createApp();
    try {
      const emitir = vi.spyOn(app.wsTickets, 'emitir');

      const resposta = await pedirTicket(app);

      expect(resposta.statusCode).toBe(403);
      expect(resposta.json()).toMatchObject({ error: { code: 'FAMILIA_SEM_ACESSO' } });
      expect(emitir).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('família excluída: 403 e nenhum ticket emitido', async () => {
    mockLimit.mockResolvedValue(EXCLUIDA);
    const app = await createApp();
    try {
      const emitir = vi.spyOn(app.wsTickets, 'emitir');

      const resposta = await pedirTicket(app);

      expect(resposta.statusCode).toBe(403);
      expect(emitir).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it(`rate limit: a ${LIMITE_POR_MINUTO + 1}ª emissão no minuto recebe 429`, async () => {
    mockLimit.mockResolvedValue(ATIVA);
    const app = await createApp();
    try {
      for (let i = 0; i < LIMITE_POR_MINUTO; i += 1) {
        expect((await pedirTicket(app)).statusCode).toBe(200);
      }

      expect((await pedirTicket(app)).statusCode).toBe(429);
    } finally {
      await app.close();
    }
  });

  it('rate limit é por usuário autenticado, não por IP: outro usuário no mesmo IP não é afetado', async () => {
    mockLimit.mockResolvedValue(ATIVA);
    const app = await createApp();
    try {
      for (let i = 0; i < LIMITE_POR_MINUTO; i += 1) await pedirTicket(app, 'ana');
      expect((await pedirTicket(app, 'ana')).statusCode).toBe(429);

      expect((await pedirTicket(app, 'bruno')).statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});
