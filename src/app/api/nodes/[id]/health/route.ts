import { NextRequest } from 'next/server';
import { checkRate, requireSession, jsonSuccess, jsonError } from '@/core/api-helper';
import { getDatabase } from '@/db';

const db = getDatabase();

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    const { id } = await context.params;

    // DBからノード情報を取得
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!node) return jsonError('NOT_FOUND', 'Node not found', 404);

    const ip = node.ip as string;
    const port = node.port as number;

    // 死活確認: cocoro-core の GET /monitor/dashboard を試みる
    let status: 'online' | 'offline' = 'offline';
    let latencyMs: number | null = null;
    try {
        const start = Date.now();
        const res = await fetch(`http://${ip}:${port}/monitor/dashboard`, {
            signal: AbortSignal.timeout(3000),
        });
        latencyMs = Date.now() - start;
        status = res.ok ? 'online' : 'offline';
    } catch { status = 'offline'; }

    // ステータスを DB に保存
    const now = new Date().toISOString();
    db.prepare('UPDATE nodes SET status = ?, last_seen = ? WHERE id = ?').run(
        status,
        status === 'online' ? now : (node.last_seen as string | null),
        id,
    );

    return jsonSuccess({ id, status, latencyMs, checkedAt: now });
}
