# CLAUDE.md — cocoro-console

> このrepoはCocoro OSのローカル管理UIです。
> プロジェクト全体の概要は cocoro-docs/CLAUDE.md を参照してください。

---

## このrepoの役割

**Personal AI Node — Local Management Interface**
miniPC上の cocoro-core / cocoro-agent をLAN内から操作するローカル管理UIです。
ChatGPTライクなUIで、ローカルファーストのプライバシー重視AIを操作できます。

- **対象**: miniPC所有者（LAN内専用・外部通信なし）
- **接続先**: `cocoro-core` (FastAPI:8001) / `cocoro-agent` (FastAPI:8002)
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
COCORO_AGENT_URL=http://192.168.50.92:8002  # cocoro-agentのURL（追加: 自動タスク用）
COCORO_CORE_API_KEY=<your-api-key>           # 共通APIキー（必須・本番）
COCORO_CORE_ENABLED=false                    # false=モックモード（オフライン開発用）
COCORO_ENCRYPT_CHAT=false                    # true=チャット履歴をAES-256-GCMで暗号化
COCORO_PIN=                                  # 4桁PINロック（例: 1234、空欄=PIN無効）
```

> `COCORO_CORE_ENABLED=false` の場合、高品質なモックSSEレスポンスが返ります。
> `cocoro-agent` 未起動時も、フォールバックとしてモックデータでエージェント画面が見れます。

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

# cocoro-core/agent に実接続する場合
# .env.local の COCORO_CORE_ENABLED=true に変更して再起動
```

> ⚠️ cocoro-website もポート3000を使用。同時起動時はどちらかのポートを変更すること。

---

## cocoro-core / agent との接続フロー

### チャット (cocoro-core: 8001)
```
チャット入力
  → POST /api/chat/stream (SSE)
  → cocoro-core /chat (AI応答生成)
  → SSE word-by-word streaming → ブラウザ表示
```

### エージェント管理 (cocoro-agent: 8002)
```
エージェント画面表示
  → GET /api/agent-proxy
  → cocoro-agent /agents, /org/status, /stats
タスク投入
  → POST /api/agent-proxy?path=/tasks
  → cocoro-agent /tasks → 非同期実行
```

### 対応エンドポイント

| Console画面 | 接続先エンドポイント |
|------------|--------------------------|
| チャット | `POST cocoro-core:/chat` |
| エージェント | `GET/POST cocoro-agent:/agents` `/tasks` `/stats` `/org/status` |
| メモリ | `GET cocoro-core:/memory/stats` |
| 感情状態 | `GET cocoro-core:/emotion/state` |
| ノード監視 | `GET cocoro-core:/monitor/dashboard` |

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
│   │   │   ├── agent-proxy/route.ts  # cocoro-agent API HTTPプロキシ ★ NEW
│   │   │   ├── session/route.ts      # セッション管理
│   │   │   ├── profile/route.ts      # プロフィール
│   │   │   ├── node/route.ts         # ノード情報
│   │   │   ├── agent/route.ts        # （旧）エージェント制御
│   │   │   ├── memory/route.ts       # メモリ管理
│   │   │   └── logs/route.ts         # セキュリティログ
│   │   ├── globals.css               # クリームテーマ CSS変数
│   │   └── page.tsx                  # メインエントリ・ルーティング
│   ├── components/
│   │   ├── ChatPage.tsx              # チャットUI
│   │   ├── Sidebar.tsx               # アイコンバー
│   │   ├── LockScreen.tsx            # PINロック
│   │   ├── AgentsPage.tsx            # エージェント管理（cocoro-agent実データ+タスク投入）★ NEW
│   │   ├── NodePage.tsx              # ノード監視
│   │   └── MemoryPage.tsx            # メモリブラウザ
│   ├── core/
│   │   ├── sessions.ts               # セッション管理 (SQLite)
│   │   ├── crypto.ts                 # 暗号化
│   │   └── security.ts               # レート制限
│   ├── db/index.ts                   # SQLite 管理
│   └── lib/
│       ├── cocoro-core.ts            # cocoro-core HTTP クライアント
│       └── api-client.ts             # フロントエンド API クライアント
├── Dockerfile
├── docker-compose.yml
├── .env.local
└── .cocoro/cocoro.db
```

---

## セキュリティ実装

| カテゴリ | 実装 |
|---------|------|
| 認証 | デバイスセッション + PINロック |
| 暗号化 | AES-256-GCM（チャット履歴・保存データ） |
| 鍵導出 | Scrypt（パスワードハッシュ） |
| CSRF対策 | Double Submit Cookie パターン |
| レート制限 | IP + エンドポイント単位 (SQLite) |

---

## 残タスク（P3）

- [x] PIN / パスコード認証（4桁テンキー付きロック画面）
- [x] チャット履歴暗号化（AES-256-GCM、COCORO_ENCRYPT_CHAT=true で有効化）
- [x] Dockerコンテナ化（Dockerfile + docker-compose.yml）
- [x] cocoro-agent 連動・タスク投入画面の実装
- [ ] E2Eテスト (Playwright)
- [ ] ユニットテスト (Vitest)
- [ ] CI/CDパイプライン（GitHub Actions）

---

## 更新履歴

| 日付 | 更新内容 |
|------|---------|
| 2026-03-08 | 初版・PIN認証・チャット暗号化・Docker対応 |
| 2026-03-09 | cocoro-agent 連携・AgentsPage全面刷新（タスク投入・統計表示） |
