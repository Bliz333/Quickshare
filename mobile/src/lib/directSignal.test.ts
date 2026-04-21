import { createDirectSignalClient } from './directSignal';

describe('directSignal', () => {
  class MockWebSocket {
    static instances: MockWebSocket[] = [];
    static OPEN = 1;
    readyState = 1;
    onopen: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    sent: string[] = [];
    url: string;

    constructor(url: string) {
      this.url = url;
      MockWebSocket.instances.push(this);
      queueMicrotask(() => this.onopen?.());
    }

    send(payload: string) {
      this.sent.push(payload);
    }

    close() {
      this.onclose?.();
    }
  }

  beforeEach(() => {
    MockWebSocket.instances = [];
    // @ts-expect-error test shim
    global.WebSocket = MockWebSocket;
  });

  it('connects and sends signal payloads over the transfer websocket', async () => {
    const received: unknown[] = [];
    const client = createDirectSignalClient({
      token: 'token-1',
      deviceId: 'device-1',
      deviceName: 'QuickShare Mobile',
      deviceType: 'Android App',
      onMessage: (message) => received.push(message),
    });

    await client.connect();
    const socket = MockWebSocket.instances[0];
    expect(socket.url).toContain('/ws/transfer?');
    expect(socket.url).toContain('deviceId=device-1');

    client.sendSignal('pair-1', 'offer', { sdp: 'fake', type: 'offer' });

    expect(socket.sent[0]).toContain('"type":"signal"');
    expect(socket.sent[0]).toContain('"pairSessionId":"pair-1"');

    socket.onmessage?.({ data: JSON.stringify({ type: 'welcome', channelId: 'channel-1' }) });
    expect(received).toEqual([{ type: 'welcome', channelId: 'channel-1' }]);
  });
});
