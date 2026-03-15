'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity, RefreshCw, MessageCircle, Shield, TrendingUp,
    CheckCircle2, XCircle, Clock, BarChart3, AlertTriangle, Link2,
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer,
} from 'recharts';
import SyncWidget, { getSyncColor } from './SyncWidget';
import ConnectionErrorBanner from './ConnectionErrorBanner';
import { SkeletonGridPage } from './SkeletonUI';

// ─── 型 ──────────────────────────────────────────────────────
interface ServiceStatus {
    id: string;
    name: string;
    icon: string;
    port: number;
    status: 'online' | 'offline' | 'unknown';
    latencyMs: number | null;
}

interface Conversation {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

interface AgentStat {
    id: string;
    name: string;
    icon: string;
    count: number;
    color: string;
}

interface LogEntry {
    event_type: string;
    ip: string | null;
    endpoint: string | null;
    status: string | null;
    timestamp: string;
    details: string | null;
}

// ─── サービスカード ───────────────────────────────────────────
function ServiceCard({ svc, index }: { svc: ServiceStatus; index: number }) {
    const online = svc.status === 'online';
    const unknown = svc.status === 'unknown';
    const color = online ? '#34d399' : unknown ? '#f59e0b' : '#f87171';
    const label = online ? '稼働中' : unknown ? '不明' : 'オフライン';

    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className="glass-panel p-5 flex flex-col gap-2"
        >
            {/* Icon + status dot */}
            <div className="flex items-center justify-between">
                <span className="text-2xl">{svc.icon}</span>
                <span className="relative flex-shrink-0 w-2.5 h-2.5">
                    <span className="block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                    {online && <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ background: color }} />}
                </span>
            </div>

            {/* Name + label */}
            <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{svc.name}</div>
                <div className="text-xs mt-0.5 font-medium" style={{ color }}>{label}</div>
            </div>

            {/* Meta */}
            <div className="text-[10px] flex items-center justify-between" style={{ color: 'var(--foreground-muted)' }}>
                {svc.port > 0 ? <span>:{svc.port}</span> : <span>ローカル</span>}
                {svc.latencyMs != null && <span>{svc.latencyMs}ms</span>}
            </div>
        </motion.div>
    );
}

// ─── エージェントバーチャート ──────────────────────────────────
function AgentChart({ agents }: { agents: AgentStat[] }) {
    const max = Math.max(...agents.map(a => a.count), 1);
    return (
        <div className="space-y-3">
            {agents.map((a, i) => (
                <motion.div key={a.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                        <span style={{ color: 'var(--foreground)' }}>{a.icon} {a.name}</span>
                        <span className="font-mono tabular-nums" style={{ color: 'var(--foreground-muted)' }}>{a.count}回</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--background-tertiary)' }}>
                        <motion.div
                            className="h-full rounded-full"
                            style={{ background: a.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${(a.count / max) * 100}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.05 }}
                        />
                    </div>
                </motion.div>
            ))}
        </div>
    );
}

