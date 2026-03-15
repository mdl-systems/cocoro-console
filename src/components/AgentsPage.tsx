'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bot, Play, Loader2, Search, BarChart3, Megaphone, Code,
    Activity, CheckCircle2, XCircle, Clock, Zap, RefreshCw,
    ChevronRight, Send, X, AlertCircle, type LucideProps,
} from 'lucide-react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';

// ─── 型定義 ──────────────────────────────────────────────
interface AgentInfo {
    id: string;
    name: string;
    department: string;
    status: 'idle' | 'busy' | 'offline';
    currentTask: string | null;
    completedTasks: number;
    failedTasks: number;
    avgResponseTimeMs: number;
    lastActiveAt: string | null;
}

interface OrgStatus {
    departments: Record<string, { agents: number; activeTasks: number }>;
    totalTasks: { queued: number; running: number; completed: number; failed?: number };
}

interface Task {
    task_id: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    title: string;
    assignedTo: string | null;
    progress: number;
    currentStep: string | null;
    result: unknown;
    error: string | null;
    createdAt: string;
}

interface Stats {
    total: number;
    byStatus: Record<string, number>;
    byAgent: Array<{ agent: string; count: number; avgDuration: number }>;
    recentTasks: Task[];
}

// ─── アイコン・カラーマップ ───────────────────────────────
type Icon = ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>>;

const deptIcons: Record<string, Icon> = {
    research: Search,
    development: Code,
    marketing: Megaphone,
    data: BarChart3,
    default: Bot,
};

const deptColors: Record<string, string> = {
    research: '#06b6d4',
    development: '#34d399',
    marketing: '#f472b6',
    data: '#f59e0b',
    default: '#a78bfa',
};

const statusBadge = {
    idle: { color: 'var(--foreground-muted)', bg: 'rgba(200,170,180,0.08)', label: '待機中' },
    busy: { color: 'var(--accent-primary)', bg: 'rgba(216,120,152,0.1)', label: '実行中' },
    offline: { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', label: 'オフライン' },
};

const taskStatusIcon: Record<string, React.ReactNode> = {
    queued: <Clock size={12} className="text-amber-400" />,
    running: <Loader2 size={12} className="animate-spin text-blue-400" />,
    completed: <CheckCircle2 size={12} className="text-emerald-400" />,
    failed: <XCircle size={12} className="text-red-400" />,
};

// ─── サブコンポーネント ────────────────────────────────────
function AgentCard({ agent, onRun }: { agent: AgentInfo; onRun: (agent: AgentInfo) => void }) {
    const Icon = deptIcons[agent.department] ?? deptIcons.default;
    const color = deptColors[agent.department] ?? deptColors.default;
    const st = statusBadge[agent.status] ?? statusBadge.idle;

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-5 hover:border-[var(--border-active)] transition-all cursor-pointer"
            onClick={() => onRun(agent)}
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                        <Icon size={18} style={{ color }} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{agent.name}</h3>
                        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{agent.department}</p>
                    </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: st.bg, color: st.color }}>
                    {agent.status === 'busy' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1 animate-pulse" />}
                    {st.label}
                </span>
            </div>

            {agent.currentTask && (
                <p className="text-[11px] mb-3 truncate" style={{ color: 'var(--foreground-muted)' }}>
                    🔄 {agent.currentTask}
                </p>
            )}

            <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex gap-4 text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
                    <span className="flex items-center gap-1">
                        <CheckCircle2 size={11} className="text-emerald-400" /> {agent.completedTasks}
                    </span>
                    <span className="flex items-center gap-1">
                        <XCircle size={11} className="text-red-400" /> {agent.failedTasks}
                    </span>
                </div>
                <button
                    className="flex items-center gap-1 text-[11px] px-3 py-1 rounded-lg transition-all hover:translate-y-[-1px]"
                    style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
                    onClick={(e) => { e.stopPropagation(); onRun(agent); }}
                >
                    <Play size={10} /> タスク投入
                </button>
            </div>
        </motion.div>
    );
}

