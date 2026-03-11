import { NextRequest } from 'next/server';
import { getDatabase } from '@/db';
import { checkRate, requireSession, jsonSuccess, jsonError } from '@/core/api-helper';
import { setupStart, setupAnswer, setupResult, CORE_ENABLED } from '@/lib/cocoro-core';

const SETUP_COMPLETED_KEY = 'setup_completed';

function isSetupCompleted(): boolean {
    try {
        const db = getDatabase();
        const row = db.prepare('SELECT value FROM user_settings WHERE key = ?').get(SETUP_COMPLETED_KEY) as { value: string } | undefined;
        return row?.value === 'true';
    } catch {
        return false;
    }
}

function markSetupCompleted() {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(`
        INSERT INTO user_settings (key, value, encrypted, updated_at)
        VALUES (?, 'true', 0, ?)
        ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = ?
    `).run(SETUP_COMPLETED_KEY, now, now);
}

export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const { searchParams } = request.nextUrl;
    const action = searchParams.get('action');

    // Status check — no session required
    if (action === 'status') {
        // If CORE is disabled, auto-skip setup
        if (!CORE_ENABLED) {
            return jsonSuccess({ setup_completed: true, skipped: true });
        }
        return jsonSuccess({ setup_completed: isSetupCompleted() });
    }

    // Result fetch
    if (action === 'result') {
        const sessionCheck = requireSession(request);
        if (sessionCheck) return sessionCheck;

        const sessionId = searchParams.get('session_id');
        if (!sessionId) return jsonError('BAD_REQUEST', 'session_id is required', 400);

        const result = await setupResult(sessionId);
        if (!result) return jsonError('CORE_ERROR', 'Failed to get setup result', 502);
        return jsonSuccess(result as unknown as Record<string, unknown>);
    }

    return jsonError('BAD_REQUEST', 'Unknown action', 400);
}

export async function POST(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    let body: Record<string, unknown> = {};
    try {
        body = await request.json();
    } catch {
        return jsonError('BAD_REQUEST', 'Invalid JSON', 400);
    }

    // action はクエリパラメータ優先、次にボディから取得
    const { searchParams } = request.nextUrl;
    const action = (searchParams.get('action') ?? body.action) as string;

    if (action === 'start') {
        const mode = (body.mode as 'boot' | 'deep') ?? 'boot';
        const result = await setupStart(mode);
        if (!result) return jsonError('CORE_ERROR', 'Failed to start setup', 502);
        return jsonSuccess(result as unknown as Record<string, unknown>);
    }

    if (action === 'answer') {
        const { session_id, question_id, answer } = body as { session_id: string; question_id: string; answer: string };
        if (!session_id || !question_id || answer === undefined) {
            return jsonError('BAD_REQUEST', 'session_id, question_id, answer are required', 400);
        }
        const result = await setupAnswer(session_id, question_id, String(answer));
        if (!result) return jsonError('CORE_ERROR', 'Failed to submit answer', 502);
        return jsonSuccess(result as unknown as Record<string, unknown>);
    }

    if (action === 'complete') {
        markSetupCompleted();
        return jsonSuccess({ setup_completed: true });
    }

    return jsonError('BAD_REQUEST', 'Unknown action', 400);
}
