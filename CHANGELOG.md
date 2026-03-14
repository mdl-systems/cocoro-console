# Changelog — cocoro-console

All notable changes to this project will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) / [Semantic Versioning](https://semver.org/)

---

## [1.0.0] — 2026-03-14

### 🎉 First stable release

#### Added
- **Boot Wizard** — 40-question personality interview (open / choice / scale / ranking / order types)
- **Chat UI** — SSE word-by-word streaming, 6 agent personas (MDL / 弁護士 / 税理士 / エンジニア / リサーチ / FP)
- **Emotion indicator** — real-time AI emotion displayed in chat header
- **Sync Rate Widget** — circular gauge + 30-day line chart (recharts)
- **Command Palette** — Cmd+K fuzzy navigation across all pages
- **Tasks Page** — Perplexity-style task management with voice input
- **Memory Viewer** — short-term / long-term / vector memory browser + search
- **Dashboard** — service health cards, conversation stats, security log stream
- **Node Monitoring** — CPU / RAM / network / services + real-time emotion panel
- **Multi-Node Manager** — register and ping remote Cocoro nodes
- **Agents Page** — cocoro-agent integration with task submission and statistics
- **Security Page** — governance log viewer, rate-limit status
- **Settings Page** — theme (light/dark/system), language, AI personality, notifications, privacy, data export
- **Lock Screen** — 4-digit PIN auth with numpad, session management (SQLite)
- **Dark Mode** — CSS variables with light/dark/system themes, localStorage persist
- **PWA** — `manifest.json`, Service Worker (offline fallback `/offline.html`), icons 192×192 + 512×512
- **Mobile** — hamburger drawer, sticky input bar, horizontal agent scroll, full-width bubbles
- **File Upload** — drag-and-drop + picker (PDF / TXT / MD / CSV / JSON)
- **Voice Input** — Web Speech API (ja-JP)
- **Markdown rendering** — react-markdown + remark-gfm + syntax highlight (react-syntax-highlighter)
- **Connection Error Banner** — user-friendly inline banner when cocoro-core is unreachable, with retry button
- **Skeleton UI** — shimmer loading states across Dashboard, Node, and Memory pages
- **AES-256-GCM encryption** — chat history encrypted at-rest (opt-in via `COCORO_ENCRYPT_CHAT=true`)
- **CSRF protection** — Double Submit Cookie pattern
- **Rate Limiting** — per-IP + per-endpoint (SQLite)
- **Docker** — `Dockerfile` + `docker-compose.yml` for self-hosted deployment

#### Testing
- Vitest × 27 unit tests (crypto, chat-crypto, sessions) — all passing
- Playwright × 16 E2E tests (startup, navigation, chat, lock screen)
- GitHub Actions CI — runs tests on every push to `main`

#### Infrastructure
- Next.js 16 App Router (Turbopack)
- TypeScript strict mode
- Vanilla CSS with CSS custom properties (no Tailwind utility layer dependency)
- SQLite via `better-sqlite3` for sessions, rate limits, chat history, and security logs

---

## [0.1.0] — 2026-03-08

### Initial Development

- Project scaffolding (Next.js 16, TypeScript, Vanilla CSS cream theme)
- PIN authentication + device session (SQLite)
- Chat with SSE streaming placeholder
- Basic sidebar navigation (icon bar)
- Docker containerisation

---

## [0.0.1] — 2026-03-08 (internal)

- Repository created
- `@mdl-systems/cocoro-sdk` integration scaffold
