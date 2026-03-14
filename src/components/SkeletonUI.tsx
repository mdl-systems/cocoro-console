'use client';

import { motion } from 'framer-motion';

// ─── Shimmer base style ────────────────────────────────────────

const shimmerStyle: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--background-secondary) 25%, var(--background-tertiary) 50%, var(--background-secondary) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.6s infinite linear',
    borderRadius: '0.4rem',
};

// Inject @keyframes once
if (typeof document !== 'undefined') {
    const styleId = 'cocoro-shimmer';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `@keyframes shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }`;
        document.head.appendChild(style);
    }
}

// ─── Primitives ────────────────────────────────────────────────

interface SkeletonLineProps {
    /** Width as CSS string, default '100%' */
    width?: string;
    /** Height as CSS string, default '14px' */
    height?: string;
    className?: string;
}

export function SkeletonLine({ width = '100%', height = '14px', className }: SkeletonLineProps) {
    return (
        <div
            className={className}
            style={{ ...shimmerStyle, width, height }}
            aria-hidden="true"
        />
    );
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
    return (
        <div
            style={{ ...shimmerStyle, width: size, height: size, borderRadius: '50%', flexShrink: 0 }}
            aria-hidden="true"
        />
    );
}

interface SkeletonCardProps {
    rows?: number;
    className?: string;
    style?: React.CSSProperties;
    header?: boolean;
}

export function SkeletonCard({ rows = 3, className = '', style, header = true }: SkeletonCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`glass-panel p-5 space-y-3 ${className}`}
            style={style}
            aria-busy="true"
            aria-label="読み込み中"
        >
            {header && (
                <div className="flex items-center gap-3 mb-1">
                    <SkeletonAvatar size={28} />
                    <SkeletonLine width="40%" height="12px" />
                </div>
            )}
            {Array.from({ length: rows }).map((_, i) => (
                <SkeletonLine
                    key={i}
                    width={i === rows - 1 ? '65%' : '100%'}
                    height="12px"
                />
            ))}
        </motion.div>
    );
}

// ─── Preset Page Skeletons ─────────────────────────────────────

/** Generic 2-column grid skeleton used for Dashboard / NodePage / etc. */
export function SkeletonGridPage({ cols = 2, cards = 4 }: { cols?: number; cards?: number }) {
    return (
        <div className="flex-1 flex flex-col h-screen overflow-y-auto p-6 gap-4">
            {/* Header skeleton */}
            <div className="flex items-center justify-between pb-4 mb-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="space-y-2">
                    <SkeletonLine width="160px" height="22px" />
                    <SkeletonLine width="240px" height="12px" />
                </div>
                <div style={{ ...shimmerStyle, width: 32, height: 32, borderRadius: '0.5rem' }} aria-hidden="true" />
            </div>
            {/* Card grid */}
            <div className={`grid grid-cols-${cols} gap-4`}>
                {Array.from({ length: cards }).map((_, i) => (
                    <SkeletonCard key={i} rows={3} />
                ))}
            </div>
            {/* Wide card below */}
            <SkeletonCard rows={5} header={false} />
        </div>
    );
}

/** Chat message skeleton (alternating user / AI) */
export function SkeletonChatMessages({ count = 4 }: { count?: number }) {
    return (
        <div className="max-w-[720px] mx-auto px-6 py-6 space-y-4">
            {Array.from({ length: count }).map((_, i) => {
                const isUser = i % 2 === 0;
                return (
                    <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2.5`}>
                        {!isUser && <SkeletonAvatar size={28} />}
                        <div className={`space-y-1.5 max-w-[55%] ${isUser ? 'items-end flex flex-col' : ''}`}>
                            <SkeletonLine width="100%" height="12px" />
                            {i % 3 !== 0 && <SkeletonLine width="80%" height="12px" />}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/** Memory / list item skeleton */
export function SkeletonListItems({ count = 5 }: { count?: number }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ border: '1px solid var(--border)' }}>
                    <SkeletonAvatar size={32} />
                    <div className="flex-1 space-y-1.5 pt-1">
                        <SkeletonLine width={`${60 + (i % 4) * 10}%`} height="12px" />
                        <SkeletonLine width="45%" height="10px" />
                    </div>
                </div>
            ))}
        </div>
    );
}
