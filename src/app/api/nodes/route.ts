export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { checkRate, requireSession, jsonSuccess, jsonError } from '@/core/api-helper';
import { getDatabase } from '@/db';

const db = getDatabase();

// ── スキーマ初期化 ─────────────────────────────────────────
try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS nodes (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            ip          TEXT NOT NULL,
            port        INTEGER NOT NULL DEFAULT 8001,
            roles       TEXT NOT NULL DEFAULT '[]',
            status      TEXT NOT NULL DEFAULT 'unknown',
            last_seen   TEXT,
            created_at  TEXT NOT NULL
        )
    `);
} catch { /* already exists */ }

// ─── GET /api/nodes ────────────────────────────────────────
export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const nodes = db.prepare('SELECT * FROM nodes ORDER BY created_at DESC').all();
        // デシリアライズ roles
        const normalized = (nodes as Record<string, unknown>[]).map(n => ({
            ...n,
            roles: JSON.parse((n.roles as string) || '[]'),
        }));
        return jsonSuccess({ nodes: normalized });
    } catch (e) {
        return jsonError('DB_ERROR', (e as Error).message, 500);
    }
}

// ─── POST /api/nodes  (register) ──────────────────────────
export async function POST(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const body = await request.json();
        const { name, ip, port = 8001, roles = [] } = body;

        if (!name || !ip) return jsonError('MISSING_FIELDS', 'name and ip are required', 400);

        const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const now = new Date().toISOString();

        db.prepare(`
            INSERT INTO nodes (id, name, ip, port, roles, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'unknown', ?)
        `).run(id, name, ip, port, JSON.stringify(roles), now);

        return jsonSuccess({ id, name, ip, port, roles, status: 'unknown', created_at: now });
    } catch (e) {
        return jsonError('DB_ERROR', (e as Error).message, 500);
    }
}

// ─── DELETE /api/nodes?id=... ──────────────────────────────
export async function DELETE(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return jsonError('MISSING_ID', 'id is required', 400);

    try {
        db.prepare('DELETE FROM nodes WHERE id = ?').run(id);
        return jsonSuccess({ deleted: id });
    } catch (e) {
        return jsonError('DB_ERROR', (e as Error).message, 500);
    }
}
