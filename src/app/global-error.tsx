'use client';

import { useEffect } from 'react';

/**
 * global-error.tsx — ルートレイアウトレベルのエラーバウンダリ
 * layout.tsx 自身がクラッシュした場合もここでキャッチされる。
 * html/body を自分でレンダリングする必要がある。
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[Cocoro OS] GlobalError caught:', error.message);
        console.error('[Cocoro OS] Stack:', error.stack);
        if (error.digest) console.error('[Cocoro OS] Digest:', error.digest);
    }, [error]);

    return (
        <html lang="ja">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>エラー — Cocoro OS</title>
                <style>{`
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body {
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #0a0a0a;
                        font-family: system-ui, -apple-system, sans-serif;
                        color: #fff;
                    }
                    .container { text-align: center; padding: 2rem; max-width: 500px; width: 100%; }
                    .logo { font-size: 2.5rem; margin-bottom: 1.5rem; }
                    h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
                    p { color: rgba(255,255,255,0.5); font-size: 0.875rem; margin-bottom: 1rem; }
                    .error-box {
                        background: rgba(248,113,113,0.08);
                        border: 1px solid rgba(248,113,113,0.2);
                        border-radius: 0.5rem;
                        padding: 0.75rem 1rem;
                        margin: 0.75rem 0;
                        color: rgba(248,113,113,0.85);
                        font-family: monospace;
                        font-size: 0.75rem;
                        text-align: left;
                        word-break: break-word;
                        white-space: pre-wrap;
                    }
                    .digest {
                        font-size: 0.65rem;
                        color: rgba(255,255,255,0.2);
                        margin-bottom: 1.5rem;
                        font-family: monospace;
                    }
                    button {
                        padding: 0.625rem 1.5rem;
                        background: rgba(216,120,152,0.15);
                        border: 1px solid rgba(216,120,152,0.4);
                        border-radius: 0.5rem;
                        color: #d87898;
                        font-size: 0.875rem;
                        cursor: pointer;
                        font-weight: 500;
                        transition: opacity 0.15s;
                    }
                    button:hover { opacity: 0.8; }
                `}</style>
            </head>
            <body>
                <div className="container">
                    <div className="logo">◉</div>
                    <h1>アプリケーションエラー</h1>
                    <p>Cocoro OS で予期せぬエラーが発生しました。</p>
                    {error.message && (
                        <div className="error-box">{error.message}</div>
                    )}
                    {error.digest && (
                        <p className="digest">Digest: {error.digest}</p>
                    )}
                    <button onClick={reset}>再試行する</button>
                </div>
            </body>
        </html>
    );
}
