import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        // happy-dom は node API も動作するため全テストに適用可
        // api-client.test.ts が document.cookie を使うためここで指定
        environment: 'happy-dom',
        globals: true,
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/core/**', 'src/lib/**'],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
