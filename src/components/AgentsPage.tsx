'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, Play, Loader2, Code, Search, Calendar, BarChart3, Shield, type LucideProps } from 'lucide-react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import { apiPost } from '@/lib/api-client';

interface Agent {
    id: string;
    name: string;
    type: string;
    description: string;
    status: string;
    policy: { allowed_tools: string[]; network_access: boolean; filesystem_scope: string };
}

type Icon = ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;

const agentIcons: Record<string, Icon> = {
    development: Code,
    research: Search,
    assistant: Calendar,
    data: BarChart3,
};

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: 'rgba(92, 184, 128, 0.1)', text: 'var(--success)', label: 'アクティブ' },
    running: { bg: 'rgba(216, 120, 152, 0.1)', text: 'var(--accent-primary)', label: '実行中' },
    idle: { bg: 'rgba(200, 170, 180, 0.08)', text: 'var(--foreground-muted)', label: '待機中' },
};

export default function AgentsPage() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [executing, setExecuting] = useState<string | null>(null);

    async function fetchAgents() {
        try {
            const res = await fetch('/api/agent');
            const data = await res.json();
            setAgents(data.agents || []);
        } catch { /* ignore */ } finally { setLoading(false); }
    }

    useEffect(() => { fetchAgents(); }, []);

    async function executeAgent(agentId: string) {
        setExecuting(agentId);
        try {
            await apiPost('/api/agent', {
                agent_id: agentId,
                task_name: 'テストタスク',
                description: 'テスト実行',
            });
            await fetchAgents();
        } catch { /* ignore */ } finally {
            setTimeout(() => setExecuting(null), 2000);
        }
    }

    return (
        <div className="flex-1 flex flex-col h-screen overflow-y-auto">
            <div className="flex items-center justify-between px-8 py-6" style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                    <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>エージェント</h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>サンドボックス環境で安全に実行</p>
                </div>
                <div className="flex items-center gap-2">
                    <Shield size={16} style={{ color: 'var(--success)' }} />
                    <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>サンドボックス保護</span>
                </div>
            </div>

            <div className="p-8">
                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent-primary)' }} /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {agents.map((agent, idx) => {
                            const AgentIcon = agentIcons[agent.type] || Bot;
                            const status = statusConfig[agent.status] || statusConfig.idle;
                            const isExecuting = executing === agent.id;

                            return (
                                <motion.div
                                    key={agent.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="glass-panel p-6 hover:border-[var(--border-active)] transition-all"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                                style={{ background: 'rgba(216, 120, 152, 0.1)' }}
                                            >
                                                <AgentIcon size={20} style={{ color: 'var(--accent-primary)' }} />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{agent.name}</h3>
                                                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{agent.description}</p>
                                            </div>
                                        </div>
                                        <span
                                            className="text-xs px-2 py-1 rounded-full"
                                            style={{ background: status.bg, color: status.text }}
                                        >
                                            {status.label}
                                        </span>
                                    </div>

                                    {/* Policy */}
                                    <div className="mb-4 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--background-tertiary)', color: 'var(--foreground-muted)' }}>
                                                scope: {agent.policy.filesystem_scope}
                                            </span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded"
                                                style={{
                                                    background: agent.policy.network_access ? 'rgba(92, 184, 128, 0.1)' : 'rgba(208, 96, 96, 0.1)',
                                                    color: agent.policy.network_access ? 'var(--success)' : 'var(--danger)',
                                                }}>
                                                {agent.policy.network_access ? 'ネットワーク可' : 'オフライン'}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {agent.policy.allowed_tools.map(tool => (
                                                <span key={tool} className="text-[10px] px-1.5 py-0.5 rounded"
                                                    style={{
                                                        background: 'rgba(216, 120, 152, 0.08)',
                                                        color: 'var(--accent-primary)',
                                                    }}>
                                                    {tool}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Execute */}
                                    <button
                                        onClick={() => executeAgent(agent.id)}
                                        disabled={isExecuting}
                                        className="btn-primary text-xs w-full flex items-center justify-center gap-2"
                                    >
                                        {isExecuting ? (
                                            <><Loader2 size={14} className="animate-spin" /> 実行中...</>
                                        ) : (
                                            <><Play size={14} /> タスクを実行</>
                                        )}
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
