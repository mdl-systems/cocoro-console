/**
 * Cocoro Security Module
 *
 * Structured JSON security logging (SQLite-backed).
 * Rate limiting with per-IP tracking.
 */

import { getDatabase } from '@/db';

// ─── Types ───────────────────────────────────────────────────

export type SecurityEventType =
    | 'login_success'
    | 'login_failure'
    | 'session_created'
    | 'session_expired'
    | 'session_locked'
    | 'session_unlocked'
    | 'session_destroyed'
    | 'api_access'
    | 'access_denied'
    | 'csrf_violation'
    | 'origin_violation'
    | 'rate_limited'
    | 'validation_error'
    | 'agent_execution';

export interface SecurityLogEntry {
    timestamp: string;
    event_type: SecurityEventType;
    ip: string;
    session_id?: string;
    endpoint?: string;
    status: string;
    details?: string;
    user_agent?: string;
}

// ─── Security Logging ────────────────────────────────────────

/**
 * Log a security event to SQLite.
 */
export function logSecurityEvent(entry: Omit<SecurityLogEntry, 'timestamp'>) {
    try {
        const db = getDatabase();
        db.prepare(`
      INSERT INTO security_logs (timestamp, event_type, ip, session_id, endpoint, status, details, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            new Date().toISOString(),
            entry.event_type,
            entry.ip || 'unknown',
            entry.session_id || null,
            entry.endpoint || null,
            entry.status,
            entry.details || null,
            entry.user_agent || null
        );
    } catch {
        // Logging must never crash the application
        console.error('[Security] Failed to log event:', entry.event_type);
    }
}

/**
 * Get recent security logs.
 */
export function getRecentLogs(count: number = 50): SecurityLogEntry[] {
    try {
        const db = getDatabase();
        return db.prepare(
            'SELECT * FROM security_logs ORDER BY id DESC LIMIT ?'
        ).all(count) as SecurityLogEntry[];
    } catch {
        return [];
    }
}

/**
 * Get security log count by event type for today.
 */
export function getTodayLogStats(): Record<string, number> {
    try {
        const db = getDatabase();
        const today = new Date().toISOString().split('T')[0];
        const rows = db.prepare(
            "SELECT event_type, COUNT(*) as count FROM security_logs WHERE timestamp >= ? GROUP BY event_type"
        ).all(today + 'T00:00:00.000Z') as Array<{ event_type: string; count: number }>;

        const stats: Record<string, number> = {};
        for (const row of rows) {
            stats[row.event_type] = row.count;
        }
        return stats;
    } catch {
        return {};
    }
}

// ─── Rate Limiting ───────────────────────────────────────────

const RATE_LIMIT_WINDOW_SEC = 60; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute

/**
 * Check rate limit for an IP + endpoint.
 * Returns true if request is allowed.
 */
export function checkRateLimit(ip: string, endpoint: string): boolean {
    try {
        const db = getDatabase();
        const windowStart = Math.floor(Date.now() / 1000 / RATE_LIMIT_WINDOW_SEC) * RATE_LIMIT_WINDOW_SEC;

        const row = db.prepare(
            'SELECT request_count FROM rate_limits WHERE ip = ? AND endpoint = ? AND window_start = ?'
        ).get(ip, endpoint, windowStart) as { request_count: number } | undefined;

        if (!row) {
            db.prepare(
                'INSERT OR REPLACE INTO rate_limits (ip, endpoint, window_start, request_count) VALUES (?, ?, ?, 1)'
            ).run(ip, endpoint, windowStart);
            return true;
        }

        if (row.request_count >= RATE_LIMIT_MAX) {
            return false;
        }

        db.prepare(
            'UPDATE rate_limits SET request_count = request_count + 1 WHERE ip = ? AND endpoint = ? AND window_start = ?'
        ).run(ip, endpoint, windowStart);
        return true;
    } catch {
        return true; // Allow on error (don't break functionality)
    }
}

/**
 * Clean old rate limit entries.
 */
export function cleanRateLimits() {
    try {
        const db = getDatabase();
        const cutoff = Math.floor(Date.now() / 1000) - RATE_LIMIT_WINDOW_SEC * 2;
        db.prepare('DELETE FROM rate_limits WHERE window_start < ?').run(cutoff);
    } catch {
        // Silent cleanup failure
    }
}
