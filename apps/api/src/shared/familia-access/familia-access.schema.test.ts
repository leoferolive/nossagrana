import Fastify from 'fastify';
import { serializerCompiler } from 'fastify-type-provider-zod';
import { describe, expect, it } from 'vitest';

import {
  categoriaDeleteSchema,
  categoriaUpdateSchema,
} from '../../modules/categoria/categoria.schema.js';
import {
  familiaCreateInviteSchema,
  familiaDeleteSchema,
  familiaListJoinRequestsSchema,
  familiaRemoveMemberSchema,
  familiaReviewJoinRequestSchema,
} from '../../modules/familia/familia.schema.js';

const semAcesso = {
  error: {
    message: 'Usuario sem acesso a familia informada',
    code: 'FAMILIA_SEM_ACESSO',
  },
};
const familiaExcluida = {
  error: { message: 'Familia excluida', code: 'FAMILIA_EXCLUIDA' },
};

const schemasProtegidos = [
  {
    nome: 'atualizar categoria',
    schema: categoriaUpdateSchema.response[403],
    negocio: [{ message: 'Categorias de sistema não podem ser editadas ou removidas' }],
  },
  {
    nome: 'remover categoria',
    schema: categoriaDeleteSchema.response[403],
    negocio: [{ message: 'Categorias de sistema não podem ser editadas ou removidas' }],
  },
  {
    nome: 'criar convite',
    schema: familiaCreateInviteSchema.response[403],
    negocio: [{ message: 'Apenas admin pode gerar convite' }],
  },
  {
    nome: 'listar solicitações',
    schema: familiaListJoinRequestsSchema.response[403],
    negocio: [{ message: 'Apenas admin pode listar solicitacoes' }],
  },
  {
    nome: 'revisar solicitação',
    schema: familiaReviewJoinRequestSchema.response[403],
    negocio: [{ message: 'Apenas admin pode listar solicitacoes' }],
  },
  {
    nome: 'remover membro',
    schema: familiaRemoveMemberSchema.response[403],
    negocio: [
      { message: 'Apenas admin pode remover membro' },
      { message: 'Admin nao pode remover a si mesmo' },
    ],
  },
  {
    nome: 'excluir família',
    schema: familiaDeleteSchema.response[403],
    negocio: [{ message: 'Apenas admin pode excluir familia' }],
  },
];

describe('403 schemas on protected family routes', () => {
  it.each(schemasProtegidos)(
    '$nome serializes scope and business responses',
    async ({ schema, negocio }) => {
      const app = Fastify();
      app.setSerializerCompiler(serializerCompiler);
      let payload: object = semAcesso;
      app.get('/forbidden', { schema: { response: { 403: schema } } }, async (_request, reply) =>
        reply.code(403).send(payload),
      );
      await app.ready();

      try {
        for (const responseBody of [semAcesso, familiaExcluida, ...negocio]) {
          payload = responseBody;
          const response = await app.inject('/forbidden');
          expect(response.statusCode).toBe(403);
          expect(response.json()).toEqual(responseBody);
        }
      } finally {
        await app.close();
      }
    },
  );
});
