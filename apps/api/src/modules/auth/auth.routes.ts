import {
  authLoginRequestSchema,
  authLogoutRequestSchema,
  authRefreshRequestSchema,
  authRegisterRequestSchema,
} from '@nossagrana/types';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import { ConsoleEmailSender } from '../email/email.console-sender.js';
import { EmailService } from '../email/email.service.js';
import { SmtpEmailSender } from '../email/email.smtp-sender.js';

import { DrizzleAuthRepository, InMemoryAuthRepository } from './auth.repository.js';
import {
  authFamiliaContextSchema,
  authForgotPasswordSchema,
  authLoginSchema,
  authLogoutSchema,
  authMeSchema,
  authPerfilSchema,
  authRefreshSchema,
  authRegisterSchema,
  authResetPasswordSchema,
  authUpdatePerfilSchema,
  authUpdateSenhaSchema,
} from './auth.schema.js';
import {
  AuthService,
  EmailAlreadyExistsError,
  hashPassword,
  InvalidCredentialsError,
} from './auth.service.js';
import {
  DrizzlePasswordResetRepository,
  InMemoryPasswordResetRepository,
} from './password-reset.repository.js';
import { InvalidResetTokenError, PasswordResetService } from './password-reset.service.js';
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

const defaultEmailService = (): EmailService => {
  if (env.SMTP_USERNAME) {
    const sender = new SmtpEmailSender({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USERNAME,
      pass: env.SMTP_PASSWORD,
      from: env.EMAIL_FROM,
      fromName: env.EMAIL_FROM_NAME,
    });
    return new EmailService(sender);
  }

  return new EmailService(new ConsoleEmailSender());
};

const defaultPasswordResetService = (emailService: EmailService): PasswordResetService => {
  if (env.NODE_ENV === 'test') {
    return new PasswordResetService(
      new InMemoryAuthRepository(),
      new InMemoryPasswordResetRepository(),
      emailService,
      env.CORS_ORIGIN,
      hashPassword,
    );
  }

  return new PasswordResetService(
    new DrizzleAuthRepository(),
    new DrizzlePasswordResetRepository(),
    emailService,
    env.CORS_ORIGIN,
    hashPassword,
  );
};

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const authService = defaultAuthService();
  const revokedTokenRepo = defaultRevokedTokenRepository();
  const emailService = defaultEmailService();
  const passwordResetService = defaultPasswordResetService(emailService);

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

        // Verificar se token específico foi revogado (reuso = roubo)
        const isTokenRevoked = await revokedTokenRepo.isRevoked(tokenHash);
        if (isTokenRevoked) {
          try {
            const decoded = fastify.jwt.verify<{ sub: string }>(payload.refreshToken, {
              key: env.REFRESH_TOKEN_SECRET,
            });
            await revokedTokenRepo.revokeAllByUserId(decoded.sub);
          } catch {
            // Token expirado/inválido — não conseguimos decodificar userId
          }
          return reply
            .code(401)
            .send({ message: 'Token reuse detected', code: 'TOKEN_REUSE_DETECTED' });
        }

        const decodedToken = fastify.jwt.verify<{
          sub: string;
          email: string;
          tokenType?: string;
          exp?: number;
        }>(payload.refreshToken, {
          key: env.REFRESH_TOKEN_SECRET,
        });

        if (decodedToken.tokenType !== 'refresh') {
          return reply.code(401).send({ message: 'Refresh token invalido' });
        }

        // Verificar se o userId foi marcado como comprometido
        const isCompromised = await revokedTokenRepo.isUserCompromised(decodedToken.sub);
        if (isCompromised) {
          return reply
            .code(401)
            .send({ message: 'Token reuse detected', code: 'TOKEN_REUSE_DETECTED' });
        }

        // Revogar o token atual ANTES de gerar o novo
        const expiresAtSeconds = decodedToken.exp ?? Math.floor(Date.now() / 1000);
        const expiresAt = new Date(expiresAtSeconds * 1000);
        await revokedTokenRepo.revokeToken(tokenHash, expiresAt, decodedToken.sub);

        // Gerar novo par
        const accessToken = fastify.jwt.sign({
          sub: decodedToken.sub,
          email: decodedToken.email,
        });

        const refreshToken = fastify.jwt.sign(
          {
            sub: decodedToken.sub,
            email: decodedToken.email,
            tokenType: 'refresh',
          },
          {
            expiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
            key: env.REFRESH_TOKEN_SECRET,
          },
        );

        return reply.code(200).send({ accessToken, refreshToken });
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

  fastify.post(
    '/auth/forgot-password',
    { schema: authForgotPasswordSchema, config: { rateLimit: { max: 3, timeWindow: '1 minute' } } },
    async (request) => {
      const { email } = authForgotPasswordSchema.body.parse(request.body);
      await passwordResetService.requestReset(email);
      return { message: 'Se o e-mail existir, um link de redefinição será enviado.' };
    },
  );

  fastify.post(
    '/auth/reset-password',
    { schema: authResetPasswordSchema, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { token, novaSenha } = authResetPasswordSchema.body.parse(request.body);
      try {
        await passwordResetService.resetPassword(token, novaSenha);
        return { message: 'Senha redefinida com sucesso.' };
      } catch (error) {
        if (error instanceof InvalidResetTokenError) {
          return reply.code(400).send({ message: error.message });
        }
        throw error;
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
