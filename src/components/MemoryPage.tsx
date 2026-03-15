'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Brain, Lock, Database, Zap, Clock, Trash2, Plus, Loader2, Search,
    X, RotateCcw, Calendar, ChevronDown, CheckCircle2, AlertCircle, RefreshCw,
} from 'lucide-react';
import { apiPost, apiDelete } from '@/lib/api-client';

// ─── 型 ──────────────────────────────────────────────────────
interface MemoryEntry {
    id: string;
    type: 'short_term' | 'long_term' | 'vector';
    content: string;
    category: string;
    timestamp: string;
    importance?: number;
}

interface Schedule {
    id: string;
    name: string;
    description: string;
    cron: string;
    agent_type: string;
    enabled: boolean;
    last_run?: string;
    next_run?: string;
}

// ─── 設定 ────────────────────────────────────────────────────
const TYPE_CONFIG = {
    short_term: { icon: Zap, color: '#f59e0b', label: '短期記憶' },
    long_term: { icon: Database, color: '#3b82f6', label: '長期記憶' },
    vector: { icon: Brain, color: '#a78bfa', label: 'ベクトル' },
} as const;

type MemType = keyof typeof TYPE_CONFIG;

const CATEGORY_TABS = [
    { id: null, label: 'すべて', emoji: '📋' },
    { id: 'prefer', label: '好み', emoji: '💡' },
    { id: 'event', label: '出来事', emoji: '📅' },
    { id: 'person', label: '人物', emoji: '👤' },
    { id: 'emotion', label: '感情', emoji: '💜' },
    { id: 'manual', label: '手動', emoji: '✏️' },
] as const;

// ─── 信頼度バー ───────────────────────────────────────────────
function ImportanceBar({ value, color }: { value: number; color: string }) {
    const pct = Math.round(value * 100);
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: `${color}20` }}>
                <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                />
            </div>
            <span className="text-[10px] tabular-nums w-7 text-right" style={{ color }}>{pct}%</span>
        </div>
    );
}

// ─── 記憶カード ───────────────────────────────────────────────
function MemoryCard({ mem, idx, onDelete }: {
    mem: MemoryEntry;
    idx: number;
    onDelete: (id: string) => void;
}) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const cfg = TYPE_CONFIG[mem.type as MemType] || TYPE_CONFIG.short_term;
    const Icon = cfg.icon;

    // カテゴリ絵文字
    const catEmoji = CATEGORY_TABS.find(t => t.id === mem.category)?.emoji ?? '📌';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ delay: Math.min(idx * 0.03, 0.3) }}
            className="glass-panel-light p-4 group hover:border-[var(--border-active)] transition-all"
        >
            {/* Top row */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{ background: `${cfg.color}15`, color: cfg.color }}>
                        <Icon size={9} className="inline mr-0.5" />{cfg.label}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
                        {catEmoji} {mem.category}
                    </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {confirmDelete ? (
                        <>
                            <button onClick={() => onDelete(mem.id)}
                                className="text-[10px] px-2 py-1 rounded-md transition-colors"
                                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
                                削除確認
                            </button>
                            <button onClick={() => setConfirmDelete(false)}
                                className="p-1 rounded-md" style={{ color: 'var(--foreground-muted)' }}>
                                <X size={12} />
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setConfirmDelete(true)}
                            className="p-1.5 rounded-lg hover:bg-[rgba(248,113,113,0.1)] transition-colors"
                            style={{ color: 'var(--danger)' }}>
                            <Trash2 size={13} />
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--foreground)' }}>
                {mem.content}
            </p>

            {/* Importance bar */}
            {mem.importance !== undefined && mem.importance > 0 && (
                <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] mb-1"
                        style={{ color: 'var(--foreground-muted)' }}>
                        <span>信頼度</span>
                    </div>
                    <ImportanceBar value={mem.importance} color={cfg.color} />
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center gap-1.5 mt-2" style={{ color: 'var(--foreground-muted)' }}>
                <Clock size={10} />
                <span className="text-[10px]">{new Date(mem.timestamp).toLocaleString('ja-JP')}</span>
            </div>
        </motion.div>
    );
}

