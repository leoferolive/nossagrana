import { authLoginRequestSchema, authRegisterRequestSchema } from '@nossagrana/types';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import { DrizzleAuthRepository, InMemoryAuthRepository } from './auth.repository.js';
import { authLoginSchema, authRegisterSchema } from './auth.schema.js';
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
};
