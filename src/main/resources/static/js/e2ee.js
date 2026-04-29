/**
 * e2ee.js — Browser-side file encryption helpers for relay transfers.
 *
 * Uses Web Crypto AES-GCM with a random per-file key. The server only receives
 * ciphertext; the raw key must travel via WebSocket payloads or URL fragments.
 */
(function () {
    'use strict';

    const AES_GCM_TAG_BYTES = 16;
    const DEFAULT_VERSION = 1;

    function ensureCrypto() {
        if (!window.crypto || !window.crypto.subtle || !window.crypto.getRandomValues) {
            throw new Error('Browser encryption is unavailable');
        }
    }

    function bytesToBase64Url(bytes) {
        let binary = '';
        const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }

    function base64UrlToBytes(value) {
        const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    function aadFor(meta, chunkIndex) {
        const aad = JSON.stringify({
            v: meta?.version || DEFAULT_VERSION,
            fileName: meta?.fileName || '',
            fileSize: Number(meta?.fileSize || 0),
            contentType: meta?.contentType || 'application/octet-stream',
            chunkSize: Number(meta?.chunkSize || 0),
            totalChunks: Number(meta?.totalChunks || 0),
            chunkIndex: Number(chunkIndex || 0)
        });
        return new TextEncoder().encode(aad);
    }

    async function generateKey() {
        ensureCrypto();
        const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
        const raw = await crypto.subtle.exportKey('raw', key);
        return {
            key,
            rawKey: bytesToBase64Url(raw)
        };
    }

    async function importKey(rawKey) {
        ensureCrypto();
        return crypto.subtle.importKey('raw', base64UrlToBytes(rawKey), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    }

    async function encryptChunk(key, chunk, meta, chunkIndex) {
        const iv = new Uint8Array(12);
        crypto.getRandomValues(iv);
        const plain = await chunk.arrayBuffer();
        const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aadFor(meta, chunkIndex) }, key, plain);
        const out = new Uint8Array(iv.length + cipher.byteLength);
        out.set(iv, 0);
        out.set(new Uint8Array(cipher), iv.length);
        return out;
    }

    async function decryptChunk(key, encryptedBytes, meta, chunkIndex) {
        const bytes = encryptedBytes instanceof Uint8Array ? encryptedBytes : new Uint8Array(encryptedBytes);
        const iv = bytes.slice(0, 12);
        const cipher = bytes.slice(12);
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aadFor(meta, chunkIndex) }, key, cipher);
    }

    function encryptedChunkSizeFor(meta, chunkIndex) {
        const chunkSize = Number(meta?.chunkSize || 0);
        const fileSize = Number(meta?.fileSize || 0);
        const totalChunks = Number(meta?.totalChunks || 0);
        const isLast = chunkIndex === totalChunks - 1;
        const plainSize = isLast ? Math.max(0, fileSize - (chunkSize * chunkIndex)) : chunkSize;
        return 12 + plainSize + AES_GCM_TAG_BYTES;
    }

    async function decryptBlob(encryptedBlob, e2ee) {
        const meta = e2ee || {};
        const key = await importKey(meta.key);
        const encrypted = new Uint8Array(await encryptedBlob.arrayBuffer());
        const chunks = [];
        let offset = 0;
        for (let i = 0; i < Number(meta.totalChunks || 0); i += 1) {
            const size = encryptedChunkSizeFor(meta, i);
            const part = encrypted.slice(offset, offset + size);
            chunks.push(await decryptChunk(key, part, meta, i));
            offset += size;
        }
        return new Blob(chunks, { type: meta.contentType || 'application/octet-stream' });
    }

    async function fetchAndDecrypt(url, e2ee) {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Encrypted file download failed');
        return decryptBlob(await response.blob(), e2ee);
    }

    function buildFragment(e2ee) {
        if (!e2ee?.key) return '';
        const params = new URLSearchParams();
        params.set('key', e2ee.key);
        params.set('v', String(e2ee.version || DEFAULT_VERSION));
        params.set('cs', String(e2ee.chunkSize || 0));
        params.set('tc', String(e2ee.totalChunks || 0));
        params.set('fs', String(e2ee.fileSize || 0));
        params.set('ct', e2ee.contentType || 'application/octet-stream');
        params.set('fn', e2ee.fileName || '');
        return params.toString();
    }

    function parseFragment() {
        const raw = window.location.hash ? window.location.hash.slice(1) : '';
        if (!raw) return null;
        const params = new URLSearchParams(raw);
        const key = params.get('key');
        if (!key) return null;
        return {
            encrypted: true,
            version: Number(params.get('v') || DEFAULT_VERSION),
            key,
            chunkSize: Number(params.get('cs') || 0),
            totalChunks: Number(params.get('tc') || 0),
            fileSize: Number(params.get('fs') || 0),
            contentType: params.get('ct') || 'application/octet-stream',
            fileName: params.get('fn') || ''
        };
    }

    async function downloadDecrypted(url, e2ee, fileName) {
        const blob = await fetchAndDecrypt(url, e2ee);
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = fileName || e2ee?.fileName || 'download';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    }

    window.QuickShareE2EE = {
        generateKey,
        importKey,
        encryptChunk,
        decryptBlob,
        fetchAndDecrypt,
        buildFragment,
        parseFragment,
        downloadDecrypted
    };
})();
