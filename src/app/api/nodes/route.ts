export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { checkRate, requireSession, jsonSuccess, jsonError } from '@/core/api-helper';
import { getDatabase } from '@/db';
import { getCoreUrl } from '@/lib/cocoro-core';

const COCORO_API_KEY = process.env.COCORO_CORE_API_KEY ?? process.env.COCORO_API_KEY ?? 'cocoro-dev-2026';

// ── スキーマ初期化（関数内で遅延実行） ─────────────────────────
function getDb() {
    const db = getDatabase();
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
    return db;
}

// ─── GET /api/nodes ────────────────────────────────────────
export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const db = getDb();
        const localRows = db.prepare('SELECT * FROM nodes ORDER BY created_at DESC').all();
        const localNodes = (localRows as Record<string, unknown>[]).map(n => ({
            ...n,
            roles: JSON.parse((n.roles as string) || '[]'),
            _source: 'local',
        }));

        // cocoro-core に登録されているノードも取得して統合
        let coreNodes: Record<string, unknown>[] = [];
        try {
            const coreUrl = getCoreUrl(request);
            const res = await fetch(`${coreUrl}/nodes`, {
                headers: { Authorization: `Bearer ${COCORO_API_KEY}` },
                signal: AbortSignal.timeout(3000),
            });
            if (res.ok) {
                const data = await res.json();
                const raw: Record<string, unknown>[] = data.nodes ?? data.data?.nodes ?? [];
                // cocoro-core形式 → NodesPage と同じ形式に変換
                coreNodes = raw.map(n => ({
                    id: n.node_id ?? n.id ?? `core_${n.ip}`,
                    name: n.name ?? n.hostname ?? String(n.ip),
                    ip: n.ip,
                    port: n.port ?? 8001,
                    roles: Array.isArray(n.roles) ? n.roles : [],
                    status: n.status ?? 'unknown',
                    last_seen: n.last_seen ?? n.updated_at ?? null,
                    created_at: n.created_at ?? new Date().toISOString(),
                    _source: 'core',
                }));
            }
        } catch { /* core offline - core nodes unavailable */ }

        // localNodes を優先し、core にのみ存在するノードを追加
        const localIps = new Set(localNodes.map(n => String((n as Record<string, unknown>).ip ?? '')));

        const mergedCoreNodes = coreNodes.filter(n => !localIps.has(String(n.ip ?? '')));

        const nodes = [...localNodes, ...mergedCoreNodes];

        return jsonSuccess({ nodes });
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

        const db = getDb();

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
        const db = getDb();
        db.prepare('DELETE FROM nodes WHERE id = ?').run(id);
        return jsonSuccess({ deleted: id });
    } catch (e) {
        return jsonError('DB_ERROR', (e as Error).message, 500);
    }
}
