export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/memory/list
 *
 * cocoro-core の /memory/list エンドポイントに対応するエイリアス。
 * 実装は /api/memory (GET) と同一。
 * nginx の location = /api/memory が /memory/list に転送するが、
 * クエリパラメータ付き (/api/memory/list?type=...) はこちらへ直接来る。
 */
import { NextRequest } from 'next/server';
import { checkRate, requireSession, jsonSuccess, jsonError } from '@/core/api-helper';
import { coreMemoryStats, coreMemoryList, CORE_ENABLED } from '@/lib/cocoro-core';
import { getDatabase } from '@/db';

export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const type = request.nextUrl.searchParams.get('type') ?? undefined;

        // ── Try cocoro-core first ──────────────────────────────
        if (CORE_ENABLED) {
            const [coreMemories, coreStats] = await Promise.all([
                coreMemoryList(type, 100),
                coreMemoryStats(),
            ]);

            if (coreMemories !== null) {
                const byType = {
                    short_term: coreStats?.short_term ?? 0,
                    long_term: coreStats?.long_term ?? 0,
                    vector: coreStats?.vector ?? 0,
                };
                const memories = coreMemories.map(m => ({
                    id: m.id,
                    type: m.type,
                    content: m.content,
                    category: m.category,
                    timestamp: m.created_at,
                    importance: m.importance,
                }));
                return jsonSuccess({ memories, total: memories.length, by_type: byType, source: 'core' });
            }
        }

        // ── Fallback: local SQLite ─────────────────────────────
        const db = getDatabase();
        const memories = type
            ? db.prepare('SELECT * FROM memory_entries WHERE type = ? ORDER BY created_at DESC').all(type)
            : db.prepare('SELECT * FROM memory_entries ORDER BY created_at DESC').all();

        const counts = db.prepare(
            'SELECT type, COUNT(*) as count FROM memory_entries GROUP BY type'
        ).all() as Array<{ type: string; count: number }>;

        const byType: Record<string, number> = { short_term: 0, long_term: 0, vector: 0 };
        for (const row of counts) byType[row.type] = row.count;

        return jsonSuccess({ memories, total: (memories as unknown[]).length, by_type: byType, source: 'local' });
    } catch {
        return jsonError('INTERNAL_ERROR', 'Failed to get memories', 500);
    }
}
