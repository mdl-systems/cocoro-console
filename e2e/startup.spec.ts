/**
 * E2E: startup.spec.ts
 * アプリ起動・初期表示のテスト
 */
import { test, expect } from '@playwright/test';

async function unlock(page: import('@playwright/test').Page) {
    const unlockBtn = page.locator('button', { hasText: '続ける' });
    if (await unlockBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await unlockBtn.click();
        await page.waitForTimeout(500);
    }
}

test.describe('アプリ起動', () => {
    test('トップページが表示される', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('body')).toBeVisible();
    });

    test('チャット入力欄が存在する（ロックなし）', async ({ page }) => {
        await page.goto('/');
        await unlock(page);

        // ChatPage のテキストエリア
        const chatInput = page.locator('textarea, input[type="text"]').first();
        await expect(chatInput).toBeVisible({ timeout: 10000 });
    });

    test('サイドバー（aside）が表示される', async ({ page }) => {
        await page.goto('/');
        await unlock(page);

        // Sidebar は <aside> タグ
        await expect(page.locator('aside').first()).toBeVisible({ timeout: 10000 });
    });
});
