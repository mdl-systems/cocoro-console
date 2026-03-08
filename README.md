# cocoro-console

> **Personal AI Node — Local Management Interface**
> miniPC上の `cocoro-core` をLAN内から操作するローカル管理UIです。

[![CI](https://github.com/mdl-systems/cocoro-console/actions/workflows/ci.yml/badge.svg)](https://github.com/mdl-systems/cocoro-console/actions/workflows/ci.yml)

---

## 概要

ChatGPT ライクな UI で、ローカルファーストのプライバシー重視 AI を操作できます。  
`cocoro-core`（FastAPI:8001）と実接続し、SSE ストリーミングチャット・メモリ管理・感情/シンクロ率ダッシュボードを提供します。

- **対象**: miniPC 所有者（LAN 内専用・外部通信なし）
- **接続先**: `cocoro-core` (FastAPI:8001) via Bearer API Key / SSE
- **ライセンス**: Private — Cocoro Project

---

## テックスタック

| レイヤー | 技術 |
|---------|------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Style | Vanilla CSS（クリームテーマ）|
| Animation | Framer Motion |
| Markdown | react-markdown + remark-gfm |
| Database | SQLite (better-sqlite3) |
| Security | AES-256-GCM / Scrypt / Ed25519 / CSRF / Rate Limiting |
| Test | Vitest（27 tests）|
| CI | GitHub Actions |

---

## セットアップ

```bash
# 依存関係インストール
npm install

# 環境変数設定
cp .env.local.example .env.local
# → .env.local を編集（下記「環境変数」参照）

# 開発サーバー起動
npm run dev
# → http://localhost:3000

# Docker で起動
docker compose up -d
```

---

## 環境変数

`.env.local` に以下を設定してください:

```bash
# cocoro-core 接続設定
COCORO_CORE_URL=http://192.168.50.92:8001   # cocoro-core の URL（LAN 内 IP）
COCORO_CORE_API_KEY=<your-api-key>           # cocoro-core の API キー
COCORO_CORE_ENABLED=true                     # false = モックモード（オフライン開発）

# オプション
COCORO_ENCRYPT_CHAT=false                    # true = チャット履歴を AES-256-GCM で暗号化
COCORO_PIN=                                  # 4 桁 PIN ロック（例: 1234、空欄で無効）
```

> `COCORO_CORE_ENABLED=false` の場合、高品質なモック SSE レスポンスが返ります。  
> オフライン開発・デモ時はこのままで OK。

---

## よく使うコマンド

```bash
npm run dev          # 開発サーバー起動
npm run build        # プロダクションビルド
npm test             # ユニットテスト実行（27件）
npm run test:watch   # ウォッチモード
docker compose up -d # Docker で起動
```

---

## スクリーン構成

| 画面 | 機能 |
|------|------|
| **チャット** | SSE ストリーミング・Claude スタイルバブル・会話履歴 |
| **メモリ** | 短期/長期/ベクトル記憶の一覧・検索・追加・削除 |
| **ノード** | 感情状態・シンクロ率・システムリソースのリアルタイム表示 |
| **エージェント** | cocoro-agent サービスのリスト・タスク管理 |
| **セキュリティ** | 監査ログ閲覧 |
| **設定** | プロフィール・PIN・暗号化設定 |

---

## セキュリティ実装

| カテゴリ | 実装 |
|---------|------|
| 認証 | デバイスセッション（64bit secure token）+ PIN ロック |
| 暗号化 | AES-256-GCM（チャット履歴・保存データ） |
| 鍵導出 | Scrypt |
| デバイス ID | Ed25519 署名鍵ペア |
| CSRF 対策 | Double Submit Cookie パターン |
| レート制限 | IP + エンドポイント単位（SQLite） |
| 入力検証 | Zod スキーマバリデーション |
| セキュリティヘッダー | CSP / X-Frame-Options / XCTO など |

---

## cocoro-core 接続フロー

```
チャット入力
  → POST /api/chat/stream (SSE)
  → cocoro-core /chat (Bearer API Key 認証)
  → AI 応答生成 (Gemini)
  → SSE word-by-word streaming → ブラウザ表示
```

### 対応エンドポイント

| Console 画面 | cocoro-core エンドポイント |
|-------------|--------------------------|
| チャット | `POST /chat` |
| エージェント | `GET /org/agents` |
| メモリ一覧 | `GET /memory/list` |
| メモリ検索 | `POST /memory/search` |
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
│   │   │   ├── chat/stream/route.ts    # SSE ストリーミング ★ cocoro-core 接続点
│   │   │   ├── memory/route.ts         # メモリ CRUD
│   │   │   ├── memory/search/route.ts  # メモリ検索（ベクトル / LIKE）
│   │   │   ├── node/emotion/route.ts   # 感情状態取得
│   │   │   ├── agent-proxy/route.ts    # cocoro-agent プロキシ
│   │   │   └── ...
│   │   └── page.tsx                    # メインエントリ・ルーティング
│   ├── components/
│   │   ├── ChatPage.tsx                # チャット UI
│   │   ├── MemoryPage.tsx              # メモリブラウザ（検索対応）
│   │   ├── NodePage.tsx                # ノード監視（感情・シンクロ率）
│   │   └── ...
│   ├── core/
│   │   ├── crypto.ts                   # AES-256-GCM 暗号化
│   │   ├── sessions.ts                 # セッション管理
│   │   ├── identity.ts                 # Ed25519 デバイス認証
│   │   └── ...
│   └── lib/
│       ├── cocoro-core.ts              # cocoro-core HTTP クライアント（Bearer Auth）
│       ├── chat-crypto.ts              # チャット暗号化レイヤー
│       └── ...
├── .github/workflows/ci.yml            # GitHub Actions CI
├── Dockerfile
├── docker-compose.yml
└── .env.local                          # 環境変数（git 除外）
```

---

## 更新履歴

| 日付 | 更新内容 |
|------|---------|
| 2026-03-08 | 初版作成 |
| 2026-03-08 | P3実装: PIN認証・チャット暗号化・Docker対応 |
| 2026-03-09 | cocoro-core 実接続（Bearer APIキー認証・Gemini確認） |
| 2026-03-09 | Memory 検索バー（ベクトル検索 + SQLite フォールバック） |
| 2026-03-09 | ユニットテスト 27件（Vitest：crypto / chat-crypto / sessions） |
| 2026-03-09 | GitHub Actions CI（push 毎に自動テスト）|
