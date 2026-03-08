/**
 * Unit tests for src/core/sessions.ts
 * Uses a vi.mock for @/db to avoid native better-sqlite3 ESM issues.
 * All DB calls are intercepted and simulated with a simple in-memory Map.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── In-memory session store ───────────────────────────────────
type SessionRow = {
    session_id: string;
    device_id: string;
    csrf_token: string;
    created_at: number;
    expires_at: number;
    last_activity: number;
    is_locked: number;
    ip_address: string | null;
};

const store = new Map<string, SessionRow>();

const mockPrepare = (sql: string) => ({
    run: (...params: unknown[]) => {
        if (sql.includes('INSERT INTO sessions')) {
            const [sid, did, csrf, ca, ea, la, ip] = params as [string, string, string, number, number, number, string | null];
            store.set(sid, { session_id: sid, device_id: did, csrf_token: csrf, created_at: ca, expires_at: ea, last_activity: la, is_locked: 0, ip_address: ip });
            return { changes: 1 };
        }
        if (sql.includes('UPDATE sessions SET is_locked = 1')) {
            const [tok] = params as [string];
            const s = store.get(tok);
            if (s) { s.is_locked = 1; return { changes: 1 }; }
            return { changes: 0 };
        }
        if (sql.includes('UPDATE sessions SET is_locked = 0')) {
            const [la, tok] = params as [number, string];
            const s = store.get(tok);
            if (s) { s.is_locked = 0; s.last_activity = la; return { changes: 1 }; }
            return { changes: 0 };
        }
        if (sql.includes('UPDATE sessions SET last_activity')) {
            const [la, tok] = params as [number, string];
            const s = store.get(tok);
            if (s && s.is_locked === 0) { s.last_activity = la; return { changes: 1 }; }
            return { changes: 0 };
        }
        if (sql.includes('DELETE FROM sessions WHERE session_id')) {
            const [tok] = params as [string];
            return { changes: store.delete(tok) ? 1 : 0 };
        }
        if (sql.includes('DELETE FROM sessions WHERE expires_at')) {
            const now = params[0] as number;
            let cnt = 0;
            for (const [k, v] of store.entries()) { if (v.expires_at < now) { store.delete(k); cnt++; } }
            return { changes: cnt };
        }
        return { changes: 0 };
    },
    get: (...params: unknown[]) => {
        if (sql.includes('WHERE session_id = ?')) {
            return store.get(params[0] as string) ?? undefined;
        }
        if (sql.includes('SELECT csrf_token')) {
            const s = store.get(params[0] as string);
            return s ? { csrf_token: s.csrf_token } : undefined;
        }
        return undefined;
    },
    all: () => [],
});

vi.mock('@/db', () => ({
    getDatabase: () => ({ prepare: mockPrepare }),
}));

import {
    createSession,
    validateSession,
    unlockSession,
    destroySession,
    validateCsrf,
    touchSession,
} from '@/core/sessions';

beforeEach(() => store.clear());

// ─────────────────────────────────────────────────────────────

describe('sessions — createSession', () => {
    it('returns string sessionToken and csrfToken', () => {
        const { sessionToken, csrfToken } = createSession('dev-001', '127.0.0.1');
        expect(typeof sessionToken).toBe('string');
        expect(sessionToken.length).toBeGreaterThan(16);
        expect(typeof csrfToken).toBe('string');
    });

    it('creates unique tokens per call', () => {
        const a = createSession('dev-001');
        const b = createSession('dev-001');
        expect(a.sessionToken).not.toBe(b.sessionToken);
        expect(a.csrfToken).not.toBe(b.csrfToken);
    });
});

describe('sessions — validateSession', () => {
    it('returns valid:false for unknown token', () => {
        expect(validateSession('ghost').valid).toBe(false);
    });

    it('returns valid:false for empty string', () => {
        expect(validateSession('').valid).toBe(false);
    });

    it('returns valid:true for a fresh session', () => {
        const { sessionToken } = createSession('dev-002');
        const res = validateSession(sessionToken);
        expect(res.valid).toBe(true);
        expect(res.locked).toBe(false);
        expect(res.expired).toBe(false);
    });
});

describe('sessions — unlockSession', () => {
    it('returns true for an existing session', () => {
        const { sessionToken } = createSession('dev-003');
        expect(unlockSession(sessionToken)).toBe(true);
    });

    it('returns false for unknown token', () => {
        expect(unlockSession('no-such')).toBe(false);
    });
});

describe('sessions — destroySession', () => {
    it('removes the session and makes it invalid', () => {
        const { sessionToken } = createSession('dev-004');
        expect(destroySession(sessionToken)).toBe(true);
        expect(validateSession(sessionToken).valid).toBe(false);
    });

    it('returns false for non-existent token', () => {
        expect(destroySession('ghost-token')).toBe(false);
    });
});

describe('sessions — validateCsrf', () => {
    it('returns true for correct csrf token', () => {
        const { sessionToken, csrfToken } = createSession('dev-005');
        expect(validateCsrf(sessionToken, csrfToken)).toBe(true);
    });

    it('returns false for wrong csrf token', () => {
        const { sessionToken } = createSession('dev-006');
        expect(validateCsrf(sessionToken, 'wrong-csrf')).toBe(false);
    });

    it('returns false for empty inputs', () => {
        expect(validateCsrf('', '')).toBe(false);
    });
});

describe('sessions — touchSession', () => {
    it('returns true for an unlocked session', () => {
        const { sessionToken } = createSession('dev-007');
        expect(touchSession(sessionToken)).toBe(true);
    });

    it('returns false for unknown session', () => {
        expect(touchSession('no-such')).toBe(false);
    });
});
