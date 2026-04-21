import { RTCIceCandidate, RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';

import type { QuickShareTransferRtcConfig } from '../types/quickshare';

export interface QuickShareDirectTransportSummary {
  connectionState: string;
  signalingState: string;
  controlChannelState: string;
  fileChannelState: string;
  hasLocalOffer: boolean;
}

export interface QuickShareDirectTransportHandle {
  close: () => void;
  handleSignal: (signalType: string, payload: unknown) => Promise<void>;
  peerConnection: RTCPeerConnection;
  sendBinary: (payload: ArrayBuffer) => boolean;
  sendControl: (payload: Record<string, unknown>) => boolean;
  summary: () => QuickShareDirectTransportSummary;
}

interface QuickShareDirectTransportCallbacks {
  onBinaryMessage?: (payload: ArrayBuffer) => void;
  onControlMessage?: (payload: Record<string, unknown>) => void;
  onStateChange?: (summary: QuickShareDirectTransportSummary) => void;
}

function buildSummary(
  peerConnection: RTCPeerConnection,
  controlChannel: { readyState: string },
  fileChannel: { readyState: string },
): QuickShareDirectTransportSummary {
  return {
    connectionState: peerConnection.connectionState,
    signalingState: peerConnection.signalingState,
    controlChannelState: controlChannel.readyState,
    fileChannelState: fileChannel.readyState,
    hasLocalOffer: Boolean(peerConnection.localDescription?.sdp),
  };
}

export async function createLocalDirectTransport(
  rtcConfig: QuickShareTransferRtcConfig | null,
  onSignal: (signalType: string, payload: unknown) => void,
  callbacks: QuickShareDirectTransportCallbacks = {},
): Promise<QuickShareDirectTransportHandle> {
  const peerConnection = new RTCPeerConnection({
    iceServers: (rtcConfig?.iceServers || []).map((server) => ({
      credential: server.credential,
      urls: server.urls || [],
      username: server.username,
    })),
  });

  const controlChannel = peerConnection.createDataChannel('transfer-control', { ordered: true });
  const fileChannel = peerConnection.createDataChannel('transfer-file', { ordered: true });
  controlChannel.binaryType = 'arraybuffer';
  fileChannel.binaryType = 'arraybuffer';
  const typedControlChannel = controlChannel as typeof controlChannel & {
    onopen?: () => void;
    onclose?: () => void;
    onmessage?: (event: { data: string }) => void;
  };
  const typedFileChannel = fileChannel as typeof fileChannel & {
    onopen?: () => void;
    onclose?: () => void;
    onmessage?: (event: { data: ArrayBuffer }) => void;
  };
  const typedPeerConnection = peerConnection as typeof peerConnection & {
    onicecandidate?: (event: { candidate?: RTCIceCandidate }) => void;
  };

  const emitState = () => {
    callbacks.onStateChange?.(buildSummary(peerConnection, controlChannel, fileChannel));
  };

  typedControlChannel.onopen = emitState;
  typedControlChannel.onclose = emitState;
  typedFileChannel.onopen = emitState;
  typedFileChannel.onclose = emitState;
  typedControlChannel.onmessage = (event: { data: string }) => {
    try {
      callbacks.onControlMessage?.(JSON.parse(String(event.data)) as Record<string, unknown>);
    } catch {
      // ignore malformed direct control messages
    }
  };
  typedFileChannel.onmessage = (event: { data: ArrayBuffer }) => {
    callbacks.onBinaryMessage?.(event.data);
  };

  typedPeerConnection.onicecandidate = (event: { candidate?: RTCIceCandidate }) => {
    if (event.candidate) {
      const payload = typeof event.candidate.toJSON === 'function' ? event.candidate.toJSON() : event.candidate;
      onSignal('candidate', payload);
    }
  };

  const offer = await peerConnection.createOffer({});
  await peerConnection.setLocalDescription(offer);
  onSignal('offer', offer);

  return {
    close: () => {
      controlChannel.close();
      fileChannel.close();
      peerConnection.close();
    },
    handleSignal: async (signalType: string, payload: unknown) => {
      if (signalType === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInitLike));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        onSignal('answer', answer);
        return;
      }

      if (signalType === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInitLike));
        return;
      }

      if (signalType === 'candidate') {
        await peerConnection.addIceCandidate(new RTCIceCandidate(payload as object));
      }
    },
    peerConnection,
    sendBinary: (payload: ArrayBuffer) => {
      if (fileChannel.readyState !== 'open') {
        return false;
      }
      fileChannel.send(payload);
      return true;
    },
    sendControl: (payload: Record<string, unknown>) => {
      if (controlChannel.readyState !== 'open') {
        return false;
      }
      controlChannel.send(JSON.stringify(payload));
      return true;
    },
    summary: () => buildSummary(peerConnection, controlChannel, fileChannel),
  };
}

type RTCSessionDescriptionInitLike = {
  sdp: string;
  type: string;
};
