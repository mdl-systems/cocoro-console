'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────

type ConnStatus = 'checking' | 'online' | 'offline' | 'degraded';

interface ConnectionErrorBannerProps {
    /** If true, renders a full-screen error overlay instead of an inline banner. */
    fullscreen?: boolean;
    /** Called after a successful reconnect check. */
    onReconnected?: () => void;
    /** Service label shown in error messages. Default: "cocoro-core" */
    serviceName?: string;
    /** Override the connection status from outside. Leave undefined to self-check. */
    status?: ConnStatus;
}

// ─── Singleton health poller ────────────────────────────────────
//
// globalThis を使って HMR / 複数インスタンス間で状態を共有する。
// 複数ページに <ConnectionErrorBanner /> が置かれていても
// /api/health へのリクエストは POLL_INTERVAL_MS に 1 回だけ送られる。
//
type HealthState = {
    status: ConnStatus;
    listeners: Set<(s: ConnStatus) => void>;
    timerId: ReturnType<typeof setInterval> | null;
    lastFetch: number; // epoch ms
};

function getGlobalHealthState(): HealthState {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any;
    if (!g.__cocoroHealthState) {
        g.__cocoroHealthState = {
            status: 'checking' as ConnStatus,
            listeners: new Set<(s: ConnStatus) => void>(),
            timerId: null,
            lastFetch: 0,
        } as HealthState;
    }
    return g.__cocoroHealthState as HealthState;
}

const POLL_INTERVAL_MS = 120_000;  // 120秒（429対策）
const MIN_FETCH_INTERVAL_MS = 30_000; // 30秒以内の重複fetchを抑制

async function fetchHealth(): Promise<ConnStatus> {
    const state = getGlobalHealthState();
    const now = Date.now();

    // 最低間隔チェック（複数コンポーネントから同時に呼ばれた場合）
    if (now - state.lastFetch < MIN_FETCH_INTERVAL_MS) {
        // 前回の状態を返す（checking の場合は online として扱う）
        return state.status === 'checking' ? 'online' : state.status;
    }
    state.lastFetch = now;

    try {
        const res = await fetch('/api/health', {
            signal: AbortSignal.timeout(5000),
            cache: 'no-store',
        });

        // ─── 429 Too Many Requests ─────────────────────────────
        // レートリミットは「接続不可」ではない。
        // 前回の成功状態を維持してバナーを出さない。
        if (res.status === 429) {
            console.warn('[Health] 429 received – keeping previous status:', state.status);
            return state.status === 'checking' ? 'online' : state.status;
        }

        return res.ok ? 'online' : 'offline';
    } catch {
        // タイムアウト / ネットワークエラーのみ offline
        return 'offline';
    }
}

function startGlobalPoller() {
    const state = getGlobalHealthState();
    if (state.timerId !== null) return; // 既に起動済み

    // 初回フェッチ
    fetchHealth().then(s => {
        state.status = s;
        state.listeners.forEach(fn => fn(s));
    });

    // POLL_INTERVAL_MS ごとのポーリング
    state.timerId = setInterval(async () => {
        const s = await fetchHealth();
        state.status = s;
        state.listeners.forEach(fn => fn(s));
    }, POLL_INTERVAL_MS);
}

// 外部から直接チェックできるエクスポート（手動 retry 用）
export async function checkHealth(): Promise<ConnStatus> {
    return fetchHealth();
}

// ─── Sub: Inline banner ────────────────────────────────────────

function InlineBanner({
    status,
    serviceName,
    onRetry,
    retrying,
}: {
    status: ConnStatus;
    serviceName: string;
    onRetry: () => void;
    retrying: boolean;
}) {
    if (status === 'online') return null;

    const isDegraded = status === 'degraded';
    const color = isDegraded ? '#f59e0b' : '#f87171';
    const bg = isDegraded ? 'rgba(245,158,11,0.08)' : 'rgba(248,113,113,0.08)';
    const border = isDegraded ? 'rgba(245,158,11,0.25)' : 'rgba(248,113,113,0.25)';
    const Icon = isDegraded ? AlertTriangle : WifiOff;
    const msg = isDegraded
        ? `${serviceName} への接続が不安定です`
        : `${serviceName} に接続できません`;

    return (
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-2.5 px-4 py-2.5 text-xs"
            style={{ background: bg, borderBottom: `1px solid ${border}` }}
        >
            <Icon size={14} style={{ color, flexShrink: 0 }} />
            <span style={{ color, flex: 1, fontWeight: 500 }}>{msg}</span>
            <button
                onClick={onRetry}
                disabled={retrying}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg transition-opacity disabled:opacity-50"
                style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
            >
                <RefreshCw size={11} className={retrying ? 'animate-spin' : ''} />
                再接続する
            </button>
        </motion.div>
    );
}

// ─── Sub: Full-screen overlay ──────────────────────────────────

