jest.mock('expo-file-system', () => {
  const files = new Map<string, Uint8Array | string>();
  const directories = new Set<string>();

  function normalize(parts: Array<string | { uri: string }>) {
    return parts
      .map((part) => typeof part === 'string' ? part : part.uri)
      .join('/');
  }

  class Directory {
    uri: string;

    constructor(...parts: Array<string | { uri: string }>) {
      this.uri = normalize(parts);
    }

    create() {
      directories.add(this.uri);
    }

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

    create() {
      if (!files.has(this.uri)) {
        files.set(this.uri, '');
      }
    }

    write(content: string | Uint8Array) {
      files.set(this.uri, content);
    }

    textSync() {
      const value = files.get(this.uri);
      return typeof value === 'string' ? value : new TextDecoder().decode(value as Uint8Array);
    }

    bytesSync() {
      const value = files.get(this.uri);
      if (typeof value === 'string') {
        return new TextEncoder().encode(value);
      }
      return value as Uint8Array;
    }

    get exists() {
      return files.has(this.uri);
    }

    get size() {
      const value = files.get(this.uri);
      if (!value) return 0;
      return typeof value === 'string' ? value.length : value.length;
    }

    get name() {
      return this.uri.split('/').pop() || '';
    }
  }

  return {
    Directory,
    File,
    Paths: {
      cache: new Directory('cache'),
    },
  };
});

import {
  assembleIncomingDirectTransfer,
  prepareIncomingDirectTransfer,
  readIncomingDirectManifest,
  saveIncomingDirectChunk,
} from './directStorage';

describe('directStorage', () => {
  it('stores chunks and assembles an incoming direct transfer', () => {
    const prepared = prepareIncomingDirectTransfer({
      transferId: 'direct-1',
      taskKey: 'task-1',
      fileName: 'hello.txt',
      fileSize: 10,
      contentType: 'text/plain',
      totalChunks: 2,
      senderDeviceId: 'sender-a',
      receiverDeviceId: 'receiver-b',
    });

    expect(prepared.missingChunks).toEqual([0, 1]);

    saveIncomingDirectChunk('direct-1', 0, new Uint8Array([104, 101, 108, 108, 111]));
    const manifestAfterFirst = readIncomingDirectManifest('direct-1');
    expect(manifestAfterFirst?.receivedChunks).toBe(1);

    saveIncomingDirectChunk('direct-1', 1, new Uint8Array([119, 111, 114, 108, 100]));
    const assembled = assembleIncomingDirectTransfer('direct-1');

    expect(assembled?.receivedChunks).toBe(2);
    expect(assembled?.assembledFileUri).toContain('assembled-hello.txt');
  });
});
