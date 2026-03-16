'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, Zap } from 'lucide-react';
import CocoroLogo from './CocoroLogo';

interface Step {
    id: string;
    label: string;
    status: 'waiting' | 'loading' | 'done' | 'skipped';
}

export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
    const [steps, setSteps] = useState<Step[]>([
        { id: 'session', label: 'セッションを確認中...', status: 'waiting' },
        { id: 'core', label: 'cocoro-core 接続中...', status: 'waiting' },
        { id: 'memory', label: '記憶を読み込み中...', status: 'waiting' },
        { id: 'emotion', label: '感情状態を確認中...', status: 'waiting' },
        { id: 'ready', label: 'チャット画面へ', status: 'waiting' },
    ]);
    const [logoVisible, setLogoVisible] = useState(false);
    const [done, setDone] = useState(false);

    function setStepStatus(id: string, status: Step['status']) {
        setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    }

    useEffect(() => {
        // Show logo first
        const t0 = setTimeout(() => setLogoVisible(true), 100);

        async function run() {
            // session
            setStepStatus('session', 'loading');
            await delay(300);
            try {
                const r = await fetch('/api/session');
                await r.json();
                setStepStatus('session', 'done');
            } catch { setStepStatus('session', 'skipped'); }

            // cocoro-core health
            setStepStatus('core', 'loading');
            await delay(200);
            try {
                const r = await fetch('/api/health');
                const d = await r.json();
                // jsonSuccess は { success, services:[...] } でスプレッド（d.data は存在しない）
                const services = d.services ?? d.data?.services ?? [];
                const coreUp = Array.isArray(services)
                    && services.some((s: { id: string; status: string }) =>
                        s.id === 'core' && s.status === 'online');
                setStepStatus('core', coreUp ? 'done' : 'skipped');

            } catch { setStepStatus('core', 'skipped'); }

            // memory
            setStepStatus('memory', 'loading');
            await delay(250);
            try {
                await fetch('/api/memory/list');
                setStepStatus('memory', 'done');
            } catch { setStepStatus('memory', 'skipped'); }

            // emotion
            setStepStatus('emotion', 'loading');
            await delay(200);
            try {
                await fetch('/api/node/emotion');
                setStepStatus('emotion', 'done');
            } catch { setStepStatus('emotion', 'skipped'); }

            // ready
            setStepStatus('ready', 'loading');
            await delay(300);
            setStepStatus('ready', 'done');
            await delay(400);
            setDone(true);
        }

        const t1 = setTimeout(run, 600);
        return () => { clearTimeout(t0); clearTimeout(t1); };
    }, []);

    useEffect(() => {
        if (done) {
            const t = setTimeout(onComplete, 350);
            return () => clearTimeout(t);
        }
    }, [done, onComplete]);

    return (
        <AnimatePresence>
            {!done && (
                <motion.div
                    className="fixed inset-0 z-[99999] flex flex-col items-center justify-center gap-8"
                    style={{ background: 'var(--background)' }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    {/* Logo */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: logoVisible ? 1 : 0, scale: logoVisible ? 1 : 0.85 }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className="flex flex-col items-center gap-3"
                    >
                        <CocoroLogo size={64} />
                        <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                            Cocoro OS
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Zap size={12} style={{ color: 'var(--accent-primary)' }} />
                            <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                                Personal AI Node
                            </span>
                        </div>
                    </motion.div>

                    {/* Steps */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: logoVisible ? 1 : 0, y: logoVisible ? 0 : 10 }}
                        transition={{ duration: 0.4, delay: 0.3 }}
                        className="flex flex-col gap-2 w-72"
                    >
                        {steps.map((step, i) => (
                            <motion.div
                                key={step.id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: step.status !== 'waiting' ? 1 : 0.3, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-center gap-2.5 text-sm"
                            >
                                {step.status === 'loading' ? (
                                    <Loader2 size={14} className="animate-spin flex-shrink-0"
                                        style={{ color: 'var(--accent-primary)' }} />
                                ) : step.status === 'done' ? (
                                    <CheckCircle2 size={14} className="flex-shrink-0"
                                        style={{ color: '#34d399' }} />
                                ) : step.status === 'skipped' ? (
                                    <CheckCircle2 size={14} className="flex-shrink-0"
                                        style={{ color: 'var(--foreground-muted)' }} />
                                ) : (
                                    <div className="w-3.5 h-3.5 rounded-full border flex-shrink-0"
                                        style={{ borderColor: 'var(--border)' }} />
                                )}
                                <span style={{
                                    color: step.status === 'done' ? 'var(--foreground)'
                                        : step.status === 'loading' ? 'var(--accent-primary)'
                                            : 'var(--foreground-muted)',
                                }}>
                                    {step.label}
                                </span>
                            </motion.div>
                        ))}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function delay(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}
