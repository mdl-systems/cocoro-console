'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Loader2 } from 'lucide-react';

interface BriefData {
    date: string;
    greeting: string;
    message: string;
    tasks_suggested: string[];
    source: 'core' | 'local';
}

interface DailyBriefingBannerProps {
    onNavigateTasks: () => void;
}

const STORAGE_KEY = 'cocoro_brief_shown';

export default function DailyBriefingBanner({ onNavigateTasks }: DailyBriefingBannerProps) {
    const [brief, setBrief] = useState<BriefData | null>(null);
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const today = new Date().toISOString().slice(0, 10);
            const stored = localStorage.getItem(STORAGE_KEY);

            // Show only once per day, and only between 6:00–11:00
            const now = new Date();
            const hour = now.getHours();
            if (stored === today) return;          // already shown today
            if (hour < 6 || hour >= 11) return;    // outside morning window

            setLoading(true);
            fetch('/api/brief/daily')
                .then(r => r.json())
                .then(data => {
                    if (data.data) {
                        setBrief(data.data);
                        setVisible(true);
                        localStorage.setItem(STORAGE_KEY, today);
                    }
                })
                .catch(() => { /* ignore */ })
                .finally(() => setLoading(false));
        } catch { /* localStorage blocked (e.g. private mode) */ }
    }, []);

    function dismiss() {
        setVisible(false);
    }

    if (loading) return null; // silent load

    return (
        <AnimatePresence>
            {visible && brief && (
                <motion.div
                    initial={{ opacity: 0, y: -16, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -16, height: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="overflow-hidden"
                >
                    <div
                        className="mx-4 mt-3 px-4 py-3 rounded-xl flex items-center gap-4"
                        style={{
                            background: 'linear-gradient(135deg, rgba(216,120,152,0.12) 0%, rgba(168,139,250,0.10) 100%)',
                            border: '1px solid rgba(216,120,152,0.25)',
                        }}
                    >
                        {/* Icon */}
                        <span className="text-2xl flex-shrink-0 leading-none select-none">🌅</span>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                                {brief.greeting}
                            </div>
                            <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--foreground-muted)' }}>
                                {brief.message}
                            </div>
                        </div>

                        {/* CTA */}
                        <button
                            onClick={() => { onNavigateTasks(); dismiss(); }}
                            className="flex-shrink-0 text-xs flex items-center gap-1 px-3 py-1.5 rounded-full transition-all hover:opacity-80"
                            style={{
                                background: 'rgba(216,120,152,0.15)',
                                border: '1px solid rgba(216,120,152,0.3)',
                                color: 'var(--accent-primary)',
                            }}
                        >
                            確認する <ArrowRight size={11} />
                        </button>

                        {/* Dismiss */}
                        <button onClick={dismiss}
                            className="flex-shrink-0 p-1 rounded hover:bg-white/[0.06] transition-colors"
                            style={{ color: 'var(--foreground-muted)' }}>
                            <X size={13} />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
