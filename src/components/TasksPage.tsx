'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ClipboardList, RefreshCw, Plus, Loader2, CheckCircle2,
    Clock, AlertCircle, XCircle, Zap, Trash2, ChevronRight,
    X, Bot,
} from 'lucide-react';
import { apiPost, apiDelete } from '@/lib/api-client';

// ─── 型 ──────────────────────────────────────────────────────
interface Task {
    id: string;
    title: string;
    description?: string;
    status: 'active' | 'pending' | 'completed' | 'failed' | 'cancelled';
    agent_type?: string;
    progress?: number;
    result?: string;
    result_count?: number;
    created_at: string;
    updated_at: string;
}

// ─── ステータス設定 ───────────────────────────────────────────
const STATUS_CONFIG = {
    active: { icon: Zap, color: '#34d399', dot: '#34d399', label: '実行中', bg: 'rgba(52,211,153,0.12)' },
    pending: { icon: Clock, color: '#f59e0b', dot: '#f59e0b', label: '承認待ち', bg: 'rgba(245,158,11,0.12)' },
    completed: { icon: CheckCircle2, color: '#34d399', dot: '#6366f1', label: '完了', bg: 'rgba(99,102,241,0.10)' },
    failed: { icon: XCircle, color: '#f87171', dot: '#f87171', label: '失敗', bg: 'rgba(248,113,113,0.10)' },
    cancelled: { icon: AlertCircle, color: 'var(--foreground-muted)', dot: '#94a3b8', label: 'キャンセル', bg: 'rgba(148,163,184,0.08)' },
} as const;

// ─── エージェント設定 ─────────────────────────────────────────
const AGENTS = [
    { id: 'default', name: 'MDL', icon: '🤖' },
    { id: 'researcher', name: 'リサーチ', icon: '🔍' },
    { id: 'lawyer', name: '弁護士', icon: '⚖️' },
    { id: 'accountant', name: '税理士', icon: '📊' },
    { id: 'engineer', name: 'エンジニア', icon: '💻' },
    { id: 'financial_advisor', name: 'FP', icon: '💰' },
] as const;

// ─── 意図確認ダイアログ ───────────────────────────────────────
interface IntentChoice {
    label: string;
    value: string;
}

interface IntentDialog {
    title: string;
    question: string;
    choices: IntentChoice[];
}

const TASK_INTENTS: Record<string, IntentDialog> = {
    slide: {
        title: '📊 スライド作成',
        question: '対象オーディエンスは？',
        choices: [
            { label: '取締役会', value: 'board' },
            { label: '投資家', value: 'investors' },
            { label: '社内', value: 'internal' },
            { label: 'その他', value: 'other' },
        ],
    },
    report: {
        title: '📝 レポート作成',
        question: 'レポートの形式は？',
        choices: [
            { label: '要約（1ページ）', value: 'summary' },
            { label: '詳細レポート', value: 'detailed' },
            { label: 'データ分析', value: 'analysis' },
        ],
    },
    research: {
        title: '🔍 リサーチ',
        question: 'リサーチの深さは？',
        choices: [
            { label: '速報（5分）', value: 'quick' },
            { label: '標準（30分）', value: 'standard' },
            { label: '詳細（数時間）', value: 'deep' },
        ],
    },
};

