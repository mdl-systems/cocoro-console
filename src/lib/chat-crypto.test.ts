/**
 * Unit tests for src/lib/chat-crypto.ts
 * Tests the enc:: prefix format, transparent decryption, and history batch decryption.
 *
 * Note: encryptMessage is sync-wrapped and uses async encrypt internally.
 * We test the exported functions via their public contract.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock identity so tests don't touch the filesystem ────────
vi.mock('@/core/identity', () => ({
    getOrCreateDeviceIdentity: () => ({ device_id: 'test-device-id-vitest' }),
}));

// ── Mock process.env.COCORO_ENCRYPT_CHAT ─────────────────────
// We need to test both enabled and disabled states.
// Because the module reads env at import time, we use dynamic imports.

describe('chat-crypto — encryption disabled (default)', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.stubEnv('COCORO_ENCRYPT_CHAT', 'false');
    });

    it('encryptMessage returns plaintext unchanged', async () => {
        const { encryptMessage } = await import('@/lib/chat-crypto');
        const result = encryptMessage('こんにちは');
        expect(result).toBe('こんにちは');
    });

    it('decryptMessage returns plaintext unchanged (no prefix)', async () => {
        const { decryptMessage } = await import('@/lib/chat-crypto');
        const result = decryptMessage('plain text message');
        expect(result).toBe('plain text message');
    });

    it('decryptHistory passes through array unchanged', async () => {
        const { decryptHistory } = await import('@/lib/chat-crypto');
        const rows = [
            { id: '1', content: 'hello', role: 'user' },
            { id: '2', content: 'world', role: 'assistant' },
        ];
        const result = decryptHistory(rows);
        expect(result[0].content).toBe('hello');
        expect(result[1].content).toBe('world');
    });
});

describe('chat-crypto — enc:: prefix detection', () => {
    it('decryptMessage returns fallback for malformed enc:: content', async () => {
        vi.resetModules();
        vi.stubEnv('COCORO_ENCRYPT_CHAT', 'false');
        const { decryptMessage } = await import('@/lib/chat-crypto');

        // Malformed encrypted content
        const result = decryptMessage('enc::not-valid-json{{{');
        expect(result).toBe('[復号化に失敗しました]');
    });

    it('decryptMessage passes through plaintext without enc:: prefix', async () => {
        vi.resetModules();
        vi.stubEnv('COCORO_ENCRYPT_CHAT', 'false');
        const { decryptMessage } = await import('@/lib/chat-crypto');

        expect(decryptMessage('regular message')).toBe('regular message');
        expect(decryptMessage('')).toBe('');
    });
});

describe('chat-crypto — decryptHistory', () => {
    it('handles mixed encrypted/plaintext rows', async () => {
        vi.resetModules();
        vi.stubEnv('COCORO_ENCRYPT_CHAT', 'false');
        const { decryptHistory } = await import('@/lib/chat-crypto');

        const rows = [
            { id: '1', content: 'plaintext message', role: 'user' },
            { id: '2', content: 'enc::malformed', role: 'assistant' },
        ];

        const result = decryptHistory(rows);
        expect(result[0].content).toBe('plaintext message');
        expect(result[1].content).toBe('[復号化に失敗しました]');
        // Other fields preserved
        expect(result[0].role).toBe('user');
        expect(result[1].id).toBe('2');
    });

    it('returns empty array for empty input', async () => {
        vi.resetModules();
        vi.stubEnv('COCORO_ENCRYPT_CHAT', 'false');
        const { decryptHistory } = await import('@/lib/chat-crypto');
        expect(decryptHistory([])).toEqual([]);
    });
});
