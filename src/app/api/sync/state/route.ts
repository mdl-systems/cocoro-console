export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { checkRate, requireSession, jsonSuccess, jsonError } from '@/core/api-helper';
import { getCoreUrl } from '@/lib/cocoro-core';

const COCORO_API_KEY = process.env.COCORO_CORE_API_KEY ?? process.env.COCORO_API_KEY ?? 'cocoro-dev-2026';

// Fallback mock history (30 days) for when core is offline
function generateMockHistory(days = 30): Array<{ date: string; value: number }> {
    const history = [];
    let current = 0.62 + Math.random() * 0.1;
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        current = Math.min(0.99, Math.max(0.2, current + (Math.random() - 0.45) * 0.04));
        history.push({
            date: d.toISOString().slice(0, 10),
            value: parseFloat(current.toFixed(3)),
        });
    }
    return history;
}

// ── GET /api/sync/state ─────────────────────────────────────────
// cocoro-core endpoint: /sync/rate (current) / /sync/history (?mode=history)
export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    const { searchParams } = request.nextUrl;
    const mode = searchParams.get('mode'); // 'history' for 30-day chart

    try {
        if (mode === 'history') {
            // Fetch history from cocoro-core
            const coreUrl = getCoreUrl(request);
            const res = await fetch(`${coreUrl}/sync/history?days=30`, {
                headers: { Authorization: `Bearer ${COCORO_API_KEY}` },
                signal: AbortSignal.timeout(4000),
            });
            if (res.ok) {
                const data = await res.json();
                return jsonSuccess({ history: data.history ?? data, source: 'core' });
            }
            // Fallback
            return jsonSuccess({ history: generateMockHistory(30), source: 'local' });
        }

        // Current state
        const coreUrl = getCoreUrl(request);
        const res = await fetch(`${coreUrl}/sync/rate`, {
            headers: { Authorization: `Bearer ${COCORO_API_KEY}` },
            signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
            const data = await res.json();
            return jsonSuccess({ ...data, source: 'core' });
        }
    } catch { /* core offline */ }

    // Fallback state
    return jsonSuccess({
        sync_rate: 0.73,
        prev_sync_rate: 0.71,
        values_alignment: 0.85,
        empathy_score: 0.70,
        label: 'フォールバック',
        source: 'local',
    });
}

export async function POST(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;
    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const body = await request.json();
        const coreUrl = getCoreUrl(request);
        const res = await fetch(`${coreUrl}/sync/update`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${COCORO_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
            const data = await res.json();
            return jsonSuccess(data);
        }
        return jsonError('UPSTREAM_ERROR', 'cocoro-core sync update failed', 502);
    } catch (e) {
        return jsonError('INTERNAL_ERROR', (e as Error).message, 500);
    }
}