// ─── タスク行 ─────────────────────────────────────────────────
function TaskRow({ task, idx, onDelete }: {
    task: Task;
    idx: number;
    onDelete: (id: string) => void;
}) {
    const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;
    const Icon = cfg.icon;
    const agentConf = AGENTS.find(a => a.id === task.agent_type) ?? AGENTS[0];

    const timeAgo = (() => {
        const diff = Date.now() - new Date(task.updated_at).getTime();
        const mins = Math.floor(diff / 60_000);
        if (mins < 1) return 'Now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    })();

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ delay: Math.min(idx * 0.04, 0.25) }}
            className="group relative flex items-start gap-3.5 px-4 py-3.5 transition-colors"
            style={{
                borderBottom: '1px solid var(--border)',
                background: 'transparent',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
            {/* Status dot / icon */}
            <div className="flex-shrink-0 mt-0.5">
                {task.status === 'active' ? (
                    <span className="relative flex w-3 h-3 mt-0.5">
                        <span className="absolute inset-0 rounded-full animate-ping opacity-40"
                            style={{ background: cfg.dot }} />
                        <span className="relative block w-3 h-3 rounded-full"
                            style={{ background: cfg.dot }} />
                    </span>
                ) : task.status === 'completed' ? (
                    <CheckCircle2 size={16} style={{ color: '#6366f1' }} />
                ) : (
                    <Icon size={15} style={{ color: cfg.color }} />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm leading-snug truncate"
                        style={{ color: task.status === 'completed' ? 'var(--foreground-muted)' : 'var(--foreground)' }}>
                        {task.title}
                    </div>
                    <span className="flex-shrink-0 text-[10px] tabular-nums"
                        style={{ color: 'var(--foreground-muted)' }}>
                        {timeAgo}
                    </span>
                </div>

                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px]" style={{ color: cfg.color }}>
                        {cfg.label}
                        {task.status === 'active' && task.progress !== undefined && (
                            <span className="ml-1 opacity-70">{task.progress}%</span>
                        )}
                        {task.status === 'completed' && task.result_count !== undefined && (
                            <span className="ml-1 opacity-70">{task.result_count}件</span>
                        )}
                        {task.status === 'active' && !task.progress && task.description && (
                            <span className="ml-1 opacity-70">{task.description}</span>
                        )}
                    </span>

                    {/* Progress bar for active */}
                    {task.status === 'active' && task.progress !== undefined && (
                        <div className="flex-1 max-w-24 h-0.5 rounded-full overflow-hidden"
                            style={{ background: 'var(--border)' }}>
                            <motion.div className="h-full rounded-full"
                                style={{ background: cfg.color }}
                                initial={{ width: 0 }}
                                animate={{ width: `${task.progress}%` }}
                                transition={{ duration: 0.6 }}
                            />
                        </div>
                    )}

                    {agentConf && task.agent_type && task.agent_type !== 'default' && (
                        <span className="text-[10px] ml-auto" style={{ color: 'var(--foreground-muted)' }}>
                            {agentConf.icon} {agentConf.name}
                        </span>
                    )}
                </div>
            </div>

            {/* Delete button */}
            <button
                onClick={() => onDelete(task.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                style={{ color: 'var(--foreground-muted)' }}
                title="削除"
            >
                <Trash2 size={13} />
            </button>
        </motion.div>
    );
}

// ─── 新規タスクダイアログ ─────────────────────────────────────
function NewTaskDialog({ onClose, onCreated }: {
    onClose: () => void;
    onCreated: () => void;
}) {
    const [title, setTitle] = useState('');
    const [agentType, setAgentType] = useState<string>('default');
    const [intentKey, setIntentKey] = useState<string | null>(null);
    const [intentValue, setIntentValue] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    // Detect intent from title
    useEffect(() => {
        const t = title.toLowerCase();
        if (t.includes('スライド') || t.includes('slide')) setIntentKey('slide');
        else if (t.includes('レポート') || t.includes('report')) setIntentKey('report');
        else if (t.includes('調査') || t.includes('リサーチ') || t.includes('research')) setIntentKey('research');
        else setIntentKey(null);
    }, [title]);

    async function create() {
        if (!title.trim()) return;
        setCreating(true);
        try {
            await apiPost('/api/tasks', {
                title,
                agent_type: agentType,
                metadata: intentValue ? { intent: intentKey, intent_value: intentValue } : undefined,
            });
            onCreated();
            onClose();
        } catch { /* ignore */ } finally { setCreating(false); }
    }

    const intent = intentKey ? TASK_INTENTS[intentKey] : null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="glass-panel w-full max-w-md p-6"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold flex items-center gap-2"
                        style={{ color: 'var(--foreground)' }}>
                        <Plus size={16} style={{ color: 'var(--accent-primary)' }} />
                        新規タスク
                    </h3>
                    <button onClick={onClose} style={{ color: 'var(--foreground-muted)' }}>
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-3">
                    <input
                        autoFocus
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && create()}
                        placeholder="タスクの内容を入力…"
                        className="input-field w-full text-sm"
                    />

                    {/* Intent dialog */}
                    <AnimatePresence>
                        {intent && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="rounded-xl overflow-hidden"
                                style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}
                            >
                                <div className="p-4">
                                    <div className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                                        {intent.title}
                                    </div>
                                    <div className="text-xs mb-3" style={{ color: 'var(--foreground-muted)' }}>
                                        {intent.question}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {intent.choices.map(c => (
                                            <button
                                                key={c.value}
                                                onClick={() => setIntentValue(v => v === c.value ? null : c.value)}
                                                className="px-3 py-1.5 rounded-full text-xs transition-all"
                                                style={{
                                                    background: intentValue === c.value ? 'rgba(216,120,152,0.2)' : 'var(--background-tertiary)',
                                                    border: `1px solid ${intentValue === c.value ? 'rgba(216,120,152,0.5)' : 'var(--border)'}`,
                                                    color: intentValue === c.value ? 'var(--accent-primary)' : 'var(--foreground-muted)',
                                                }}
                                            >
                                                {c.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Agent selector */}
                    <div>
                        <label className="text-[10px] mb-1.5 block" style={{ color: 'var(--foreground-muted)' }}>
                            担当エージェント
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {AGENTS.map(a => (
                                <button
                                    key={a.id}
                                    onClick={() => setAgentType(a.id)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] transition-all"
                                    style={{
                                        background: agentType === a.id ? 'rgba(216,120,152,0.15)' : 'var(--background-secondary)',
                                        border: `1px solid ${agentType === a.id ? 'rgba(216,120,152,0.4)' : 'var(--border)'}`,
                                        color: agentType === a.id ? 'var(--accent-primary)' : 'var(--foreground-muted)',
                                    }}
                                >
                                    <span>{a.icon}</span> {a.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-5">
                    <button onClick={create} disabled={!title.trim() || creating}
                        className="btn-primary text-sm flex items-center gap-2 flex-1 justify-center disabled:opacity-40">
                        {creating ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                        タスク開始
                    </button>
                    <button onClick={onClose} className="text-sm px-4 py-2 rounded-xl transition-colors hover:bg-white/[0.05]"
                        style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
                        キャンセル
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── メインページ ─────────────────────────────────────────────
export default function TasksPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showNew, setShowNew] = useState(false);

    const fetchTasks = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const res = await fetch('/api/tasks');
            if (!res.ok) { setTasks([]); return; }
            const data = await res.json();
            setTasks(data.tasks ?? data.data?.tasks ?? []);
        } catch { setTasks([]); } finally { setLoading(false); setRefreshing(false); }
    }, []);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);
    useEffect(() => {
        const id = setInterval(() => fetchTasks(true), 30_000); // 30秒ごと（429対策）
        return () => clearInterval(id);
    }, [fetchTasks]);

    async function deleteTask(id: string) {
        try {
            await apiDelete(`/api/tasks?id=${id}`);
            setTasks(prev => prev.filter(t => t.id !== id));
        } catch { /* ignore */ }
    }

    const activeTasks = tasks.filter(t => t.status === 'active' || t.status === 'pending');
    const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled');

    return (
        <div className="flex-1 flex flex-col h-screen overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2"
                        style={{ color: 'var(--foreground)' }}>
                        <ClipboardList size={20} style={{ color: 'var(--accent-primary)' }} />
                        タスク
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
                        {activeTasks.length}件 アクティブ · {completedTasks.length}件 完了
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => fetchTasks(true)} disabled={refreshing}
                        className="p-2 rounded-xl transition-colors hover:bg-white/[0.06]"
                        style={{ border: '1px solid var(--border)' }}>
                        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''}
                            style={{ color: 'var(--foreground-muted)' }} />
                    </button>
                    <button onClick={() => setShowNew(true)}
                        className="btn-primary text-xs flex items-center gap-1.5 px-3 py-2">
                        <Plus size={13} /> 新規タスク
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent-primary)' }} />
                </div>
            ) : tasks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <Bot size={48} className="opacity-15" style={{ color: 'var(--foreground-muted)' }} />
                    <div className="text-center">
                        <p className="text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>タスクがありません</p>
                        <p className="text-xs mt-1 opacity-60" style={{ color: 'var(--foreground-muted)' }}>
                            「新規タスク」ボタンでエージェントにタスクを依頼できます
                        </p>
                    </div>
                    <button onClick={() => setShowNew(true)} className="btn-primary text-sm flex items-center gap-2">
                        <Plus size={14} /> 最初のタスクを作成
                    </button>
                </div>
            ) : (
                <div className="flex-1 max-w-2xl mx-auto w-full py-4">
                    {/* Active tasks */}
                    {activeTasks.length > 0 && (
                        <section className="mb-6">
                            <div className="px-4 pb-2">
                                <h3 className="text-[11px] font-semibold uppercase tracking-wider"
                                    style={{ color: 'var(--foreground-muted)' }}>
                                    アクティブ
                                </h3>
                            </div>
                            <div className="glass-panel overflow-hidden">
                                <AnimatePresence initial={false}>
                                    {activeTasks.map((task, idx) => (
                                        <TaskRow key={task.id} task={task} idx={idx} onDelete={deleteTask} />
                                    ))}
                                </AnimatePresence>
                            </div>
                        </section>
                    )}

                    {/* Completed tasks */}
                    {completedTasks.length > 0 && (
                        <section>
                            <div className="px-4 pb-2">
                                <h3 className="text-[11px] font-semibold uppercase tracking-wider"
                                    style={{ color: 'var(--foreground-muted)' }}>
                                    完了 / 終了
                                </h3>
                            </div>
                            <div className="glass-panel overflow-hidden">
                                <AnimatePresence initial={false}>
                                    {completedTasks.map((task, idx) => (
                                        <TaskRow key={task.id} task={task} idx={idx} onDelete={deleteTask} />
                                    ))}
                                </AnimatePresence>
                            </div>
                        </section>
                    )}
                </div>
            )}

            {/* New task dialog */}
            <AnimatePresence>
                {showNew && (
                    <NewTaskDialog onClose={() => setShowNew(false)} onCreated={() => fetchTasks()} />
                )}
            </AnimatePresence>
        </div>
    );
}
