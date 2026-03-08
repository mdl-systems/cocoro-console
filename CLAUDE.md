# CLAUDE.md — cocoro-console

> このrepoはCocoro OSのローカル管理UIです。
> プロジェクト全体の概要は cocoro-docs/CLAUDE.md を参照してください。

---

## このrepoの役割

**Personal AI Node — Local Management Interface**
miniPC上の cocoro-core をLAN内から操作するローカル管理UIです。
ChatGPTライクなUIで、ローカルファーストのプライバシー重視AIを操作できます。

- **対象**: miniPC所有者（LAN内専用・外部通信なし）
- **接続先**: `cocoro-core` (FastAPI:8001) via SSE/HTTP/JWT
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

---

## 環境変数

設定ファイル: `.env.local`（`.env.local.example` からコピー）

```bash
COCORO_CORE_URL=http://192.168.50.92:8001   # cocoro-coreのURL（LAN内IP）
COCORO_CORE_API_KEY=<your-api-key>           # cocoro-coreのAPIキー（必須・本番）
COCORO_CORE_ENABLED=false                    # false=モックモード（オフライン開発用）
COCORO_ENCRYPT_CHAT=false                    # true=チャット履歴をAES-256-GCMで暗号化
COCORO_PIN=                                  # 4桁PINロック（例: 1234、空欄=PIN無効）
```

> `COCORO_CORE_ENABLED=false` の場合、高品質なモックSSEレスポンスが返ります。
> 開発・デモ時はこのままでOK。

---

## よく使うコマンド

```bash
# セットアップ
npm install
cp .env.local.example .env.local   # 環境変数設定

# 開発サーバー起動
npm run dev
# → http://localhost:3000

# ビルド確認
npm run build

# Dockerで起動
docker compose up -d

# cocoro-core に実接続する場合
# .env.local の COCORO_CORE_ENABLED=true に変更して再起動
```

> ⚠️ cocoro-website もポート3000を使用。同時起動時はどちらかのポートを変更すること。

---

## cocoro-core との接続フロー

```
チャット入力
  → POST /api/chat/stream (SSE)
  → cocoro-core /auth/token (JWT取得・1時間キャッシュ)
  → cocoro-core /chat (AI応答生成)
  → SSE word-by-word streaming → ブラウザ表示
```

### 対応エンドポイント

| Console画面 | cocoro-core エンドポイント |
|------------|--------------------------|
| チャット | `POST /chat` |
| エージェント | `GET /org/agents` |
| メモリ | `GET /memory/stats` |
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
│   │   │   ├── node/route.ts         # ノード情報
│   │   │   ├── agent/route.ts        # エージェント制御
│   │   │   ├── memory/route.ts       # メモリ管理
│   │   │   ├── logs/route.ts         # セキュリティログ
│   │   │   └── identity/route.ts     # デバイスID
│   │   ├── globals.css               # クリームテーマ CSS変数
│   │   └── page.tsx                  # メインエントリ・ルーティング
│   ├── components/
│   │   ├── ChatPage.tsx              # チャットUI (SSEストリーミング)
│   │   ├── Sidebar.tsx               # アイコンバー + 会話履歴パネル
│   │   ├── LockScreen.tsx            # PINロックスクリーン
│   │   ├── AgentsPage.tsx            # エージェント管理
│   │   ├── NodePage.tsx              # ノード監視
│   │   ├── MemoryPage.tsx            # メモリブラウザ
│   │   ├── SecurityPage.tsx          # セキュリティログ
│   │   └── SettingsPage.tsx          # 設定
│   ├── core/
│   │   ├── sessions.ts               # セッション管理 (SQLite)
│   │   ├── crypto.ts                 # AES-256-GCM 暗号化
│   │   ├── identity.ts               # Ed25519 デバイス認証
│   │   ├── security.ts               # レート制限・セキュリティログ
│   │   └── validators.ts             # Zod バリデーション
│   ├── db/index.ts                   # SQLite スキーマ・接続管理
│   ├── middleware.ts                  # Next.js ミドルウェア登録
│   ├── security-middleware.ts        # CSRF・オリジン検証・セキュリティヘッダー
│   └── lib/
│       ├── cocoro-core.ts            # cocoro-core HTTP クライアント (JWT)
│       ├── api-client.ts             # フロントエンド API クライアント (CSRF)
│       ├── chat-crypto.ts            # チャット暗号化レイヤー (AES-256-GCM)
│       └── hooks.ts                  # React カスタムフック
├── Dockerfile                         # マルチステージビルド
├── docker-compose.yml                 # Docker Compose設定
├── .env.local                         # 環境変数（git除外）
└── .cocoro/cocoro.db                  # SQLite DB（自動生成）
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

## 残タスク（P3）

- [x] PIN / パスコード認証（4桁テンキー付きロック画面）
- [x] チャット履歴暗号化（AES-256-GCM、COCORO_ENCRYPT_CHAT=true で有効化）
- [x] Dockerコンテナ化（Dockerfile + docker-compose.yml）
- [ ] エージェントUI強化（リアルタイムログ・作成・編集）
- [ ] E2Eテスト (Playwright)
- [ ] ユニットテスト (Vitest)
- [ ] CI/CDパイプライン（GitHub Actions）

---

## 更新履歴

| 日付 | 更新内容 |
|------|---------|
| 2026-03-08 | 初版作成 |
| 2026-03-08 | P3実装: PIN認証・チャット暗号化・Docker対応 |
