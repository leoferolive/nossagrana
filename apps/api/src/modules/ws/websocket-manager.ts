import type WebSocket from 'ws';

export class WebSocketManager {
  private rooms = new Map<string, Set<WebSocket>>();

  join(familiaId: string, ws: WebSocket): void {
    if (!this.rooms.has(familiaId)) {
      this.rooms.set(familiaId, new Set());
    }
    this.rooms.get(familiaId)!.add(ws);
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

  roomSize(familiaId: string): number {
    return this.rooms.get(familiaId)?.size ?? 0;
  }

  entries(): IterableIterator<[string, Set<WebSocket>]> {
    return this.rooms.entries();
  }
}
