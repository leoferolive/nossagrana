import {
  authLoginRequestSchema,
  authLoginResponseSchema,
  authLogoutRequestSchema,
  authMeResponseSchema,
  authRefreshRequestSchema,
  authRefreshResponseSchema,
  authRegisterRequestSchema,
  authRegisterResponseSchema,
} from '@nossagrana/types';
import { z } from 'zod';

const erroCsrfSchema = z.object({ message: z.string(), code: z.literal('CSRF_INVALID') });

export const authRegisterSchema = {
  body: authRegisterRequestSchema,
  response: {
    201: authRegisterResponseSchema,
    409: z.object({
      message: z.literal('Email ja cadastrado'),
    }),
  },
};

export const authLoginSchema = {
  body: authLoginRequestSchema,
  response: {
    200: authLoginResponseSchema,
    401: z.object({
      message: z.literal('Credenciais invalidas'),
    }),
  },
};

export const authRefreshSchema = {
  body: authRefreshRequestSchema,
  response: {
    200: authRefreshResponseSchema,
    401: z.object({
      message: z.string(),
      code: z.string().optional(),
    }),
    403: erroCsrfSchema,
  },
};

export const authLogoutSchema = {
  body: authLogoutRequestSchema,
  response: {
    204: z.null(),
    401: z.object({
      message: z.literal('Refresh token invalido'),
    }),
    403: erroCsrfSchema,
  },
};

export const authMeSchema = {
  response: {
    200: authMeResponseSchema,
  },
};

export const authFamiliaContextSchema = {
  response: {
    200: z.object({
      familiaId: z.guid(),
    }),
  },
};

export const authPerfilSchema = {
  response: {
    200: z.object({
      nome: z.string(),
      email: z.string().email(),
    }),
  },
};

export const authUpdatePerfilSchema = {
  body: z.object({ nome: z.string().min(1) }),
  response: {
    200: z.object({
      nome: z.string(),
      email: z.string().email(),
    }),
  },
};

export const authForgotPasswordSchema = {
  body: z.object({ email: z.string().email() }),
  response: {
    200: z.object({ message: z.string() }),
  },
};

export const authResetPasswordSchema = {
  body: z.object({
    token: z.guid(),
    novaSenha: z.string().min(8).max(128),
  }),
  response: {
    200: z.object({ message: z.string() }),
    400: z.object({ message: z.string() }),
  },
};

export const authUpdateSenhaSchema = {
  body: z.object({
    senhaAtual: z.string(),
    novaSenha: z.string().min(8).max(128),
  }),
  response: {
    204: z.null(),
    401: z.object({ message: z.string() }),
  },
};
