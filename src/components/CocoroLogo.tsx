'use client';

/**
 * Cocoro Logo — Heartbeat Badge
 *
 * Official logo SVG from the brand design system.
 * Supports circle and rounded-square variants at any size.
 *
 * Usage:
 *   <CocoroLogo size={80} />
 *   <CocoroLogo size={32} variant="square" />
 */

interface CocoroLogoProps {
    size?: number;
    variant?: 'circle' | 'square';
    className?: string;
    glow?: boolean;
}

// Unique ID prefix per instance to avoid SVG gradient conflicts
let instanceCounter = 0;

export default function CocoroLogo({
    size = 80,
    variant = 'circle',
    className = '',
    glow = false,
}: CocoroLogoProps) {
    const id = `cl${++instanceCounter}`;

    // Adjust stroke width for small sizes
    const strokeWidth = size <= 24 ? 5 : size <= 48 ? 3.5 : 3;
    // Center dot radius
    const dotR = size <= 24 ? 7 : size <= 48 ? 6 : 5.5;
    // Show inner ring only on larger sizes
    const showRing = size > 48;
    // Show shine only on larger sizes
    const showShine = size > 40;

    const heartbeatPoints =
        '14,100 40,100 52,68 62,130 70,52 80,116 90,100 110,100 120,66 130,134 138,56 148,118 158,100 186,100';

    return (
        <svg
            viewBox="0 0 200 200"
            width={size}
            height={size}
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={glow ? { filter: `drop-shadow(0 0 ${size * 0.2}px rgba(216, 120, 152, 0.4))` } : undefined}
        >
            <defs>
                {/* Background gradient */}
                <radialGradient id={`${id}bg`} cx="38%" cy="32%" r="72%">
                    <stop offset="0%" stopColor="#FFE8F0" />
                    <stop offset="55%" stopColor="#F0A8C0" />
                    <stop offset="100%" stopColor="#D87898" />
                </radialGradient>

                {/* Shine overlay */}
                {showShine && (
                    <radialGradient id={`${id}sh`} cx="35%" cy="28%" r="50%">
                        <stop offset="0%" stopColor="#fff" stopOpacity=".38" />
                        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                    </radialGradient>
                )}

                {/* Heartbeat line gradient */}
                <linearGradient id={`${id}ln`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#fff" stopOpacity="0" />
                    <stop offset="22%" stopColor="#fff" stopOpacity=".95" />
                    <stop offset="50%" stopColor="#fff" />
                    <stop offset="78%" stopColor="#fff" stopOpacity=".95" />
                    <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                </linearGradient>

                {/* Clip path */}
                {variant === 'circle' ? (
                    <clipPath id={`${id}cp`}>
                        <circle cx="100" cy="100" r="84" />
                    </clipPath>
                ) : (
                    <clipPath id={`${id}cp`}>
                        <rect x="16" y="16" width="168" height="168" rx="42" />
                    </clipPath>
                )}
            </defs>

            {/* Shape */}
            {variant === 'circle' ? (
                <>
                    <circle cx="100" cy="100" r="88" fill={`url(#${id}bg)`} />
                    {showShine && <circle cx="100" cy="100" r="84" fill={`url(#${id}sh)`} />}
                    {showRing && (
                        <circle cx="100" cy="100" r="80" fill="none" stroke="#fff" strokeWidth="1" opacity=".25" />
                    )}
                </>
            ) : (
                <>
                    <rect x="12" y="12" width="176" height="176" rx="46" fill={`url(#${id}bg)`} />
                    {showShine && <rect x="16" y="16" width="168" height="168" rx="42" fill={`url(#${id}sh)`} />}
                    {showRing && (
                        <rect x="20" y="20" width="160" height="160" rx="38" fill="none" stroke="#fff" strokeWidth="1" opacity=".25" />
                    )}
                </>
            )}

            {/* Heartbeat line */}
            <g clipPath={`url(#${id}cp)`}>
                <polyline
                    points={heartbeatPoints}
                    fill="none"
                    stroke={`url(#${id}ln)`}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
            </g>

            {/* Center dot */}
            <circle cx="100" cy="100" r={dotR} fill="#fff" opacity=".95" />
            {showRing && (
                <circle cx="100" cy="100" r="10" fill="none" stroke="#fff" strokeWidth="1" opacity=".35" />
            )}
        </svg>
    );
}
