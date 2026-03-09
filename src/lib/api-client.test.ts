/**
 * Unit tests: src/lib/api-client.ts
 * フロントエンド API クライアント (fetch + CSRF) のユニットテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── fetch モック ─────────────────────────────────────────────

const mockResponse = (body: unknown, status = 200): Response =>
({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: new Headers(),
} as unknown as Response);

const mockFetch = vi.fn();

// ── document.cookie モック ───────────────────────────────────

function setCsrfCookie(token: string | null) {
    if (token) {
        Object.defineProperty(document, 'cookie', {
            value: `cocoro_csrf=${token}`,
            configurable: true,
            writable: true,
        });
    } else {
        Object.defineProperty(document, 'cookie', {
            value: '',
            configurable: true,
            writable: true,
        });
    }
}

// ── Setup ─────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;

    // セットアップ: デフォルトで CSRF トークンあり
    setCsrfCookie('test-csrf-token');
    mockFetch.mockResolvedValue(mockResponse({ ok: true }));
});

afterEach(() => {
    setCsrfCookie(null);
});

// ── Tests ─────────────────────────────────────────────────────

describe('apiGet()', () => {
    it('指定パスに GET リクエストを送信する', async () => {
        const { apiGet } = await import('./api-client');
        await apiGet('/api/node');

        expect(mockFetch).toHaveBeenCalledWith('/api/node');
    });
});

describe('apiPost()', () => {
    it('Content-Type と X-CSRF-Token ヘッダーを含む POST を送信する', async () => {
        const { apiPost } = await import('./api-client');
        await apiPost('/api/session', { action: 'create' });

        expect(mockFetch).toHaveBeenCalledWith(
            '/api/session',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': 'test-csrf-token',
                }),
                body: JSON.stringify({ action: 'create' }),
            })
        );
    });

    it('body なしでも POST できる', async () => {
        const { apiPost } = await import('./api-client');
        await apiPost('/api/session');

        expect(mockFetch).toHaveBeenCalledWith(
            '/api/session',
            expect.objectContaining({ method: 'POST', body: undefined })
        );
    });
});

describe('apiPut()', () => {
    it('Content-Type と X-CSRF-Token ヘッダーを含む PUT を送信する', async () => {
        const { apiPut } = await import('./api-client');
        await apiPut('/api/profile', { name: 'テスト' });

        expect(mockFetch).toHaveBeenCalledWith(
            '/api/profile',
            expect.objectContaining({
                method: 'PUT',
                headers: expect.objectContaining({
                    'X-CSRF-Token': 'test-csrf-token',
                }),
                body: JSON.stringify({ name: 'テスト' }),
            })
        );
    });
});

describe('apiDelete()', () => {
    it('X-CSRF-Token ヘッダーを含む DELETE を送信する', async () => {
        const { apiDelete } = await import('./api-client');
        await apiDelete('/api/session');

        expect(mockFetch).toHaveBeenCalledWith(
            '/api/session',
            expect.objectContaining({
                method: 'DELETE',
                headers: expect.objectContaining({
                    'X-CSRF-Token': 'test-csrf-token',
                }),
            })
        );
    });
});

describe('apiStream()', () => {
    it('CSRF トークンが存在する場合は直接 POST する', async () => {
        const { apiStream } = await import('./api-client');
        await apiStream('/api/chat/stream', { message: 'test' });

        // fetch は1回だけ（セッション取得なし）
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith(
            '/api/chat/stream',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'X-CSRF-Token': 'test-csrf-token',
                }),
            })
        );
    });

    it('CSRF トークンがない場合はセッション取得してから POST する', async () => {
        setCsrfCookie(null); // CSRF なし

        mockFetch
            // 1回目: /api/session POST
            .mockResolvedValueOnce(mockResponse({ csrf_token: 'refreshed-token' }))
            // 2回目: 本来のリクエスト
            .mockResolvedValueOnce(mockResponse({ ok: true }));

        const { apiStream } = await import('./api-client');
        await apiStream('/api/chat/stream', { message: 'hello' });

        // fetch が2回呼ばれる
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockFetch.mock.calls[0][0]).toBe('/api/session');
    });

    it('AbortSignal を渡せる', async () => {
        const controller = new AbortController();
        const { apiStream } = await import('./api-client');
        await apiStream('/api/chat/stream', { message: 'test' }, controller.signal);

        expect(mockFetch).toHaveBeenCalledWith(
            '/api/chat/stream',
            expect.objectContaining({ signal: controller.signal })
        );
    });
});
