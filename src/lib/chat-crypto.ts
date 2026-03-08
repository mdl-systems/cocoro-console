/**
 * Chat Message Encryption
 *
 * Encrypts/decrypts chat_history.content at rest using AES-256-GCM.
 * Key source = device_id (stable per device, stored in .cocoro/identity.json).
 *
 * Encryption is opt-in:
 *   COCORO_ENCRYPT_CHAT=true  → encrypt all new messages
 *   COCORO_ENCRYPT_CHAT=false → store plaintext (default for dev)
 *
 * Encrypted content format: "enc::<json(EncryptedPayload)>"
 * Plaintext content is stored as-is (no prefix).
 */

import { encrypt, decrypt, type EncryptedPayload } from '@/core/crypto';
import { getOrCreateDeviceIdentity } from '@/core/identity';

const ENCRYPT_ENABLED = process.env.COCORO_ENCRYPT_CHAT === 'true';
const ENC_PREFIX = 'enc::';

// ─── Key source ───────────────────────────────────────────────

function getKeySource(): string {
    try {
        const identity = getOrCreateDeviceIdentity();
        return identity.device_id;
    } catch {
        // Fallback: use a fixed key (only for dev)
        return 'cocoro-dev-key-fallback';
    }
}

// ─── Encrypt ─────────────────────────────────────────────────

/**
 * Encrypt a chat message content string.
 * Returns "enc::<json>" if encryption is enabled, otherwise returns plaintext.
 */
export function encryptMessage(plaintext: string): string {
    if (!ENCRYPT_ENABLED) return plaintext;

    try {
        const keySource = getKeySource();
        const payload = encrypt(plaintext, keySource);
        return `${ENC_PREFIX}${JSON.stringify(payload)}`;
    } catch (err) {
        console.error('[chat-crypto] encrypt failed, storing plaintext:', err);
        return plaintext;
    }
}

// ─── Decrypt ─────────────────────────────────────────────────

/**
 * Decrypt a chat message content string.
 * Handles both encrypted ("enc::<json>") and plaintext messages transparently.
 */
export function decryptMessage(content: string): string {
    if (!content.startsWith(ENC_PREFIX)) {
        // Plaintext — return as-is
        return content;
    }

    try {
        const jsonStr = content.slice(ENC_PREFIX.length);
        const payload = JSON.parse(jsonStr) as EncryptedPayload;
        const keySource = getKeySource();
        return decrypt(payload, keySource);
    } catch (err) {
        console.error('[chat-crypto] decrypt failed, returning raw:', err);
        // Return raw without prefix to avoid exposing JSON garbage
        return '[復号化に失敗しました]';
    }
}

/**
 * Decrypt an array of chat history rows in place.
 */
export function decryptHistory(
    rows: Array<{ content: string;[key: string]: unknown }>
): Array<{ content: string;[key: string]: unknown }> {
    return rows.map(row => ({
        ...row,
        content: decryptMessage(row.content),
    }));
}

export { ENCRYPT_ENABLED };
