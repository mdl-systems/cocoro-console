export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { checkRate, requireSession, jsonSuccess } from '@/core/api-helper';
import { getCoreUrl } from '@/lib/cocoro-core';

const COCORO_API_KEY = process.env.COCORO_CORE_API_KEY ?? process.env.COCORO_API_KEY ?? 'cocoro-dev-2026';

export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    // Check if already shown today
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    try {
        // Try to fetch brief from cocoro-core
        const coreUrl = getCoreUrl(request);
        const res = await fetch(`${coreUrl}/brain/brief/daily`, {
            headers: {
                Authorization: `Bearer ${COCORO_API_KEY}`,
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(4000),
        });

        if (res.ok) {
            const data = await res.json();
            return jsonSuccess({
                date: today,
                greeting: buildGreeting(),
                message: data.summary ?? data.message ?? '昨日の振り返りと今日の提案があります',
                tasks_suggested: data.tasks_suggested ?? [],
                memories_surfaced: data.memories_surfaced ?? [],
                source: 'core',
            });
        }
    } catch { /* core offline → fallback */ }

    // Fallback brief
    return jsonSuccess({
        date: today,
        greeting: buildGreeting(),
        message: '昨日の振り返りと今日の提案があります',
        tasks_suggested: [],
        memories_surfaced: [],
        source: 'local',
    });
}

function buildGreeting(): string {
    const h = new Date().getHours();
    if (h < 5) return 'お疲れさまです 🌙';
    if (h < 10) return 'おはようございます 🌅';
    if (h < 17) return 'こんにちは ☀️';
    return 'お疲れさまです 🌆';
}
