'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Lock, Database, Zap, Clock, Trash2, Plus, Loader2, Search, X } from 'lucide-react';
import { apiPost, apiDelete } from '@/lib/api-client';

interface MemoryEntry {
    id: string;
    type: 'short_term' | 'long_term' | 'vector';
    content: string;
    category: string;
    timestamp: string;
    importance?: number;
}

const typeConfig = {
    short_term: { icon: Zap, color: 'var(--warning)', label: '短期記憶' },
    long_term: { icon: Database, color: 'var(--info)', label: '長期記憶' },
    vector: { icon: Brain, color: 'var(--accent-secondary)', label: 'ベクトル記憶' },
} as const;

type MemType = keyof typeof typeConfig;

export default function MemoryPage() {
    const [memories, setMemories] = useState<MemoryEntry[]>([]);
    const [stats, setStats] = useState({ short_term: 0, long_term: 0, vector: 0 });
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [filter, setFilter] = useState<string | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [newContent, setNewContent] = useState('');
    const [newType, setNewType] = useState<'short_term' | 'long_term'>('long_term');
    const [dataSource, setDataSource] = useState<'core' | 'local' | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchMode, setIsSearchMode] = useState(false);

    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Fetch list ────────────────────────────────────────────
    const fetchMemories = useCallback(async () => {
        if (isSearchMode) return;
        try {
            const url = filter ? `/api/memory?type=${filter}` : '/api/memory';
            const res = await fetch(url);
            const data = await res.json();
            setMemories(data.memories ?? []);
            setStats(data.by_type ?? { short_term: 0, long_term: 0, vector: 0 });
            setDataSource(data.source ?? 'local');
        } catch { /* ignore */ } finally { setLoading(false); }
    }, [filter, isSearchMode]);

    useEffect(() => { fetchMemories(); }, [fetchMemories]);

    // ── Search (debounced 400ms) ──────────────────────────────
    const runSearch = useCallback(async (q: string) => {
        if (!q.trim()) {
            setIsSearchMode(false);
            fetchMemories();
            return;
        }
        setIsSearchMode(true);
        setSearching(true);
        try {
            const res = await apiPost('/api/memory/search', { query: q });
            const data = await res.json();
            setMemories(data.memories ?? []);
            setDataSource(data.source ?? 'local');
        } catch { /* ignore */ } finally { setSearching(false); }
    }, [fetchMemories]);

    const handleSearchChange = (val: string) => {
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

    // ── Add / Delete ──────────────────────────────────────────
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

    return (
        <div className="flex-1 flex flex-col h-screen overflow-y-auto">
            {/* ── Header ───────────────────────────────────────── */}
            <div className="flex items-center justify-between px-8 py-6" style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>メモリ管理</h2>
                        {dataSource === 'core' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(74,222,128,0.12)', color: 'var(--success)' }}>
                                cocoro-core ★ リアル
                            </span>
                        )}
                        {dataSource === 'local' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(216,120,152,0.1)', color: 'var(--foreground-muted)' }}>
                                ローカル DB
                            </span>
                        )}
                    </div>
                    <p className="text-sm mt-1 flex items-center gap-1" style={{ color: 'var(--foreground-muted)' }}>
                        <Lock size={12} /> すべてのメモリはAES-256で暗号化されています
                    </p>
                </div>
                <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-sm flex items-center gap-2">
                    <Plus size={14} /> 追加
                </button>
            </div>

            <div className="p-8 space-y-6">
                {/* ── Search bar ───────────────────────────────── */}
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ color: isSearchMode ? 'var(--accent-primary)' : 'var(--foreground-muted)' }} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => handleSearchChange(e.target.value)}
                        placeholder="メモリを検索… (cocoro-core ベクトル検索)"
                        className="input-field pl-9 pr-9 w-full"
                        style={isSearchMode ? { borderColor: 'var(--accent-primary)' } : undefined}
                    />
                    {searching && (
                        <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin"
                            style={{ color: 'var(--accent-primary)' }} />
                    )}
                    {searchQuery && !searching && (
                        <button onClick={clearSearch}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors"
                            style={{ color: 'var(--foreground-muted)' }}>
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* ── Type filter cards ────────────────────────── */}
                <AnimatePresence>
                    {!isSearchMode && (
                        <motion.div
                            key="filter-cards"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="grid grid-cols-3 gap-4"
                        >
                            {(Object.entries(typeConfig) as [MemType, typeof typeConfig[MemType]][]).map(([type, config], idx) => {
                                const Icon = config.icon;
                                return (
                                    <motion.button key={type}
                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        onClick={() => setFilter(filter === type ? null : type)}
                                        className="glass-panel p-4 text-left transition-all hover:border-[var(--border-active)]"
                                        style={{ borderColor: filter === type ? config.color : undefined }}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Icon size={16} style={{ color: config.color }} />
                                            <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{config.label}</span>
                                        </div>
                                        <div className="text-2xl font-bold font-mono" style={{ color: config.color }}>
                                            {stats[type] || 0}
                                        </div>
                                    </motion.button>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Search mode label */}
                {isSearchMode && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground-muted)' }}>
                        <Search size={13} style={{ color: 'var(--accent-primary)' }} />
                        <span>「<span style={{ color: 'var(--accent-primary)' }}>{searchQuery}</span>」の検索結果
                            <span className="ml-2 font-mono">{memories.length} 件</span>
                        </span>
                        <button onClick={clearSearch} className="ml-2 text-xs underline"
                            style={{ color: 'var(--foreground-muted)' }}>クリア</button>
                    </div>
                )}

                {/* ── Add form ─────────────────────────────────── */}
                <AnimatePresence>
                    {showAdd && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }} className="glass-panel p-6">
                            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>新しいメモリを追加</h3>
                            <textarea value={newContent} onChange={e => setNewContent(e.target.value)}
                                placeholder="記憶内容を入力..." className="input-field min-h-[80px] resize-none mb-3" />
                            <div className="flex items-center gap-3">
                                <select value={newType} onChange={e => setNewType(e.target.value as 'short_term' | 'long_term')}
                                    className="input-field w-auto">
                                    <option value="short_term">短期記憶</option>
                                    <option value="long_term">長期記憶</option>
                                </select>
                                <button onClick={addMemory} className="btn-primary text-sm">保存</button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Memory list ──────────────────────────────── */}
                <div className="space-y-3">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent-primary)' }} />
                        </div>
                    ) : memories.length === 0 ? (
                        <div className="text-center py-20">
                            <Brain size={40} className="mx-auto mb-4"
                                style={{ color: 'var(--foreground-muted)', opacity: 0.3 }} />
                            <p style={{ color: 'var(--foreground-muted)' }}>
                                {isSearchMode ? '検索結果がありません' : 'メモリが見つかりません'}
                            </p>
                        </div>
                    ) : memories.map((mem, idx) => {
                        const cfg = typeConfig[mem.type as MemType] || typeConfig.short_term;
                        const Icon = cfg.icon;
                        return (
                            <motion.div key={mem.id}
                                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.04 }}
                                className="glass-panel-light p-4 flex items-start gap-4 group hover:border-[var(--border-active)] transition-all">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ background: `${cfg.color}15` }}>
                                    <Icon size={16} style={{ color: cfg.color }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>{mem.content}</p>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded"
                                            style={{ background: `${cfg.color}15`, color: cfg.color }}>
                                            {cfg.label}
                                        </span>
                                        {mem.importance !== undefined && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded"
                                                style={{ background: 'rgba(216,120,152,0.08)', color: 'var(--accent-primary)' }}>
                                                重要度 {(mem.importance * 100).toFixed(0)}%
                                            </span>
                                        )}
                                        <span className="text-[10px] flex items-center gap-1"
                                            style={{ color: 'var(--foreground-muted)' }}>
                                            <Clock size={10} />
                                            {new Date(mem.timestamp).toLocaleString('ja-JP')}
                                        </span>
                                    </div>
                                </div>
                                <button onClick={() => deleteMemory(mem.id)}
                                    className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[rgba(248,113,113,0.1)]"
                                    style={{ color: 'var(--danger)' }}>
                                    <Trash2 size={14} />
                                </button>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
