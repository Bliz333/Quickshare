import { Directory, File, Paths } from 'expo-file-system';

export interface QuickShareIncomingDirectManifest {
  transferId: string;
  taskKey?: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  totalChunks: number;
  senderDeviceId?: string;
  receiverDeviceId?: string;
  receivedChunks: number;
  assembledFileUri?: string;
}

function sanitizeFileName(value: string): string {
  return String(value || 'incoming-transfer').replace(/[\\/:*?"<>|]/g, '_');
}

function getRootDirectory(): Directory {
  const directory = new Directory(Paths.cache, 'quickshare-direct');
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function getTransferDirectory(transferId: string): Directory {
  const directory = new Directory(getRootDirectory(), transferId);
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function getManifestFile(transferId: string): File {
  const file = new File(getTransferDirectory(transferId), 'manifest.json');
  return file;
}

function getChunkFile(transferId: string, chunkIndex: number): File {
  const file = new File(getTransferDirectory(transferId), `chunk-${chunkIndex}.bin`);
  return file;
}

function getAssembledFile(transferId: string, fileName: string): File {
  const file = new File(getTransferDirectory(transferId), `assembled-${sanitizeFileName(fileName)}`);
  if (!file.exists) {
    file.create({ intermediates: true, overwrite: true });
  }
  return file;
}

function countStoredChunks(transferId: string): number {
  return getTransferDirectory(transferId)
    .list()
    .filter((entry) => entry instanceof File && entry.name.startsWith('chunk-'))
    .length;
}

export function readIncomingDirectManifest(transferId: string): QuickShareIncomingDirectManifest | null {
  const manifestFile = getManifestFile(transferId);
  if (!manifestFile.exists) {
    return null;
  }
  try {
    return JSON.parse(manifestFile.textSync()) as QuickShareIncomingDirectManifest;
  } catch {
    return null;
  }
}

export function writeIncomingDirectManifest(manifest: QuickShareIncomingDirectManifest): QuickShareIncomingDirectManifest {
  const nextManifest = {
    ...manifest,
    receivedChunks: countStoredChunks(manifest.transferId),
  };
  const manifestFile = getManifestFile(manifest.transferId);
  if (!manifestFile.exists) {
    manifestFile.create({ intermediates: true, overwrite: true });
  }
  manifestFile.write(JSON.stringify(nextManifest));
  return nextManifest;
}

export function prepareIncomingDirectTransfer(manifest: Omit<QuickShareIncomingDirectManifest, 'receivedChunks' | 'assembledFileUri'>): {
  manifest: QuickShareIncomingDirectManifest;
  missingChunks: number[];
} {
  const existing = readIncomingDirectManifest(manifest.transferId);
  const nextManifest = writeIncomingDirectManifest({
    ...existing,
    ...manifest,
    receivedChunks: 0,
  });
  const missingChunks = Array.from({ length: Math.max(0, nextManifest.totalChunks) }, (_, index) => index)
    .filter((index) => !getChunkFile(nextManifest.transferId, index).exists || getChunkFile(nextManifest.transferId, index).size === 0);
  return { manifest: nextManifest, missingChunks };
}

export function saveIncomingDirectChunk(transferId: string, chunkIndex: number, payload: Uint8Array): QuickShareIncomingDirectManifest | null {
  const chunkFile = getChunkFile(transferId, chunkIndex);
  if (!chunkFile.exists) {
    chunkFile.create({ intermediates: true, overwrite: true });
  }
  chunkFile.write(payload);
  const manifest = readIncomingDirectManifest(transferId);
  if (!manifest) {
    return null;
  }
  return writeIncomingDirectManifest(manifest);
}

export function assembleIncomingDirectTransfer(transferId: string): QuickShareIncomingDirectManifest | null {
  const manifest = readIncomingDirectManifest(transferId);
  if (!manifest) {
    return null;
  }

  const chunks = Array.from({ length: manifest.totalChunks }, (_, index) => getChunkFile(transferId, index).bytesSync());
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  const assembledFile = getAssembledFile(transferId, manifest.fileName);
  assembledFile.write(combined);
  return writeIncomingDirectManifest({
    ...manifest,
    assembledFileUri: assembledFile.uri,
  });
}
