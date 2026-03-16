/**
 * Next.js Middleware
 *
 * 【役割】
 * 1. CORS: console.cocoro-os.com / localhost のみ許可
 *    - それ以外の Origin は 403 を返す
 *    - OPTIONS プリフライトに適切なヘッダを返す
 *
 * 2. Cookie サニタイズ:
 *    - 外部オリジン（HTTPS）からのアクセス時は
 *      cocoro_device_token を SameSite=None; Secure で再設定する
 *    - LAN からの HTTP アクセスは SameSite=Lax のまま
 *
 * 【Cloudflare Tunnel 構成】
 *   Browser → https://console.cocoro-os.com → Tunnel → nginx:80 → Next.js:3000
 *   Next.js はリバースプロキシ背後にあるため X-Forwarded-Proto で HTTPS を判別する
 */

import { NextRequest, NextResponse } from 'next/server';

// ─── 許可オリジン一覧 ────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
    'https://console.cocoro-os.com',
    'http://localhost:3000',
    'http://localhost',
    // LAN アクセス用（開発・miniPC 直接アクセス）
    // 必要に応じて環境変数から追加する
    ...(process.env.EXTRA_ALLOWED_ORIGINS
        ? process.env.EXTRA_ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : []),
]);

// ─── API ルートのみに適用 ─────────────────────────────────────────
export const config = {
    matcher: ['/api/:path*'],
};

export function middleware(request: NextRequest) {
    const origin = request.headers.get('origin') ?? '';
    const isAllowedOrigin = !origin || ALLOWED_ORIGINS.has(origin);

    // ── OPTIONS プリフライト ──────────────────────────────────────
    if (request.method === 'OPTIONS') {
        if (!isAllowedOrigin) {
            return new NextResponse(null, { status: 403 });
        }
        return new NextResponse(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin':      origin,
                'Access-Control-Allow-Methods':     'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers':     'Content-Type, Authorization, X-CSRF-Token',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age':           '86400',
                'Vary':                             'Origin',
            },
        });
    }

    // ── Origin 検証（ブラウザ → API の直接呼び出しのみ対象）──────
    // Origin ヘッダがない = サーバー間通信 or 同一オリジン = 許可
    if (origin && !isAllowedOrigin) {
        return new NextResponse(
            JSON.stringify({ success: false, error: 'ORIGIN_FORBIDDEN' }),
            {
                status: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Vary': 'Origin',
                },
            }
        );
    }

    // ── レスポンスに CORS ヘッダを付与 ───────────────────────────
    const response = NextResponse.next();

    if (origin && isAllowedOrigin) {
        response.headers.set('Access-Control-Allow-Origin',      origin);
        response.headers.set('Access-Control-Allow-Credentials', 'true');
        response.headers.set('Vary',                             'Origin');
    }

    // ── 外部 HTTPS アクセス時: Cookie を SameSite=None; Secure に昇格 ──
    // Cloudflare Tunnel → nginx → Next.js の場合
    // X-Forwarded-Proto: https がセットされる
    const proto = request.headers.get('x-forwarded-proto') ?? 'http';
    const isHttps = proto === 'https' || origin.startsWith('https://');

    if (isHttps) {
        const token = request.cookies.get('cocoro_device_token')?.value;
        if (token) {
            // SameSite=None; Secure でクロスサイト Cookie を送信可能にする
            response.cookies.set('cocoro_device_token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none',
                path: '/',
                maxAge: 60 * 60 * 24 * 30, // 30日
            });
        }
    }

    return response;
}
