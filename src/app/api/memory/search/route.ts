import { NextRequest } from 'next/server';
import { checkRate, requireSession, jsonSuccess, jsonError } from '@/core/api-helper';
import { coreMemorySearch, CORE_ENABLED } from '@/lib/cocoro-core';
import { getDatabase } from '@/db';

export async function POST(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const body = await request.json();
        const query: string = body.query?.trim() ?? '';
        if (!query) return jsonError('VALIDATION_ERROR', 'query is required', 400);

        // ── Try cocoro-core vector search ─────────────────────
        if (CORE_ENABLED) {
            const results = await coreMemorySearch(query);
            if (results !== null) {
                const memories = results.map(m => ({
                    id: m.id,
                    type: m.type,
                    content: m.content,
                    category: m.category,
                    timestamp: m.created_at,
                    importance: m.importance,
                }));
                return jsonSuccess({ memories, total: memories.length, source: 'core' });
            }
        }

        // ── Fallback: local SQLite LIKE search ────────────────
        const db = getDatabase();
        const like = `%${query}%`;
        const memories = db.prepare(
            'SELECT * FROM memory_entries WHERE content LIKE ? OR category LIKE ? ORDER BY created_at DESC LIMIT 30'
        ).all(like, like);

        return jsonSuccess({ memories, total: (memories as unknown[]).length, source: 'local' });
    } catch {
        return jsonError('INTERNAL_ERROR', 'Search failed', 500);
    }
}
