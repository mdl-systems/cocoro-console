'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ─── 型 ──────────────────────────────────────────────────────
export interface SyncData {
    sync_rate: number;        // 0–1
    prev_sync_rate?: number;  // 0–1
    values_alignment?: number;
    empathy_score?: number;
    label?: string;
    source?: 'core' | 'local';
}

// ─── シンクロ率 → テーマカラー ──────────────────────────────
export function getSyncColor(rate: number): string {
    if (rate < 0.41) return '#94a3b8';        // グレー: まだ理解中
    if (rate < 0.71) return '#3b82f6';        // ブルー: 理解が深まっている
    if (rate < 0.91) return '#34d399';        // グリーン: 高い共鳴
    return '#f59e0b';                          // ゴールド: 完全シンクロ
}

export function getSyncLabel(rate: number): string {
    if (rate < 0.41) return 'まだ理解中';
    if (rate < 0.71) return '理解が深まっている';
    if (rate < 0.91) return '高い共鳴';
    return '完全シンクロ ✨';
}

// ─── 動的 CSS 変数を適用するフック ───────────────────────────
export function useSyncTheme(rate: number | null) {
    useEffect(() => {
        if (rate === null) return;
        const color = getSyncColor(rate);
        document.documentElement.style.setProperty('--accent-primary', color);
    }, [rate]);
}

// ─── ウィジェット本体 ─────────────────────────────────────────
export default function SyncWidget({ compact = false }: { compact?: boolean }) {
    const [sync, setSync] = useState<SyncData | null>(null);

    const fetchSync = useCallback(async () => {
        try {
            const res = await fetch('/api/sync/rate');
            if (!res.ok) return;
            const d = await res.json();
            setSync(d.data ?? d);
        } catch { /* offline */ }
    }, []);

    useEffect(() => {
        fetchSync();
        const id = setInterval(fetchSync, 30_000);
        return () => clearInterval(id);
    }, [fetchSync]);

    // Apply dynamic theme colour
    useSyncTheme(sync ? sync.sync_rate : null);

    if (!sync) return null;

    const pct = Math.round(sync.sync_rate * 100);
    const prevPct = sync.prev_sync_rate !== undefined ? Math.round(sync.prev_sync_rate * 100) : null;
    const delta = prevPct !== null ? pct - prevPct : null;
    const color = getSyncColor(sync.sync_rate);
    const statusLbl = getSyncLabel(sync.sync_rate);

    const TrendIcon = delta === null ? Minus : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
    const trendColor = delta === null ? 'var(--foreground-muted)' : delta > 0 ? '#34d399' : delta < 0 ? '#f87171' : 'var(--foreground-muted)';

    if (compact) {
        // Inline badge for chat header
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{ background: `${color}12`, border: `1px solid ${color}30` }}>
                <Link2 size={12} style={{ color }} />
                <span className="text-xs font-semibold tabular-nums" style={{ color }}>
                    {pct}%
                </span>
                <span className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
                    シンクロ率
                </span>
                {delta !== null && (
                    <TrendIcon size={11} style={{ color: trendColor }} />
                )}
            </div>
        );
    }

    // Full card
    return (
        <div className="glass-panel p-5 flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Link2 size={16} style={{ color }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                        シンクロ率
                    </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: `${color}15`, color }}>
                    {statusLbl}
                </span>
            </div>

            {/* Main percentage */}
            <div className="flex items-end gap-3">
                <span className="text-4xl font-bold tabular-nums leading-none" style={{ color }}>
                    {pct}
                </span>
                <span className="text-lg mb-0.5" style={{ color: 'var(--foreground-muted)' }}>%</span>
                {delta !== null && (
                    <div className="flex items-center gap-0.5 mb-1" style={{ color: trendColor }}>
                        <TrendIcon size={14} />
                        <span className="text-xs font-medium">
                            {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                        </span>
                    </div>
                )}
            </div>

            {/* Progress bar */}
            <div className="relative h-2 rounded-full overflow-hidden"
                style={{ background: `${color}15` }}>
                <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ background: `linear-gradient(90deg, ${color}80, ${color})` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                />
            </div>

            {/* Sub-scores */}
            {(sync.values_alignment !== undefined || sync.empathy_score !== undefined) && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                    {sync.values_alignment !== undefined && (
                        <div>
                            <div className="text-[10px] mb-1" style={{ color: 'var(--foreground-muted)' }}>
                                価値観
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: `${color}15` }}>
                                    <motion.div className="h-full rounded-full" style={{ background: color }}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.round(sync.values_alignment * 100)}%` }}
                                        transition={{ duration: 1.0, ease: 'easeOut', delay: 0.2 }}
                                    />
                                </div>
                                <span className="text-[11px] font-mono tabular-nums w-8 text-right" style={{ color }}>
                                    {Math.round(sync.values_alignment * 100)}%
                                </span>
                            </div>
                        </div>
                    )}
                    {sync.empathy_score !== undefined && (
                        <div>
                            <div className="text-[10px] mb-1" style={{ color: 'var(--foreground-muted)' }}>
                                共感
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: `${color}15` }}>
                                    <motion.div className="h-full rounded-full" style={{ background: color }}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.round(sync.empathy_score * 100)}%` }}
                                        transition={{ duration: 1.0, ease: 'easeOut', delay: 0.3 }}
                                    />
                                </div>
                                <span className="text-[11px] font-mono tabular-nums w-8 text-right" style={{ color }}>
                                    {Math.round(sync.empathy_score * 100)}%
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
