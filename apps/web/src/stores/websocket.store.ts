import { create } from 'zustand';

import { ApiError } from '../services/api-client';
import { wsTicketService } from '../services/ws-ticket.service';

import { useDashboardStore } from './dashboard.store';

const getWsUrl = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  }
  return 'ws://localhost:3000';
};
// Espelham `apps/api/src/modules/ws/ws-close-codes.ts` (#119).
const WS_CLOSE_SESSAO_REVOGADA = 4005;
const WS_CLOSE_MEMBRO_REMOVIDO = 4006;
/** Acesso negado de forma definitiva (sem vínculo, família excluída, membro removido): não reconectar. */
const CLOSE_SEM_RECONEXAO = [4003, 4004, WS_CLOSE_MEMBRO_REMOVIDO];
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 100;
/** Espera padrão após 429 sem `Retry-After`: a janela do rate limit do endpoint é de 60 s. */
const LIMITE_EXCEDIDO_ESPERA_PADRAO_MS = 60_000;
const LIMITE_EXCEDIDO_ESPERA_MINIMA_MS = 1_000;

interface ConnectOpts {
  familiaId: string;
  clearSession: () => void;
}

interface WebSocketStore {
  socket: WebSocket | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  connect(opts: ConnectOpts): void;
  disconnect(): void;
}

/** O ticket (uso único, ~30 s) é o único segredo na URL; o JWT nunca vai para ela (#118). */
const buildSocketUrl = (ticket: string, familiaId: string): string =>
  `${getWsUrl()}/api/ws?ticket=${encodeURIComponent(ticket)}&familiaId=${encodeURIComponent(familiaId)}`;

type FalhaDoTicket =
  | { falha: 'sessao' | 'acesso' | 'transitoria' }
  | { falha: 'limite'; esperaMs: number };
type ResultadoDoTicket = { ticket: string } | FalhaDoTicket;

/** Um ticket novo por (re)conexão; classifica a falha para o store decidir entre retry e parar. */
async function emitirTicket(familiaId: string): Promise<ResultadoDoTicket> {
  try {
    const { ticket } = await wsTicketService.emitir(familiaId);
    return { ticket };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return { falha: 'sessao' };
    if (err instanceof ApiError && err.status === 403) return { falha: 'acesso' };
    if (err instanceof ApiError && err.status === 429) {
      const pedida = err.retryAfterMs ?? LIMITE_EXCEDIDO_ESPERA_PADRAO_MS;
      return { falha: 'limite', esperaMs: Math.max(pedida, LIMITE_EXCEDIDO_ESPERA_MINIMA_MS) };
    }
    return { falha: 'transitoria' };
  }
}

export const useWebSocketStore = create<WebSocketStore>((set, get) => {
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  // Invalida conexões em andamento: connect/disconnect durante o `await` do ticket descartam o resultado.
  let geracao = 0;

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  /**
   * `encerrarSessaoAoEsgotar`: só o socket que cai repetidamente (mesmo com ticket válido) indica
   * sessão inutilizável. Falha ao emitir o ticket (rede, 5xx) não é motivo de logout.
   */
  const agendarReconexao = (opts: ConnectOpts, encerrarSessaoAoEsgotar: boolean) => {
    if (retryCount >= MAX_RETRIES) {
      if (encerrarSessaoAoEsgotar) opts.clearSession();
      set({ status: 'error' });
      return;
    }
    const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
    retryCount++;
    retryTimer = setTimeout(() => void doConnect(opts), delay);
  };

  const onSocketClose = (opts: ConnectOpts, event: CloseEvent) => {
    set({ socket: null, status: 'disconnected' });

    if (event.code === WS_CLOSE_SESSAO_REVOGADA) {
      // Sessão revogada no servidor (troca/reset de senha, #119): só um novo login destrava.
      opts.clearSession();
      return;
    }
    if (CLOSE_SEM_RECONEXAO.includes(event.code)) return;
    agendarReconexao(opts, true);
  };

  const abrirSocket = (opts: ConnectOpts, ticket: string) => {
    const ws = new WebSocket(buildSocketUrl(ticket, opts.familiaId));
    const geracaoDoSocket = geracao;
    set({ socket: ws, status: 'connecting' });

    ws.onopen = () => {
      retryCount = 0;
      set({ status: 'connected' });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.tipo === 'transacao:alterada') {
          useDashboardStore.getState().fetchAll(opts.familiaId);
        }
      } catch {
        // ignora mensagens malformadas
      }
    };

    ws.onclose = (event) => {
      // Socket substituído por connect/disconnect: o fechamento dele não decide mais nada.
      if (geracaoDoSocket === geracao) onSocketClose(opts, event);
    };
  };

  /** 429: espera o que o servidor pediu e tenta de novo, sem gastar tentativas nem derrubar a sessão. */
  const esperarLimite = (opts: ConnectOpts, esperaMs: number) => {
    set({ status: 'connecting' });
    retryTimer = setTimeout(() => void doConnect(opts), esperaMs);
  };

  const tratarFalhaDoTicket = (opts: ConnectOpts, resultado: FalhaDoTicket) => {
    const { falha } = resultado;
    if (falha === 'limite') {
      esperarLimite(opts, resultado.esperaMs);
      return;
    }
    if (falha === 'sessao') {
      opts.clearSession();
      set({ status: 'error' });
      return;
    }
    if (falha === 'acesso') {
      set({ status: 'disconnected' });
      return;
    }
    agendarReconexao(opts, false);
  };

  const doConnect = async (opts: ConnectOpts) => {
    if (typeof WebSocket === 'undefined') {
      set({ status: 'error' });
      return;
    }

    const minhaGeracao = geracao;
    set({ status: 'connecting' });
    const resultado = await emitirTicket(opts.familiaId);
    if (minhaGeracao !== geracao) return;

    if ('ticket' in resultado) abrirSocket(opts, resultado.ticket);
    else tratarFalhaDoTicket(opts, resultado);
  };

  return {
    socket: null,
    status: 'disconnected',

    connect(opts) {
      geracao++;
      retryCount = 0;
      clearRetry();
      const existing = get().socket;
      if (existing) existing.close();
      void doConnect(opts);
    },

    disconnect() {
      geracao++;
      clearRetry();
      retryCount = MAX_RETRIES; // evita reconexão após close manual
      const { socket } = get();
      if (socket) socket.close();
      set({ socket: null, status: 'disconnected' });
    },
  };
});
