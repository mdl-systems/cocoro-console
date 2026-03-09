import { NextRequest } from 'next/server';
import { checkRate, requireSession, jsonSuccess, jsonError } from '@/core/api-helper';

// cocoro-agent の URL（環境変数 or デフォルト）
const AGENT_URL = process.env.COCORO_AGENT_URL ?? 'http://localhost:8002';
const AGENT_KEY = process.env.COCORO_CORE_API_KEY ?? process.env.COCORO_API_KEY ?? 'cocoro-dev-2026';

function agentHeaders() {
    return {
        'Authorization': `Bearer ${AGENT_KEY}`,
        'Content-Type': 'application/json',
    };
}

// ─── GET /api/agent-proxy?path=... ───────────────────────
export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    const url = new URL(request.url);
    // path パラメータは /agents?limit=10 のようにクエリを含む場合がある
    const path = url.searchParams.get('path') ?? '/agents';

    try {
        const res = await fetch(`${AGENT_URL}${path}`, {
            headers: agentHeaders(),
            signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
            const text = await res.text();
            return jsonError('AGENT_ERROR', `cocoro-agent: ${text}`, res.status);
        }

        const data = await res.json();
        // データをそのまま返す（cocoro-agent のレスポンス構造を保持）
        return jsonSuccess(data);
    } catch (e) {
        // cocoro-agent が起動していない場合はモックデータを返す
        console.warn('cocoro-agent unreachable, returning mock data:', (e as Error).message);
        return jsonSuccess(getMockData(path));
    }
}

// ─── POST /api/agent-proxy ────────────────────────────────
export async function POST(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    const url = new URL(request.url);
    const path = url.searchParams.get('path') ?? '/tasks';

    try {
        const body = await request.json();
        const res = await fetch(`${AGENT_URL}${path}`, {
            method: 'POST',
            headers: agentHeaders(),
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
            const text = await res.text();
            return jsonError('AGENT_ERROR', `cocoro-agent: ${text}`, res.status);
        }

        const data = await res.json();
        return jsonSuccess(data);
    } catch (e) {
        return jsonError('AGENT_UNAVAILABLE', `cocoro-agent is unreachable: ${(e as Error).message}`, 503);
    }
}

// ─── モックデータ（cocoro-agent 未起動時のフォールバック） ──
function getMockData(path: string): Record<string, unknown> {
    if (path === '/agents') {
        return {
            agents: [
                { id: 'researcher', name: 'Research Agent', department: 'research', status: 'idle', currentTask: null, completedTasks: 0, failedTasks: 0, avgResponseTimeMs: 0, lastActiveAt: null },
                { id: 'dev', name: 'Dev Agent', department: 'development', status: 'idle', currentTask: null, completedTasks: 0, failedTasks: 0, avgResponseTimeMs: 0, lastActiveAt: null },
                { id: 'marketing', name: 'Marketing Agent', department: 'marketing', status: 'idle', currentTask: null, completedTasks: 0, failedTasks: 0, avgResponseTimeMs: 0, lastActiveAt: null },
            ],
            total: 3,
            mode: 'mock (cocoro-agent offline)',
        };
    }
    if (path === '/org/status') {
        return {
            departments: { research: { agents: 1, activeTasks: 0 }, development: { agents: 1, activeTasks: 0 }, marketing: { agents: 1, activeTasks: 0 } },
            totalTasks: { queued: 0, running: 0, completed: 0 },
        };
    }
    if (path === '/stats') {
        return { total: 0, byStatus: {}, byAgent: [], recentTasks: [] };
    }
    if (path === '/tasks') {
        return { tasks: [], total: 0, limit: 20, offset: 0 };
    }
    return {};
}
