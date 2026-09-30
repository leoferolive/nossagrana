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

  comoWebSocket(): WebSocket {
    return this as unknown as WebSocket;
  }
}
