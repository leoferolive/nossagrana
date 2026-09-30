import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import {
  DrizzleRevokedTokenRepository,
  type RevokedTokenRepository,
} from '../modules/auth/revoked-token.repository.js';
import { SessaoRevogacaoService } from '../modules/auth/sessao-revogacao.service.js';
import { repositoriosInMemoryDe } from '../shared/repositorios-in-memory.js';
import {
  EventBusSessaoLifecyclePublisher,
  NoopSessaoLifecyclePublisher,
  type SessaoLifecyclePublisher,
} from '../shared/sessao-lifecycle/sessao-lifecycle.events.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** Revogação global de sessões (#119), única para auth e WebSocket desta instância. */
    sessoes: SessaoRevogacaoService;
    /** Repositório de refresh tokens revogados; o mesmo que alimenta `sessoes`. */
    tokensRevogados: RevokedTokenRepository;
  }
}

export interface SessaoRevogacaoPluginOptions {
  /** Injeção para testes; por padrão: InMemory compartilhado (test) ou Drizzle. */
  tokensRevogados?: RevokedTokenRepository;
}

function tokensRevogadosPadrao(fastify: FastifyInstance): RevokedTokenRepository {
  if (env.NODE_ENV === 'test') return repositoriosInMemoryDe(fastify).tokensRevogados;
  return new DrizzleRevokedTokenRepository(db);
}

function publisherDe(fastify: FastifyInstance): SessaoLifecyclePublisher {
  if (fastify.eventBus) return new EventBusSessaoLifecyclePublisher(fastify.eventBus, fastify.log);
  // Sem `eventBus` os sockets do usuário não são fechados na revogação; acontece se o
  // `websocketPlugin` for registrado depois deste plugin em `app.ts` (#119).
  fastify.log.warn(
    'eventBus ausente ao registrar sessaoRevogacaoPlugin: revogar sessões não fechará sockets; registre websocketPlugin antes',
  );
  return new NoopSessaoLifecyclePublisher();
}

/** Registrar DEPOIS do `websocketPlugin` (precisa do `eventBus`) e antes de auth/ws routes. */
export const sessaoRevogacaoPlugin = fp<SessaoRevogacaoPluginOptions>(async (fastify, opts) => {
  const tokensRevogados = opts.tokensRevogados ?? tokensRevogadosPadrao(fastify);
  fastify.decorate('tokensRevogados', tokensRevogados);
  fastify.decorate('sessoes', new SessaoRevogacaoService(tokensRevogados, publisherDe(fastify)));
});
