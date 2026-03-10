/**
 * src/lib/cocoro-core.ts
 *
 * cocoro-core HTTP API の直接クライアント。
 * @mdl-systems/cocoro-sdk に依存せず、fetch で直接呼び出す。
 * - JWT トークンを globalThis にキャッシュ（HMR・Docker両対応）
 * - CORE_ENABLED=false 時は全関数が null を返す（モックフォールバック）
 */

// ─── Config ────────────────────────────────────────────────────
export const CORE_URL = process.env.COCORO_CORE_URL || 'http://localhost:8001'
export const CORE_ENABLED = process.env.COCORO_CORE_ENABLED === 'true'

// ─── JWT キャッシュ（globalThis で HMR をまたいで保持）─────────
declare global {
    // eslint-disable-next-line no-var
    var __cocoroJwt: { token: string; expiresAt: number } | null | undefined
}

async function getToken(): Promise<string | null> {
    const apiKey = process.env.COCORO_CORE_API_KEY
    if (!apiKey) {
        console.warn('[cocoro-core] COCORO_CORE_API_KEY が未設定です')
        return null
    }

    const now = Date.now()
    // キャッシュが有効なら再利用（5分前に期限切れとみなす）
    if (globalThis.__cocoroJwt && globalThis.__cocoroJwt.expiresAt > now + 5 * 60 * 1000) {
        return globalThis.__cocoroJwt.token
    }

    try {
        const res = await fetch(`${CORE_URL}/auth/token`, {
            method: 'POST',
            headers: {
                'X-API-Key': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ api_key: apiKey }),
            signal: AbortSignal.timeout(5000),
        })

        if (!res.ok) {
            // 501 = /auth/token 未実装 → API キーを直接 Bearer として使用
            if (res.status === 501 || res.status === 404) {
                console.info(`[cocoro-core] /auth/token は未実装 (${res.status})。API キーを直接 Bearer として使用します`)
                // 短いキャッシュ（30分）で API キー自体をトークンとして保存
                globalThis.__cocoroJwt = { token: apiKey, expiresAt: now + 30 * 60 * 1000 }
                return apiKey
            }
            const text = await res.text()
            console.error(`[cocoro-core] /auth/token failed ${res.status}:`, text)
            // 認証失敗でもフォールバックとして API キーを試みる
            return apiKey
        }

        const data = await res.json() as { access_token: string; expires_in?: number }
        const token = data.access_token
        const expiresIn = (data.expires_in ?? 3600) * 1000
        globalThis.__cocoroJwt = { token, expiresAt: now + expiresIn }
        return token
    } catch (err) {
        console.error('[cocoro-core] token fetch error:', (err as Error).message)
        // ネットワークエラーの場合も API キーを直接使う
        return apiKey
    }
}

