export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/sync/rate
 * cocoro-core の /sync/rate エンドポイントに対応。
 * 現在のシンクロ率を返す。
 */
import { NextRequest } from 'next/server';
import { checkRate, requireSession, jsonSuccess } from '@/core/api-helper';
import { getCoreUrl } from '@/lib/cocoro-core';

const COCORO_API_KEY = process.env.COCORO_CORE_API_KEY ?? process.env.COCORO_API_KEY ?? 'cocoro-dev-2026';

export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const coreUrl = getCoreUrl(request);
        const res = await fetch(`${coreUrl}/sync/rate`, {
            headers: { Authorization: `Bearer ${COCORO_API_KEY}` },
            signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
            const data = await res.json();

            // cocoro-core が返す sync_rate を 0-1 に正規化：
            //   - 0.73 などの小数（正しい形式）→ そのまま使用
            //   - 73 などの整数（0-100 スケール）→ 100 で割る
            //   - undefined / NaN → フォールバック値を使用
            function normRate(v: unknown): number | undefined {
                const n = parseFloat(String(v));
                if (isNaN(n)) return undefined;
                return n > 1 ? n / 100 : n; // 1超 = 0-100スケール → 割る
            }

            const syncRate = normRate(data.sync_rate ?? data.rate ?? data.syncRate);

            if (syncRate !== undefined) {
                return jsonSuccess({
                    sync_rate: syncRate,
                    prev_sync_rate: normRate(data.prev_sync_rate ?? data.prevRate),
                    values_alignment: normRate(data.values_alignment),
                    empathy_score: normRate(data.empathy_score),
                    label: data.label,
                    source: 'core',
                });
            }
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
