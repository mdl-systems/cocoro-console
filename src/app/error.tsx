'use client';

import { useEffect } from 'react';

/**
 * error.tsx — ページレベルのエラーバウンダリ
 * layout.tsx は生きているので html/body は不要。
 */
export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[Cocoro OS] Page error:', error.message);
        console.error('[Cocoro OS] Stack:', error.stack);
        if (error.digest) console.error('[Cocoro OS] Digest:', error.digest);
    }, [error]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--background, #0a0a0a)',
            fontFamily: 'system-ui, sans-serif',
        }}>
            <div style={{ textAlign: 'center', padding: '2rem', maxWidth: 500 }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>◉</div>
                <h2 style={{ color: 'var(--foreground, #fff)', fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
                    エラーが発生しました
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
                    予期せぬエラーが発生しました。
                </p>
                {error.message && (
                    <pre style={{
                        color: 'rgba(248,113,113,0.85)',
                        fontSize: '0.75rem',
                        margin: '0.75rem 0',
                        padding: '0.75rem 1rem',
                        background: 'rgba(248,113,113,0.08)',
                        borderRadius: '0.5rem',
                        border: '1px solid rgba(248,113,113,0.2)',
                        textAlign: 'left',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'monospace',
                    }}>
                        {error.message}
                    </pre>
                )}
                {error.digest && (
                    <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', marginBottom: '1.5rem', fontFamily: 'monospace' }}>
                        Digest: {error.digest}
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
        </div>
    );
}
