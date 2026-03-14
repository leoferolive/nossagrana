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
      message: z.literal('Refresh token invalido'),
    }),
  },
};

export const authLogoutSchema = {
  body: authLogoutRequestSchema,
  response: {
    204: z.null(),
    401: z.object({
      message: z.literal('Refresh token invalido'),
    }),
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
      familiaId: z.string().uuid(),
    }),
  },
};
