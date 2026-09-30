import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../../app.js';

import {
  conectarComAccess,
  conectarComTicket,
  emitirTicketPorHttp,
} from './tests/ws-ticket-helpers.js';
import { WS_CLOSE_SESSAO_REVOGADA } from './ws-close-codes.js';
import { WS_TICKET_TTL_MS } from './ws-ticket.service.js';

type App = ReturnType<typeof buildApp>;
type ClienteWs = Awaited<ReturnType<App['injectWS']>>;

const FAMILIA = '00000000-0000-4000-8000-000000000001';
const OUTRA_FAMILIA = '00000000-0000-4000-8000-000000000002';
const SENHA = 'password123';

interface Fechamento {
  codigo: number;
  motivo: string;
}

const fechamentoDe = (ws: ClienteWs) =>
  new Promise<Fechamento>((resolve, reject) => {
    const limite = setTimeout(() => reject(new Error('socket permaneceu aberto')), 2000);
    ws.on('close', (codigo: number, motivo: Buffer) => {
      clearTimeout(limite);
      resolve({ codigo, motivo: motivo.toString() });
    });
  });

let contador = 0;

async function loginNovo(app: App): Promise<string> {
  contador += 1;
  const email = `ws-routes-${contador}@example.com`;
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { nome: 'WS User', email, senha: SENHA },
  });
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, senha: SENHA },
  });
  return login.json().accessToken as string;
}

