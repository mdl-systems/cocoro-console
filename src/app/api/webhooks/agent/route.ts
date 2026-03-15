export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { checkRate, jsonSuccess, jsonError } from '@/core/api-helper';

// ── In-memory SSE clients (per-process) ──────────────────────
type SseClient = { id: string; controller: ReadableStreamDefaultController };
const clients = new Map<string, SseClient>();

export function addSseClient(id: string, controller: ReadableStreamDefaultController) {
    clients.set(id, { id, controller });
}
export function removeSseClient(id: string) {
    clients.delete(id);
}

export function broadcastNotification(payload: object) {
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const { controller } of clients.values()) {
        try { controller.enqueue(new TextEncoder().encode(data)); } catch { /* client gone */ }
    }
}

// ── GET: SSE stream for browser clients ──────────────────────
export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const id = `sse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const stream = new ReadableStream({
        start(controller) {
            addSseClient(id, controller);
            // heartbeat every 20s
            const hb = setInterval(() => {
                try { controller.enqueue(new TextEncoder().encode(': ping\n\n')); }
                catch { clearInterval(hb); }
            }, 20_000);
            request.signal.addEventListener('abort', () => {
                clearInterval(hb);
                removeSseClient(id);
                try { controller.close(); } catch { /* ignore */ }
            });
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}

// ── POST: Webhook from cocoro-agent ──────────────────────────
export async function POST(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    // Validate webhook secret (optional but recommended)
    const secret = process.env.WEBHOOK_SECRET;
    if (secret) {
        const incoming = request.headers.get('X-Webhook-Secret');
        if (incoming !== secret) return jsonError('UNAUTHORIZED', 'Invalid webhook secret', 401);
    }

    try {
        const body = await request.json();
        const { task_id, task_title, status, result_count, agent_type } = body;

        const notification = {
            type: 'task_update',
            task_id,
            task_title: task_title ?? '(名称未設定)',
            status: status ?? 'completed',
            result_count,
            agent_type,
            timestamp: new Date().toISOString(),
        };

        broadcastNotification(notification);
        return jsonSuccess({ broadcast: clients.size });
    } catch (e) {
        return jsonError('INTERNAL_ERROR', (e as Error).message, 500);
    }
}