function FullscreenError({
    status,
    serviceName,
    onRetry,
    retrying,
}: {
    status: ConnStatus;
    serviceName: string;
    onRetry: () => void;
    retrying: boolean;
}) {
    const isDegraded = status === 'degraded';
    const Icon = isDegraded ? AlertTriangle : WifiOff;
    const color = isDegraded ? '#f59e0b' : '#f87171';
    const msg = isDegraded
        ? '一部サービスへの接続が不安定です'
        : `${serviceName} に接続できません`;
    const sub = isDegraded
        ? 'cocoro-core が起動中か確認してください。しばらくお待ちいただくと復旧する場合があります。'
        : 'LAN 内の cocoro-core サービスが起動しているか確認してください。\nWi-Fi / LAN ケーブルの接続も確認してください。';

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-6 text-center"
            style={{ background: 'var(--background, #0a0a0a)' }}
        >
            <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: `${color}14`, border: `1px solid ${color}30` }}
            >
                <Icon size={36} style={{ color }} />
            </motion.div>

            <div>
                <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--foreground, #fff)' }}>
                    {msg}
                </h2>
                <p className="text-sm whitespace-pre-line" style={{ color: 'var(--foreground-muted, #999)', maxWidth: 360 }}>
                    {sub}
                </p>
            </div>

            <div className="flex gap-2 flex-wrap justify-center">
                {['cocoro-core :8001', 'cocoro-agent :8002'].map(svc => (
                    <span
                        key={svc}
                        className="text-[11px] px-2.5 py-1 rounded-full font-mono"
                        style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}
                    >
                        {svc}
                    </span>
                ))}
            </div>

            <button
                onClick={onRetry}
                disabled={retrying}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50"
                style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
            >
                <RefreshCw size={16} className={retrying ? 'animate-spin' : ''} />
                {retrying ? '確認中...' : '再接続する'}
            </button>

            <button
                onClick={() => window.location.reload()}
                className="text-xs underline-offset-2 underline"
                style={{ color: 'var(--foreground-muted, #666)' }}
            >
                モックモードで続ける（オフライン）
            </button>
        </motion.div>
    );
}

// ─── Main Export ───────────────────────────────────────────────

/**
 * ConnectionErrorBanner
 *
 * Singleton グローバルポーラーで /api/health を 120 秒ごとに確認する。
 * 複数ページにマウントされても fetch は 1 回だけ実行される。
 * 429 受信時は前回の成功状態を維持してバナーを表示しない。
 */
export default function ConnectionErrorBanner({
    fullscreen = false,
    onReconnected,
    serviceName = 'cocoro-core',
    status: externalStatus,
}: ConnectionErrorBannerProps) {
    const [status, setStatus] = useState<ConnStatus>(() => {
        if (externalStatus !== undefined) return externalStatus;
        // グローバル状態から初期値を取得（ページ遷移後も維持）
        const g = getGlobalHealthState();
        return g.status === 'checking' ? 'checking' : g.status;
    });
    const [retrying, setRetrying] = useState(false);
    const [reconnectedFlash, setReconnectedFlash] = useState(false);

    // グローバルポーラーに購読する
    useEffect(() => {
        if (externalStatus !== undefined) return;

        const state = getGlobalHealthState();

        const listener = (s: ConnStatus) => {
            setStatus(s);
            if (s === 'online') onReconnected?.();
        };

        state.listeners.add(listener);
        startGlobalPoller(); // 二重起動はガード済み

        // 現在の状態を即時反映
        if (state.status !== 'checking') setStatus(state.status);

        return () => {
            state.listeners.delete(listener);
            // タイマーは残す（他のリスナーが使っている可能性があるため）
        };
    }, [externalStatus, onReconnected]);

    // 外部 status の同期
    useEffect(() => {
        if (externalStatus !== undefined) setStatus(externalStatus);
    }, [externalStatus]);

    const handleRetry = useCallback(async () => {
        setRetrying(true);
        // 再試行時は MIN_FETCH_INTERVAL_MS を無視して強制フェッチ
        getGlobalHealthState().lastFetch = 0;
        const s = await fetchHealth();
        const state = getGlobalHealthState();
        state.status = s;
        state.listeners.forEach(fn => fn(s));
        setStatus(s);
        if (s === 'online') {
            setReconnectedFlash(true);
            setTimeout(() => setReconnectedFlash(false), 2500);
            onReconnected?.();
        }
        setRetrying(false);
    }, [onReconnected]);

    // 初回チェック中は何も表示しない
    if (status === 'checking') return null;

    // 接続復旧フラッシュ
    if (reconnectedFlash) {
        return (
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-4 py-2.5 text-xs"
                style={{ background: 'rgba(52,211,153,0.08)', borderBottom: '1px solid rgba(52,211,153,0.2)' }}
            >
                <CheckCircle2 size={13} style={{ color: '#34d399' }} />
                <span style={{ color: '#34d399', fontWeight: 500 }}>接続が復旧しました</span>
            </motion.div>
        );
    }

    // オンライン時は何も表示しない
    if (status === 'online') return null;

    return (
        <AnimatePresence>
            {fullscreen ? (
                <FullscreenError
                    status={status}
                    serviceName={serviceName}
                    onRetry={handleRetry}
                    retrying={retrying}
                />
            ) : (
                <InlineBanner
                    status={status}
                    serviceName={serviceName}
                    onRetry={handleRetry}
                    retrying={retrying}
                />
            )}
        </AnimatePresence>
    );
}

export type { ConnStatus };