// ─── ログ行 ───────────────────────────────────────────────────
function LogRow({ log }: { log: LogEntry }) {
    const ok = log.status === 'success' || log.status === 'ok';
    const warn = log.event_type?.includes('rate') || log.event_type?.includes('warn');
    const color = ok ? '#34d399' : warn ? '#f59e0b' : '#f87171';
    const Icon = ok ? CheckCircle2 : warn ? AlertTriangle : XCircle;

    return (
        <div className="flex items-start gap-2.5 py-1.5 text-[11px]"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <Icon size={12} className="flex-shrink-0 mt-0.5" style={{ color }} />
            <div className="flex-1 min-w-0">
                <span className="font-medium" style={{ color: 'var(--foreground)' }}>{log.event_type}</span>
                {log.endpoint && <span className="ml-1.5 font-mono" style={{ color: 'var(--foreground-muted)' }}>{log.endpoint}</span>}
                {log.ip && <span className="ml-1.5" style={{ color: 'var(--foreground-muted)' }}>{log.ip}</span>}
            </div>
            <span className="flex-shrink-0 tabular-nums" style={{ color: 'var(--foreground-muted)' }}>
                {new Date(log.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
        </div>
    );
}

// ─── メインページ ─────────────────────────────────────────────
export default function DashboardPage() {
    const [services, setServices] = useState<ServiceStatus[]>([]);
    const [convs, setConvs] = useState<Conversation[]>([]);
    const [agents, setAgents] = useState<AgentStat[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [totalConvs, setTotalConvs] = useState(0);
    const [totalMsgs, setTotalMsgs] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [syncHistory, setSyncHistory] = useState<Array<{ date: string; value: number }>>([]);

    const fetchAll = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);

        try {
            const [healthRes, statsRes] = await Promise.all([
                fetch('/api/health'),
                fetch('/api/stats'),
            ]);
            const healthData = await healthRes.json();
            const statsData = await statsRes.json();

            if (healthData.data?.services) setServices(healthData.data.services);
            if (statsData.data) {
                const d = statsData.data;
                setConvs(d.recentConversations ?? []);
                setAgents(d.agentUsage ?? []);
                setLogs(d.recentLogs ?? []);
                setTotalConvs(d.totalConversations ?? 0);
                setTotalMsgs(d.totalMessages ?? 0);
            }
            setLastUpdated(new Date());

            // Sync rate history
            try {
                const syncRes = await fetch('/api/sync/history');
                if (syncRes.ok) {
                    const syncData = await syncRes.json();
                    setSyncHistory(syncData.data?.history ?? syncData.history ?? []);
                }
            } catch { /* ignore */ }
        } catch { /* ignore */ } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);
    useEffect(() => {
        const id = setInterval(() => fetchAll(true), 15_000);
        return () => clearInterval(id);
    }, [fetchAll]);

    if (loading) {
        return <SkeletonGridPage cols={4} cards={4} />;
    }

    const onlineCount = services.filter(s => s.status === 'online').length;

    return (
        <div className="flex-1 flex flex-col h-screen overflow-y-auto">
            {/* Inline connection error banner */}
            <ConnectionErrorBanner serviceName="cocoro-core" onReconnected={() => fetchAll(true)} />

            {/* Header */}
            <div className="flex items-center justify-between px-8 py-5"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                        <Activity size={20} style={{ color: 'var(--accent-primary)' }} />
                        ダッシュボード
                    </h2>
                    <p className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'var(--foreground-muted)' }}>
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#34d399' }} />
                        {onlineCount}/{services.length} サービス稼働中
                        {lastUpdated && (
                            <span> • {lastUpdated.toLocaleTimeString('ja-JP')} 更新</span>
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
                {/* ── Service status cards ──────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {services.map((svc, i) => (
                        <ServiceCard key={svc.id} svc={svc} index={i} />
                    ))}
                </div>

                {/* ── Sync Rate row ─────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Full sync widget card */}
                    <SyncWidget />

                    {/* 30-day chart */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }} className="glass-panel p-5">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"
                            style={{ color: 'var(--foreground)' }}>
                            <Link2 size={14} style={{ color: 'var(--accent-primary)' }} />
                            シンクロ率 推移（30日）
                        </h3>
                        {syncHistory.length > 0 ? (
                            <ResponsiveContainer width="100%" height={140}>
                                <AreaChart data={syncHistory}
                                    margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="syncGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={getSyncColor(syncHistory[syncHistory.length - 1]?.value ?? 0.7)} stopOpacity={0.35} />
                                            <stop offset="95%" stopColor={getSyncColor(syncHistory[syncHistory.length - 1]?.value ?? 0.7)} stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                    <XAxis dataKey="date"
                                        tick={{ fontSize: 9, fill: 'var(--foreground-muted)' }}
                                        tickFormatter={d => d.slice(5)}
                                        interval={Math.floor(syncHistory.length / 5)}
                                    />
                                    <YAxis domain={[0, 1]}
                                        tick={{ fontSize: 9, fill: 'var(--foreground-muted)' }}
                                        tickFormatter={v => `${Math.round(v * 100)}%`}
                                    />
                                    <Tooltip
                                        contentStyle={{ background: 'var(--background-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                                        formatter={(v) => [`${Math.round((Number(v) || 0) * 100)}%`, 'シンクロ率']}
                                        labelFormatter={l => `📅 ${l}`}
                                    />
                                    <Area type="monotone" dataKey="value"
                                        stroke={getSyncColor(syncHistory[syncHistory.length - 1]?.value ?? 0.7)}
                                        strokeWidth={2}
                                        fill="url(#syncGrad)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-[140px]">
                                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>データなし</p>
                            </div>
                        )}
                    </motion.div>
                </div>

                {/* ── Summary numbers ───────────────────────────── */}
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { label: '総会話数', value: totalConvs, icon: MessageCircle, color: 'var(--accent-primary)' },
                        { label: '総メッセージ数', value: totalMsgs, icon: TrendingUp, color: '#a78bfa' },
                    ].map(({ label, value, icon: Icon, color }) => (
                        <motion.div key={label}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass-panel p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                                <Icon size={18} style={{ color }} />
                            </div>
                            <div>
                                <div className="text-2xl font-bold font-mono" style={{ color }}>{value.toLocaleString()}</div>
                                <div className="text-[10px] mt-0.5" style={{ color: 'var(--foreground-muted)' }}>{label}</div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* ── Middle: conversations + agent chart ──────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Recent conversations */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-5">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"
                            style={{ color: 'var(--foreground)' }}>
                            <MessageCircle size={14} style={{ color: 'var(--accent-primary)' }} />
                            最近の会話
                        </h3>
                        {convs.length === 0 ? (
                            <p className="text-[11px] py-4 text-center" style={{ color: 'var(--foreground-muted)' }}>
                                会話履歴がありません
                            </p>
                        ) : (
                            <div className="space-y-1">
                                {convs.map(c => (
                                    <div key={c.id}
                                        className="flex items-center gap-2 py-2 text-[11px] rounded-lg"
                                        style={{ borderBottom: '1px solid var(--border)' }}>
                                        <Clock size={10} className="flex-shrink-0" style={{ color: 'var(--foreground-muted)' }} />
                                        <span className="flex-1 truncate" style={{ color: 'var(--foreground)' }}>
                                            {c.title || '（無題）'}
                                        </span>
                                        <span className="flex-shrink-0 tabular-nums" style={{ color: 'var(--foreground-muted)' }}>
                                            {new Date(c.updated_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>

                    {/* Agent usage */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-5">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"
                            style={{ color: 'var(--foreground)' }}>
                            <BarChart3 size={14} style={{ color: 'var(--accent-primary)' }} />
                            エージェント使用状況
                        </h3>
                        <AgentChart agents={agents} />
                    </motion.div>
                </div>

                {/* ── System logs ──────────────────────────────── */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-panel p-5">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"
                        style={{ color: 'var(--foreground)' }}>
                        <Shield size={14} style={{ color: 'var(--accent-primary)' }} />
                        システムログ
                        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(216,120,152,0.1)', color: 'var(--accent-primary)' }}>
                            直近{logs.length}件
                        </span>
                    </h3>
                    {logs.length === 0 ? (
                        <p className="text-[11px] py-4 text-center" style={{ color: 'var(--foreground-muted)' }}>
                            ログがありません
                        </p>
                    ) : (
                        <div>
                            <AnimatePresence initial={false}>
                                {logs.map((log, i) => (
                                    <motion.div key={i}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: i * 0.03 }}>
                                        <LogRow log={log} />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
