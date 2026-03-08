/**
 * Cocoro Core API Client
 *
 * Handles JWT token acquisition and authenticated requests to cocoro-core.
 * Falls back to mock mode when COCORO_CORE_ENABLED=false or core is unreachable.
 */

const CORE_URL = process.env.COCORO_CORE_URL || 'http://192.168.50.92:8001';
const CORE_API_KEY = process.env.COCORO_CORE_API_KEY || '';
const CORE_ENABLED = process.env.COCORO_CORE_ENABLED === 'true';

// ─── Token Cache ──────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getToken(): Promise<string | null> {
    if (!CORE_ENABLED || !CORE_API_KEY) return null;

    // Return cached token if still valid (leave 60s margin)
    if (cachedToken && Date.now() < tokenExpiry - 60_000) {
        return cachedToken;
    }

    try {
        const res = await fetch(`${CORE_URL}/auth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: CORE_API_KEY }),
            signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) return null;

        const data = await res.json();
        cachedToken = data.access_token || data.token || null;
        // Default JWT lifetime = 1 hour
        tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
        return cachedToken;
    } catch {
        return null;
    }
}

// ─── Core API call ────────────────────────────────────────────
async function corePost<T>(path: string, body: unknown): Promise<T | null> {
    const token = await getToken();
    if (!token) return null;

    try {
        const res = await fetch(`${CORE_URL}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(30_000),
        });

        if (!res.ok) {
            console.error(`[cocoro-core] ${path} failed: ${res.status}`);
            return null;
        }

        return await res.json() as T;
    } catch (err) {
        console.error(`[cocoro-core] ${path} error:`, err);
        return null;
    }
}

async function coreGet<T>(path: string): Promise<T | null> {
    const token = await getToken();
    if (!token) return null;

    try {
        const res = await fetch(`${CORE_URL}${path}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) return null;
        return await res.json() as T;
    } catch {
        return null;
    }
}

// ─── Chat ─────────────────────────────────────────────────────
export interface CoreChatResponse {
    response: string;
    session_id: string;
    action: string;
    emotion: string;
    task_id?: string | null;
}

export async function coreChat(
    message: string,
    sessionId?: string
): Promise<CoreChatResponse | null> {
    return corePost<CoreChatResponse>('/chat', {
        message,
        session_id: sessionId || null,
    });
}

// ─── Health / Status ─────────────────────────────────────────
export async function coreHealth(): Promise<boolean> {
    if (!CORE_ENABLED) return false;
    try {
        const res = await fetch(`${CORE_URL}/health`, {
            signal: AbortSignal.timeout(3000),
        });
        return res.ok;
    } catch {
        return false;
    }
}

export async function coreNodeStatus(): Promise<unknown> {
    return coreGet('/monitor/dashboard');
}

export async function coreAgents(): Promise<unknown> {
    return coreGet('/org/agents');
}

export async function coreMemoryStats(): Promise<unknown> {
    return coreGet('/memory/stats');
}

export async function coreEmotionState(): Promise<unknown> {
    return coreGet('/emotion/state');
}

export { CORE_ENABLED, CORE_URL };
