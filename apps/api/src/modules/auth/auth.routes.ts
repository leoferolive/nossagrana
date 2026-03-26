import {
  authLoginRequestSchema,
  authLogoutRequestSchema,
  authRefreshRequestSchema,
  authRegisterRequestSchema,
} from '@nossagrana/types';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import { DrizzleAuthRepository, InMemoryAuthRepository } from './auth.repository.js';
import {
  authFamiliaContextSchema,
  authLoginSchema,
  authLogoutSchema,
  authMeSchema,
  authPerfilSchema,
  authRefreshSchema,
  authRegisterSchema,
  authUpdatePerfilSchema,
  authUpdateSenhaSchema,
} from './auth.schema.js';
import { AuthService, EmailAlreadyExistsError, InvalidCredentialsError } from './auth.service.js';
import {
  DrizzleRevokedTokenRepository,
  hashToken,
  InMemoryRevokedTokenRepository,
} from './revoked-token.repository.js';
import type { RevokedTokenRepository } from './revoked-token.repository.js';

const defaultAuthService = (): AuthService => {
  if (env.NODE_ENV === 'test') {
    return new AuthService(new InMemoryAuthRepository());
  }

  return new AuthService(new DrizzleAuthRepository());
};

const defaultRevokedTokenRepository = (): RevokedTokenRepository => {
  if (env.NODE_ENV === 'test') {
    return new InMemoryRevokedTokenRepository();
  }

  return new DrizzleRevokedTokenRepository();
};

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const authService = defaultAuthService();
  const revokedTokenRepo = defaultRevokedTokenRepository();

  fastify.post(
    '/auth/register',
    { schema: authRegisterSchema, config: { rateLimit: { max: 3, timeWindow: '1 minute' } } },
    async (request, reply) => {
      try {
        const payload = authRegisterRequestSchema.parse(request.body);
        const user = await authService.register(payload);
        return reply.code(201).send({ user });
      } catch (error) {
        if (error instanceof EmailAlreadyExistsError) {
          return reply.code(409).send({ message: error.message });
        }

        throw error;
      }
    },
  );

  fastify.post(
    '/auth/login',
    { schema: authLoginSchema, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      try {
        const payload = authLoginRequestSchema.parse(request.body);
        const authenticatedUser = await authService.login(payload);

        const accessToken = fastify.jwt.sign({
          sub: authenticatedUser.id,
          email: authenticatedUser.email,
        });

        const refreshToken = fastify.jwt.sign(
          {
            sub: authenticatedUser.id,
            email: authenticatedUser.email,
            tokenType: 'refresh',
          },
          {
            expiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
            key: env.REFRESH_TOKEN_SECRET,
          },
        );

        return reply.code(200).send({
          accessToken,
          refreshToken,
        });
      } catch (error) {
        if (error instanceof InvalidCredentialsError) {
          return reply.code(401).send({ message: error.message });
        }

        throw error;
      }
    },
  );

  fastify.post(
    '/auth/refresh',
    { schema: authRefreshSchema, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      try {
        const payload = authRefreshRequestSchema.parse(request.body);
        const tokenHash = hashToken(payload.refreshToken);

        const isRevoked = await revokedTokenRepo.isRevoked(tokenHash);
        if (isRevoked) {
          return reply.code(401).send({ message: 'Refresh token invalido' });
        }

        const decodedToken = fastify.jwt.verify<{
          sub: string;
          email: string;
          tokenType?: string;
        }>(payload.refreshToken, {
          key: env.REFRESH_TOKEN_SECRET,
        });

        if (decodedToken.tokenType !== 'refresh') {
          return reply.code(401).send({ message: 'Refresh token invalido' });
        }

        const accessToken = fastify.jwt.sign({
          sub: decodedToken.sub,
          email: decodedToken.email,
        });

        return reply.code(200).send({ accessToken });
      } catch {
        return reply.code(401).send({ message: 'Refresh token invalido' });
      }
    },
  );

  fastify.post('/auth/logout', { schema: authLogoutSchema }, async (request, reply) => {
    try {
      const payload = authLogoutRequestSchema.parse(request.body);

      const decodedToken = fastify.jwt.verify<{
        sub: string;
        tokenType?: string;
        exp?: number;
      }>(payload.refreshToken, {
        key: env.REFRESH_TOKEN_SECRET,
      });

      if (decodedToken.tokenType !== 'refresh') {
        return reply.code(401).send({ message: 'Refresh token invalido' });
      }

      const tokenHash = hashToken(payload.refreshToken);
      const expiresAtSeconds = decodedToken.exp ?? Math.floor(Date.now() / 1000);
      const expiresAt = new Date(expiresAtSeconds * 1000);
      await revokedTokenRepo.revokeToken(tokenHash, expiresAt, decodedToken.sub);

      return reply.code(204).send();
    } catch {
      return reply.code(401).send({ message: 'Refresh token invalido' });
    }
  });

  fastify.get(
    '/auth/me',
    { preHandler: [fastify.authenticate], schema: authMeSchema },
    async (request) => {
      return {
        user: {
          id: request.user.sub,
          email: request.user.email,
        },
      };
    },
  );

  fastify.get(
    '/auth/perfil',
    { preHandler: [fastify.authenticate], schema: authPerfilSchema },
    async (request) => {
      return authService.getPerfil(request.user.sub);
    },
  );

  fastify.patch(
    '/auth/perfil',
    { preHandler: [fastify.authenticate], schema: authUpdatePerfilSchema },
    async (request) => {
      const { nome } = authUpdatePerfilSchema.body.parse(request.body);
      return authService.updatePerfil(request.user.sub, nome);
    },
  );

  fastify.patch(
    '/auth/senha',
    { preHandler: [fastify.authenticate], schema: authUpdateSenhaSchema },
    async (request, reply) => {
      const { senhaAtual, novaSenha } = authUpdateSenhaSchema.body.parse(request.body);
      try {
        await authService.updateSenha(request.user.sub, senhaAtual, novaSenha);
        return reply.code(204).send();
      } catch {
        return reply.code(401).send({ message: 'Senha atual incorreta' });
      }
    },
  );

  fastify.get(
    '/auth/familia-context',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: authFamiliaContextSchema,
    },
    async (request) => {
      return { familiaId: request.familiaIdAtiva };
    },
  );
};