// ─── スケジュールカード ────────────────────────────────────────
function ScheduleCard({ sched, onDelete, onToggle }: {
    sched: Schedule;
    onDelete: (id: string) => void;
    onToggle: (id: string, enabled: boolean) => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="glass-panel-light p-4 group flex items-start gap-3 hover:border-[var(--border-active)] transition-all"
        >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: sched.enabled ? 'rgba(52,211,153,0.15)' : 'rgba(148,163,184,0.1)' }}>
                <Calendar size={16} style={{ color: sched.enabled ? '#34d399' : 'var(--foreground-muted)' }} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{sched.name}</div>
                        {sched.description && (
                            <div className="text-[11px] mt-0.5" style={{ color: 'var(--foreground-muted)' }}>{sched.description}</div>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                            onClick={() => onToggle(sched.id, !sched.enabled)}
                            className="text-[10px] px-2 py-0.5 rounded-full transition-all"
                            style={{
                                background: sched.enabled ? 'rgba(52,211,153,0.15)' : 'rgba(148,163,184,0.1)',
                                color: sched.enabled ? '#34d399' : 'var(--foreground-muted)',
                                border: `1px solid ${sched.enabled ? '#34d39930' : 'var(--border)'}`,
                            }}
                        >
                            {sched.enabled ? '有効' : '無効'}
                        </button>
                        <button onClick={() => onDelete(sched.id)}
                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[rgba(248,113,113,0.1)] transition-all"
                            style={{ color: 'var(--danger)' }}>
                            <Trash2 size={13} />
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
                    <span className="font-mono px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--background-secondary)' }}>{sched.cron}</span>
                    <span>{sched.agent_type}</span>
                    {sched.last_run && <span>最終: {new Date(sched.last_run).toLocaleString('ja-JP')}</span>}
                </div>
            </div>
        </motion.div>
    );
}

