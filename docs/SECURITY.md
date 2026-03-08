# Cocoro Console — Security Architecture

## Overview

Cocoro Console follows a **Zero Trust, Local-First** security model.
All data is encrypted at rest using **AES-256-GCM** (AEAD).
No external services are required for operation.

## Cryptographic Primitives

### Allowed
- **AES-256-GCM** — Authenticated encryption (AEAD)
- **Ed25519** — Device identity key pairs
- **scrypt** — Key derivation function
- **SHA-256** — Non-security-critical hashing

### Forbidden
- AES-CBC (no authentication)
- MD5 (broken)
- SHA-1 (deprecated)

## Device Identity

- **Algorithm**: Ed25519 key pair
- **Private Key Storage**: Encrypted with AES-256-GCM
- **Key Derivation**: `scrypt(hardwareFingerprint, randomSalt)` — never direct fingerprint
- **Salt**: Stored separately in encrypted payload
- **Location**: `.cocoro/device_identity.json` + `.cocoro/device_private_key.enc`

## Session Management

- **Storage**: Encrypted SQLite database (never JSON files)
- **Transport**: HTTPOnly, SameSite=Strict cookies
- **Token**: Cryptographically random 64-character hex string
- **Idle Timeout**: 30 minutes → lock screen
- **Absolute Expiry**: 24 hours max session lifetime
- **CSRF**: Separate token per session, validated on all state-changing requests

## Access Control

### Local Access (Primary)
- No login required
- Automatic session creation on first visit
- Protected by device token cookie

### LAN Access
- Same security as local
- Firewall rules should block WAN traffic
- Origin/Host header verification

### Remote Access (Phase 3)
- Requires device pairing
- Mutual TLS or WireGuard tunnel
- Additional session controls

## API Protection

| Protection       | Implementation                          |
|------------------|-----------------------------------------|
| Authentication   | `cocoro_device_token` HTTPOnly cookie   |
| CSRF             | `X-CSRF-Token` header + cookie match    |
| Origin           | Origin/Host header verification         |
| Content-Type     | Only `application/json` accepted        |
| Input Validation | Zod schema validation on all bodies     |
| Rate Limiting    | 60 requests/minute per IP (SQLite)      |
| Cookies          | HTTPOnly, SameSite=Strict               |

## Security Headers

All responses include:
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-XSS-Protection: 1; mode=block`
- `X-DNS-Prefetch-Control: off`

## Middleware Security Layer

Global proxy layer (`src/proxy.ts`) enforces:
1. Security headers on all responses
2. Origin/Host verification on API routes
3. Content-Type validation on state-changing requests
4. CSRF token verification (header vs cookie match)

## Agent Sandbox

Each agent runs with a defined policy:

```json
{
  "allowed_tools": ["code_gen", "file_write"],
  "network_access": false,
  "filesystem_scope": "/workspace"
}
```

## Data Persistence

All persistent state uses SQLite:

| Table           | Purpose                    | Encryption |
|-----------------|----------------------------|------------|
| sessions        | Session management         | ✅         |
| security_logs   | Security event audit trail | ✅         |
| user_settings   | User profile & preferences | Planned    |
| agent_settings  | Agent configuration        | Planned    |
| chat_history    | Conversation records       | Planned    |
| memory_entries  | Memory system              | Planned    |
| rate_limits     | Per-IP rate tracking       | N/A        |

## Security Logging

All security events are logged to SQLite with structured format:
- Session lifecycle (create, lock, unlock, destroy, expire)
- API access events
- CSRF violations
- Origin violations
- Rate limiting events
- Agent execution events
- Access denied events

## Error Handling

Internal errors are never exposed to the client:
```json
{
  "success": false,
  "error": "UNAUTHORIZED"
}
```
