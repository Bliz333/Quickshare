jest.mock('expo-file-system', () => {
  const files = new Map<string, Uint8Array | string>();

  function normalize(parts: Array<string | { uri: string }>) {
    return parts.map((part) => typeof part === 'string' ? part : part.uri).join('/');
  }

  class Directory {
    uri: string;
    constructor(...parts: Array<string | { uri: string }>) {
      this.uri = normalize(parts);
    }
    create() {}
    list() {
      return Array.from(files.keys())
        .filter((key) => key.startsWith(`${this.uri}/`))
        .map((key) => new File(key));
    }
  }

  class File {
    uri: string;
    constructor(...parts: Array<string | { uri: string }>) {
      this.uri = normalize(parts);
    }
    create() { if (!files.has(this.uri)) files.set(this.uri, ''); }
    write(content: string | Uint8Array) { files.set(this.uri, content); }
    textSync() {
      const value = files.get(this.uri);
      return typeof value === 'string' ? value : new TextDecoder().decode(value as Uint8Array);
    }
    bytesSync() {
      const value = files.get(this.uri);
      return typeof value === 'string' ? new TextEncoder().encode(value) : (value as Uint8Array);
    }
    get exists() { return files.has(this.uri); }
    get size() {
      const value = files.get(this.uri);
      return value ? (typeof value === 'string' ? value.length : value.length) : 0;
    }
    get name() { return this.uri.split('/').pop() || ''; }
  }

  return {
    Directory,
    File,
    Paths: { cache: new Directory('cache') },
  };
});

import { buildDirectChunkPacket, parseDirectChunkPacket } from './directProtocol';
import { assembleIncomingDirectTransfer, prepareIncomingDirectTransfer, saveIncomingDirectChunk } from './directStorage';

describe('direct flow', () => {
  it('can prepare, receive, and assemble a direct transfer payload', async () => {
    const fileBytes = new TextEncoder().encode('hello-direct-world');
    const chunkSize = 5;
    const totalChunks = Math.ceil(fileBytes.length / chunkSize);

    const prepared = prepareIncomingDirectTransfer({
      transferId: 'flow-1',
      taskKey: 'task-flow-1',
      fileName: 'flow.txt',
      fileSize: fileBytes.length,
      contentType: 'text/plain',
      totalChunks,
      senderDeviceId: 'sender-1',
      receiverDeviceId: 'receiver-1',
    });

    expect(prepared.missingChunks).toEqual([0, 1, 2, 3]);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(fileBytes.length, start + chunkSize);
      const packet = buildDirectChunkPacket('flow-1', chunkIndex, totalChunks, fileBytes.slice(start, end).buffer);
      const parsed = await parseDirectChunkPacket(packet);
      saveIncomingDirectChunk(parsed.header.transferId, parsed.header.chunkIndex, parsed.payload);
    }

    const assembled = assembleIncomingDirectTransfer('flow-1');

    expect(assembled?.receivedChunks).toBe(totalChunks);
    expect(assembled?.assembledFileUri).toContain('assembled-flow.txt');
  });
});
