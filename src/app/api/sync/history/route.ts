/**
 * GET /api/sync/history
 * cocoro-core の /sync/history エンドポイントに対応。
 * 過去30日のシンクロ率履歴を返す（DashboardPageのグラフ用）。
 */
import { NextRequest } from 'next/server';
import { checkRate, requireSession, jsonSuccess } from '@/core/api-helper';

const COCORO_CORE_URL = process.env.COCORO_CORE_URL ?? 'http://localhost:8001';
const COCORO_API_KEY = process.env.COCORO_CORE_API_KEY ?? process.env.COCORO_API_KEY ?? 'cocoro-dev-2026';

// Fallback mock history (30 days)
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

export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const res = await fetch(`${COCORO_CORE_URL}/sync/history?days=30`, {
            headers: { Authorization: `Bearer ${COCORO_API_KEY}` },
            signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
            const data = await res.json();
            return jsonSuccess({ history: data.history ?? data, source: 'core' });
        }
    } catch { /* core offline */ }

    // Fallback
    return jsonSuccess({ history: generateMockHistory(30), source: 'local' });
}
