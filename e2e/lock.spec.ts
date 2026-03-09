/**
 * E2E: lock.spec.ts
 * ロック画面フローのテスト
 */
import { test, expect } from '@playwright/test';

test.describe('ロック画面', () => {
    test('ページロード時に画面が表示される', async ({ page }) => {
        await page.goto('/');
        // ページが何かを表示している
        await expect(page.locator('body')).toBeVisible();
    });

    test('ロック画面の「続ける」ボタンで unlock できる', async ({ page }) => {
        await page.goto('/');

        const unlockBtn = page.locator('button', { hasText: '続ける' });

        if (await unlockBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            // ロック画面が表示された場合
            await expect(unlockBtn).toBeVisible();
            await unlockBtn.click();

            // unlock 後にチャット UI が表示される
            await expect(
                page.locator('textarea, input[type="text"]').first()
            ).toBeVisible({ timeout: 10000 });
        } else {
            // PIN なし設定なのでロック画面がない → チャット UI が直接表示される
            await expect(
                page.locator('textarea, input[type="text"]').first()
            ).toBeVisible({ timeout: 10000 });
        }
    });

    test('unlock 後はロック画面が非表示になる', async ({ page }) => {
        await page.goto('/');

        const unlockBtn = page.locator('button', { hasText: '続ける' });
        if (await unlockBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await unlockBtn.click();
            // unlock ボタンが消える
            await expect(unlockBtn).not.toBeVisible({ timeout: 5000 });
        }

        // チャット UI が表示されている
        await expect(
            page.locator('textarea, input[type="text"]').first()
        ).toBeVisible({ timeout: 10000 });
    });
});
