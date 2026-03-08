import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/db';
import { validateBody, MemoryCreateSchema } from '@/core/validators';
import { checkRate, requireSession, jsonSuccess, jsonError } from '@/core/api-helper';

export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const db = getDatabase();
        const type = request.nextUrl.searchParams.get('type');

        let memories;
        if (type) {
            memories = db.prepare('SELECT * FROM memory_entries WHERE type = ? ORDER BY created_at DESC').all(type);
        } else {
            memories = db.prepare('SELECT * FROM memory_entries ORDER BY created_at DESC').all();
        }

        const counts = db.prepare(`
      SELECT type, COUNT(*) as count FROM memory_entries GROUP BY type
    `).all() as Array<{ type: string; count: number }>;

        const byType: Record<string, number> = { short_term: 0, long_term: 0, vector: 0 };
        for (const row of counts) byType[row.type] = row.count;

        return jsonSuccess({ memories, total: memories.length, by_type: byType });
    } catch {
        return jsonError('INTERNAL_ERROR', 'Failed to get memories', 500);
    }
}

export async function POST(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const body = await request.json();
        const validation = validateBody(body, MemoryCreateSchema);

        if (!validation.success) {
            return jsonError('VALIDATION_ERROR', validation.error, 400);
        }

        const { content, type, category, metadata } = validation.data;
        const id = `mem_${uuidv4().substring(0, 8)}`;
        const now = new Date().toISOString();

        const db = getDatabase();
        db.prepare(`
      INSERT INTO memory_entries (id, type, content, category, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, type, content, category, metadata ? JSON.stringify(metadata) : null, now, now);

        return jsonSuccess({
            memory: { id, type, content, category, metadata, created_at: now },
        });
    } catch {
        return jsonError('INTERNAL_ERROR', 'Failed to store memory', 500);
    }
}

export async function DELETE(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const db = getDatabase();
        const id = request.nextUrl.searchParams.get('id');

        if (id) {
            const result = db.prepare('DELETE FROM memory_entries WHERE id = ?').run(id);
            if (result.changes === 0) return jsonError('NOT_FOUND', 'Memory not found', 404);
            return jsonSuccess({});
        }

        db.prepare('DELETE FROM memory_entries').run();
        return jsonSuccess({ message: 'All memories cleared' });
    } catch {
        return jsonError('INTERNAL_ERROR', 'Failed to delete memory', 500);
    }
}
