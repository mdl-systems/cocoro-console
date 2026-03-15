export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/db';
import { validateBody, AgentExecuteSchema } from '@/core/validators';
import { checkRate, requireSession, jsonSuccess, jsonError, logAccess } from '@/core/api-helper';

// ─── Agent Definitions ──────────────────────────────────────

interface AgentDef {
    id: string;
    name: string;
    type: string;
    description: string;
    policy: {
        allowed_tools: string[];
        network_access: boolean;
        filesystem_scope: string;
    };
}

const BUILT_IN_AGENTS: AgentDef[] = [
    {
        id: 'agent_dev',
        name: 'Dev Agent',
        type: 'development',
        description: 'コード生成・技術タスクの実行',
        policy: { allowed_tools: ['code_gen', 'file_write', 'terminal'], network_access: false, filesystem_scope: '/workspace' },
    },
    {
        id: 'agent_research',
        name: 'Research Agent',
        type: 'research',
        description: '情報収集・分析・レポート作成',
        policy: { allowed_tools: ['web_search', 'summarize', 'report_gen'], network_access: true, filesystem_scope: '/reports' },
    },
    {
        id: 'agent_assistant',
        name: 'Personal Assistant',
        type: 'assistant',
        description: 'スケジュール管理・リマインダー・日常タスク',
        policy: { allowed_tools: ['calendar', 'notification', 'email_draft'], network_access: true, filesystem_scope: '/personal' },
    },
    {
        id: 'agent_data',
        name: 'Data Agent',
        type: 'data',
        description: 'データ分析・CSV処理・グラフ生成',
        policy: { allowed_tools: ['data_parse', 'chart_gen', 'csv_export'], network_access: false, filesystem_scope: '/data' },
    },
];

// ─── Routes ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const db = getDatabase();

        // Merge built-in definitions with saved settings
        const agents = BUILT_IN_AGENTS.map(agent => {
            const saved = db.prepare(
                'SELECT enabled, updated_at FROM agent_settings WHERE agent_id = ?'
            ).get(agent.id) as { enabled: number; updated_at: string } | undefined;

            return {
                ...agent,
                status: saved ? (saved.enabled ? 'active' : 'idle') : (agent.id === 'agent_assistant' ? 'active' : 'idle'),
                lastRun: saved?.updated_at,
            };
        });

        return jsonSuccess({
            agents,
            total: agents.length,
            active: agents.filter(a => a.status === 'active').length,
        });
    } catch {
        return jsonError('INTERNAL_ERROR', 'Failed to get agents', 500);
    }
}

export async function POST(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const body = await request.json();
        const validation = validateBody(body, AgentExecuteSchema);

        if (!validation.success) {
            return jsonError('VALIDATION_ERROR', validation.error, 400);
        }

        const { agent_id, task_name } = validation.data;
        const agent = BUILT_IN_AGENTS.find(a => a.id === agent_id);

        if (!agent) {
            return jsonError('NOT_FOUND', 'Agent not found', 404);
        }

        const executionId = uuidv4();
        const now = new Date().toISOString();

        // Save agent execution state
        const db = getDatabase();
        db.prepare(`
      INSERT INTO agent_settings (agent_id, name, type, enabled, policy, updated_at)
      VALUES (?, ?, ?, 1, ?, ?)
      ON CONFLICT(agent_id) DO UPDATE SET enabled = 1, updated_at = ?
    `).run(agent.id, agent.name, agent.type, JSON.stringify(agent.policy), now, now);

        logAccess(request, 'agent_execution', 'started', `agent=${agent_id} task=${task_name}`);

        return jsonSuccess({
            execution_id: executionId,
            agent_id: agent.id,
            agent_name: agent.name,
            task_name,
            status: 'running',
            started_at: now,
        });
    } catch {
        return jsonError('INTERNAL_ERROR', 'Failed to execute agent', 500);
    }
}
