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
  authLoginSchema,
  authLogoutSchema,
  authMeSchema,
  authRefreshSchema,
  authRegisterSchema,
} from './auth.schema.js';
import {
  AuthService,
  EmailAlreadyExistsError,
  InvalidCredentialsError,
} from './auth.service.js';

const defaultAuthService = (): AuthService => {
  if (env.NODE_ENV === 'test') {
    return new AuthService(new InMemoryAuthRepository());
  }

  return new AuthService(new DrizzleAuthRepository());
};

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const authService = defaultAuthService();
  const revokedRefreshTokens = new Set<string>();

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
      if (revokedRefreshTokens.has(payload.refreshToken)) {
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
  });

  fastify.post('/auth/logout', { schema: authLogoutSchema }, async (request, reply) => {
    const payload = authLogoutRequestSchema.parse(request.body);
    revokedRefreshTokens.add(payload.refreshToken);
    return reply.code(204).send();
  });

  fastify.get('/auth/me', { preHandler: [fastify.authenticate], schema: authMeSchema }, async (request) => {
    return {
      user: {
        id: request.user.sub,
        email: request.user.email,
      },
    };
  });
};
