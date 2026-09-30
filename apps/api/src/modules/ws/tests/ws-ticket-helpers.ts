import type { FastifyInstance } from 'fastify';

/** Pede o ticket pelo endpoint HTTP real, como o cliente web faz a cada (re)conexão. */
export async function emitirTicketPorHttp(
  app: FastifyInstance,
  accessToken: string,
  familiaId: string,
): Promise<string> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/ws/ticket',
    headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
  });
  return (resposta.json() as { ticket: string }).ticket;
}

/** Abre o socket com o ticket na query, que é o único segredo aceito na URL do WS. */
export function conectarComTicket(app: FastifyInstance, ticket: string, familiaId: string) {
  return app.injectWS(`/api/ws?ticket=${ticket}&familiaId=${familiaId}`);
}

/** Emite por HTTP e já abre o socket (ticket novo a cada chamada). */
export async function conectarComAccess(
  app: FastifyInstance,
  accessToken: string,
  familiaId: string,
) {
  const ticket = await emitirTicketPorHttp(app, accessToken, familiaId);
  return conectarComTicket(app, ticket, familiaId);
}
