import type WebSocket from 'ws';

const OPEN = 1;
const CLOSED = 3;

/**
 * Fake nomeada de um socket `ws`: registra envios e fechamentos em vez de
 * abrir rede. `falharAoFechar` simula um socket cujo `close()` lança (ex.:
 * transporte já quebrado) para provar que um socket ruim não impede o
 * fechamento dos demais da mesma família.
 */
export class WebSocketFake {
  readyState = OPEN;
  readonly enviadas: string[] = [];
  fechamento: { codigo: number; motivo: string } | null = null;
  encerradoPorTerminate = false;
  pings = 0;
  private readonly ouvintesPong: Array<() => void> = [];

  constructor(private readonly falharAoFechar = false) {}

  send(mensagem: string): void {
    this.enviadas.push(mensagem);
  }

  close(codigo: number, motivo: string): void {
    if (this.falharAoFechar) throw new Error('close indisponível no socket fake');
    this.fechamento = { codigo, motivo };
    this.readyState = CLOSED;
  }

  terminate(): void {
    this.encerradoPorTerminate = true;
    this.readyState = CLOSED;
  }

  /** Registra ouvinte único de pong, como `ws.once('pong', ...)`. */
  once(evento: 'pong', ouvinte: () => void): void {
    if (evento === 'pong') this.ouvintesPong.push(ouvinte);
  }

  ping(): void {
    this.pings += 1;
  }

  /** Simula o cliente respondendo ao ping. */
  responderPong(): void {
    for (const ouvinte of this.ouvintesPong.splice(0)) ouvinte();
  }

  comoWebSocket(): WebSocket {
    return this as unknown as WebSocket;
  }
}