async function coreGet<T>(path: string): Promise<T | null> {
    if (!CORE_ENABLED) return null
    const token = await getToken()
    if (!token) return null
    try {
        const res = await fetch(`${CORE_URL}${path}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
        return await res.json() as T
    } catch (err) {
        console.error(`[cocoro-core] GET ${path} error:`, (err as Error).message)
        return null
    }
}

async function corePost<T>(path: string, body: unknown): Promise<T | null> {
    if (!CORE_ENABLED) return null
    const token = await getToken()
    if (!token) return null
    try {
        const res = await fetch(`${CORE_URL}${path}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
        return await res.json() as T
    } catch (err) {
        console.error(`[cocoro-core] POST ${path} error:`, (err as Error).message)
        return null
    }
}

// ─── 後方互換型定義 ──────────────────────────────────────────

export interface CoreChatResponse {
    response: string
    session_id: string
    action: string
    emotion: string
    task_id?: string | null
}

export interface CoreDashboard {
    status: string
    uptime: number
    cpu_usage: number
    memory_usage: number
    active_agents: number
    tasks_today: number
    emotion?: string
    sync_rate?: number
}

export interface CoreEmotionState {
    current_emotion: string
    valence: number
    arousal: number
    sync_rate: number
    dominant_trait: string
    updated_at: string
}

export interface CoreMemoryEntry {
    id: string
    type: 'short_term' | 'long_term' | 'vector'
    content: string
    category: string
    importance: number
    created_at: string
    metadata?: Record<string, unknown>
}

export interface CoreMemoryStats {
    total: number
    short_term: number
    long_term: number
    vector: number
    last_updated: string
}

export interface CoreAgent {
    agent_id: string
    name: string
    type: string
    status: string
    enabled: boolean
    last_active?: string
}

// ─── Chat ─────────────────────────────────────────────────────

interface RawChatResponse {
    response?: string
    message?: string
    session_id?: string
    action?: string
    emotion?: string | { dominant?: string }
}

export async function coreChat(
    message: string,
    sessionId?: string
): Promise<CoreChatResponse | null> {
    const data = await corePost<RawChatResponse>('/chat', { message, session_id: sessionId })
    if (!data) return null
    const emotionRaw = data.emotion
    const emotion = typeof emotionRaw === 'string'
        ? emotionRaw
        : (emotionRaw?.dominant ?? 'neutral')
    return {
        response: data.response ?? data.message ?? '',
        session_id: data.session_id ?? '',
        action: data.action ?? 'talk',
        emotion,
        task_id: null,
    }
}

// SSE ストリーミング: ReadableStream<string> を返す
// /chat/stream が利用できない場合は /chat にフォールバック（JSON → SSE 変換）
export async function coreChatStream(
    message: string,
    sessionId?: string
): Promise<ReadableStream<string> | null> {
    if (!CORE_ENABLED) return null
    const token = await getToken()
    if (!token) return null

    // まず /chat/stream を試みる
    try {
        const res = await fetch(`${CORE_URL}/chat/stream`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
            },
            body: JSON.stringify({ message, session_id: sessionId }),
        })

        if (res.ok) {
            return res.body
                ? res.body.pipeThrough(new TextDecoderStream())
                : null
        }

        // 404 の場合は /chat にフォールバック
        if (res.status !== 404) {
            console.error(`[cocoro-core] stream error: HTTP ${res.status}`)
            return null
        }
        console.info('[cocoro-core] /chat/stream は 404。/chat エンドポイントにフォールバック')
    } catch (err) {
        console.error('[cocoro-core] stream fetch error:', (err as Error).message)
        return null
    }

    // /chat にフォールバック: JSON レスポンスを SSE 形式の ReadableStream に変換
    try {
        const res = await fetch(`${CORE_URL}/chat`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message, session_id: sessionId }),
        })

        if (!res.ok) {
            console.error(`[cocoro-core] /chat fallback error: HTTP ${res.status}`)
            return null
        }

        const data = await res.json() as {
            response?: string; message?: string;
            session_id?: string; action?: string;
            emotion?: string | { dominant?: string };
        }
        const text = data.response ?? data.message ?? ''
        const sessionIdOut = data.session_id ?? sessionId ?? ''
        const action = data.action ?? 'chat'
        const emotionRaw = data.emotion
        const emotion = typeof emotionRaw === 'string' ? emotionRaw : (emotionRaw?.dominant ?? 'neutral')

        // SSE 形式に変換してストリームとして返す
        const encoder = new TextEncoder()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stream = new ReadableStream<any>({
            start(controller) {
                // テキストをチャンクとして送出
                const chunkSize = 10
                for (let i = 0; i < text.length; i += chunkSize) {
                    const chunk = text.slice(i, i + chunkSize)
                    controller.enqueue(encoder.encode(
                        `data: ${JSON.stringify({ text: chunk })}\n\n`
                    ))
                }
                // 完了メタデータ
                controller.enqueue(encoder.encode(
                    `data: ${JSON.stringify({ session_id: sessionIdOut, action, emotion })}\n\n`
                ))
                controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                controller.close()
            }
        })
        return stream.pipeThrough(new TextDecoderStream())
    } catch (err) {
        console.error('[cocoro-core] /chat fallback fetch error:', (err as Error).message)
        return null
    }
}

// ─── Health ───────────────────────────────────────────────────
export async function coreHealth(): Promise<boolean> {
    try {
        const res = await fetch(`${CORE_URL}/health`, {
            signal: AbortSignal.timeout(3000),
        })
        if (!res.ok) return false
        const data = await res.json() as { status?: string }
        return data.status === 'ok'
    } catch {
        return false
    }
}

// ─── Monitor ─────────────────────────────────────────────────

interface RawMonitor {
    status?: string
    uptime?: number
    cpu?: number
    memory?: number
    activeConnections?: number
    requestsPerMin?: number
    active_connections?: number
    requests_per_min?: number
}

export async function coreNodeStatus(): Promise<CoreDashboard | null> {
    const d = await coreGet<RawMonitor>('/monitor')
    if (!d) return null
    return {
        status: d.status ?? 'ok',
        uptime: d.uptime ?? 0,
        cpu_usage: d.cpu ?? 0,
        memory_usage: d.memory ?? 0,
        active_agents: d.activeConnections ?? d.active_connections ?? 0,
        tasks_today: d.requestsPerMin ?? d.requests_per_min ?? 0,
    }
}

// ─── Emotion ─────────────────────────────────────────────────

