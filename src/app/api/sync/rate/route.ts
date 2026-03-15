/**
 * GET /api/sync/rate
 * cocoro-core の /sync/rate エンドポイントに対応。
 * 現在のシンクロ率を返す。
 */
import { NextRequest } from 'next/server';
import { checkRate, requireSession, jsonSuccess } from '@/core/api-helper';

const COCORO_CORE_URL = process.env.COCORO_CORE_URL ?? 'http://localhost:8001';
const COCORO_API_KEY = process.env.COCORO_CORE_API_KEY ?? process.env.COCORO_API_KEY ?? 'cocoro-dev-2026';

export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const res = await fetch(`${COCORO_CORE_URL}/sync/rate`, {
            headers: { Authorization: `Bearer ${COCORO_API_KEY}` },
            signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
            const data = await res.json();
            return jsonSuccess({ ...data, source: 'core' });
        }
    } catch { /* core offline */ }

    // Fallback
    return jsonSuccess({
        sync_rate: 0.73,
        prev_sync_rate: 0.71,
        values_alignment: 0.85,
        empathy_score: 0.70,
        label: 'フォールバック',
        source: 'local',
    });
}
