# CLAUDE.md — cocoro-console

> このrepoはCocoro OSのローカル管理UIです。
> プロジェクト全体の概要は cocoro-docs/CLAUDE.md を参照してください。

---

## このrepoの役割

**Personal AI Node — Local Management Interface**
miniPC上の cocoro-core をLAN内から操作するローカル管理UIです。
ChatGPTライクなUIで、ローカルファーストのプライバシー重視AIを操作できます。

- **対象**: miniPC所有者（LAN内専用・外部通信なし）
- **接続先**: `cocoro-core` (FastAPI:8001) via SSE / HTTP / Bearer API Key
- **ライセンス**: Private — Cocoro Project

---

## テックスタック

| レイヤー | 技術 |
|---------|------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Style | Vanilla CSS（クリームテーマ）|
| Animation | Framer Motion |
| Markdown | react-markdown + remark-gfm + react-syntax-highlighter |
| Database | SQLite (better-sqlite3) |
| Security | AES-256-GCM / Scrypt / Ed25519 / CSRF / Rate Limiting |
| Test | Vitest（27 tests passing） |
| CI | GitHub Actions（push 毎に自動実行） |

---

## 環境変数

設定ファイル: `.env.local`（`.env.local.example` からコピー）

```bash
COCORO_CORE_URL=http://192.168.50.92:8001   # cocoro-coreのURL（LAN内IP）
COCORO_CORE_API_KEY=<your-api-key>           # cocoro-coreのAPIキー（必須・本番）
COCORO_CORE_ENABLED=true                     # false=モックモード（オフライン開発用）
COCORO_ENCRYPT_CHAT=false                    # true=チャット履歴をAES-256-GCMで暗号化
COCORO_PIN=                                  # 4桁PINロック（例: 1234、空欄=PIN無効）
```

> `COCORO_CORE_ENABLED=false` の場合、高品質なモックSSEレスポンスが返ります。
> 開発・デモ時はこのままでOK。

### 認証方式について

**JWT ではなく Bearer API Key 直接認証を使用しています。**

```
Authorization: Bearer <COCORO_CORE_API_KEY>
```

cocoro-core は `/auth/token` エンドポイントを持たず、API キーを直接 Bearer トークンとして受け付けます。

---

## よく使うコマンド

```bash
# セットアップ
npm install
cp .env.local.example .env.local   # 環境変数設定

# 開発サーバー起動
npm run dev
# → http://localhost:3000

# テスト実行
npm test             # 一回実行（CI相当）
npm run test:watch   # ウォッチモード（開発中）

# ビルド確認
npm run build

# Dockerで起動
docker compose up -d
```

> ⚠️ cocoro-website もポート3000を使用。同時起動時はどちらかのポートを変更すること。

---

## cocoro-core との接続フロー

```
チャット入力
  → POST /api/chat/stream (SSE)
  → cocoro-core /chat (Bearer API Key 認証)
  → Gemini で AI応答生成
  → SSE word-by-word streaming → ブラウザ表示
```

### 対応エンドポイント

| Console画面 | cocoro-core エンドポイント |
|------------|--------------------------|
| チャット | `POST /chat` |
| エージェント | `GET /org/agents` |
| メモリ一覧 | `GET /memory/list` |
| **メモリ検索** | `POST /memory/search` ← 新規追加 |
| 記憶統計 | `GET /memory/stats` |
| 感情状態 | `GET /emotion/state` |
| ノード監視 | `GET /monitor/dashboard` |

---

## ディレクトリ構成