interface RawEmotion {
    dominant?: string
    happiness?: number
    sadness?: number
    anger?: number
    fear?: number
    surprise?: number
    trust?: number
    current_emotion?: string
    valence?: number
    arousal?: number
    sync_rate?: number
    dominant_trait?: string
}

export async function coreEmotionState(): Promise<CoreEmotionState | null> {
    const e = await coreGet<RawEmotion>('/emotion/state')
    if (!e) return null

    // 8次元ベクトル形式と既にまとまった形式の両方に対応
    if (e.current_emotion) {
        return {
            current_emotion: e.current_emotion,
            valence: e.valence ?? 0,
            arousal: e.arousal ?? 0,
            sync_rate: e.sync_rate ?? 0,
            dominant_trait: e.dominant_trait ?? e.current_emotion,
            updated_at: new Date().toISOString(),
        }
    }

    const happiness = e.happiness ?? 0
    const sadness = e.sadness ?? 0
    const anger = e.anger ?? 0
    const fear = e.fear ?? 0
    const surprise = e.surprise ?? 0
    const trust = e.trust ?? 0
    const valence = happiness - sadness - anger * 0.5 - fear * 0.3
    const arousal = surprise + anger * 0.5 + fear * 0.3 + happiness * 0.2

    return {
        current_emotion: e.dominant ?? 'neutral',
        valence: Math.max(-1, Math.min(1, valence)),
        arousal: Math.max(0, Math.min(1, arousal)),
        sync_rate: trust,
        dominant_trait: e.dominant ?? 'neutral',
        updated_at: new Date().toISOString(),
    }
}

// ─── Memory ──────────────────────────────────────────────────

interface RawMemoryStats {
    short_term_count?: number
    long_term_count?: number
    episodic_count?: number
    shortTermCount?: number
    longTermCount?: number
    episodicCount?: number
    last_consolidated?: string
    lastConsolidated?: string
}

export async function coreMemoryStats(): Promise<CoreMemoryStats | null> {
    const s = await coreGet<RawMemoryStats>('/memory/stats')
    if (!s) return null
    const stm = s.shortTermCount ?? s.short_term_count ?? 0
    const ltm = s.longTermCount ?? s.long_term_count ?? 0
    const ep = s.episodicCount ?? s.episodic_count ?? 0
    return {
        total: stm + ltm + ep,
        short_term: stm,
        long_term: ltm,
        vector: ep,
        last_updated: s.lastConsolidated ?? s.last_consolidated ?? new Date().toISOString(),
    }
}

interface RawMemoryEntry {
    id?: string
    content?: string
    importance?: number
    timestamp?: string
    created_at?: string
}

export async function coreMemoryList(_type?: string, limit = 50): Promise<CoreMemoryEntry[] | null> {
    const entries = await coreGet<RawMemoryEntry[]>(`/memory/conversations?limit=${limit}`)
    if (!entries) return null
    return entries.map(e => ({
        id: e.id ?? '',
        type: 'short_term' as const,
        content: e.content ?? '',
        category: 'conversation',
        importance: e.importance ?? 0.5,
        created_at: e.timestamp ?? e.created_at ?? new Date().toISOString(),
    }))
}

interface RawSearchResult {
    id?: string
    type?: string
    content?: string
    score?: number
    timestamp?: string
}

export async function coreMemorySearch(query: string): Promise<CoreMemoryEntry[] | null> {
    const results = await coreGet<RawSearchResult[]>(`/memory/search?q=${encodeURIComponent(query)}&limit=20`)
    if (!results) return null
    return results.map(r => ({
        id: r.id ?? '',
        type: (r.type as CoreMemoryEntry['type']) ?? 'long_term',
        content: r.content ?? '',
        category: 'search',
        importance: r.score ?? 0.5,
        created_at: r.timestamp ?? new Date().toISOString(),
    }))
}

// ─── Agents ──────────────────────────────────────────────────

interface RawAgent {
    id?: string
    name?: string
    department?: string
    role?: string
    status?: string
    currentTask?: string
    current_task?: string
}

export async function coreAgents(): Promise<CoreAgent[] | null> {
    const data = await coreGet<{ agents?: RawAgent[] } | RawAgent[]>('/agents')
    if (!data) return null
    const agents = Array.isArray(data) ? data : (data.agents ?? [])
    return agents.map(a => ({
        agent_id: a.id ?? '',
        name: a.name ?? '',
        type: a.role ?? a.department ?? 'agent',
        status: a.status ?? 'idle',
        enabled: a.status !== 'offline',
        last_active: a.currentTask ?? a.current_task ?? undefined,
    }))
}