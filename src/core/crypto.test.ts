/**
 * Unit tests for src/core/crypto.ts
 * Tests AES-256-GCM encrypt/decrypt round-trip and key derivation.
 */
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '@/core/crypto';

const KEY_SOURCE = 'test-device-id-abc123';
const PLAINTEXT = 'Hello, Cocoro! 🌸';

describe('crypto — AES-256-GCM', () => {
    it('encrypts and decrypts a string round-trip', async () => {
        const payload = await encrypt(PLAINTEXT, KEY_SOURCE);
        expect(payload).toBeDefined();
        expect(payload.ciphertext).toBeTruthy();
        expect(payload.iv).toBeTruthy();
        expect(payload.salt).toBeTruthy();
        expect(payload.authTag).toBeTruthy();

        const result = await decrypt(payload, KEY_SOURCE);
        expect(result).toBe(PLAINTEXT);
    });

    it('produces different ciphertext each call (random IV)', async () => {
        const p1 = await encrypt(PLAINTEXT, KEY_SOURCE);
        const p2 = await encrypt(PLAINTEXT, KEY_SOURCE);
        // IV should differ
        expect(p1.iv).not.toBe(p2.iv);
    });

    it('fails decryption with wrong key source', async () => {
        const payload = await encrypt(PLAINTEXT, KEY_SOURCE);
        // decrypt throws Error when auth tag mismatch
        let threw = false;
        try { await Promise.resolve(decrypt(payload, 'wrong-key')); }
        catch { threw = true; }
        expect(threw).toBe(true);
    });

    it('encrypts empty string', async () => {
        const payload = await encrypt('', KEY_SOURCE);
        const result = await decrypt(payload, KEY_SOURCE);
        expect(result).toBe('');
    });

    it('encrypts long content', async () => {
        const long = 'あ'.repeat(10_000);
        const payload = await encrypt(long, KEY_SOURCE);
        const result = await decrypt(payload, KEY_SOURCE);
        expect(result).toBe(long);
    });

    it('encrypts JSON content', async () => {
        const json = JSON.stringify({ name: 'Cocoro', version: 1, data: [1, 2, 3] });
        const payload = await encrypt(json, KEY_SOURCE);
        const result = await decrypt(payload, KEY_SOURCE);
        expect(JSON.parse(result)).toEqual(JSON.parse(json));
    });
});
