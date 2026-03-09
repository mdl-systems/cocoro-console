/**
 * E2E: chat.spec.ts
 * チャット送受信フローのテスト（モックモード）
 */
import { test, expect } from '@playwright/test';

async function unlock(page: import('@playwright/test').Page) {
    const unlockBtn = page.locator('button', { hasText: '続ける' });
    if (await unlockBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await unlockBtn.click();
        await page.waitForTimeout(500);
    }
}

test.describe('チャット', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await unlock(page);
        // チャット入力欄が表示されるまで待つ
        await page.locator('textarea, input[type="text"]').first().waitFor({ timeout: 10000 });
    });

    test('チャット入力欄にテキストを入力できる', async ({ page }) => {
        const input = page.locator('textarea, input[type="text"]').first();
        await input.fill('Hello, Cocoro!');
        await expect(input).toHaveValue('Hello, Cocoro!');
    });

    test('メッセージを送信するとユーザーバブルが表示される', async ({ page }) => {
        const input = page.locator('textarea, input[type="text"]').first();
        await input.fill('テスト送信');

        // Enter または送信ボタンで送信
        const sendBtn = page.locator('button[type="submit"], button[aria-label*="send"], button[aria-label*="送信"]').first();
        if (await sendBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await sendBtn.click();
        } else {
            await input.press('Enter');
        }

        // 送信したメッセージがバブルとして表示される
        await expect(page.locator('text=テスト送信').first()).toBeVisible({ timeout: 10000 });
    });

    test('送信後に AI レスポンスバブルが表示される（モック）', async ({ page }) => {
        const input = page.locator('textarea, input[type="text"]').first();
        await input.fill('こんにちは');

        const sendBtn = page.locator('button[type="submit"], button[aria-label*="send"], button[aria-label*="送信"]').first();
        if (await sendBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await sendBtn.click();
        } else {
            await input.press('Enter');
        }

        // ChatPage のメッセージは flex div（justify-end=user, justify-start=assistant）
        // 送信後にモックレスポンスが来るまで最大 15 秒待つ
        // AI メッセージは prose-cocoro クラスを持つ div
        await expect(
            page.locator('div.prose-cocoro, [class*="justify-start"] > div').first()
        ).toBeVisible({ timeout: 15000 });
    });

    test('入力欄が送信後にクリアされる', async ({ page }) => {
        const input = page.locator('textarea, input[type="text"]').first();
        await input.fill('クリアテスト');

        const sendBtn = page.locator('button[type="submit"], button[aria-label*="send"], button[aria-label*="送信"]').first();
        if (await sendBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await sendBtn.click();
        } else {
            await input.press('Enter');
        }

        // 送信後に入力欄がクリアされる
        await expect(input).toHaveValue('', { timeout: 5000 });
    });
});
