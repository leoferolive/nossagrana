import { describe, expect, it } from 'vitest';

import { RelogioFake } from './tests/relogio-fake.js';
import { SessoesFake, StoreDeTicketsInspecionavel } from './tests/ws-ticket-helpers.js';
import { hashWsTicket } from './ws-ticket.hash.js';
import {
  WS_TICKET_TTL_MS,
  WsTicketService,
  WsTicketSessaoRevogadaError,
} from './ws-ticket.service.js';

const FAMILIA_A = '11111111-1111-4111-8111-111111111111';
const FAMILIA_B = '22222222-2222-4222-8222-222222222222';
const dadosDa = (familiaId: string, userId = 'user-1') => ({ userId, familiaId, emitidoEm: 1000 });

function montar() {
  const relogio = new RelogioFake();
  const store = new StoreDeTicketsInspecionavel();
  const sessoes = new SessoesFake();
  const service = new WsTicketService(store, sessoes, relogio.agora);
  return { relogio, store, sessoes, service };
}

describe('WsTicketService — emissão', () => {
  it('emite ticket aleatório (256 bits, base64url) e expiração em TTL', async () => {
    const { relogio, service } = montar();

    const { ticket, expiraEm } = await service.emitir(dadosDa(FAMILIA_A));

    expect(ticket).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(expiraEm.getTime()).toBe(relogio.agora().getTime() + WS_TICKET_TTL_MS);
  });

  it('dois tickets emitidos para o mesmo usuário e família são distintos', async () => {
    const { service } = montar();

    const primeiro = await service.emitir(dadosDa(FAMILIA_A));
    const segundo = await service.emitir(dadosDa(FAMILIA_A));

    expect(primeiro.ticket).not.toBe(segundo.ticket);
  });

  it('persiste só o hash: o ticket bruto nunca entra no store', async () => {
    const { store, service } = montar();

    const { ticket } = await service.emitir(dadosDa(FAMILIA_A));

    expect(JSON.stringify(store.chavesArmazenadas())).not.toContain(ticket);
    expect(store.chavesArmazenadas()).toEqual([hashWsTicket(ticket)]);
  });
});

describe('WsTicketService — sessão revogada (#119)', () => {
  it('sessão revogada não obtém ticket e nada é armazenado', async () => {
    const { store, sessoes, service } = montar();
    sessoes.revogar();

    await expect(service.emitir(dadosDa(FAMILIA_A))).rejects.toBeInstanceOf(
      WsTicketSessaoRevogadaError,
    );
    expect(store.chavesArmazenadas()).toHaveLength(0);
  });
});

describe('WsTicketService — consumo', () => {
  it('devolve usuário, família e sessão vinculados ao ticket', async () => {
    const { service } = montar();
    const { ticket } = await service.emitir(dadosDa(FAMILIA_A, 'ana'));

    const dados = await service.consumir(ticket, FAMILIA_A);

    expect(dados).toEqual({ userId: 'ana', familiaId: FAMILIA_A, emitidoEm: 1000 });
  });

  it('é de uso único: o segundo consumo falha', async () => {
    const { service } = montar();
    const { ticket } = await service.emitir(dadosDa(FAMILIA_A));

    expect(await service.consumir(ticket, FAMILIA_A)).not.toBeNull();
    expect(await service.consumir(ticket, FAMILIA_A)).toBeNull();
  });

  it('expira depois do TTL e não pode mais ser consumido', async () => {
    const { relogio, service } = montar();
    const { ticket } = await service.emitir(dadosDa(FAMILIA_A));

    relogio.avancar(WS_TICKET_TTL_MS);

    expect(await service.consumir(ticket, FAMILIA_A)).toBeNull();
  });

  it('ainda vale um instante antes de expirar', async () => {
    const { relogio, service } = montar();
    const { ticket } = await service.emitir(dadosDa(FAMILIA_A));

    relogio.avancar(WS_TICKET_TTL_MS - 1);

    expect(await service.consumir(ticket, FAMILIA_A)).not.toBeNull();
  });

  it('ticket de outra família é recusado e fica queimado (não vale nem para a família certa)', async () => {
    const { service } = montar();
    const { ticket } = await service.emitir(dadosDa(FAMILIA_A));

    expect(await service.consumir(ticket, FAMILIA_B)).toBeNull();
    expect(await service.consumir(ticket, FAMILIA_A)).toBeNull();
  });

  it('ticket desconhecido ou vazio é recusado', async () => {
    const { service } = montar();

    expect(await service.consumir('nao-existe', FAMILIA_A)).toBeNull();
    expect(await service.consumir('', FAMILIA_A)).toBeNull();
  });

  it('tickets de usuários de famílias distintas não se misturam (multi-tenant)', async () => {
    const { service } = montar();
    const ana = await service.emitir(dadosDa(FAMILIA_A, 'ana'));
    const bruno = await service.emitir(dadosDa(FAMILIA_B, 'bruno'));

    expect((await service.consumir(bruno.ticket, FAMILIA_B))?.userId).toBe('bruno');
    expect(await service.consumir(ana.ticket, FAMILIA_B)).toBeNull();
  });

  it('consumos simultâneos do mesmo ticket: só um passa', async () => {
    const { service } = montar();
    const { ticket } = await service.emitir(dadosDa(FAMILIA_A));

    const resultados = await Promise.all(
      Array.from({ length: 10 }, () => service.consumir(ticket, FAMILIA_A)),
    );

    expect(resultados.filter((dados) => dados !== null)).toHaveLength(1);
  });
});

describe('WsTicketService — limpeza', () => {
  it('remove só os expirados', async () => {
    const { relogio, store, service } = montar();
    await service.emitir(dadosDa(FAMILIA_A));
    relogio.avancar(WS_TICKET_TTL_MS / 2);
    const vivo = await service.emitir(dadosDa(FAMILIA_A));
    relogio.avancar(WS_TICKET_TTL_MS / 2);

    const removidos = await service.limparExpirados();

    expect(removidos).toBe(1);
    expect(store.chavesArmazenadas()).toEqual([hashWsTicket(vivo.ticket)]);
  });
});
