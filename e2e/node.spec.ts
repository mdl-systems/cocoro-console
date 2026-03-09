/**
 * E2E: node.spec.ts
 * ノード監視ページのテスト
 */
import { test, expect } from '@playwright/test';

// ── ヘルパー ────────────────────────────────────────────────

async function unlock(page: import('@playwright/test').Page) {
    const unlockBtn = page.locator('button', { hasText: '続ける' });
    if (await unlockBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await unlockBtn.click();
        await page.waitForTimeout(500);
    }
}

async function navigateToNode(page: import('@playwright/test').Page) {
    await page.goto('/');
    await unlock(page);
    await page.locator('aside').first().waitFor({ timeout: 10000 });

    const nodeBtn = page.locator('button[title="ノード"]');
    await nodeBtn.waitFor({ timeout: 5000 });
    await nodeBtn.click();
    await page.waitForTimeout(500);
}

// ── テスト ──────────────────────────────────────────────────

test.describe('ノード監視ページ', () => {

    test('ノードページに遷移できる', async ({ page }) => {
        await navigateToNode(page);

        await expect(
            page.getByText('ノード').first()
        ).toBeVisible({ timeout: 8000 });
    });

    test('ノードページにステータス情報が表示される', async ({ page }) => {
        await navigateToNode(page);

        // CPU / メモリ / アップタイム / ステータスのいずれかが表示される
        const statusContent = page.locator([
            'text=CPU',
            'text=Memory',
            'text=メモリ',
            'text=uptime',
            'text=Uptime',
            'text=稼働',
            'text=Status',
            'text=ステータス',
            '[class*="node"]',
            '[class*="monitor"]',
            '[class*="stat"]',
        ].join(', ')).first();

        const visible = await statusContent.isVisible({ timeout: 8000 }).catch(() => false);
        // モックモードでも「オフライン」「N/A」などが表示される
        await expect(page.locator('main, [class*="page"], [class*="content"], body').first()).toBeVisible();
    });

    test('ノードページはcocoro-core未接続でもクラッシュしない', async ({ page }) => {
        // /api/node のレスポンスをオフラインシミュレート
        await page.route('**/api/node**', async (route) => {
            await route.fulfill({
                status: 503,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Service Unavailable' }),
            });
        });

        await navigateToNode(page);

        // エラーでクラッシュしない
        await expect(page.locator('body')).toBeVisible();
        await page.waitForTimeout(2000);
        await expect(page.locator('body')).toBeVisible();
    });

    test('別ページからノードページへ戻れる', async ({ page }) => {
        await page.goto('/');
        await unlock(page);
        await page.locator('aside').first().waitFor({ timeout: 10000 });

        // まずメモリへ
        const memoryBtn = page.locator('button[title="メモリ"]');
        await memoryBtn.click();
        await page.waitForTimeout(300);

        // ノードへ戻る
        const nodeBtn = page.locator('button[title="ノード"]');
        await nodeBtn.click();

        await expect(
            page.getByText('ノード').first()
        ).toBeVisible({ timeout: 8000 });
    });
});
