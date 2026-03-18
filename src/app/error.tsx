'use client';

import { useEffect } from 'react';
import CocoroLogo from '@/components/CocoroLogo';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // 本番環境でもコンソールにスタックトレースを出力
        console.error('[Cocoro OS] Client-side error:', error);
        console.error('[Cocoro OS] Stack:', error.stack);
        if (error.digest) console.error('[Cocoro OS] Digest:', error.digest);
    }, [error]);

    return (
        <html lang="ja">
            <body style={{
                margin: 0,
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0a0a0a',
                fontFamily: 'system-ui, sans-serif',
            }}>
                <div style={{ textAlign: 'center', padding: '2rem', maxWidth: 480 }}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <CocoroLogo size={48} />
                    </div>
                    <h1 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
                        アプリケーションエラー
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', margin: '0 0 0.25rem' }}>
                        予期せぬエラーが発生しました。
                    </p>
                    {error.message && (
                        <p style={{
                            color: 'rgba(248,113,113,0.8)',
                            fontSize: '0.75rem',
                            margin: '0.75rem 0',
                            padding: '0.75rem 1rem',
                            background: 'rgba(248,113,113,0.08)',
                            borderRadius: '0.5rem',
                            border: '1px solid rgba(248,113,113,0.2)',
                            textAlign: 'left',
                            wordBreak: 'break-word',
                            fontFamily: 'monospace',
                        }}>
                            {error.message}
                        </p>
                    )}
                    <button
                        onClick={reset}
                        style={{
                            marginTop: '1rem',
                            padding: '0.625rem 1.5rem',
                            background: 'rgba(216,120,152,0.15)',
                            border: '1px solid rgba(216,120,152,0.4)',
                            borderRadius: '0.5rem',
                            color: '#d87898',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            fontWeight: 500,
                        }}
                    >
                        再試行する
                    </button>
                </div>
            </body>
        </html>
    );
}
