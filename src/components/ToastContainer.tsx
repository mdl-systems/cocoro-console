'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertCircle, X, ArrowRight, Bell } from 'lucide-react';

// ─── 型 ──────────────────────────────────────────────────────
export interface ToastNotification {
    id: string;
    type: 'success' | 'error' | 'info' | 'task';
    title: string;
    message?: string;
    task_id?: string;
    duration?: number; // ms, default 5000
}

// ─── Global singleton (simple pub/sub) ───────────────────────
type Listener = (toast: ToastNotification) => void;
const listeners: Listener[] = [];

export function showToast(toast: Omit<ToastNotification, 'id'>) {
    const full: ToastNotification = { ...toast, id: `toast_${Date.now()}_${Math.random().toString(36).slice(2)}` };
    listeners.forEach(fn => fn(full));
}

// ─── Toast item ───────────────────────────────────────────────
function ToastItem({
    toast,
    onDismiss,
    onNavigate,
}: {
    toast: ToastNotification;
    onDismiss: (id: string) => void;
    onNavigate?: (taskId: string) => void;
}) {
    const icons = {
        success: <CheckCircle2 size={16} style={{ color: '#34d399' }} />,
        error: <XCircle size={16} style={{ color: '#f87171' }} />,
        info: <Bell size={16} style={{ color: '#60a5fa' }} />,
        task: <CheckCircle2 size={16} style={{ color: '#34d399' }} />,
    };
    const borders = {
        success: '#34d39940',
        error: '#f8717140',
        info: '#60a5fa40',
        task: '#34d39940',
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.2 } }}
            className="relative w-80 rounded-2xl overflow-hidden shadow-2xl"
            style={{
                background: 'var(--background-secondary)',
                border: `1px solid ${borders[toast.type]}`,
                backdropFilter: 'blur(12px)',
            }}
        >
            {/* Progress bar */}
            <motion.div
                className="absolute top-0 left-0 h-0.5 rounded-full"
                style={{ background: toast.type === 'error' ? '#f87171' : '#34d399' }}
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: (toast.duration ?? 5000) / 1000, ease: 'linear' }}
            />

            <div className="p-4">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                            {toast.title}
                        </div>
                        {toast.message && (
                            <div className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--foreground-muted)' }}>
                                {toast.message}
                            </div>
                        )}
                        {toast.task_id && onNavigate && (
                            <button
                                onClick={() => { onNavigate(toast.task_id!); onDismiss(toast.id); }}
                                className="mt-2 text-xs flex items-center gap-1 transition-opacity hover:opacity-70"
                                style={{ color: 'var(--accent-primary)' }}
                            >
                                結果を見る <ArrowRight size={11} />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => onDismiss(toast.id)}
                        className="flex-shrink-0 p-0.5 rounded transition-colors hover:bg-white/[0.06]"
                        style={{ color: 'var(--foreground-muted)' }}
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

// ─── Toast Container ──────────────────────────────────────────
export default function ToastContainer({
    onNavigateTasks,
}: {
    onNavigateTasks?: () => void;
}) {
    const [toasts, setToasts] = useState<ToastNotification[]>([]);
    const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const eventSourceRef = useRef<EventSource | null>(null);

    const dismiss = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
        const timer = timers.current.get(id);
        if (timer) { clearTimeout(timer); timers.current.delete(id); }
    }, []);

    const add = useCallback((toast: ToastNotification) => {
        setToasts(prev => [...prev.slice(-4), toast]); // max 5

        // OS Notification
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(toast.title, { body: toast.message, icon: '/favicon.svg' });
        }

        const duration = toast.duration ?? 5000;
        const timer = setTimeout(() => dismiss(toast.id), duration);
        timers.current.set(toast.id, timer);
    }, [dismiss]);

    // Subscribe to global pub/sub
    useEffect(() => {
        listeners.push(add);
        return () => {
            const idx = listeners.indexOf(add);
            if (idx !== -1) listeners.splice(idx, 1);
        };
    }, [add]);

    // Request notification permission
    useEffect(() => {
        if (typeof window === 'undefined' || !('Notification' in window)) return;
        if (Notification.permission === 'default') {
            // Delay 2s to avoid blocking page load
            const t = setTimeout(() => Notification.requestPermission(), 2000);
            return () => clearTimeout(t);
        }
    }, []);

    // SSE connection for server-push notifications
    useEffect(() => {
        function connect() {
            const es = new EventSource('/api/webhooks/agent');
            eventSourceRef.current = es;

            es.onmessage = (e) => {
                try {
                    const payload = JSON.parse(e.data);
                    if (payload.type === 'task_update') {
                        const isComplete = payload.status === 'completed';
                        add({
                            id: `sse_${Date.now()}`,
                            type: isComplete ? 'task' : 'info',
                            title: isComplete ? '✅ タスク完了' : `📋 タスク更新: ${payload.status}`,
                            message: payload.task_title,
                            task_id: payload.task_id,
                            duration: 6000,
                        });
                    }
                } catch { /* malformed */ }
            };

            es.onerror = () => {
                es.close();
                // Reconnect after 10s
                setTimeout(connect, 10_000);
            };
        }
        connect();
        return () => { eventSourceRef.current?.close(); };
    }, [add]);

    return (
        <div
            className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
            aria-live="polite"
        >
            <AnimatePresence mode="sync">
                {toasts.map(toast => (
                    <div key={toast.id} className="pointer-events-auto">
                        <ToastItem
                            toast={toast}
                            onDismiss={dismiss}
                            onNavigate={onNavigateTasks ? () => onNavigateTasks() : undefined}
                        />
                    </div>
                ))}
            </AnimatePresence>
        </div>
    );
}
