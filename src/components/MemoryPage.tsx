'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Lock, Database, Zap, Clock, Trash2, Plus, Loader2 } from 'lucide-react';
import { apiPost, apiDelete } from '@/lib/api-client';

interface MemoryEntry {
    id: string;
    type: 'short_term' | 'long_term' | 'vector';
    content: string;
    category: string;
    timestamp: string;
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
    const [filter, setFilter] = useState<string | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [newContent, setNewContent] = useState('');
    const [newType, setNewType] = useState<'short_term' | 'long_term'>('long_term');

    async function fetchMemories() {
        try {
            const url = filter ? `/api/memory?type=${filter}` : '/api/memory';
            const res = await fetch(url);
            const data = await res.json();
            setMemories(data.memories);
            setStats(data.by_type);
        } catch { /* ignore */ } finally { setLoading(false); }
    }

    useEffect(() => { fetchMemories(); }, [filter]);

    async function addMemory() {
        if (!newContent.trim()) return;
        await apiPost('/api/memory', { content: newContent, type: newType, category: 'manual' });
        setNewContent('');
        setShowAdd(false);
        fetchMemories();
    }

    async function deleteMemory(id: string) {
        await apiDelete(`/api/memory?id=${id}`);
        fetchMemories();
    }

    return (
        <div className="flex-1 flex flex-col h-screen overflow-y-auto">
            <div className="flex items-center justify-between px-8 py-6" style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                    <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>メモリ管理</h2>
                    <p className="text-sm mt-1 flex items-center gap-1" style={{ color: 'var(--foreground-muted)' }}>
                        <Lock size={12} /> すべてのメモリはAES-256で暗号化されています
                    </p>
                </div>
                <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-sm flex items-center gap-2">
                    <Plus size={14} /> 追加
                </button>
            </div>

            <div className="p-8 space-y-6">
                <div className="grid grid-cols-3 gap-4">
                    {(Object.entries(typeConfig) as [MemType, typeof typeConfig[MemType]][]).map(([type, config], idx) => {
                        const Icon = config.icon;
                        return (
                            <motion.button key={type} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
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
                </div>

                {showAdd && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-6">
                        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>新しいメモリを追加</h3>
                        <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="記憶内容を入力..." className="input-field min-h-[80px] resize-none mb-3" />
                        <div className="flex items-center gap-3">
                            <select value={newType} onChange={e => setNewType(e.target.value as 'short_term' | 'long_term')} className="input-field w-auto">
                                <option value="short_term">短期記憶</option>
                                <option value="long_term">長期記憶</option>
                            </select>
                            <button onClick={addMemory} className="btn-primary text-sm">保存</button>
                        </div>
                    </motion.div>
                )}

                <div className="space-y-3">
                    {loading ? (
                        <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent-primary)' }} /></div>
                    ) : memories.length === 0 ? (
                        <div className="text-center py-20">
                            <Brain size={40} className="mx-auto mb-4" style={{ color: 'var(--foreground-muted)', opacity: 0.3 }} />
                            <p style={{ color: 'var(--foreground-muted)' }}>メモリが見つかりません</p>
                        </div>
                    ) : memories.map((mem, idx) => {
                        const cfg = typeConfig[mem.type as MemType] || typeConfig.short_term;
                        const Icon = cfg.icon;
                        return (
                            <motion.div key={mem.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                                className="glass-panel-light p-4 flex items-start gap-4 group hover:border-[var(--border-active)] transition-all">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${cfg.color}15` }}>
                                    <Icon size={16} style={{ color: cfg.color }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>{mem.content}</p>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${cfg.color}15`, color: cfg.color }}>{cfg.label}</span>
                                        <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--foreground-muted)' }}>
                                            <Clock size={10} />{new Date(mem.timestamp).toLocaleString('ja-JP')}
                                        </span>
                                    </div>
                                </div>
                                <button onClick={() => deleteMemory(mem.id)} className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[rgba(248,113,113,0.1)]" style={{ color: 'var(--danger)' }}>
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