describe('ws.routes — handshake com ticket efêmero (#118)', () => {
  let app: App;
  let accessToken: string;

  beforeEach(async () => {
    app = buildApp();
    await app.ready();
    accessToken = await loginNovo(app);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
  });

  it('conecta com ticket válido e familiaId UUID (NODE_ENV=test bypassa membership)', async () => {
    const ws = await conectarComAccess(app, accessToken, FAMILIA);

    expect(ws.readyState).toBe(1);
    expect(app.wsManager.roomSize(FAMILIA)).toBe(1);
    ws.close();
  });

  it('o ticket é de uso único: a reutilização fecha com 4001', async () => {
    const ticket = await emitirTicketPorHttp(app, accessToken, FAMILIA);
    const primeiro = await conectarComTicket(app, ticket, FAMILIA);

    const segundo = await conectarComTicket(app, ticket, FAMILIA);

    expect((await fechamentoDe(segundo)).codigo).toBe(4001);
    expect(primeiro.readyState).toBe(1);
    expect(app.wsManager.roomSize(FAMILIA)).toBe(1);
    primeiro.close();
  });

  it('dois handshakes simultâneos com o mesmo ticket: só um conecta', async () => {
    const ticket = await emitirTicketPorHttp(app, accessToken, FAMILIA);

    const sockets = await Promise.all([
      conectarComTicket(app, ticket, FAMILIA),
      conectarComTicket(app, ticket, FAMILIA),
    ]);
    await vi.waitFor(() => expect(sockets.filter((ws) => ws.readyState === 1)).toHaveLength(1));

    expect(app.wsManager.roomSize(FAMILIA)).toBe(1);
    const fechado = sockets.find((ws) => ws.readyState !== 1)!;
    expect((await fechamentoDe(fechado)).codigo).toBe(4001);
    sockets.forEach((ws) => ws.close());
  });

  it('ticket expirado fecha com 4001 e não entra no room', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T10:00:00Z'));
    const ticket = await emitirTicketPorHttp(app, accessToken, FAMILIA);
    vi.setSystemTime(new Date(Date.now() + WS_TICKET_TTL_MS + 1));

    const ws = await conectarComTicket(app, ticket, FAMILIA);

    expect((await fechamentoDe(ws)).codigo).toBe(4001);
    expect(app.wsManager.roomSize(FAMILIA)).toBe(0);
  });

  it('ticket emitido para uma família não abre socket em outra (nem depois, na certa)', async () => {
    const ticket = await emitirTicketPorHttp(app, accessToken, FAMILIA);

    const naOutra = await conectarComTicket(app, ticket, OUTRA_FAMILIA);

    expect((await fechamentoDe(naOutra)).codigo).toBe(4001);
    expect(app.wsManager.roomSize(OUTRA_FAMILIA)).toBe(0);
    const naCerta = await conectarComTicket(app, ticket, FAMILIA);
    expect((await fechamentoDe(naCerta)).codigo).toBe(4001);
  });

  it('ticket inexistente fecha com 4001', async () => {
    const ws = await conectarComTicket(app, 'ticket-que-nunca-foi-emitido', FAMILIA);

    expect((await fechamentoDe(ws)).codigo).toBe(4001);
  });

  it('ticket ausente fecha com 4001', async () => {
    const ws = await app.injectWS(`/api/ws?familiaId=${FAMILIA}`);

    expect((await fechamentoDe(ws)).codigo).toBe(4001);
  });

  it('familiaId ausente ou malformado fecha com 4001, sem consumir o ticket', async () => {
    const ticket = await emitirTicketPorHttp(app, accessToken, FAMILIA);

    const semFamilia = await app.injectWS(`/api/ws?ticket=${ticket}`);
    const malformada = await app.injectWS(`/api/ws?ticket=${ticket}&familiaId=nao-e-uuid`);

    expect((await fechamentoDe(semFamilia)).codigo).toBe(4001);
    expect((await fechamentoDe(malformada)).codigo).toBe(4001);
    const ws = await conectarComTicket(app, ticket, FAMILIA);
    expect(ws.readyState).toBe(1);
    ws.close();
  });

  it('JWT na query (?token=) é ignorado: access válido sozinho não abre o socket', async () => {
    const ws = await app.injectWS(`/api/ws?token=${accessToken}&familiaId=${FAMILIA}`);

    expect((await fechamentoDe(ws)).codigo).toBe(4001);
    expect(app.wsManager.roomSize(FAMILIA)).toBe(0);
  });

  it('JWT na query junto com ticket inválido: o JWT não "salva" o handshake', async () => {
    const ws = await app.injectWS(
      `/api/ws?ticket=invalido&token=${accessToken}&familiaId=${FAMILIA}`,
    );

    expect((await fechamentoDe(ws)).codigo).toBe(4001);
  });

  it('todas as recusas de autenticação têm o mesmo código e o mesmo motivo (sem detalhe)', async () => {
    const usado = await emitirTicketPorHttp(app, accessToken, FAMILIA);
    (await conectarComTicket(app, usado, FAMILIA)).close();
    const deOutraFamilia = await emitirTicketPorHttp(app, accessToken, FAMILIA);

    const recusas = await Promise.all([
      fechamentoDe(await conectarComTicket(app, 'inexistente', FAMILIA)),
      fechamentoDe(await conectarComTicket(app, usado, FAMILIA)),
      fechamentoDe(await conectarComTicket(app, deOutraFamilia, OUTRA_FAMILIA)),
      fechamentoDe(await app.injectWS(`/api/ws?familiaId=${FAMILIA}`)),
    ]);

    expect(new Set(recusas.map((r) => JSON.stringify(r))).size).toBe(1);
    expect(recusas[0]!.motivo).not.toMatch(/ticket|token|expir|usado|familia/i);
  });

  it('sessão revogada depois da emissão do ticket: handshake recusado com 4005', async () => {
    const ticket = await emitirTicketPorHttp(app, accessToken, FAMILIA);
    const { sub } = app.jwt.decode<{ sub: string }>(accessToken)!;
    await app.sessoes.revogarTodas(sub);

    const ws = await conectarComTicket(app, ticket, FAMILIA);

    expect((await fechamentoDe(ws)).codigo).toBe(WS_CLOSE_SESSAO_REVOGADA);
    expect(app.wsManager.roomSize(FAMILIA)).toBe(0);
  });

  it('falha ao consumir o ticket: falha fechada (1011), sem entrar no room', async () => {
    vi.spyOn(app.wsTickets, 'consumir').mockRejectedValue(new Error('armazenamento indisponível'));

    const ws = await conectarComTicket(app, 'qualquer', FAMILIA);

    expect((await fechamentoDe(ws)).codigo).toBe(1011);
    expect(app.wsManager.roomSize(FAMILIA)).toBe(0);
  });
});
