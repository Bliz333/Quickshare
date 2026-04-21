jest.mock('react-native-webrtc', () => {
  class MockDataChannel {
    readyState = 'open';
    binaryType = 'arraybuffer';
    sent: unknown[] = [];
    close() {}
    send(payload: unknown) { this.sent.push(payload); }
    onmessage?: (event: { data: string | ArrayBuffer }) => void;
    onopen?: () => void;
    onclose?: () => void;
  }

  class MockPeerConnection {
    connectionState = 'new';
    signalingState = 'stable';
    localDescription: { type: string; sdp: string } | null = null;
    remoteDescription: { type: string; sdp: string } | null = null;
    candidates: Array<{ candidate: string }> = [];
    control = new MockDataChannel();
    file = new MockDataChannel();

    createDataChannel(label: string) {
      return label === 'transfer-control' ? this.control : this.file;
    }

    async createOffer() {
      return { type: 'offer', sdp: 'offer-sdp' };
    }

    async createAnswer() {
      return { type: 'answer', sdp: 'answer-sdp' };
    }

    async setLocalDescription(desc: { type: string; sdp: string }) {
      this.localDescription = desc;
    }

    async setRemoteDescription(desc: { type: string; sdp: string }) {
      this.remoteDescription = desc;
    }

    async addIceCandidate(candidate: { candidate: string }) {
      this.candidates.push(candidate);
    }

    close() {}
  }

  return {
    RTCPeerConnection: MockPeerConnection,
    RTCSessionDescription: function RTCSessionDescription(value: { type: string; sdp: string }) { return value; },
    RTCIceCandidate: function RTCIceCandidate(value: { candidate: string }) { return value; },
  };
});

import { createLocalDirectTransport } from './directTransfer';

describe('directTransfer', () => {
  it('creates local offer and handles answer/candidate signals', async () => {
    const sentSignals: Array<{ type: string; payload: unknown }> = [];
    const transport = await createLocalDirectTransport({
      directTransferEnabled: true,
      iceServers: [{ urls: ['stun:example.com'] }],
    }, (type, payload) => sentSignals.push({ type, payload }));

    expect(sentSignals[0].type).toBe('offer');
    expect(transport.summary().hasLocalOffer).toBe(true);

    await transport.handleSignal('answer', { type: 'answer', sdp: 'remote-answer' });
    await transport.handleSignal('candidate', { candidate: 'candidate-1' });

    expect(transport.peerConnection.remoteDescription).toEqual({ type: 'answer', sdp: 'remote-answer' });
    expect((transport.peerConnection as unknown as { candidates: Array<{ candidate: string }> }).candidates).toEqual([{ candidate: 'candidate-1' }]);
  });

  it('sends control/binary payloads and surfaces channel callbacks', async () => {
    const controlMessages: Array<Record<string, unknown>> = [];
    const binaryMessages: number[][] = [];
    let latestSummary: unknown = null;

    const transport = await createLocalDirectTransport(
      { directTransferEnabled: true, iceServers: [] },
      () => {},
      {
        onBinaryMessage: (payload) => binaryMessages.push(Array.from(new Uint8Array(payload))),
        onControlMessage: (payload) => controlMessages.push(payload),
        onStateChange: (summary) => { latestSummary = summary; },
      },
    );

    expect(transport.sendControl({ type: 'hello' })).toBe(true);
    expect(transport.sendBinary(new Uint8Array([1, 2, 3]).buffer)).toBe(true);

    const peerConnection = transport.peerConnection as unknown as {
      control: {
        onmessage?: (event: { data: string }) => void;
        onopen?: () => void;
      };
      file: {
        onmessage?: (event: { data: ArrayBuffer }) => void;
      };
    };
    peerConnection.control.onmessage?.({ data: JSON.stringify({ type: 'transfer-offer', transferId: 'x' }) });
    peerConnection.file.onmessage?.({ data: new Uint8Array([9, 8]).buffer });
    peerConnection.control.onopen?.();

    expect(controlMessages).toEqual([{ type: 'transfer-offer', transferId: 'x' }]);
    expect(binaryMessages).toEqual([[9, 8]]);
    expect(latestSummary).not.toBeNull();
  });
});