```
cocoro-console/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/
│   │   │   │   ├── route.ts          # チャット CRUD
│   │   │   │   └── stream/route.ts   # SSE ストリーミング ★ cocoro-core接続点
│   │   │   ├── session/route.ts      # セッション管理
│   │   │   ├── profile/route.ts      # プロフィール
│   │   │   ├── node/
│   │   │   │   ├── route.ts          # ノード情報
│   │   │   │   └── emotion/route.ts  # 感情状態（リアルタイム）
│   │   │   ├── agent/route.ts        # エージェント制御（ローカル）
│   │   │   ├── agent-proxy/route.ts  # cocoro-agent プロキシ
│   │   │   ├── memory/
│   │   │   │   ├── route.ts          # メモリ CRUD
│   │   │   │   └── search/route.ts   # ベクトル検索 ← 新規追加
│   │   │   ├── logs/route.ts         # セキュリティログ
│   │   │   └── identity/route.ts     # デバイスID
│   │   ├── globals.css               # クリームテーマ CSS変数
│   │   └── page.tsx                  # メインエントリ・ルーティング
│   ├── components/
│   │   ├── ChatPage.tsx              # チャットUI (SSEストリーミング・Claudeスタイル)
│   │   ├── Sidebar.tsx               # アイコンバー + 会話履歴パネル
│   │   ├── LockScreen.tsx            # PINロックスクリーン
│   │   ├── AgentsPage.tsx            # エージェント管理
│   │   ├── NodePage.tsx              # ノード監視（感情・シンクロ率ゲージ）
│   │   ├── MemoryPage.tsx            # メモリブラウザ（検索バー付き）← 強化
│   │   ├── SecurityPage.tsx          # セキュリティログ
│   │   └── SettingsPage.tsx          # 設定
│   ├── core/
│   │   ├── sessions.ts               # セッション管理 (SQLite)
│   │   ├── sessions.test.ts          # ユニットテスト（14件）
│   │   ├── crypto.ts                 # AES-256-GCM 暗号化
│   │   ├── crypto.test.ts            # ユニットテスト（6件）
│   │   ├── identity.ts               # Ed25519 デバイス認証
│   │   ├── security.ts               # レート制限・セキュリティログ
│   │   └── validators.ts             # Zod バリデーション
│   ├── db/index.ts                   # SQLite スキーマ・接続管理
│   ├── middleware.ts                  # Next.js ミドルウェア登録
│   ├── security-middleware.ts        # CSRF・オリジン検証・セキュリティヘッダー
│   └── lib/
│       ├── cocoro-core.ts            # cocoro-core HTTP クライアント（Bearer Auth）
│       ├── api-client.ts             # フロントエンド API クライアント (CSRF)
│       ├── chat-crypto.ts            # チャット暗号化レイヤー (AES-256-GCM)
│       ├── chat-crypto.test.ts       # ユニットテスト（7件）
│       └── hooks.ts                  # React カスタムフック
├── .github/
│   └── workflows/ci.yml             # GitHub Actions CI（push 毎に自動実行）
├── vitest.config.ts                  # Vitest 設定
├── Dockerfile                        # マルチステージビルド
├── docker-compose.yml                # Docker Compose設定
├── .env.local                        # 環境変数（git除外）
└── .cocoro/cocoro.db                 # SQLite DB（自動生成）
```

---

## セキュリティ実装

| カテゴリ | 実装 |
|---------|------|
| 認証 | デバイスセッション (64bit secure token) + PINロック |
| 暗号化 | AES-256-GCM（チャット履歴・保存データ） |
| 鍵導出 | Scrypt（パスワードハッシュ） |
| デバイスID | Ed25519 署名鍵ペア |
| CSRF対策 | Double Submit Cookie パターン |
| レート制限 | IP + エンドポイント単位 (SQLite) |
| 入力検証 | Zod スキーマバリデーション |
| セキュリティヘッダー | CSP / X-Frame-Options / XCTO など |

---

## テスト

```bash
npm test             # vitest run（27件 全パス）
npm run test:watch   # ウォッチモード
```

| ファイル | テスト数 | カバー内容 |
|---------|---------|-----------|
| `core/crypto.test.ts` | 6件 | AES-256-GCM 暗号化・復号・エラー |
| `lib/chat-crypto.test.ts` | 7件 | enc:: フォーマット・透過復号 |
| `core/sessions.test.ts` | 14件 | 作成・検証・ロック・削除・CSRF |

---

## SQLite テーブル構成

```
.cocoro/cocoro.db
├── sessions          # アクティブセッション
├── conversations     # 会話一覧
├── chat_history      # メッセージ履歴（暗号化対応）
├── memory_entries    # メモリエントリ
├── security_logs     # セキュリティ監査ログ
└── user_settings     # ユーザー設定
```

---

## 実装完了タスク

- [x] Claude スタイルチャット UI（左右バブル）
- [x] SSE ストリーミングチャット
- [x] cocoro-core 実接続（Bearer API Key 認証・Gemini 確認済）
- [x] PIN / パスコード認証（4桁テンキー付きロック画面）
- [x] チャット履歴暗号化（AES-256-GCM）
- [x] Docker コンテナ化（Dockerfile + docker-compose.yml）
- [x] Memory ブラウザ（cocoro-core 接続 + 検索バー）
- [x] Node ダッシュボード（感情・シンクロ率リアルタイム）
- [x] ユニットテスト 27件（Vitest）
- [x] GitHub Actions CI（push 毎に自動実行）

## 残タスク

- [ ] エージェント UI 実接続（/org/agents リスト・ON/OFF）
- [ ] E2E テスト（Playwright）

---

## 更新履歴

| 日付 | 更新内容 |
|------|---------|
| 2026-03-08 | 初版作成 |
| 2026-03-08 | P3実装: PIN認証・チャット暗号化・Docker対応 |
| 2026-03-09 | cocoro-core 実接続（Bearer APIキー認証・Gemini動作確認） |
| 2026-03-09 | Memory 検索バー（ベクトル検索 + SQLiteフォールバック） |
| 2026-03-09 | ユニットテスト 27件（Vitest：crypto / chat-crypto / sessions）|
| 2026-03-09 | GitHub Actions CI（push 毎にテスト自動実行）|
