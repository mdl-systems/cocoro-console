'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Server, Cpu, HardDrive, Wifi, Activity, RefreshCw, Clock,
    CheckCircle2, Loader2, Heart, Zap, Brain
} from 'lucide-react';
import type { CoreEmotionState } from '@/lib/cocoro-core';

interface NodeStatus {
    status: string;
    device_id: string;
    hostname: string;
    platform: string;
    arch: string;
    uptime_seconds: number;
    uptime_human: string;
    cpu: { model: string; cores: number; usage: string };
    memory: { total_gb: string; used_gb: string; free_gb: string; usage_percent: string };
    network: { interfaces: Record<string, string> };
    services: Record<string, string>;
    version: string;
    // cocoro-core 拡張フィールド
    core_connected?: boolean;
    core_status?: string;
    core_uptime?: number;
    core_cpu?: number;
    core_memory?: number;
    core_active_connections?: number;
    core_emotion?: string;
}

const serviceLabels: Record<string, string> = {
    console: 'コンソール',
    api_gateway: 'APIゲートウェイ',
    identity_engine: 'ID エンジン',
    memory_engine: 'メモリエンジン',
    agent_runtime: 'エージェント',
    cocoro_core: 'cocoro-core',
};

const statusColors: Record<string, string> = {
    running: 'var(--success)',
    active: 'var(--success)',
    standby: 'var(--warning)',
    stopped: 'var(--danger)',
    offline: 'var(--danger)',
    disabled: 'var(--foreground-muted)',
};

// ─── Emotion display config ───────────────────────────────────
const emotionConfig: Record<string, { emoji: string; color: string; label: string }> = {
    joy: { emoji: '😊', color: '#f59e0b', label: '喜び' },
    happy: { emoji: '😊', color: '#f59e0b', label: '嬉しい' },
    calm: { emoji: '😌', color: 'var(--success)', label: '穏やか' },
    neutral: { emoji: '😐', color: 'var(--foreground-muted)', label: 'ニュートラル' },
    curious: { emoji: '🤔', color: 'var(--info)', label: '好奇心' },
    excited: { emoji: '✨', color: '#a78bfa', label: '興奮' },
    sad: { emoji: '😢', color: 'var(--info)', label: '悲しみ' },
    anxious: { emoji: '😰', color: 'var(--warning)', label: '不安' },
    focused: { emoji: '🎯', color: 'var(--accent-primary)', label: '集中' },
};

function getEmotionConfig(emotion: string) {
    return emotionConfig[emotion.toLowerCase()] ?? { emoji: '🌸', color: 'var(--accent-primary)', label: emotion };
}

// ─── Gauge component ──────────────────────────────────────────
function CircularGauge({ value, max = 1, color, size = 80, label, sub }:
    { value: number; max?: number; color: string; size?: number; label: string; sub?: string }) {
    const pct = Math.min(value / max, 1);
    const r = (size - 12) / 2;
    const circ = 2 * Math.PI * r;
    const dash = circ * pct;

    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx={size / 2} cy={size / 2} r={r}
                        fill="none" stroke="rgba(216,120,152,0.1)" strokeWidth={8} />
                    <motion.circle
                        cx={size / 2} cy={size / 2} r={r}
                        fill="none" stroke={color} strokeWidth={8}
                        strokeLinecap="round"
                        initial={{ strokeDasharray: `0 ${circ}` }}
                        animate={{ strokeDasharray: `${dash} ${circ}` }}
                        transition={{ duration: 1.2, ease: 'easeOut' }}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold font-mono" style={{ color }}>
                        {Math.round(pct * 100)}%
                    </span>
                </div>
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{label}</span>
            {sub && <span className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>{sub}</span>}
        </div>
    );
}

