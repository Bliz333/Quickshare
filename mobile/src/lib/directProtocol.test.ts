import { buildDirectChunkPacket, parseDirectChunkPacket } from './directProtocol';

describe('directProtocol', () => {
  it('round-trips chunk metadata and payload', async () => {
    const payload = new Uint8Array([1, 2, 3, 4]).buffer;
    const packet = buildDirectChunkPacket('transfer-1', 2, 8, payload);

    const parsed = await parseDirectChunkPacket(packet);

    expect(parsed.header).toEqual({
      transferId: 'transfer-1',
      chunkIndex: 2,
      totalChunks: 8,
    });
    expect(Array.from(parsed.payload)).toEqual([1, 2, 3, 4]);
  });
});
