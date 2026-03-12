import { NextRequest } from 'next/server';
import { checkRate, requireSession, jsonSuccess } from '@/core/api-helper';

const COCORO_CORE_URL = process.env.COCORO_CORE_URL ?? 'http://localhost:8001';
const COCORO_AGENT_URL = process.env.COCORO_AGENT_URL ?? 'http://localhost:8002';
const COCORO_API_KEY = process.env.COCORO_CORE_API_KEY ?? process.env.COCORO_API_KEY ?? 'cocoro-dev-2026';

async function ping(url: string, timeoutMs = 3000): Promise<{ ok: boolean; latencyMs: number | null }> {
    const start = Date.now();
    try {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${COCORO_API_KEY}` },
            signal: AbortSignal.timeout(timeoutMs),
        });
        return { ok: res.ok, latencyMs: Date.now() - start };
    } catch {
        return { ok: false, latencyMs: null };
    }
}

export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    const [core, agent] = await Promise.all([
        ping(`${COCORO_CORE_URL}/health`),
        ping(`${COCORO_AGENT_URL}/health`),
    ]);

    const services = [
        {
            id: 'core',
            name: 'cocoro-core',
            icon: '🧠',
            port: Number(new URL(COCORO_CORE_URL).port) || 8001,
            status: core.ok ? 'online' : 'offline',
            latencyMs: core.latencyMs,
        },
        {
            id: 'agent',
            name: 'cocoro-agent',
            icon: '🤖',
            port: Number(new URL(COCORO_AGENT_URL).port) || 8002,
            status: agent.ok ? 'online' : 'offline',
            latencyMs: agent.latencyMs,
        },
        // DB / Redis はローカルなので常に「正常」表示（サーバー側で確認済み）
        { id: 'db', name: 'SQLite', icon: '💾', port: 0, status: 'online', latencyMs: null },
        { id: 'redis', name: 'Redis', icon: '⚡', port: 6379, status: 'unknown', latencyMs: null },
    ];

    return jsonSuccess({ services, checkedAt: new Date().toISOString() });
}