function TaskRow({ task }: { task: Task }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="rounded-lg p-3 transition-colors hover:bg-white/[0.02]"
            style={{ border: '1px solid var(--border)', cursor: 'pointer' }}
            onClick={() => setOpen(v => !v)}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {taskStatusIcon[task.status]}
                    <span className="text-[12px] truncate max-w-[220px]" style={{ color: 'var(--foreground)' }}>{task.title}</span>
                </div>
                <div className="flex items-center gap-3">
                    {task.status === 'running' && (
                        <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1 rounded-full" style={{ background: 'var(--background-tertiary)' }}>
                                <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${task.progress}%` }} />
                            </div>
                            <span className="text-[10px] text-blue-400">{task.progress}%</span>
                        </div>
                    )}
                    <ChevronRight size={12} className={`transition-transform ${open ? 'rotate-90' : ''}`}
                        style={{ color: 'var(--foreground-muted)' }} />
                </div>
            </div>
            {open && (
                <div className="mt-2 pt-2 text-[11px] space-y-1" style={{ borderTop: '1px solid var(--border)', color: 'var(--foreground-muted)' }}>
                    <div>エージェント: <span style={{ color: 'var(--foreground)' }}>{task.assignedTo ?? '—'}</span></div>
                    {task.currentStep && <div>現在: <span style={{ color: 'var(--foreground)' }}>{task.currentStep}</span></div>}
                    {task.result != null && (
                        <div className="mt-1 p-2 rounded" style={{ background: 'var(--background-tertiary)' }}>
                            <pre className="whitespace-pre-wrap text-[10px]">{JSON.stringify(task.result, null, 2)}</pre>
                        </div>
                    )}

                    {task.error && <div className="text-red-400">エラー: {task.error}</div>}
                </div>
            )}
        </div>
    );
}

// ─── タスク投入モーダル ────────────────────────────────────
function TaskModal({ agent, onClose, onSubmit }: {
    agent: AgentInfo | null;
    onClose: () => void;
    onSubmit: (title: string, description: string, type: string) => Promise<void>;
}) {
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [type, setType] = useState('auto');
    const [submitting, setSubmitting] = useState(false);

    const color = agent ? (deptColors[agent.department] ?? deptColors.default) : '#a78bfa';

    const presets = agent?.department === 'research'
        ? ['AIトレンドをリサーチして', '競合他社を分析して', '市場規模を調査して']
        : agent?.department === 'development'
            ? ['バグレポートをまとめて', 'API仕様書を生成して', 'コードレビューをして']
            : ['SNSの投稿内容を考えて', 'マーケティング戦略を立てて', '週次レポートを作成して'];

    async function handleSubmit() {
        if (!title.trim()) return;
        setSubmitting(true);
        try {
            await onSubmit(title, desc, type);
            onClose();
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md rounded-2xl p-6"
                style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>

                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                            タスク投入
                        </h3>
                        {agent && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
                                → {agent.name}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/[0.06] transition-colors">
                        <X size={16} style={{ color: 'var(--foreground-muted)' }} />
                    </button>
                </div>

                {/* プリセット */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                    {presets.map(p => (
                        <button key={p} onClick={() => setTitle(p)}
                            className="text-[10px] px-2.5 py-1 rounded-lg transition-colors hover:opacity-80"
                            style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
                            {p}
                        </button>
                    ))}
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-[11px] mb-1 block" style={{ color: 'var(--foreground-muted)' }}>タスクタイトル *</label>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="例: AIトレンドをリサーチして"
                            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                            style={{
                                background: 'var(--background-tertiary)',
                                border: '1px solid var(--border)',
                                color: 'var(--foreground)',
                            }}
                            onFocus={e => (e.currentTarget.style.borderColor = color)}
                            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                        />
                    </div>
                    <div>
                        <label className="text-[11px] mb-1 block" style={{ color: 'var(--foreground-muted)' }}>詳細（任意）</label>
                        <textarea
                            value={desc}
                            onChange={e => setDesc(e.target.value)}
                            rows={3}
                            placeholder="タスクの詳細説明..."
                            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none transition-all"
                            style={{
                                background: 'var(--background-tertiary)',
                                border: '1px solid var(--border)',
                                color: 'var(--foreground)',
                            }}
                        />
                    </div>
                    <div>
                        <label className="text-[11px] mb-1 block" style={{ color: 'var(--foreground-muted)' }}>タスクタイプ</label>
                        <select value={type} onChange={e => setType(e.target.value)}
                            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                            style={{
                                background: 'var(--background-tertiary)',
                                border: '1px solid var(--border)',
                                color: 'var(--foreground)',
                            }}>
                            <option value="auto">自動判定</option>
                            <option value="research">research — リサーチ</option>
                            <option value="analyze">analyze — 分析</option>
                            <option value="write">write — 文章生成</option>
                            <option value="schedule">schedule — スケジュール</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-3 mt-5">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
                        style={{ border: '1px solid var(--border)', color: 'var(--foreground-muted)' }}>
                        キャンセル
                    </button>
                    <button onClick={handleSubmit} disabled={!title.trim() || submitting}
                        className="flex-1 btn-primary py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-40">
                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        {submitting ? '送信中...' : 'タスク投入'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

// ─── メインページ ─────────────────────────────────────────
export default function AgentsPage() {
    const [agents, setAgents] = useState<AgentInfo[]>([]);
    const [orgStatus, setOrgStatus] = useState<OrgStatus | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [recentTasks, setRecentTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalAgent, setModalAgent] = useState<AgentInfo | null>(null);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const [agentOnline, setAgentOnline] = useState(true);

    const showToast = (msg: string, ok = true) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchAll = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);

        try {
            const [agentsRes, orgRes, statsRes, tasksRes] = await Promise.all([
                fetch('/api/agent-proxy?path=/agents'),
                fetch('/api/agent-proxy?path=/org/status'),
                fetch('/api/agent-proxy?path=/stats'),
                fetch('/api/agent-proxy?path=/tasks?limit=10'),
            ]);

            const agentsData = await agentsRes.json();
            const orgData = await orgRes.json();
            const statsData = await statsRes.json();
            const tasksData = await tasksRes.json();

            if (agentsData.data?.agents) setAgents(agentsData.data.agents);
            if (agentsData.data?.mode?.includes('mock')) setAgentOnline(false);
            else setAgentOnline(true);
            if (orgData.data) setOrgStatus(orgData.data);
            if (statsData.data) setStats(statsData.data);
            if (tasksData.data?.tasks) setRecentTasks(tasksData.data.tasks);

        } catch { /* ignore */ } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);
    // 5秒ごとに自動リフレッシュ
    useEffect(() => {
        const id = setInterval(() => fetchAll(true), 30_000); // 30秒ごと（429対策）
        return () => clearInterval(id);
    }, [fetchAll]);

    async function handleTaskSubmit(title: string, description: string, type: string) {
        const body = {
            title,
            description: description || undefined,
            type: type === 'auto' ? undefined : type,
            assignTo: modalAgent?.id,
        };

        const res = await fetch('/api/agent-proxy?path=/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();

        if (data.success) {
            showToast(`✓ タスクを投入しました (ID: ${data.data?.task_id?.slice(0, 8)}...)`, true);
            setTimeout(() => fetchAll(true), 1000);
        } else {
            showToast(`✗ 投入失敗: ${data.error}`, false);
            throw new Error(data.error);
        }
    }

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent-primary)' }} />
            </div>
        );
    }

    const totalTasks = orgStatus?.totalTasks;

    return (
        <div className="flex-1 flex flex-col h-screen overflow-y-auto">
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-8 py-5"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                        <Activity size={20} style={{ color: 'var(--accent-primary)' }} />
                        エージェント管理
                    </h2>
                    <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--foreground-muted)' }}>
                        {agentOnline ? (
                            <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> cocoro-agent 接続中</>
                        ) : (
                            <><AlertCircle size={11} className="text-amber-400" /> cocoro-agent オフライン（モックデータ）</>
                        )}
                    </p>
                </div>
                <button onClick={() => fetchAll(true)} disabled={refreshing}
                    className="p-2 rounded-xl transition-colors hover:bg-white/[0.06]"
                    style={{ border: '1px solid var(--border)' }}>
                    <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''}
                        style={{ color: 'var(--foreground-muted)' }} />
                </button>
            </div>

            <div className="p-6 space-y-6">
                {/* 組織サマリー */}
                {totalTasks && (
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: '待機中', value: totalTasks.queued, color: '#f59e0b', icon: Clock },
                            { label: '実行中', value: totalTasks.running, color: '#06b6d4', icon: Zap },
                            { label: '完了', value: totalTasks.completed, color: '#34d399', icon: CheckCircle2 },
                        ].map(({ label, value, color, icon: Icon }) => (
                            <div key={label} className="glass-panel p-4 text-center">
                                <Icon size={16} style={{ color, margin: '0 auto 6px' }} />
                                <div className="text-2xl font-bold font-mono" style={{ color }}>{value}</div>
                                <div className="text-[10px] mt-1" style={{ color: 'var(--foreground-muted)' }}>{label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* エージェント一覧 */}
                <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                        <Bot size={14} style={{ color: 'var(--accent-primary)' }} />
                        稼働エージェント
                        <span className="text-[10px] px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(216,120,152,0.1)', color: 'var(--accent-primary)' }}>
                            {agents.length}
                        </span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {agents.map((agent, idx) => (
                            <motion.div key={agent.id} transition={{ delay: idx * 0.05 }}>
                                <AgentCard agent={agent} onRun={setModalAgent} />
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* 最近のタスク */}
                {recentTasks.length > 0 && (
                    <div>
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                            <Clock size={14} style={{ color: 'var(--accent-primary)' }} /> 最近のタスク
                        </h3>
                        <div className="space-y-2">
                            {recentTasks.map(task => <TaskRow key={task.task_id} task={task} />)}
                        </div>
                    </div>
                )}

                {/* 統計 */}
                {stats && stats.byAgent.length > 0 && (
                    <div>
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                            <BarChart3 size={14} style={{ color: 'var(--accent-primary)' }} /> エージェント統計
                        </h3>
                        <div className="glass-panel p-4 space-y-3">
                            {stats.byAgent.map(({ agent, count, avgDuration }) => {
                                const color = deptColors[agent] ?? deptColors.default;
                                const max = Math.max(...stats.byAgent.map(a => a.count), 1);
                                return (
                                    <div key={agent}>
                                        <div className="flex justify-between text-[11px] mb-1">
                                            <span style={{ color: 'var(--foreground)' }}>{agent}</span>
                                            <span style={{ color: 'var(--foreground-muted)' }}>{count}件 / 平均{avgDuration}s</span>
                                        </div>
                                        <div className="h-1.5 rounded-full" style={{ background: 'var(--background-tertiary)' }}>
                                            <div className="h-full rounded-full transition-all" style={{ width: `${(count / max) * 100}%`, background: color }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* タスク投入モーダル */}
            <AnimatePresence>
                {modalAgent && (
                    <TaskModal
                        agent={modalAgent}
                        onClose={() => setModalAgent(null)}
                        onSubmit={handleTaskSubmit}
                    />
                )}
            </AnimatePresence>

            {/* トースト */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm shadow-xl"
                        style={{
                            background: toast.ok ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                            border: `1px solid ${toast.ok ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
                            color: toast.ok ? '#34d399' : '#f87171',
                        }}>
                        {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
