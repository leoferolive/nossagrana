import { create } from 'zustand';

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
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 100;

interface ConnectOpts {
  getAccessToken: () => string | null;
  familiaId: string;
  clearSession: () => void;
}

interface WebSocketStore {
  socket: WebSocket | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  connect(opts: ConnectOpts): void;
  disconnect(): void;
}

export const useWebSocketStore = create<WebSocketStore>((set, get) => {
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const doConnect = (opts: ConnectOpts) => {
    const token = opts.getAccessToken();
    if (!token) {
      set({ status: 'error' });
      return;
    }

    if (typeof WebSocket === 'undefined') {
      set({ status: 'error' });
      return;
    }

    const url = `${getWsUrl()}/api/ws?token=${encodeURIComponent(token)}&familiaId=${encodeURIComponent(opts.familiaId)}`;
    const ws = new WebSocket(url);
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
      set({ socket: null, status: 'disconnected' });

      if (event.code === 4003) {
        // Acesso negado — não reconectar
        return;
      }

      if (retryCount < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
        retryCount++;
        retryTimer = setTimeout(() => doConnect(opts), delay);
      } else {
        opts.clearSession();
        set({ status: 'error' });
      }
    };
  };

  return {
    socket: null,
    status: 'disconnected',

    connect(opts) {
      retryCount = 0;
      clearRetry();
      const existing = get().socket;
      if (existing) existing.close();
      doConnect(opts);
    },

    disconnect() {
      clearRetry();
      retryCount = MAX_RETRIES; // evita reconexão após close manual
      const { socket } = get();
      if (socket) socket.close();
      set({ socket: null, status: 'disconnected' });
    },
  };
});
