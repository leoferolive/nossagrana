import type WebSocket from 'ws';

export class WebSocketManager {
  private rooms = new Map<string, Set<WebSocket>>();
  // Dono de cada socket (#119): permite fechar por usuário sem indexar o room por usuário.
  private readonly userBySocket = new WeakMap<WebSocket, string>();

  join(familiaId: string, ws: WebSocket, userId: string): void {
    if (!this.rooms.has(familiaId)) {
      this.rooms.set(familiaId, new Set());
    }
    this.rooms.get(familiaId)!.add(ws);
    this.userBySocket.set(ws, userId);
  }

  leave(familiaId: string, ws: WebSocket): void {
    this.rooms.get(familiaId)?.delete(ws);
  }

  broadcast(familiaId: string, payload: object): void {
    const room = this.rooms.get(familiaId);
    if (!room) return;
    const msg = JSON.stringify(payload);
    for (const ws of room) {
      if (ws.readyState === 1 /* OPEN */) {
        ws.send(msg);
      }
    }
  }

  /**
   * Encerra de forma controlada todos os sockets da família (ex.: exclusão) e
   * esvazia o room. Retorna quantos sockets foram tratados. Um socket cujo
   * `close` lança é terminado à força para não deixar conexão viva nem
   * impedir o fechamento dos demais.
   * Ex.: `closeFamily(familiaId, WS_CLOSE_FAMILIA_EXCLUIDA, 'Familia excluida')`.
   */
  closeFamily(familiaId: string, code: number, reason: string): number {
    const room = this.rooms.get(familiaId);
    if (!room) return 0;
    this.rooms.delete(familiaId);
    for (const ws of room) {
      this.closeOrTerminate(ws, code, reason);
    }
    return room.size;
  }

  /**
   * Encerra os sockets do usuário em TODAS as famílias (sessão revogada: troca/reset
   * de senha). Retorna quantos sockets foram tratados.
   * Ex.: `closeUser(userId, WS_CLOSE_SESSAO_REVOGADA, 'Sessao revogada')`.
   */
  closeUser(userId: string, code: number, reason: string): number {
    let fechados = 0;
    for (const familiaId of [...this.rooms.keys()]) {
      fechados += this.closeUserInFamily(familiaId, userId, code, reason);
    }
    return fechados;
  }

  /**
   * Encerra só os sockets do usuário naquela família (membership removida); os
   * demais membros e as outras famílias do próprio usuário seguem conectados.
   * Ex.: `closeUserInFamily(familiaId, userId, WS_CLOSE_MEMBRO_REMOVIDO, 'Membro removido')`.
   */
  closeUserInFamily(familiaId: string, userId: string, code: number, reason: string): number {
    const room = this.rooms.get(familiaId);
    if (!room) return 0;
    const alvos = [...room].filter((ws) => this.userBySocket.get(ws) === userId);
    for (const ws of alvos) {
      room.delete(ws);
      this.closeOrTerminate(ws, code, reason);
    }
    return alvos.length;
  }

  private closeOrTerminate(ws: WebSocket, code: number, reason: string): void {
    try {
      ws.close(code, reason);
    } catch {
      ws.terminate?.();
    }
  }

  roomSize(familiaId: string): number {
    return this.rooms.get(familiaId)?.size ?? 0;
  }

  entries(): IterableIterator<[string, Set<WebSocket>]> {
    return this.rooms.entries();
  }
}