export default function NodePage() {
    const [node, setNode] = useState<NodeStatus | null>(null);
    const [emotion, setEmotion] = useState<CoreEmotionState | null>(null);
    const [loading, setLoading] = useState(true);
    const [coreOnline, setCoreOnline] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchStatus = useCallback(async () => {
        try {
            const [nodeRes, emotionRes] = await Promise.all([
                fetch('/api/node'),
                fetch('/api/node/emotion'),
            ]);
            const nodeJson = await nodeRes.json();
            // jsonSuccess ラッパー: { success: true, data: { ... } }
            const nodeData: NodeStatus = nodeJson.data ?? nodeJson;
            setNode(nodeData);

            // core_connected フラグがノードレスポンスにおける品質情報ソース
            if (nodeData.core_connected) {
                setCoreOnline(true);
                // core_emotion が含まれる場合はそのまま使用
                if (nodeData.core_emotion) {
                    // emotion マップは別途エンドポイントから取得する
                }
            }

            // /api/node/emotion で読み込む（CORE_ENABLED 時）
            if (emotionRes.ok) {
                const emoJson = await emotionRes.json();
                const emoData = emoJson.data ?? emoJson;
                if (emoData.emotion) {
                    setEmotion(emoData.emotion);
                    setCoreOnline(true);
                }
            }
            setLastUpdated(new Date());
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 10_000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    if (loading || !node) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-primary)' }} />
            </div>
        );
    }

    const memUsage = parseFloat(node.memory.usage_percent);
    const cpuUsage = parseFloat(node.cpu.usage);
    const emoConf = emotion ? getEmotionConfig(emotion.current_emotion) : null;

    return (
        <div className="flex-1 flex flex-col h-screen overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6" style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                    <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>ノードステータス</h2>
                    <p className="text-sm mt-1 flex items-center gap-2" style={{ color: 'var(--foreground-muted)' }}>
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--success)' }} />
                        {node.hostname} • {node.platform}/{node.arch} • v{node.version}
                        {coreOnline && (
                            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px]"
                                style={{ background: 'rgba(var(--success-rgb, 74,222,128), 0.12)', color: 'var(--success)' }}>
                                cocoro-core ★ オンライン
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <span className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
                            {lastUpdated.toLocaleTimeString('ja-JP')} 更新
                        </span>
                    )}
                    <button onClick={fetchStatus}
                        className="p-2 rounded-lg transition-colors hover:bg-[rgba(216,120,152,0.06)]"
                        style={{ color: 'var(--foreground-muted)' }}>
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            <div className="p-8 space-y-6">
                {/* ── Emotion & Sync row (cocoro-core) ─────────────── */}
                <AnimatePresence>
                    {emotion && emoConf && (
                        <motion.div
                            key="emotion-panel"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="glass-panel p-6"
                            style={{ borderLeft: `3px solid ${emoConf.color}` }}
                        >
                            <div className="flex items-center gap-3 mb-5">
                                <Heart size={18} style={{ color: emoConf.color }} />
                                <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                                    感情状態 / シンクロ率
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full"
                                    style={{ background: `${emoConf.color}18`, color: emoConf.color }}>
                                    cocoro-core リアルタイム
                                </span>
                            </div>

                            <div className="flex items-center gap-8 flex-wrap">
                                {/* Current emotion */}
                                <div className="flex items-center gap-4">
                                    <motion.span
                                        className="text-5xl"
                                        animate={{ scale: [1, 1.08, 1] }}
                                        transition={{ duration: 3, repeat: Infinity }}
                                    >
                                        {emoConf.emoji}
                                    </motion.span>
                                    <div>
                                        <div className="text-xl font-bold" style={{ color: emoConf.color }}>
                                            {emoConf.label}
                                        </div>
                                        <div className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
                                            Trait: {emotion.dominant_trait}
                                        </div>
                                    </div>
                                </div>

                                {/* Gauges */}
                                <div className="flex gap-6">
                                    <CircularGauge
                                        value={emotion.sync_rate}
                                        color="var(--accent-primary)"
                                        label="シンクロ率"
                                        sub={`${(emotion.sync_rate * 100).toFixed(1)}%`}
                                    />
                                    <CircularGauge
                                        value={(emotion.valence + 1) / 2}
                                        color={emotion.valence >= 0 ? '#f59e0b' : 'var(--info)'}
                                        label="感情価"
                                        sub={emotion.valence >= 0 ? 'ポジティブ' : 'ネガティブ'}
                                    />
                                    <CircularGauge
                                        value={emotion.arousal}
                                        color="#a78bfa"
                                        label="覚醒度"
                                        sub={emotion.arousal > 0.6 ? '高め' : '落ち着き'}
                                    />
                                </div>

                                {/* Bars */}
                                <div className="flex-1 min-w-[160px] space-y-3">
                                    {[
                                        { label: 'シンクロ率', val: emotion.sync_rate, color: 'var(--accent-primary)' },
                                        { label: '覚醒度', val: emotion.arousal, color: '#a78bfa' },
                                        { label: 'ポジティブ度', val: (emotion.valence + 1) / 2, color: '#f59e0b' },
                                    ].map(({ label, val, color }) => (
                                        <div key={label}>
                                            <div className="flex justify-between text-[10px] mb-1"
                                                style={{ color: 'var(--foreground-muted)' }}>
                                                <span>{label}</span>
                                                <span style={{ color }}>{(val * 100).toFixed(0)}%</span>
                                            </div>
                                            <div className="h-1.5 rounded-full overflow-hidden"
                                                style={{ background: 'rgba(216, 120, 152, 0.1)' }}>
                                                <motion.div
                                                    className="h-full rounded-full"
                                                    style={{ background: color }}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${val * 100}%` }}
                                                    transition={{ duration: 1, ease: 'easeOut' }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Uptime ───────────────────────────────────────── */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Clock size={18} style={{ color: 'var(--accent-primary)' }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>稼働時間</span>
                    </div>
                    <div className="text-3xl font-bold font-mono" style={{ color: 'var(--foreground)' }}>{node.uptime_human}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
                        デバイスID: {node.device_id.substring(0, 12)}...
                    </div>
                </motion.div>

                {/* ── CPU & Memory ─────────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Cpu size={18} style={{ color: 'var(--info)' }} />
                            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>CPU</span>
                        </div>
                        <div className="text-2xl font-bold font-mono mb-1" style={{ color: 'var(--foreground)' }}>{node.cpu.usage}</div>
                        <div className="text-xs mb-3" style={{ color: 'var(--foreground-muted)' }}>{node.cpu.model} • {node.cpu.cores}コア</div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(216, 120, 152, 0.1)' }}>
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(cpuUsage, 100)}%` }} transition={{ duration: 1 }}
                                className="h-full rounded-full"
                                style={{ background: cpuUsage > 80 ? 'var(--danger)' : cpuUsage > 50 ? 'var(--warning)' : 'var(--success)' }} />
                        </div>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-panel p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <HardDrive size={18} style={{ color: 'var(--warning)' }} />
                            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>メモリ</span>
                        </div>
                        <div className="text-2xl font-bold font-mono mb-1" style={{ color: 'var(--foreground)' }}>
                            {node.memory.used_gb} / {node.memory.total_gb} GB
                        </div>
                        <div className="text-xs mb-3" style={{ color: 'var(--foreground-muted)' }}>使用率: {node.memory.usage_percent}%</div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(216, 120, 152, 0.1)' }}>
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(memUsage, 100)}%` }} transition={{ duration: 1 }}
                                className="h-full rounded-full"
                                style={{ background: memUsage > 80 ? 'var(--danger)' : memUsage > 50 ? 'var(--warning)' : 'var(--info)' }} />
                        </div>
                    </motion.div>
                </div>

                {/* ── Network ──────────────────────────────────────── */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-panel p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Wifi size={18} style={{ color: 'var(--success)' }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>ネットワーク</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.entries(node.network.interfaces).map(([name, ip]) => (
                            <div key={name} className="p-3 rounded-lg" style={{ background: 'var(--background-tertiary)' }}>
                                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{name}</div>
                                <div className="text-sm font-mono mt-1" style={{ color: 'var(--foreground)' }}>{ip}</div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* ── Services ─────────────────────────────────────── */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-panel p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Activity size={18} style={{ color: 'var(--accent-primary)' }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>サービス</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.entries(node.services).map(([service, status]) => (
                            <div key={service} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--background-tertiary)' }}>
                                <CheckCircle2 size={16} style={{ color: statusColors[status] || 'var(--foreground-muted)' }} />
                                <div>
                                    <div className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                                        {serviceLabels[service] || service}
                                    </div>
                                    <div className="text-[10px]" style={{ color: statusColors[status] || 'var(--foreground-muted)' }}>
                                        {status === 'running' ? '稼働中' : status === 'active' ? 'アクティブ' : status === 'standby' ? 'スタンバイ' : status}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
