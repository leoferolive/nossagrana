import type { FastifyInstance } from 'fastify';

export interface UsuarioDeTeste {
  id: string;
  email: string;
}

type EmissorJwt = Pick<FastifyInstance, 'jwt'>;

/**
 * Emite um access token com o mesmo payload do login real (`sub` + `email`),
 * assinado pelo próprio app — nenhum segredo é lido ou duplicado aqui.
 *
 * @example emitirTokenDeAcesso(app, cenario.familiaA.admin)
 */
export function emitirTokenDeAcesso(app: EmissorJwt, usuario: UsuarioDeTeste): string {
  return app.jwt.sign({ sub: usuario.id, email: usuario.email });
}

/**
 * Headers para `app.inject` em rotas protegidas e escopadas por família.
 * O `x-familia-id` é controlado pelo cliente (ver .claude/rules/security.md),
 * então testes de ownership podem passar de propósito a família de outro tenant.
 *
 * @example app.inject({ url: '/api/categorias', headers: cabecalhosAutenticados(app, admin, familiaId) })
 */
export function cabecalhosAutenticados(
  app: EmissorJwt,
  usuario: UsuarioDeTeste,
  familiaId: string,
): Record<string, string> {
  return {
    authorization: `Bearer ${emitirTokenDeAcesso(app, usuario)}`,
    'x-familia-id': familiaId,
  };
}
