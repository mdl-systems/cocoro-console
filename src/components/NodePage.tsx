'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Server, Cpu, HardDrive, Wifi, Activity, RefreshCw, Clock, CheckCircle2, Loader2 } from 'lucide-react';

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
}

const serviceLabels: Record<string, string> = {
    console: 'コンソール',
    api_gateway: 'APIゲートウェイ',
    identity_engine: 'ID エンジン',
    memory_engine: 'メモリエンジン',
    agent_runtime: 'エージェント',
};

const statusLabels: Record<string, string> = {
    running: '稼働中',
    active: 'アクティブ',
    standby: 'スタンバイ',
    stopped: '停止',
};

const statusColors: Record<string, string> = {
    running: 'var(--success)',
    active: 'var(--success)',
    standby: 'var(--warning)',
    stopped: 'var(--danger)',
};

export default function NodePage() {
    const [node, setNode] = useState<NodeStatus | null>(null);
    const [loading, setLoading] = useState(true);

    async function fetchStatus() {
        try {
            const res = await fetch('/api/node');
            const data = await res.json();
            setNode(data);
        } catch { /* ignore */ } finally { setLoading(false); }
    }

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 10000);
        return () => clearInterval(interval);
    }, []);

    if (loading || !node) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-primary)' }} />
            </div>
        );
    }

    const memUsage = parseFloat(node.memory.usage_percent);
    const cpuUsage = parseFloat(node.cpu.usage);

    return (
        <div className="flex-1 flex flex-col h-screen overflow-y-auto">
            <div className="flex items-center justify-between px-8 py-6" style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                    <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>ノードステータス</h2>
                    <p className="text-sm mt-1 flex items-center gap-2" style={{ color: 'var(--foreground-muted)' }}>
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--success)' }} />
                        {node.hostname} • {node.platform}/{node.arch} • v{node.version}
                    </p>
                </div>
                <button onClick={fetchStatus} className="p-2 rounded-lg transition-colors hover:bg-[rgba(216,120,152,0.06)]" style={{ color: 'var(--foreground-muted)' }}>
                    <RefreshCw size={18} />
                </button>
            </div>

            <div className="p-8 space-y-6">
                {/* Uptime */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Clock size={18} style={{ color: 'var(--accent-primary)' }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>稼働時間</span>
                    </div>
                    <div className="text-3xl font-bold font-mono" style={{ color: 'var(--foreground)' }}>{node.uptime_human}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>デバイスID: {node.device_id.substring(0, 12)}...</div>
                </motion.div>

                {/* CPU & Memory */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Cpu size={18} style={{ color: 'var(--info)' }} />
                            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>CPU</span>
                        </div>
                        <div className="text-2xl font-bold font-mono mb-1" style={{ color: 'var(--foreground)' }}>{node.cpu.usage}</div>
                        <div className="text-xs mb-3" style={{ color: 'var(--foreground-muted)' }}>{node.cpu.model} • {node.cpu.cores}コア</div>
                        <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(216, 120, 152, 0.1)' }}>
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(cpuUsage, 100)}%` }}
                                transition={{ duration: 1 }}
                                className="h-full rounded-full"
                                style={{ background: cpuUsage > 80 ? 'var(--danger)' : cpuUsage > 50 ? 'var(--warning)' : 'var(--success)' }}
                            />
                        </div>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-panel p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <HardDrive size={18} style={{ color: 'var(--warning)' }} />
                            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>メモリ</span>
                        </div>
                        <div className="text-2xl font-bold font-mono mb-1" style={{ color: 'var(--foreground)' }}>{node.memory.used_gb} / {node.memory.total_gb} GB</div>
                        <div className="text-xs mb-3" style={{ color: 'var(--foreground-muted)' }}>使用率: {node.memory.usage_percent}%</div>
                        <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(216, 120, 152, 0.1)' }}>
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(memUsage, 100)}%` }}
                                transition={{ duration: 1 }}
                                className="h-full rounded-full"
                                style={{ background: memUsage > 80 ? 'var(--danger)' : memUsage > 50 ? 'var(--warning)' : 'var(--info)' }}
                            />
                        </div>
                    </motion.div>
                </div>

                {/* Network */}
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

                {/* Services */}
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
                                    <div className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{serviceLabels[service] || service}</div>
                                    <div className="text-[10px]" style={{ color: statusColors[status] || 'var(--foreground-muted)' }}>
                                        {statusLabels[status] || status}
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
