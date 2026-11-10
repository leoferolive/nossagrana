import {
  authLoginRequestSchema,
  authLogoutRequestSchema,
  authRefreshRequestSchema,
  authRegisterRequestSchema,
} from '@nossagrana/types';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';

import { env } from '../../config/env.js';
import { ConsoleEmailSender } from '../email/email.console-sender.js';
import { EmailService } from '../email/email.service.js';
import { SmtpEmailSender } from '../email/email.smtp-sender.js';

import { gravarCookieRefresh, limparCookieRefresh } from './auth.cookie.js';
import { temCabecalhoCsrf } from './auth.csrf.js';
import { renovarSessao } from './auth.refresh.js';
import { extrairRefresh } from './auth.refresh-origem.js';
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
import { emitirParDeTokens, verificarRefreshToken } from './auth.tokens.js';
import type { SessaoRevogador } from './auth.types.js';
import {
  DrizzlePasswordResetRepository,
  InMemoryPasswordResetRepository,
} from './password-reset.repository.js';
import { InvalidResetTokenError, PasswordResetService } from './password-reset.service.js';
import { hashToken } from './revoked-token.repository.js';
import { logarSessoesNaoRevogadas } from './sessoes-nao-revogadas.error.js';

/** 401 do refresh/logout: o cookie inválido é removido para o cliente não insistir nele. */
const recusarRefresh = (reply: FastifyReply, corpo: { message: string; code?: string }) => {
  limparCookieRefresh(reply);
  return reply.code(401).send(corpo);
};

const defaultAuthService = (sessoes: SessaoRevogador): AuthService => {
  if (env.NODE_ENV === 'test') {
    return new AuthService(new InMemoryAuthRepository(), sessoes);
  }

  return new AuthService(new DrizzleAuthRepository(), sessoes);
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

const defaultPasswordResetService = (
  emailService: EmailService,
  sessoes: SessaoRevogador,
): PasswordResetService => {
  if (env.NODE_ENV === 'test') {
    return new PasswordResetService(
      new InMemoryAuthRepository(),
      new InMemoryPasswordResetRepository(),
      sessoes,
      emailService,
      env.CORS_ORIGIN,
      hashPassword,
    );
  }

  return new PasswordResetService(
    new DrizzleAuthRepository(),
    new DrizzlePasswordResetRepository(),
    sessoes,
    emailService,
    env.CORS_ORIGIN,
    hashPassword,
  );
};

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const authService = defaultAuthService(fastify.sessoes);
  const emailService = defaultEmailService();
  const passwordResetService = defaultPasswordResetService(emailService, fastify.sessoes);

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

        const { accessToken, refreshToken } = emitirParDeTokens(fastify, {
          sub: authenticatedUser.id,
          email: authenticatedUser.email,
        });

        gravarCookieRefresh(reply, refreshToken);
        const clienteLegado = env.REFRESH_TOKEN_BODY_FALLBACK && !temCabecalhoCsrf(request);
        return reply
          .code(200)
          .send(clienteLegado ? { accessToken, refreshToken } : { accessToken });
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
      const recebido = extrairRefresh(request, authRefreshRequestSchema.parse(request.body));
      if (!recebido.ok) return reply.code(recebido.status).send(recebido.corpo);

      try {
        const resultado = await renovarSessao(fastify, recebido.token);
        if (!resultado.ok) return recusarRefresh(reply, resultado.corpo);

        const { accessToken, refreshToken } = resultado;
        gravarCookieRefresh(reply, refreshToken);
        return reply
          .code(200)
          .send(recebido.origem === 'corpo' ? { accessToken, refreshToken } : { accessToken });
      } catch {
        return recusarRefresh(reply, { message: 'Refresh token invalido' });
      }
    },
  );

  fastify.post('/auth/logout', { schema: authLogoutSchema }, async (request, reply) => {
    const recebido = extrairRefresh(request, authLogoutRequestSchema.parse(request.body));
    if (!recebido.ok) return reply.code(recebido.status).send(recebido.corpo);

    try {
      const decodedToken = verificarRefreshToken(fastify, recebido.token);
      if (decodedToken.tokenType !== 'refresh') throw new Error('tokenType diferente de refresh');

      const expiresAt = new Date((decodedToken.exp ?? Math.floor(Date.now() / 1000)) * 1000);
      await fastify.tokensRevogados.revokeToken(
        hashToken(recebido.token),
        expiresAt,
        decodedToken.sub,
      );

      limparCookieRefresh(reply);
      return reply.code(204).send();
    } catch {
      return recusarRefresh(reply, { message: 'Refresh token invalido' });
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
      } catch (error) {
        // Só credencial errada vira 401; falha de infraestrutura (ex.: gravar a revogação)
        // não pode ser mascarada como "senha incorreta" (#119).
        if (error instanceof InvalidCredentialsError) {
          return reply.code(401).send({ message: 'Senha atual incorreta' });
        }
        logarSessoesNaoRevogadas(request.log, error);
        throw error;
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
        logarSessoesNaoRevogadas(request.log, error);
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
