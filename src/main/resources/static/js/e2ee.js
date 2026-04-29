/**
 * e2ee.js — Browser-side file encryption helpers for relay transfers.
 *
 * Uses Web Crypto AES-GCM. Public pickup links carry keys in URL fragments;
 * paired relay paths use browser ECDH/HKDF so WebSocket signaling does not
 * carry the raw file key.
 */
(function () {
    'use strict';

    const AES_GCM_TAG_BYTES = 16;
    const DEFAULT_VERSION = 1;
    const RELAY_KDF_VERSION = 2;
    const RELAY_IDENTITY_DB = 'quickshare-e2ee-identity-v1';
    const RELAY_IDENTITY_STORE = 'keys';
    const relayRecipientKeys = new Map();

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

    async function sha256(bytes) {
        ensureCrypto();
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        return bytesToBase64Url(new Uint8Array(digest));
    }

    function openIdentityDb() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('Browser key storage is unavailable'));
                return;
            }
            const request = indexedDB.open(RELAY_IDENTITY_DB, 1);
            request.onupgradeneeded = () => {
                request.result.createObjectStore(RELAY_IDENTITY_STORE);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('Browser key storage failed'));
        });
    }

    async function idbGet(key) {
        const db = await openIdentityDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(RELAY_IDENTITY_STORE, 'readonly');
            const request = tx.objectStore(RELAY_IDENTITY_STORE).get(key);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error || new Error('Browser key read failed'));
            tx.oncomplete = () => db.close();
        });
    }

    async function idbPut(key, value) {
        const db = await openIdentityDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(RELAY_IDENTITY_STORE, 'readwrite');
            tx.objectStore(RELAY_IDENTITY_STORE).put(value, key);
            tx.oncomplete = () => {
                db.close();
                resolve();
            };
            tx.onerror = () => {
                db.close();
                reject(tx.error || new Error('Browser key write failed'));
            };
        });
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

    async function exportRawKey(key) {
        const raw = await crypto.subtle.exportKey('raw', key);
        return bytesToBase64Url(raw);
    }

    async function ensureRelayIdentity() {
        ensureCrypto();
        const stored = await idbGet('identity');
        if (stored?.privateKey && stored?.publicKey && stored?.publicKeyRaw && stored?.fingerprint) {
            return stored;
        }
        const pair = await crypto.subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' },
            false,
            ['sign', 'verify']
        );
        const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
        const identity = {
            privateKey: pair.privateKey,
            publicKey: pair.publicKey,
            publicKeyRaw: bytesToBase64Url(publicRaw),
            fingerprint: await sha256(publicRaw)
        };
        await idbPut('identity', identity);
        return identity;
    }

    async function importEcdhPublic(rawPublicKey) {
        return crypto.subtle.importKey(
            'raw',
            base64UrlToBytes(rawPublicKey),
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            []
        );
    }

    async function importVerifyPublic(rawPublicKey) {
        return crypto.subtle.importKey(
            'raw',
            base64UrlToBytes(rawPublicKey),
            { name: 'ECDSA', namedCurve: 'P-256' },
            false,
            ['verify']
        );
    }

    function relayInfo(meta, salt) {
        const info = JSON.stringify({
            purpose: 'quickshare-relay-file-key',
            version: RELAY_KDF_VERSION,
            fileName: meta?.fileName || '',
            fileSize: Number(meta?.fileSize || 0),
            contentType: meta?.contentType || 'application/octet-stream',
            chunkSize: Number(meta?.chunkSize || 0),
            totalChunks: Number(meta?.totalChunks || 0),
            salt
        });
        return new TextEncoder().encode(info);
    }

    async function deriveRelayAesKey(privateKey, peerPublicKeyRaw, meta, salt) {
        const peerPublicKey = await importEcdhPublic(peerPublicKeyRaw);
        const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: peerPublicKey }, privateKey, 256);
        const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
        return crypto.subtle.deriveKey(
            {
                name: 'HKDF',
                hash: 'SHA-256',
                salt: base64UrlToBytes(salt),
                info: relayInfo(meta, salt)
            },
            hkdfKey,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    }

    async function prepareRelayRecipient(sessionId) {
        ensureCrypto();
        const normalizedSessionId = String(sessionId || '').trim();
        if (!normalizedSessionId) throw new Error('Missing relay key session');
        const identity = await ensureRelayIdentity();
        const ecdh = await crypto.subtle.generateKey(
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            ['deriveBits']
        );
        const recipientPublicKey = bytesToBase64Url(await crypto.subtle.exportKey('raw', ecdh.publicKey));
        const signedBytes = new TextEncoder().encode(`${normalizedSessionId}.${recipientPublicKey}`);
        const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, identity.privateKey, signedBytes);
        const keyId = `${normalizedSessionId}:${recipientPublicKey}`;
        relayRecipientKeys.set(keyId, ecdh.privateKey);
        await idbPut(`recipient:${keyId}`, ecdh.privateKey);
        return {
            version: RELAY_KDF_VERSION,
            algorithm: 'ECDH-P256-HKDF-SHA256-AES-GCM',
            sessionId: normalizedSessionId,
            recipientPublicKey,
            recipientIdentityPublicKey: identity.publicKeyRaw,
            recipientIdentityFingerprint: identity.fingerprint,
            recipientKeySignature: bytesToBase64Url(signature)
        };
    }

    async function verifyRelayRecipientOffer(offer) {
        if (!offer?.sessionId || !offer?.recipientPublicKey || !offer?.recipientIdentityPublicKey || !offer?.recipientKeySignature) {
            return false;
        }
        const verifyKey = await importVerifyPublic(offer.recipientIdentityPublicKey);
        const signedBytes = new TextEncoder().encode(`${offer.sessionId}.${offer.recipientPublicKey}`);
        return crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            verifyKey,
            base64UrlToBytes(offer.recipientKeySignature),
            signedBytes
        );
    }

    async function encryptForRelayRecipient(offer, meta) {
        ensureCrypto();
        const valid = await verifyRelayRecipientOffer(offer);
        if (!valid) throw new Error('Recipient encryption key could not be verified');
        const sender = await crypto.subtle.generateKey(
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            ['deriveBits']
        );
        const senderPublicKey = bytesToBase64Url(await crypto.subtle.exportKey('raw', sender.publicKey));
        const saltBytes = new Uint8Array(16);
        crypto.getRandomValues(saltBytes);
        const salt = bytesToBase64Url(saltBytes);
        const keyAgreement = {
            version: RELAY_KDF_VERSION,
            algorithm: 'ECDH-P256-HKDF-SHA256-AES-GCM',
            sessionId: offer.sessionId,
            salt,
            senderPublicKey,
            recipientPublicKey: offer.recipientPublicKey,
            recipientIdentityPublicKey: offer.recipientIdentityPublicKey,
            recipientIdentityFingerprint: offer.recipientIdentityFingerprint || ''
        };
        const e2ee = {
            ...meta,
            encrypted: true,
            version: RELAY_KDF_VERSION,
            keyAgreement
        };
        const key = await deriveRelayAesKey(sender.privateKey, offer.recipientPublicKey, e2ee, salt);
        return { key, e2ee };
    }

    async function completeRelayRecipientE2ee(e2ee) {
        if (e2ee?.key || !e2ee?.keyAgreement?.senderPublicKey || !e2ee?.keyAgreement?.recipientPublicKey) {
            return e2ee;
        }
        const agreement = e2ee.keyAgreement;
        const keyId = `${agreement.sessionId}:${agreement.recipientPublicKey}`;
        let privateKey = relayRecipientKeys.get(keyId) || null;
        if (!privateKey) {
            privateKey = await idbGet(`recipient:${keyId}`);
            if (privateKey) relayRecipientKeys.set(keyId, privateKey);
        }
        if (!privateKey) throw new Error('Recipient relay key is unavailable');
        const key = await deriveRelayAesKey(privateKey, agreement.senderPublicKey, e2ee, agreement.salt);
        return {
            ...e2ee,
            key: await exportRawKey(key)
        };
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
        exportRawKey,
        prepareRelayRecipient,
        encryptForRelayRecipient,
        completeRelayRecipientE2ee,
        encryptChunk,
        decryptBlob,
        fetchAndDecrypt,
        buildFragment,
        parseFragment,
        downloadDecrypted
    };
})();
