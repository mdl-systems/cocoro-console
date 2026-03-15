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

// ─── Health check ───────────────────────────────────────────────
//
// 対応するレスポンス形式:
//   A) Next.js /api/health (cocoro-console経由):
//      { success: true, services: [{ id:'core', status:'online'|'offline' }, ...] }
//   B) cocoro-core /health 直接 (nginx が core に転送している場合):
//      { status: 'healthy', version: '1.0.0', ... }
//
// 判定優先順位:
//   0. fetch 失敗 (タイムアウト/ネットワークエラー) → 'offline'
//   1. HTTP 非200 → 'offline'
//   2. HTTP 200 → まず 'online' とみなす（最重要ルール）
//   3. (オプション詳細) services 配列があれば core の status を確認
//      → core が 'offline' の場合のみ 'degraded' に格下げ
//
export async function checkHealth(): Promise<ConnStatus> {
    try {
        const res = await fetch('/api/health', {
            signal: AbortSignal.timeout(5000),
            cache: 'no-store',
        });

        // ── ルール 1: HTTP ステータスで判定 ──
        if (!res.ok) {
            console.debug('[ConnectionBanner] /api/health non-200:', res.status);
            return 'offline';
        }

        // ── ルール 2: HTTP 200 → 基本的に online ──
        // (cocoro-core 直接フォーマット { status:'healthy' } でも 200 なら alive)
        let data: Record<string, unknown> = {};
        try {
            data = await res.json();
        } catch {
            // JSON パース失敗でも 200 が返ったなら online とみなす
            console.debug('[ConnectionBanner] /api/health JSON parse error, but 200 → online');
            return 'online';
        }

        console.debug('[ConnectionBanner] /api/health response:', JSON.stringify(data).slice(0, 200));

        // ── ルール 3 (オプション詳細): cocoro-core 直接フォーマット ──
        // { status: 'healthy' | 'ok' | 'error', ... }
        if (typeof data.status === 'string' && data.services === undefined) {
            const coreStatus = data.status as string;
            if (coreStatus === 'error' || coreStatus === 'unhealthy') {
                return 'degraded';
            }
            // 'healthy', 'ok', その他 → online
            return 'online';
        }

        // ── ルール 4: Next.js フォーマット ──
        // { success: true, services: [{ id:'core', status:'online'|'offline' }] }
        const services = (data.services as { id?: string; status: string }[] | undefined) ?? [];

        if (services.length === 0) {
            return 'online'; // services なし = 200 が返った = alive
        }

        const coreService = services.find(s => s.id === 'core');
        if (!coreService) {
            return 'online'; // core エントリなし = 200 が返った = alive
        }

        const result = coreService.status === 'online' ? 'online' : 'degraded';
        console.debug('[ConnectionBanner] core service status:', coreService.status, '→', result);
        return result;

    } catch (err) {
        console.debug('[ConnectionBanner] /api/health fetch failed:', err);
        return 'offline';
    }
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
 * /api/health のレスポンスを解析して接続状態を判定する。
 * services[id='core'].status === 'online' の時のみ非表示。
 * 15秒ごとに自動ポーリング。
 */
export default function ConnectionErrorBanner({
    fullscreen = false,
    onReconnected,
    serviceName = 'cocoro-core',
    status: externalStatus,
}: ConnectionErrorBannerProps) {
    const [status, setStatus] = useState<ConnStatus>(externalStatus ?? 'checking');
    const [retrying, setRetrying] = useState(false);
    const [reconnectedFlash, setReconnectedFlash] = useState(false);

    const doCheck = useCallback(async () => {
        if (externalStatus !== undefined) return; // 外部制御モード
        const s = await checkHealth();
        setStatus(s);
        if (s === 'online') {
            onReconnected?.();
        }
    }, [externalStatus, onReconnected]);

    // 外部 status の同期
    useEffect(() => {
        if (externalStatus !== undefined) setStatus(externalStatus);
    }, [externalStatus]);

    // 自動ポーリング（セルフマネージドモード）
    useEffect(() => {
        if (externalStatus !== undefined) return;
        doCheck();
        const id = setInterval(doCheck, 15_000);
        return () => clearInterval(id);
    }, [doCheck, externalStatus]);

    const handleRetry = useCallback(async () => {
        setRetrying(true);
        const s = await checkHealth();
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
