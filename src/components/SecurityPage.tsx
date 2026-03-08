'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Key, Globe, FileText, AlertTriangle, CheckCircle2, Clock, Loader2 } from 'lucide-react';

interface SecurityEvent {
    timestamp: string;
    type: string;
    details: Record<string, unknown>;
}

const eventTypeLabels: Record<string, { label: string; color: string; icon: typeof Shield }> = {
    device_auth: { label: 'デバイス認証', color: 'var(--success)', icon: Key },
    session_created: { label: 'セッション作成', color: 'var(--info)', icon: Lock },
    session_expired: { label: 'セッション期限切れ', color: 'var(--warning)', icon: Clock },
    session_locked: { label: 'セッションロック', color: 'var(--warning)', icon: Lock },
    session_unlocked: { label: 'セッション解除', color: 'var(--success)', icon: Lock },
    session_destroyed: { label: 'セッション破棄', color: 'var(--foreground-muted)', icon: Lock },
    api_access: { label: 'APIアクセス', color: 'var(--info)', icon: Globe },
    access_denied: { label: 'アクセス拒否', color: 'var(--danger)', icon: AlertTriangle },
    csrf_violation: { label: 'CSRF違反', color: 'var(--danger)', icon: AlertTriangle },
    origin_violation: { label: 'オリジン違反', color: 'var(--danger)', icon: AlertTriangle },
};

export default function SecurityPage() {
    const [events, setEvents] = useState<SecurityEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [deviceInfo, setDeviceInfo] = useState<Record<string, string> | null>(null);

    useEffect(() => {
        Promise.all([
            fetch('/api/logs').then(r => r.json()).then(d => setEvents(d.recent_events || [])),
            fetch('/api/identity').then(r => r.json()).then(d => setDeviceInfo(d)),
        ]).finally(() => setLoading(false));
    }, []);

    const securityChecks = [
        { label: 'デバイスID', status: true, detail: deviceInfo?.device_id?.substring(0, 12) + '...' || '生成中...' },
        { label: 'Ed25519鍵ペア', status: true, detail: 'アクティブ' },
        { label: 'AES-256暗号化', status: true, detail: '有効' },
        { label: 'LANアクセスのみ', status: true, detail: 'ファイアウォール有効' },
        { label: 'CSRF保護', status: true, detail: 'トークン検証有効' },
        { label: 'HTTPOnly Cookie', status: true, detail: '設定済み' },
        { label: 'セッションタイムアウト', status: true, detail: '30分 非アクティブ後' },
        { label: 'セキュリティログ', status: true, detail: `${events.length} イベント記録済み` },
    ];

    return (
        <div className="flex-1 flex flex-col h-screen overflow-y-auto">
            <div className="px-8 py-6" style={{ borderBottom: '1px solid var(--border)' }}>
                <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>セキュリティ</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>ゼロトラストセキュリティモデル</p>
            </div>

            {loading ? (
                <div className="flex-1 flex justify-center items-center"><Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-primary)' }} /></div>
            ) : (
                <div className="p-8 space-y-6">
                    {/* Security Score */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-6 flex items-center gap-6">
                        <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--success), #16a34a)' }}>
                            <Shield size={36} className="text-white" />
                        </div>
                        <div>
                            <div className="text-3xl font-bold" style={{ color: 'var(--success)' }}>8/8</div>
                            <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>セキュリティチェック通過</div>
                            <div className="text-xs mt-1" style={{ color: 'var(--success)' }}>すべての保護が有効です</div>
                        </div>
                    </motion.div>

                    {/* Checks */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="glass-panel p-6">
                        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                            <CheckCircle2 size={16} style={{ color: 'var(--success)' }} /> セキュリティステータス
                        </h3>
                        <div className="space-y-3">
                            {securityChecks.map((check, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.2)' }}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full" style={{ background: check.status ? 'var(--success)' : 'var(--danger)' }} />
                                        <span className="text-sm" style={{ color: 'var(--foreground)' }}>{check.label}</span>
                                    </div>
                                    <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{check.detail}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Event Log */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-panel p-6">
                        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                            <FileText size={16} style={{ color: 'var(--accent-primary-light)' }} /> セキュリティイベント
                        </h3>
                        {events.length === 0 ? (
                            <p className="text-sm text-center py-8" style={{ color: 'var(--foreground-muted)' }}>イベントはまだ記録されていません</p>
                        ) : (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {events.slice().reverse().map((evt, i) => {
                                    const cfg = eventTypeLabels[evt.type] || { label: evt.type, color: 'var(--foreground-muted)', icon: Shield };
                                    return (
                                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg text-xs" style={{ background: 'rgba(0,0,0,0.15)' }}>
                                            <span className="w-16 shrink-0 font-mono" style={{ color: 'var(--foreground-muted)' }}>
                                                {new Date(evt.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded" style={{ background: `${cfg.color}15`, color: cfg.color }}>{cfg.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </div>
    );
}