// ─── メインページ ─────────────────────────────────────────────
export default function MemoryPage() {
    const [activeTab, setActiveTab] = useState<'memory' | 'schedule'>('memory');

    // ── Memory state
    const [memories, setMemories] = useState<MemoryEntry[]>([]);
    const [stats, setStats] = useState({ short_term: 0, long_term: 0, vector: 0 });
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [catFilter, setCatFilter] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<string | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [newContent, setNewContent] = useState('');
    const [newType, setNewType] = useState<'short_term' | 'long_term'>('long_term');
    const [dataSource, setDataSource] = useState<'core' | 'local' | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchMode, setIsSearchMode] = useState(false);
    const [confirmReset, setConfirmReset] = useState(false);

    // ── Schedule state
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [schedLoading, setSchedLoading] = useState(false);
    const [showSchedAdd, setShowSchedAdd] = useState(false);
    const [newSchedName, setNewSchedName] = useState('');
    const [newSchedDesc, setNewSchedDesc] = useState('');
    const [newSchedCron, setNewSchedCron] = useState('0 9 * * *');
    const [newSchedAgent, setNewSchedAgent] = useState('researcher');

    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Fetch memories ────────────────────────────────────────
    const fetchMemories = useCallback(async () => {
        if (isSearchMode) return;
        try {
            const params = new URLSearchParams();
            if (typeFilter) params.set('type', typeFilter);
            const res = await fetch(`/api/memory/list?${params}`);
            const data = await res.json();
            let list: MemoryEntry[] = data.memories ?? [];
            if (catFilter) list = list.filter(m => m.category === catFilter);
            setMemories(list);
            setStats(data.by_type ?? { short_term: 0, long_term: 0, vector: 0 });
            setDataSource(data.source ?? 'local');
        } catch { /* ignore */ } finally { setLoading(false); }
    }, [typeFilter, catFilter, isSearchMode]);

    useEffect(() => { fetchMemories(); }, [fetchMemories]);

    // ── Search ────────────────────────────────────────────────
    const runSearch = useCallback(async (q: string) => {
        if (!q.trim()) { setIsSearchMode(false); fetchMemories(); return; }
        setIsSearchMode(true);
        setSearching(true);
        try {
            const res = await apiPost('/api/memory/search', { query: q });
            const data = await res.json();
            setMemories(data.memories ?? []);
        } catch { /* ignore */ } finally { setSearching(false); }
    }, [fetchMemories]);

    const handleSearch = (val: string) => {
        setSearchQuery(val);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => runSearch(val), 400);
    };

    const clearSearch = () => {
        setSearchQuery('');
        setIsSearchMode(false);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        fetchMemories();
    };

    // ── Add / Delete memory ────────────────────────────────────
    async function addMemory() {
        if (!newContent.trim()) return;
        await apiPost('/api/memory', { content: newContent, type: newType, category: 'manual' });
        setNewContent('');
        setShowAdd(false);
        fetchMemories();
    }

    async function deleteMemory(id: string) {
        await apiDelete(`/api/memory?id=${id}`);
        setMemories(prev => prev.filter(m => m.id !== id));
    }

    async function resetAllMemories() {
        await apiDelete('/api/memory');
        setConfirmReset(false);
        fetchMemories();
    }

    // ── Fetch schedules ───────────────────────────────────────
    const fetchSchedules = useCallback(async () => {
        setSchedLoading(true);
        try {
            const res = await fetch('/api/agent/schedules');
            if (!res.ok) { setSchedules([]); return; }
            const data = await res.json();
            setSchedules(data.schedules ?? data.data?.schedules ?? []);
        } catch { setSchedules([]); } finally { setSchedLoading(false); }
    }, []);

    useEffect(() => {
        if (activeTab === 'schedule') fetchSchedules();
    }, [activeTab, fetchSchedules]);

    async function addSchedule() {
        if (!newSchedName.trim()) return;
        try {
            await apiPost('/api/agent/schedules', {
                name: newSchedName,
                description: newSchedDesc,
                cron: newSchedCron,
                agent_type: newSchedAgent,
                enabled: true,
            });
            setNewSchedName(''); setNewSchedDesc(''); setShowSchedAdd(false);
            fetchSchedules();
        } catch { /* ignore */ }
    }

    async function deleteSchedule(id: string) {
        try {
            await apiDelete(`/api/agent/schedules?id=${id}`);
            setSchedules(prev => prev.filter(s => s.id !== id));
        } catch { /* ignore */ }
    }

    async function toggleSchedule(id: string, enabled: boolean) {
        try {
            await apiPost(`/api/agent/schedules/${id}/toggle`, { enabled });
            setSchedules(prev => prev.map(s => s.id === id ? { ...s, enabled } : s));
        } catch { /* ignore */ }
    }

    const totalMem = stats.short_term + stats.long_term + stats.vector;

    return (
        <div className="flex-1 flex flex-col h-screen overflow-y-auto">
            {/* ── Header ───────────────────────────────────────── */}
            <div className="flex items-center justify-between px-8 py-5"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold flex items-center gap-2"
                            style={{ color: 'var(--foreground)' }}>
                            <Brain size={20} style={{ color: 'var(--accent-primary)' }} />
                            記憶・学習
                        </h2>
                        {dataSource === 'core' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(74,222,128,0.12)', color: '#34d399' }}>
                                cocoro-core ★ リアル
                            </span>
                        )}
                    </div>
                    <p className="text-xs mt-0.5 flex items-center gap-1.5"
                        style={{ color: 'var(--foreground-muted)' }}>
                        <Lock size={10} />
                        すべての記憶はAES-256で暗号化されています
                        <span className="ml-2 font-mono">{totalMem}件</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowAdd(v => !v)}
                        className="btn-primary text-xs flex items-center gap-1.5 px-3 py-2">
                        <Plus size={13} /> 追加
                    </button>
                    {confirmReset ? (
                        <>
                            <button onClick={resetAllMemories}
                                className="text-xs px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5"
                                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                                <AlertCircle size={12} /> 本当に削除
                            </button>
                            <button onClick={() => setConfirmReset(false)}
                                className="text-xs px-3 py-2 rounded-xl"
                                style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
                                キャンセル
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setConfirmReset(true)}
                            className="text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors hover:bg-white/[0.04]"
                            style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
                            <RotateCcw size={12} /> 記憶をリセット
                        </button>
                    )}
                </div>
            </div>

            {/* ── Main tabs ─────────────────────────────────────── */}
            <div className="flex gap-0 px-8 pt-4" style={{ borderBottom: '1px solid var(--border)' }}>
                {[
                    { id: 'memory', label: '🧠 記憶', },
                    { id: 'schedule', label: '📅 スケジュール' },
                ].map(tab => (
                    <button key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        className="px-4 py-2 text-sm font-medium transition-all relative"
                        style={{ color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--foreground-muted)' }}
                    >
                        {tab.label}
                        {activeTab === tab.id && (
                            <motion.div layoutId="main-tab-bar"
                                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                                style={{ background: 'var(--accent-primary)' }}
                            />
                        )}
                    </button>
                ))}
            </div>

            {activeTab === 'memory' ? (
                <div className="p-6 space-y-5 flex-1">
                    {/* ── Stats row ───────────────────────────── */}
                    <div className="grid grid-cols-3 gap-3">
                        {(Object.entries(TYPE_CONFIG) as [MemType, typeof TYPE_CONFIG[MemType]][]).map(([type, cfg], i) => {
                            const Icon = cfg.icon;
                            const active = typeFilter === type;
                            return (
                                <motion.button key={type}
                                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.06 }}
                                    onClick={() => setTypeFilter(active ? null : type)}
                                    className="glass-panel p-3 text-left transition-all"
                                    style={{ borderColor: active ? cfg.color : undefined, boxShadow: active ? `0 0 0 1px ${cfg.color}40` : undefined }}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Icon size={13} style={{ color: cfg.color }} />
                                        <span className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>{cfg.label}</span>
                                    </div>
                                    <div className="text-xl font-bold font-mono" style={{ color: cfg.color }}>{stats[type] || 0}</div>
                                </motion.button>
                            );
                        })}
                    </div>

                    {/* ── Search bar ──────────────────────────── */}
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2"
                            style={{ color: isSearchMode ? 'var(--accent-primary)' : 'var(--foreground-muted)' }} />
                        <input type="text" value={searchQuery} onChange={e => handleSearch(e.target.value)}
                            placeholder="メモリをキーワード検索…"
                            className="input-field pl-9 pr-8 w-full text-sm"
                            style={isSearchMode ? { borderColor: 'var(--accent-primary)' } : undefined} />
                        {searching && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin"
                            style={{ color: 'var(--accent-primary)' }} />}
                        {searchQuery && !searching && (
                            <button onClick={clearSearch}
                                className="absolute right-3 top-1/2 -translate-y-1/2"
                                style={{ color: 'var(--foreground-muted)' }}>
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {/* ── Category tabs ────────────────────────── */}
                    {!isSearchMode && (
                        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                            {CATEGORY_TABS.map(tab => (
                                <button key={String(tab.id)}
                                    onClick={() => setCatFilter(tab.id)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex-shrink-0 transition-all"
                                    style={{
                                        background: catFilter === tab.id ? 'rgba(216,120,152,0.15)' : 'var(--background-secondary)',
                                        border: `1px solid ${catFilter === tab.id ? 'rgba(216,120,152,0.4)' : 'var(--border)'}`,
                                        color: catFilter === tab.id ? 'var(--accent-primary)' : 'var(--foreground-muted)',
                                    }}>
                                    <span>{tab.emoji}</span> {tab.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── Add form ─────────────────────────────── */}
                    <AnimatePresence>
                        {showAdd && (
                            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }} className="glass-panel p-5">
                                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
                                    新しい記憶を追加
                                </h3>
                                <textarea value={newContent} onChange={e => setNewContent(e.target.value)}
                                    placeholder="記憶内容を入力..."
                                    className="input-field w-full min-h-[80px] resize-none mb-3 text-sm" />
                                <div className="flex items-center gap-3">
                                    <select value={newType} onChange={e => setNewType(e.target.value as 'short_term' | 'long_term')}
                                        className="input-field w-auto text-sm">
                                        <option value="short_term">短期記憶</option>
                                        <option value="long_term">長期記憶</option>
                                    </select>
                                    <button onClick={addMemory} className="btn-primary text-sm">保存</button>
                                    <button onClick={() => setShowAdd(false)}
                                        className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                                        キャンセル
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ── Memory list ──────────────────────────── */}
                    {isSearchMode && (
                        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground-muted)' }}>
                            <Search size={13} style={{ color: 'var(--accent-primary)' }} />
                            「<span style={{ color: 'var(--accent-primary)' }}>{searchQuery}</span>」
                            <span className="font-mono">{memories.length}件</span>
                            <button onClick={clearSearch} className="underline text-xs ml-1">クリア</button>
                        </div>
                    )}

                    <div className="space-y-2">
                        {loading ? (
                            <div className="flex justify-center py-16">
                                <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent-primary)' }} />
                            </div>
                        ) : memories.length === 0 ? (
                            <div className="text-center py-16">
                                <Brain size={36} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--foreground-muted)' }} />
                                <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                                    {isSearchMode ? '検索結果がありません' : '記憶が見つかりません'}
                                </p>
                            </div>
                        ) : (
                            <AnimatePresence initial={false}>
                                {memories.map((mem, idx) => (
                                    <MemoryCard key={mem.id} mem={mem} idx={idx} onDelete={deleteMemory} />
                                ))}
                            </AnimatePresence>
                        )}
                    </div>
                </div>
            ) : (
                /* ── Schedule tab ───────────────────────────── */
                <div className="p-6 space-y-5 flex-1">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold flex items-center gap-2"
                            style={{ color: 'var(--foreground)' }}>
                            <Calendar size={15} style={{ color: 'var(--accent-primary)' }} />
                            定期タスク
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                                style={{ background: 'rgba(216,120,152,0.08)', color: 'var(--accent-primary)' }}>
                                {schedules.length}件
                            </span>
                        </h3>
                        <div className="flex items-center gap-2">
                            <button onClick={fetchSchedules}
                                className="p-1.5 rounded-lg transition-colors hover:bg-white/[0.05]"
                                style={{ border: '1px solid var(--border)' }}>
                                <RefreshCw size={13} style={{ color: 'var(--foreground-muted)' }} />
                            </button>
                            <button onClick={() => setShowSchedAdd(v => !v)}
                                className="btn-primary text-xs flex items-center gap-1.5 px-3 py-2">
                                <Plus size={13} /> 追加
                            </button>
                        </div>
                    </div>

                    {/* Add schedule form */}
                    <AnimatePresence>
                        {showSchedAdd && (
                            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }} className="glass-panel p-5 space-y-3">
                                <h4 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                                    新規スケジュール
                                </h4>
                                <input value={newSchedName} onChange={e => setNewSchedName(e.target.value)}
                                    placeholder="タスク名" className="input-field w-full text-sm" />
                                <input value={newSchedDesc} onChange={e => setNewSchedDesc(e.target.value)}
                                    placeholder="説明（任意）" className="input-field w-full text-sm" />
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="text-[10px] mb-1 block" style={{ color: 'var(--foreground-muted)' }}>
                                            Cron式
                                        </label>
                                        <input value={newSchedCron} onChange={e => setNewSchedCron(e.target.value)}
                                            className="input-field w-full text-sm font-mono" />
                                    </div>
                                    <div className="w-40">
                                        <label className="text-[10px] mb-1 block" style={{ color: 'var(--foreground-muted)' }}>
                                            エージェント
                                        </label>
                                        <select value={newSchedAgent} onChange={e => setNewSchedAgent(e.target.value)}
                                            className="input-field w-full text-sm">
                                            <option value="researcher">リサーチ</option>
                                            <option value="lawyer">弁護士</option>
                                            <option value="accountant">税理士</option>
                                            <option value="engineer">エンジニア</option>
                                            <option value="financial_advisor">FP</option>
                                        </select>
                                    </div>
                                </div>
                                {/* Cron hint */}
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { label: '毎朝9時', cron: '0 9 * * *' },
                                        { label: '毎週月曜', cron: '0 9 * * 1' },
                                        { label: '毎時', cron: '0 * * * *' },
                                    ].map(({ label, cron }) => (
                                        <button key={cron} onClick={() => setNewSchedCron(cron)}
                                            className="text-[10px] px-2 py-1 rounded-full transition-colors"
                                            style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)', color: 'var(--foreground-muted)' }}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={addSchedule} className="btn-primary text-sm">作成</button>
                                    <button onClick={() => setShowSchedAdd(false)}
                                        className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                                        キャンセル
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {schedLoading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent-primary)' }} />
                        </div>
                    ) : schedules.length === 0 ? (
                        <div className="text-center py-16">
                            <Calendar size={36} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--foreground-muted)' }} />
                            <p className="text-sm mb-1" style={{ color: 'var(--foreground-muted)' }}>スケジュールがありません</p>
                            <p className="text-[11px]" style={{ color: 'var(--foreground-muted)', opacity: 0.5 }}>
                                cocoro-agent が稼働中の場合にのみ動作します
                            </p>
                        </div>
                    ) : (
                        <AnimatePresence initial={false}>
                            <div className="space-y-2">
                                {schedules.map(s => (
                                    <ScheduleCard key={s.id} sched={s} onDelete={deleteSchedule} onToggle={toggleSchedule} />
                                ))}
                            </div>
                        </AnimatePresence>
                    )}
                </div>
            )}
        </div>
    );
}
