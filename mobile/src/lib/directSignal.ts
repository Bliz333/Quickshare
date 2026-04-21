import { QUICKSHARE_API_BASE_URL } from './config';

export interface QuickShareDirectSignalMessage {
  type?: string;
  pairSessionId?: string;
  peerChannelId?: string;
  peerDeviceId?: string;
  peerLabel?: string;
  signalType?: string;
  payload?: unknown;
  channelId?: string;
  roomId?: string;
  roomScope?: string;
  roomCode?: string;
  devices?: Array<Record<string, unknown>>;
  message?: string;
}

export interface QuickShareDirectSignalClient {
  close: () => void;
  connect: () => Promise<void>;
  send: (payload: Record<string, unknown>) => void;
  sendSignal: (pairSessionId: string, signalType: string, payload: unknown) => void;
}

function getWsOrigin(): string {
  const apiUrl = new URL(QUICKSHARE_API_BASE_URL);
  const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${apiUrl.host}`;
}

function buildWsUrl(params: { token?: string; guestId?: string; deviceId: string; deviceName: string; deviceType: string }): string {
  const search = new URLSearchParams();
  search.set('deviceId', params.deviceId);
  search.set('deviceName', params.deviceName);
  search.set('deviceType', params.deviceType);
  if (params.token) {
    search.set('token', params.token);
  } else if (params.guestId) {
    search.set('guestId', params.guestId);
  }
  return `${getWsOrigin()}/ws/transfer?${search.toString()}`;
}

export function createDirectSignalClient(params: {
  token?: string;
  guestId?: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  onOpen?: () => void;
  onMessage: (message: QuickShareDirectSignalMessage) => void;
}): QuickShareDirectSignalClient {
  let socket: WebSocket | null = null;
  let connectPromise: Promise<void> | null = null;

  return {
    close: () => {
      socket?.close();
      socket = null;
      connectPromise = null;
    },
    connect: async () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        return;
      }
      if (connectPromise) {
        return connectPromise;
      }

      connectPromise = new Promise<void>((resolve, reject) => {
        const nextSocket = new WebSocket(buildWsUrl(params));
        socket = nextSocket;
        nextSocket.onopen = () => {
          params.onOpen?.();
          resolve();
        };
        nextSocket.onerror = () => reject(new Error('Failed to connect transfer signaling socket'));
        nextSocket.onmessage = (event) => {
          try {
            params.onMessage(JSON.parse(String(event.data)) as QuickShareDirectSignalMessage);
          } catch {
            // ignore malformed payloads
          }
        };
        nextSocket.onclose = () => {
          if (socket === nextSocket) {
            socket = null;
            connectPromise = null;
          }
        };
      });

      return connectPromise.finally(() => {
        connectPromise = null;
      });
    },
    send: (payload: Record<string, unknown>) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }
      socket.send(JSON.stringify(payload));
    },
    sendSignal: (pairSessionId: string, signalType: string, payload: unknown) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }
      socket.send(JSON.stringify({
        type: 'signal',
        pairSessionId,
        signalType,
        payload,
      }));
    },
  };
}
