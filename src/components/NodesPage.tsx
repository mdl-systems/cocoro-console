'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Server, Plus, X, Loader2, Wifi, WifiOff, RefreshCw,
    CheckCircle2, Circle, Trash2, Activity, Clock
} from 'lucide-react';

// ─── 型定義 ──────────────────────────────────────────────────
interface NodeEntry {
    id: string;
    name: string;
    ip: string;
    port: number;
    roles: string[];
    status: 'online' | 'offline' | 'checking' | 'unknown';
    last_seen: string | null;
    created_at: string;
}

// ─── ロール候補 ───────────────────────────────────────────────
const ROLE_OPTIONS = [
    { id: 'researcher', label: 'リサーチ', emoji: '🔍' },
    { id: 'engineer', label: 'エンジニア', emoji: '💻' },
    { id: 'lawyer', label: '弁護士', emoji: '⚖️' },
    { id: 'accountant', label: '税理士', emoji: '📊' },
    { id: 'financial_advisor', label: 'FP', emoji: '💰' },
    { id: 'default', label: 'MDL（本人）', emoji: '🤖' },
];

// ─── ステータスバッジ ─────────────────────────────────────────
function StatusDot({ status }: { status: NodeEntry['status'] }) {
    const map: Record<string, { color: string; pulse: boolean }> = {
        online: { color: '#34d399', pulse: true },
        offline: { color: '#f87171', pulse: false },
        checking: { color: '#f59e0b', pulse: true },
        unknown: { color: '#6b7280', pulse: false },
    };
    const { color, pulse } = map[status] ?? map.unknown;
    return (
        <span className="relative flex-shrink-0 w-2.5 h-2.5">
            <span className="block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            {pulse && (
                <span className="absolute inset-0 rounded-full animate-ping opacity-50"
                    style={{ background: color }} />
            )}
        </span>
    );
}

