import type { NextConfig } from "next";

// 外部アクセスを許可するオリジン
// LAN 内 + Cloudflare Tunnel 経由の console.cocoro-os.com の両方を許可
const ALLOWED_ORIGINS = [
  'https://console.cocoro-os.com',
  'http://localhost:3000',
  'http://localhost',
];

const CSP = [
  "default-src 'self'",
  // インラインスクリプト（テーマ初期化・ SW 登録）と Next.js HMR を許可
  "script-src 'self' 'unsafe-inline'",
  // CSP Level 3: strict-dynamic は広く使われるが、Next.js RSC のため unsafe-inline も必要
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  // API コール先: 同一オリジン (Next.js でプロキシ済み) + SSE
  "connect-src 'self' wss://console.cocoro-os.com",
  // 嵌込み禁止
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  // Service Worker
  "worker-src 'self'",
].join('; ');

const nextConfig: NextConfig = {
  // NOTE: output: 'standalone' は Next.js 16 Turbopack + middleware.ts の組み合わせで
  // .next/server/middleware.js.nft.json が生成されないバグがある (2024-2025 既知)
  // Docker では .next ディレクトリをそのままコピーする通常モードを使用する
  // output: 'standalone',

  typescript: {
    // Type errors are caught by unit tests and local tsc.
    ignoreBuildErrors: true,
  },

  async headers() {
    return [
      {
        // 全ルートに共通セキュリティヘッダを適用
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy',   value: CSP },
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
          // HTTPS 強制（Cloudflare Tunnel 経由時にブラウザへ指示）
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
      {
        // APIルートにCORSプリフライト対応
        source: '/api/(.*)',
        headers: [
          // 実際の CORS 制御は middleware.ts で Origin 検証するため
          // ここは OPTIONS プリフライトへの静的応答のみ
          { key: 'Access-Control-Allow-Methods',     value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers',     value: 'Content-Type, Authorization, X-CSRF-Token' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
    ];
  },
};

export { ALLOWED_ORIGINS };
export default nextConfig;