export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { getRecentLogs, getTodayLogStats } from '@/core/security';
import { checkRate, requireSession, jsonSuccess, jsonError } from '@/core/api-helper';

export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const events = getRecentLogs(100);
        const stats = getTodayLogStats();

        return jsonSuccess({
            recent_events: events,
            today_stats: stats,
            total_today: Object.values(stats).reduce((a, b) => a + b, 0),
        });
    } catch {
        return jsonError('INTERNAL_ERROR', 'Failed to retrieve logs', 500);
    }
}