// ─── ノードカード ─────────────────────────────────────────────
function NodeCard({ node, onDelete, onCheck }: {
    node: NodeEntry;
    onDelete: (id: string) => void;
    onCheck: (id: string) => void;
}) {
    const statusLabel: Record<string, string> = {
        online: 'オンライン', offline: 'オフライン', checking: '確認中...', unknown: '未確認',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="glass-panel p-5 relative group"
        >
            {/* Status + name row */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <StatusDot status={node.status} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                        {node.name}
                    </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onCheck(node.id)}
                        className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
                        title="ヘルスチェック"
                    >
                        <RefreshCw size={13} style={{ color: 'var(--foreground-muted)' }} />
                    </button>
                    <button
                        onClick={() => onDelete(node.id)}
                        className="p-1.5 rounded-lg hover:bg-red-400/10 transition-colors"
                        title="削除"
                    >
                        <Trash2 size={13} style={{ color: '#f87171' }} />
                    </button>
                </div>
            </div>

            {/* IP */}
            <div className="flex items-center gap-1.5 mb-2 text-xs font-mono" style={{ color: 'var(--foreground-muted)' }}>
                <Wifi size={11} />
                {node.ip}:{node.port}
            </div>

            {/* Roles */}
            {node.roles.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                    {node.roles.map(role => {
                        const r = ROLE_OPTIONS.find(o => o.id === role);
                        return (
                            <span key={role}
                                className="text-[10px] px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(216,120,152,0.1)', color: 'var(--accent-primary)' }}>
                                {r?.emoji} {r?.label ?? role}
                            </span>
                        );
                    })}
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
                    {statusLabel[node.status]}
                    {node.last_seen && ` • ${new Date(node.last_seen).toLocaleString('ja-JP')}`}
                </span>
                {node.status === 'offline' && (
                    <button
                        onClick={() => onCheck(node.id)}
                        className="text-[10px] px-3 py-1 rounded-lg transition-colors"
                        style={{ background: 'rgba(216,120,152,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(216,120,152,0.25)' }}
                    >
                        接続する
                    </button>
                )}
            </div>
        </motion.div>
    );
}

// ─── 追加モーダル ─────────────────────────────────────────────
function AddNodeModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
    const [name, setName] = useState('');
    const [ip, setIp] = useState('192.168.50.');
    const [port, setPort] = useState('8001');
    const [roles, setRoles] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    function toggleRole(id: string) {
        setRoles(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
    }

    async function handleSubmit() {
        if (!name.trim() || !ip.trim()) { setError('名前とIPは必須です'); return; }
        setSubmitting(true); setError('');
        try {
            const res = await fetch('/api/nodes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), ip: ip.trim(), port: parseInt(port) || 8001, roles }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || '登録失敗');
            onAdded();
            onClose();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                className="w-full max-w-md rounded-2xl p-6"
                style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>

                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                        <Server size={16} style={{ color: 'var(--accent-primary)' }} />
                        ノードを追加
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/[0.06]">
                        <X size={16} style={{ color: 'var(--foreground-muted)' }} />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Name */}
                    <div>
                        <label className="text-[11px] mb-1 block" style={{ color: 'var(--foreground-muted)' }}>ノード名 *</label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="miniPC A（メイン）"
                            autoFocus
                            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                            style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                        />
                    </div>

                    {/* IP + Port */}
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="text-[11px] mb-1 block" style={{ color: 'var(--foreground-muted)' }}>IP アドレス *</label>
                            <input
                                value={ip}
                                onChange={e => setIp(e.target.value)}
                                placeholder="192.168.50.92"
                                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none font-mono"
                                style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                            />
                        </div>
                        <div className="w-24">
                            <label className="text-[11px] mb-1 block" style={{ color: 'var(--foreground-muted)' }}>ポート</label>
                            <input
                                value={port}
                                onChange={e => setPort(e.target.value)}
                                placeholder="8001"
                                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none font-mono"
                                style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                            />
                        </div>
                    </div>

                    {/* Roles */}
                    <div>
                        <label className="text-[11px] mb-2 block" style={{ color: 'var(--foreground-muted)' }}>ロール（複数選択可）</label>
                        <div className="flex flex-wrap gap-1.5">
                            {ROLE_OPTIONS.map(r => (
                                <button key={r.id}
                                    onClick={() => toggleRole(r.id)}
                                    className="text-[11px] px-2.5 py-1 rounded-full transition-all"
                                    style={{
                                        background: roles.includes(r.id) ? 'rgba(216,120,152,0.18)' : 'var(--background-tertiary)',
                                        border: `1.5px solid ${roles.includes(r.id) ? 'rgba(216,120,152,0.5)' : 'var(--border)'}`,
                                        color: roles.includes(r.id) ? 'var(--accent-primary)' : 'var(--foreground-muted)',
                                    }}>
                                    {r.emoji} {r.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && <p className="text-[11px]" style={{ color: '#f87171' }}>{error}</p>}
                </div>

                <div className="flex gap-3 mt-5">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
                        style={{ border: '1px solid var(--border)', color: 'var(--foreground-muted)' }}>
                        キャンセル
                    </button>
                    <button onClick={handleSubmit} disabled={!name.trim() || !ip.trim() || submitting}
                        className="flex-1 btn-primary py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-40">
                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        {submitting ? '登録中...' : '追加'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

// ─── メインページ ─────────────────────────────────────────────
export default function NodesPage() {
    const [nodes, setNodes] = useState<NodeEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
    const [toast, setToast] = useState<string | null>(null);

    function showToast(msg: string) {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    }

    const fetchNodes = useCallback(async () => {
        try {
            const res = await fetch('/api/nodes');
            const data = await res.json();
            if (data.success) setNodes(data.data?.nodes ?? data.nodes ?? []);
        } catch { /* ignore */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchNodes(); }, [fetchNodes]);

    async function handleCheck(id: string) {
        setCheckingIds(prev => new Set(prev).add(id));
        setNodes(prev => prev.map(n => n.id === id ? { ...n, status: 'checking' } : n));
        try {
            const res = await fetch(`/api/nodes/${id}/health`);
            const data = await res.json();
            const status = data.data?.status ?? data.status ?? 'unknown';
            setNodes(prev => prev.map(n => n.id === id ? {
                ...n,
                status,
                last_seen: status === 'online' ? new Date().toISOString() : n.last_seen,
            } : n));
            showToast(status === 'online' ? '✓ ノードに接続しました' : '✗ ノードに接続できません');
        } catch {
            setNodes(prev => prev.map(n => n.id === id ? { ...n, status: 'offline' } : n));
        } finally {
            setCheckingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('このノードを削除しますか？')) return;
        await fetch(`/api/nodes?id=${id}`, { method: 'DELETE' });
        setNodes(prev => prev.filter(n => n.id !== id));
        showToast('ノードを削除しました');
    }

    const online = nodes.filter(n => n.status === 'online').length;
    const offline = nodes.filter(n => n.status === 'offline').length;

    return (
        <div className="flex-1 flex flex-col h-screen overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                        <Activity size={20} style={{ color: 'var(--accent-primary)' }} />
                        ノード管理
                    </h2>
                    <p className="text-xs mt-0.5 flex items-center gap-3" style={{ color: 'var(--foreground-muted)' }}>
                        {nodes.length > 0 && (
                            <>
                                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> オンライン {online}</span>
                                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /> オフライン {offline}</span>
                            </>
                        )}
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
                >
                    <Plus size={15} />
                    ノードを追加
                </button>
            </div>

            <div className="p-6">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent-primary)' }} />
                    </div>
                ) : nodes.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-20"
                    >
                        <Server size={40} className="mx-auto mb-4" style={{ color: 'var(--foreground-muted)', opacity: 0.3 }} />
                        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                            登録済みのノードがありません
                        </p>
                        <p className="text-[11px] mt-1 mb-5" style={{ color: 'var(--foreground-muted)', opacity: 0.6 }}>
                            LAN 内の Cocoro miniPC を追加してください
                        </p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="btn-primary px-6 py-2.5 rounded-xl text-sm flex items-center gap-2 mx-auto"
                        >
                            <Plus size={14} />
                            最初のノードを追加
                        </button>
                    </motion.div>
                ) : (
                    <>
                        {/* Summary cards */}
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            {[
                                { label: '総ノード数', value: nodes.length, icon: Server, color: 'var(--accent-primary)' },
                                { label: 'オンライン', value: online, icon: Wifi, color: '#34d399' },
                                { label: 'オフライン', value: offline, icon: WifiOff, color: '#f87171' },
                            ].map(({ label, value, icon: Icon, color }) => (
                                <div key={label} className="glass-panel p-4 text-center">
                                    <Icon size={16} style={{ color, margin: '0 auto 6px' }} />
                                    <div className="text-2xl font-bold font-mono" style={{ color }}>{value}</div>
                                    <div className="text-[10px] mt-1" style={{ color: 'var(--foreground-muted)' }}>{label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Node grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            <AnimatePresence>
                                {nodes.map(node => (
                                    <NodeCard
                                        key={node.id}
                                        node={checkingIds.has(node.id) ? { ...node, status: 'checking' } : node}
                                        onDelete={handleDelete}
                                        onCheck={handleCheck}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                    </>
                )}
            </div>

            {/* Add modal */}
            <AnimatePresence>
                {showModal && <AddNodeModal onClose={() => setShowModal(false)} onAdded={fetchNodes} />}
            </AnimatePresence>

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm shadow-xl"
                        style={{
                            background: toast.startsWith('✓') ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                            border: `1px solid ${toast.startsWith('✓') ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
                            color: toast.startsWith('✓') ? '#34d399' : '#f87171',
                        }}>
                        {toast}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
