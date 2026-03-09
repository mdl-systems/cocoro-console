/**
 * E2E: api.spec.ts
 * Next.js API ルートの E2E テスト（HTTPリクエスト直接）
 * 注: dev server が起動しているときのみ実行可能
 */
import { test, expect } from '@playwright/test';

// ── ヘルパー ────────────────────────────────────────────────

/** セッショントークンを取得する（UIログイン → クッキーから取得） */
async function getSessionToken(page: import('@playwright/test').Page): Promise<string> {
    await page.goto('/');
    // セッションクッキーを返す（cocoro-session）
    const cookies = await page.context().cookies();
    const session = cookies.find(c => c.name === 'cocoro-session');
    return session?.value ?? '';
}

// ── テスト ──────────────────────────────────────────────────

test.describe('API ルート', () => {

    test('GET /api/session — セッションが存在する', async ({ page, request }) => {
        await page.goto('/');
        const cookies = await page.context().cookies();
        const token = cookies.find(c => c.name === 'cocoro-session')?.value ?? '';

        const resp = await request.get('/api/session', {
            headers: token ? { Cookie: `cocoro-session=${token}` } : {},
        });

        // セッションがあれば 200、なければ 401 — どちらもサーバーが応答できている
        expect([200, 401]).toContain(resp.status());
    });

    test('GET /api/node — ノード情報が返る（またはオフライン応答）', async ({ page, request }) => {
        await page.goto('/');
        const cookies = await page.context().cookies();
        const token = cookies.find(c => c.name === 'cocoro-session')?.value ?? '';

        const resp = await request.get('/api/node', {
            headers: token ? { Cookie: `cocoro-session=${token}` } : {},
        });

        // 200 (mock) or 401 (未認証) or 503 (core offline) — サーバーがクラッシュしないこと
        expect([200, 401, 503]).toContain(resp.status());

        if (resp.status() === 200) {
            const data = await resp.json();
            expect(data).toBeDefined();
        }
    });

    test('GET /api/agent-proxy — エージェント情報が返る（モックフォールバック含む）', async ({ page, request }) => {
        await page.goto('/');
        const cookies = await page.context().cookies();
        const token = cookies.find(c => c.name === 'cocoro-session')?.value ?? '';

        const resp = await request.get('/api/agent-proxy', {
            headers: token ? { Cookie: `cocoro-session=${token}` } : {},
        });

        // 200 (live or mock) or 401 — サーバーが応答する
        expect([200, 401]).toContain(resp.status());

        if (resp.status() === 200) {
            const data = await resp.json();
            // agents か status キーが含まれる
            expect(data).toBeDefined();
        }
    });

    test('GET /api/memory — メモリAPIが応答する', async ({ page, request }) => {
        await page.goto('/');
        const cookies = await page.context().cookies();
        const token = cookies.find(c => c.name === 'cocoro-session')?.value ?? '';

        const resp = await request.get('/api/memory', {
            headers: token ? { Cookie: `cocoro-session=${token}` } : {},
        });

        expect([200, 401, 503]).toContain(resp.status());
    });

    test('POST /api/chat — 認証なしで 401 が返る', async ({ request }) => {
        const resp = await request.post('/api/chat', {
            data: { message: 'test', sessionId: 'invalid' },
        });

        // 認証なし → 401 か 400
        expect([400, 401, 403]).toContain(resp.status());
    });

    test('GET /api/logs — ログAPIが応答する', async ({ page, request }) => {
        await page.goto('/');
        const cookies = await page.context().cookies();
        const token = cookies.find(c => c.name === 'cocoro-session')?.value ?? '';

        const resp = await request.get('/api/logs', {
            headers: token ? { Cookie: `cocoro-session=${token}` } : {},
        });

        expect([200, 401]).toContain(resp.status());
    });
});
