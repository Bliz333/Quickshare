export const QUICKSHARE_DIRECT_CHUNK_SIZE = 64 * 1024;

export function buildDirectChunkPacket(
  transferId: string,
  chunkIndex: number,
  totalChunks: number,
  payload: ArrayBuffer,
): ArrayBuffer {
  const encoder = new TextEncoder();
  const header = encoder.encode(JSON.stringify({
    transferId,
    chunkIndex,
    totalChunks,
  }));
  const body = new Uint8Array(payload);
  const packet = new Uint8Array(4 + header.length + body.length);
  const view = new DataView(packet.buffer);
  view.setUint32(0, header.length);
  packet.set(header, 4);
  packet.set(body, 4 + header.length);
  return packet.buffer;
}

export async function parseDirectChunkPacket(data: ArrayBuffer): Promise<{
  header: { transferId: string; chunkIndex: number; totalChunks: number };
  payload: Uint8Array;
}> {
  const view = new DataView(data);
  const headerLength = view.getUint32(0);
  const headerBytes = data.slice(4, 4 + headerLength);
  const payload = new Uint8Array(data.slice(4 + headerLength));
  const decoder = new TextDecoder();
  const header = JSON.parse(decoder.decode(headerBytes)) as { transferId: string; chunkIndex: number; totalChunks: number };
  return { header, payload };
}
