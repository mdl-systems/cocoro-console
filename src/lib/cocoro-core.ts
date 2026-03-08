/**
 * src/lib/cocoro-core.ts
 *
 * cocoro-sdk の薄いラッパー。
 * - COCORO_CORE_ENABLED / CORE_URL / CORE_API_KEY はここで一元管理
 * - 既存APIルートが import する関数シグネチャを完全互換で維持
 * - 内部では @mdl-systems/cocoro-sdk の CocoroClient を使用
 */

import { CocoroClient } from '@mdl-systems/cocoro-sdk'
import type { EmotionState, MemoryStats, MemorySearchResult } from '@mdl-systems/cocoro-sdk'

// ─── Config ────────────────────────────────────────────────────
export const CORE_URL = process.env.COCORO_CORE_URL || 'http://192.168.50.92:8001'
export const CORE_ENABLED = process.env.COCORO_CORE_ENABLED === 'true'

// ─── Singleton client ─────────────────────────────────────────
let _client: CocoroClient | null = null

function getClient(): CocoroClient | null {
    if (!CORE_ENABLED) return null
    const apiKey = process.env.COCORO_CORE_API_KEY
    if (!apiKey) {
        console.warn('[cocoro-core] COCORO_CORE_API_KEY が未設定です')
        return null
    }
    if (!_client) {
        _client = new CocoroClient({ baseUrl: CORE_URL, apiKey })
    }
    return _client
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
export async function coreChat(
    message: string,
    sessionId?: string
): Promise<CoreChatResponse | null> {
    const client = getClient()
    if (!client) return null
    try {
        const res = await client.chat.send({ message, sessionId })
        return {
            response: res.text,
            session_id: res.sessionId,
            action: res.action,
            emotion: res.emotion.dominant,
            task_id: null,
        }
    } catch (err) {
        console.error('[cocoro-core] chat error:', (err as Error).message)
        return null
    }
}

export async function coreChatStream(message: string, sessionId?: string) {
    const client = getClient()
    if (!client) return null
    try {
        return await client.chat.stream({ message, sessionId })
    } catch (err) {
        console.error('[cocoro-core] stream error:', (err as Error).message)
        return null
    }
}

// ─── Health ───────────────────────────────────────────────────
export async function coreHealth(): Promise<boolean> {
    const client = getClient()
    if (!client) return false
    try {
        const h = await client.health.check()
        return h.status === 'ok'
    } catch {
        return false
    }
}

// ─── Monitor ─────────────────────────────────────────────────
export async function coreNodeStatus(): Promise<CoreDashboard | null> {
    const client = getClient()
    if (!client) return null
    try {
        const d = await client.monitor.getDashboard()
        return {
            status: d.status,
            uptime: d.uptime,
            cpu_usage: d.cpu,
            memory_usage: d.memory,
            active_agents: d.activeConnections,
            tasks_today: d.requestsPerMin,
        }
    } catch (err) {
        console.error('[cocoro-core] monitor error:', (err as Error).message)
        return null
    }
}

// ─── Emotion ─────────────────────────────────────────────────
export async function coreEmotionState(): Promise<CoreEmotionState | null> {
    const client = getClient()
    if (!client) return null
    try {
        const e: EmotionState = await client.emotion.getState()
        const valence = e.happiness - e.sadness - e.anger * 0.5 - e.fear * 0.3
        const arousal = e.surprise + e.anger * 0.5 + e.fear * 0.3 + e.happiness * 0.2
        return {
            current_emotion: e.dominant,
            valence: Math.max(-1, Math.min(1, valence)),
            arousal: Math.max(0, Math.min(1, arousal)),
            sync_rate: e.trust,
            dominant_trait: e.dominant,
            updated_at: new Date().toISOString(),
        }
    } catch (err) {
        console.error('[cocoro-core] emotion error:', (err as Error).message)
        return null
    }
}

// ─── Memory ──────────────────────────────────────────────────
export async function coreMemoryStats(): Promise<CoreMemoryStats | null> {
    const client = getClient()
    if (!client) return null
    try {
        const s: MemoryStats = await client.memory.getStats()
        return {
            total: s.shortTermCount + s.longTermCount + s.episodicCount,
            short_term: s.shortTermCount,
            long_term: s.longTermCount,
            vector: s.episodicCount,
            last_updated: s.lastConsolidated ?? new Date().toISOString(),
        }
    } catch (err) {
        console.error('[cocoro-core] memory stats error:', (err as Error).message)
        return null
    }
}

export async function coreMemoryList(type?: string, limit = 50): Promise<CoreMemoryEntry[] | null> {
    const client = getClient()
    if (!client) return null
    try {
        const entries = await client.memory.getShortTerm({ limit })
        return entries.map(e => ({
            id: e.id,
            type: 'short_term' as const,
            content: e.content,
            category: 'conversation',
            importance: e.importance ?? 0.5,
            created_at: e.timestamp,
        }))
    } catch (err) {
        console.error('[cocoro-core] memory list error:', (err as Error).message)
        return null
    }
}

export async function coreMemorySearch(query: string): Promise<CoreMemoryEntry[] | null> {
    const client = getClient()
    if (!client) return null
    try {
        const results: MemorySearchResult[] = await client.memory.search({ query, limit: 20 })
        return results.map(r => ({
            id: r.id,
            type: r.type as CoreMemoryEntry['type'],
            content: r.content,
            category: 'search',
            importance: r.score,
            created_at: r.timestamp,
        }))
    } catch (err) {
        console.error('[cocoro-core] memory search error:', (err as Error).message)
        return null
    }
}

// ─── Agents ──────────────────────────────────────────────────
export async function coreAgents(): Promise<CoreAgent[] | null> {
    const client = getClient()
    if (!client) return null
    try {
        const agents = await client.agent.list()
        return agents.map(a => ({
            agent_id: a.id,
            name: a.name,
            type: a.role,
            status: a.status,
            enabled: a.status !== 'paused' && a.status !== 'error',
            last_active: a.currentTask,
        }))
    } catch (err) {
        console.error('[cocoro-core] agents error:', (err as Error).message)
        return null
    }
}