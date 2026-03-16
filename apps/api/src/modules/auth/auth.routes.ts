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
  authDeleteAccountSchema,
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

const defaultAuthService = (): AuthService => {
  if (env.NODE_ENV === 'test') {
    return new AuthService(new InMemoryAuthRepository());
  }

  return new AuthService(new DrizzleAuthRepository());
};

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const authService = defaultAuthService();
  const revokedRefreshTokens = new Map<string, number>();
  const maxRevokedRefreshTokens = 5000;

  const cleanupRevokedRefreshTokens = (nowSeconds: number) => {
    for (const [token, expiresAt] of revokedRefreshTokens.entries()) {
      if (expiresAt <= nowSeconds) {
        revokedRefreshTokens.delete(token);
      }
    }

    while (revokedRefreshTokens.size > maxRevokedRefreshTokens) {
      const oldestToken = revokedRefreshTokens.keys().next().value;
      if (!oldestToken) {
        break;
      }

      revokedRefreshTokens.delete(oldestToken);
    }
  };

  fastify.post('/auth/register', { schema: authRegisterSchema }, async (request, reply) => {
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
  });

  fastify.post('/auth/login', { schema: authLoginSchema }, async (request, reply) => {
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
  });

  fastify.post('/auth/refresh', { schema: authRefreshSchema }, async (request, reply) => {
    try {
      const payload = authRefreshRequestSchema.parse(request.body);
      const nowSeconds = Math.floor(Date.now() / 1000);
      cleanupRevokedRefreshTokens(nowSeconds);

      const revokedExpiration = revokedRefreshTokens.get(payload.refreshToken);
      if (revokedExpiration && revokedExpiration > nowSeconds) {
        return reply.code(401).send({ message: 'Refresh token invalido' });
      }

      revokedRefreshTokens.delete(payload.refreshToken);

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
  });

  fastify.post('/auth/logout', { schema: authLogoutSchema }, async (request, reply) => {
    try {
      const payload = authLogoutRequestSchema.parse(request.body);

      const decodedToken = fastify.jwt.verify<{
        tokenType?: string;
        exp?: number;
      }>(payload.refreshToken, {
        key: env.REFRESH_TOKEN_SECRET,
      });

      if (decodedToken.tokenType !== 'refresh') {
        return reply.code(401).send({ message: 'Refresh token invalido' });
      }

      const nowSeconds = Math.floor(Date.now() / 1000);
      const expiresAt = decodedToken.exp ?? nowSeconds;
      revokedRefreshTokens.set(payload.refreshToken, expiresAt);
      cleanupRevokedRefreshTokens(nowSeconds);

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
      const { nome } = request.body as { nome: string };
      return authService.updatePerfil(request.user.sub, nome);
    },
  );

  fastify.patch(
    '/auth/senha',
    { preHandler: [fastify.authenticate], schema: authUpdateSenhaSchema },
    async (request, reply) => {
      const { senhaAtual, novaSenha } = request.body as {
        senhaAtual: string;
        novaSenha: string;
      };
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

  fastify.delete(
    '/auth/account',
    { preHandler: [fastify.authenticate], schema: authDeleteAccountSchema },
    async (request, reply) => {
      await authService.deleteAccount(request.user.sub);
      return reply.code(204).send();
    },
  );
};
