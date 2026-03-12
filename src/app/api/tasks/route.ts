import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { checkRate, requireSession, jsonSuccess, jsonError } from '@/core/api-helper';
import { getDatabase } from '@/db';

interface TaskRow {
    id: string;
    title: string;
    description: string | null;
    status: string;
    agent_type: string | null;
    progress: number | null;
    result: string | null;
    result_count: number | null;
    metadata: string | null;
    created_at: string;
    updated_at: string;
}

function ensureTable() {
    const db = getDatabase();
    db.prepare(`
        CREATE TABLE IF NOT EXISTS tasks (
            id          TEXT PRIMARY KEY,
            title       TEXT NOT NULL,
            description TEXT,
            status      TEXT NOT NULL DEFAULT 'pending',
            agent_type  TEXT,
            progress    INTEGER,
            result      TEXT,
            result_count INTEGER,
            metadata    TEXT,
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL
        )
    `).run();
    return db;
}

export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;
    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const db = ensureTable();
        const tasks = db.prepare(
            `SELECT * FROM tasks ORDER BY
             CASE status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
             updated_at DESC`
        ).all() as TaskRow[];

        return jsonSuccess({
            tasks: tasks.map(t => ({
                ...t,
                metadata: t.metadata ? JSON.parse(t.metadata) : null,
            })),
        });
    } catch (e) {
        return jsonError('INTERNAL_ERROR', (e as Error).message, 500);
    }
}

export async function POST(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;
    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const body = await request.json();
        const { title, description, agent_type, metadata } = body;
        if (!title?.trim()) return jsonError('VALIDATION_ERROR', 'title is required', 400);

        const db = ensureTable();
        const id = `task_${uuidv4().slice(0, 8)}`;
        const now = new Date().toISOString();

        db.prepare(`
            INSERT INTO tasks (id, title, description, status, agent_type, metadata, created_at, updated_at)
            VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)
        `).run(id, title.trim(), description ?? null, agent_type ?? 'default', metadata ? JSON.stringify(metadata) : null, now, now);

        return jsonSuccess({ task: { id, title, status: 'pending', agent_type, created_at: now, updated_at: now } });
    } catch (e) {
        return jsonError('INTERNAL_ERROR', (e as Error).message, 500);
    }
}

export async function DELETE(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;
    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const db = ensureTable();
        const id = request.nextUrl.searchParams.get('id');
        if (!id) return jsonError('VALIDATION_ERROR', 'id is required', 400);
        db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
        return jsonSuccess({});
    } catch (e) {
        return jsonError('INTERNAL_ERROR', (e as Error).message, 500);
    }
}
