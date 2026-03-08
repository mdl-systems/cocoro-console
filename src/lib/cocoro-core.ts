/**
 * Cocoro Core API Client
 *
 * Handles JWT token acquisition and authenticated requests to cocoro-core.
 * Falls back gracefully when COCORO_CORE_ENABLED=false or core is unreachable.
 */

const CORE_URL = process.env.COCORO_CORE_URL || 'http://192.168.50.92:8001';
const CORE_API_KEY = process.env.COCORO_CORE_API_KEY || '';
const CORE_ENABLED = process.env.COCORO_CORE_ENABLED === 'true';

// ─── Auth helper ────────────────────────────────────────────
// cocoro-core uses the API key directly as a Bearer token (no JWT endpoint).
function getAuthHeaders() {
    if (!CORE_API_KEY) return null;
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CORE_API_KEY}`,
    };
}

// ─── Core request helpers ─────────────────────────────────────
async function corePost<T>(path: string, body: unknown): Promise<T | null> {
    if (!CORE_ENABLED) return null;
    const headers = getAuthHeaders();
    if (!headers) return null;

    try {
        const res = await fetch(`${CORE_URL}${path}`, {
            method: 'POST',
            headers,
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
    if (!CORE_ENABLED) return null;
    const headers = getAuthHeaders();
    if (!headers) return null;

    try {
        const res = await fetch(`${CORE_URL}${path}`, {
            headers: { 'Authorization': headers.Authorization },
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

// ─── Health ───────────────────────────────────────────────────
export async function coreHealth(): Promise<boolean> {
    if (!CORE_ENABLED) return false;
    try {
        const res = await fetch(`${CORE_URL}/health`, { signal: AbortSignal.timeout(3000) });
        return res.ok;
    } catch {
        return false;
    }
}

// ─── Node / Monitor Dashboard ─────────────────────────────────
export interface CoreDashboard {
    status: string;
    uptime: number;
    cpu_usage: number;
    memory_usage: number;
    active_agents: number;
    tasks_today: number;
    emotion?: string;
    sync_rate?: number;
}

export async function coreNodeStatus(): Promise<CoreDashboard | null> {
    return coreGet<CoreDashboard>('/monitor/dashboard');
}

// ─── Emotion State ────────────────────────────────────────────
export interface CoreEmotionState {
    current_emotion: string;
    valence: number;        // -1.0 ~ 1.0
    arousal: number;        // 0.0 ~ 1.0
    sync_rate: number;      // 0.0 ~ 1.0
    dominant_trait: string;
    updated_at: string;
}

export async function coreEmotionState(): Promise<CoreEmotionState | null> {
    return coreGet<CoreEmotionState>('/emotion/state');
}

// ─── Memory ───────────────────────────────────────────────────
export interface CoreMemoryEntry {
    id: string;
    type: 'short_term' | 'long_term' | 'vector';
    content: string;
    category: string;
    importance: number;
    created_at: string;
    metadata?: Record<string, unknown>;
}

export interface CoreMemoryStats {
    total: number;
    short_term: number;
    long_term: number;
    vector: number;
    last_updated: string;
}

export async function coreMemoryStats(): Promise<CoreMemoryStats | null> {
    return coreGet<CoreMemoryStats>('/memory/stats');
}

export async function coreMemoryList(
    type?: string,
    limit = 50
): Promise<CoreMemoryEntry[] | null> {
    const q = type ? `?type=${type}&limit=${limit}` : `?limit=${limit}`;
    const res = await coreGet<{ memories: CoreMemoryEntry[] }>(`/memory/list${q}`);
    return res?.memories ?? null;
}

export async function coreMemorySearch(query: string): Promise<CoreMemoryEntry[] | null> {
    const res = await corePost<{ results: CoreMemoryEntry[] }>(
        '/memory/search',
        { query, limit: 20 }
    );
    return res?.results ?? null;
}

// ─── Agents ───────────────────────────────────────────────────
export interface CoreAgent {
    agent_id: string;
    name: string;
    type: string;
    status: string;
    enabled: boolean;
    last_active?: string;
}

export async function coreAgents(): Promise<CoreAgent[] | null> {
    const res = await coreGet<{ agents: CoreAgent[] }>('/org/agents');
    return res?.agents ?? null;
}

export { CORE_ENABLED, CORE_URL };
