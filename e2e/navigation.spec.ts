/**
 * E2E: navigation.spec.ts
 * サイドバー経由のナビゲーションテスト
 */
import { test, expect } from '@playwright/test';

async function unlock(page: import('@playwright/test').Page) {
    const unlockBtn = page.locator('button', { hasText: '続ける' });
    if (await unlockBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await unlockBtn.click();
        await page.waitForTimeout(500);
    }
}

test.describe('ナビゲーション', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await unlock(page);
        // サイドバー（aside）が表示されるまで待機
        await page.locator('aside').first().waitFor({ timeout: 10000 });
    });

    test('チャット画面が初期表示される', async ({ page }) => {
        // チャット入力欄が存在する
        const chatInput = page.locator('textarea, input[type="text"]').first();
        await expect(chatInput).toBeVisible();
    });

    test('Memory ページに遷移できる', async ({ page }) => {
        // title="メモリ" のボタン（Sidebar の bottomNav）
        const memoryBtn = page.locator('button[title="メモリ"]');
        await expect(memoryBtn).toBeVisible({ timeout: 5000 });
        await memoryBtn.click();

        // MemoryPage 固有コンテンツが表示される
        await expect(page.getByText('メモリ').first()).toBeVisible({ timeout: 5000 });
    });

    test('Agents ページに遷移できる', async ({ page }) => {
        const agentsBtn = page.locator('button[title="エージェント"]');
        await expect(agentsBtn).toBeVisible({ timeout: 5000 });
        await agentsBtn.click();

        await expect(page.getByText('エージェント').first()).toBeVisible({ timeout: 5000 });
    });

    test('Node ページに遷移できる', async ({ page }) => {
        const nodeBtn = page.locator('button[title="ノード"]');
        await expect(nodeBtn).toBeVisible({ timeout: 5000 });
        await nodeBtn.click();

        await expect(page.getByText('ノード').first()).toBeVisible({ timeout: 5000 });
    });

    test('Security ページに遷移できる', async ({ page }) => {
        const securityBtn = page.locator('button[title="セキュリティ"]');
        await expect(securityBtn).toBeVisible({ timeout: 5000 });
        await securityBtn.click();

        await expect(page.getByText('セキュリティ').first()).toBeVisible({ timeout: 5000 });
    });

    test('Settings ページに遷移できる', async ({ page }) => {
        const settingsBtn = page.locator('button[title="設定"]');
        await expect(settingsBtn).toBeVisible({ timeout: 5000 });
        await settingsBtn.click();

        await expect(page.getByText('設定').first()).toBeVisible({ timeout: 5000 });
    });
});
