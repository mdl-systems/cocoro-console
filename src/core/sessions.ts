/**
 * Cocoro Session Manager
 *
 * Sessions stored in encrypted SQLite — never JSON files.
 * Session policy:
 *   - Idle timeout: 30 minutes
 *   - Absolute expiration: 24 hours
 */

import { generateSecureToken } from './crypto';
import { getDatabase } from '@/db';

// ─── Constants ───────────────────────────────────────────────

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;       // 30 minutes
const ABSOLUTE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Types ───────────────────────────────────────────────────

export interface Session {
    session_id: string;
    device_id: string;
    csrf_token: string;
    created_at: number;
    expires_at: number;
    last_activity: number;
    is_locked: number;
    ip_address: string | null;
}

export interface SessionValidation {
    valid: boolean;
    locked: boolean;
    expired: boolean;
    session?: Session;
}

// ─── Session Operations ──────────────────────────────────────

/**
 * Create a new session.
 */
export function createSession(deviceId: string, ipAddress?: string): {
    sessionToken: string;
    csrfToken: string;
} {
    const sessionToken = generateSecureToken(32);
    const csrfToken = generateSecureToken(32);
    const now = Date.now();

    const db = getDatabase();
    db.prepare(`
    INSERT INTO sessions (session_id, device_id, csrf_token, created_at, expires_at, last_activity, is_locked, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
        sessionToken,
        deviceId,
        csrfToken,
        now,
        now + ABSOLUTE_EXPIRY_MS,
        now,
        ipAddress || null
    );

    return { sessionToken, csrfToken };
}

/**
 * Validate a session token.
 */
export function validateSession(token: string): SessionValidation {
    if (!token) return { valid: false, locked: false, expired: false };

    const db = getDatabase();
    const session = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(token) as Session | undefined;

    if (!session) return { valid: false, locked: false, expired: false };

    const now = Date.now();

    // Absolute expiration
    if (now > session.expires_at) {
        destroySession(token);
        return { valid: false, locked: false, expired: true };
    }

    // Idle timeout → lock
    const idleTime = now - session.last_activity;
    if (idleTime > IDLE_TIMEOUT_MS && !session.is_locked) {
        db.prepare('UPDATE sessions SET is_locked = 1 WHERE session_id = ?').run(token);
        session.is_locked = 1;
    }

    return {
        valid: true,
        locked: session.is_locked === 1,
        expired: false,
        session,
    };
}

/**
 * Touch session (update last activity).
 */
export function touchSession(token: string): boolean {
    const db = getDatabase();
    const result = db.prepare(
        'UPDATE sessions SET last_activity = ? WHERE session_id = ? AND is_locked = 0'
    ).run(Date.now(), token);
    return result.changes > 0;
}

/**
 * Unlock a locked session.
 */
export function unlockSession(token: string): boolean {
    const db = getDatabase();
    const result = db.prepare(
        'UPDATE sessions SET is_locked = 0, last_activity = ? WHERE session_id = ?'
    ).run(Date.now(), token);
    return result.changes > 0;
}

/**
 * Destroy a session.
 */
export function destroySession(token: string): boolean {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM sessions WHERE session_id = ?').run(token);
    return result.changes > 0;
}

/**
 * Validate CSRF token against session.
 */
export function validateCsrf(sessionToken: string, csrfToken: string): boolean {
    if (!sessionToken || !csrfToken) return false;

    const db = getDatabase();
    const session = db.prepare(
        'SELECT csrf_token FROM sessions WHERE session_id = ?'
    ).get(sessionToken) as { csrf_token: string } | undefined;

    if (!session) return false;
    return session.csrf_token === csrfToken;
}

/**
 * Clean up expired sessions.
 */
export function cleanExpiredSessions(): number {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
    return result.changes;
}
