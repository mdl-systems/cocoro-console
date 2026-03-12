'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CocoroLogo from './CocoroLogo';

interface LockScreenProps {
    nickname: string;
    onUnlock: (pin?: string) => void;
    requirePin?: boolean;
}

export default function LockScreen({ nickname, onUnlock, requirePin = false }: LockScreenProps) {
    const [pin, setPin] = useState<string[]>(['', '', '', '']);
    const [error, setError] = useState(false);
    const [shake, setShake] = useState(false);
    const [loading, setLoading] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (requirePin) {
            inputRefs.current[0]?.focus();
        }
    }, [requirePin]);

    // ─── PIN input handler ────────────────────────────────────
    function handlePinInput(index: number, value: string) {
        if (!/^\d*$/.test(value)) return;

        const newPin = [...pin];
        newPin[index] = value.slice(-1); // keep only last digit
        setPin(newPin);
        setError(false);

        // Auto-advance to next input
        if (value && index < 3) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all filled
        if (index === 3 && value) {
            const fullPin = [...newPin.slice(0, 3), value].join('');
            if (fullPin.length === 4) {
                submitPin(fullPin);
            }
        }
    }

    function handleKeyDown(index: number, e: React.KeyboardEvent) {
        if (e.key === 'Backspace' && !pin[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
        if (e.key === 'Enter') {
            const fullPin = pin.join('');
            if (fullPin.length === 4) submitPin(fullPin);
        }
    }

    async function submitPin(fullPin: string) {
        setLoading(true);
        try {
            const res = await fetch('/api/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unlock', pin: fullPin }),
            });
            const data = await res.json();
            if (data.success) {
                onUnlock(fullPin);
            } else {
                triggerError();
            }
        } catch {
            triggerError();
        } finally {
            setLoading(false);
        }
    }

    function triggerError() {
        setError(true);
        setShake(true);
        setPin(['', '', '', '']);
        setTimeout(() => {
            setShake(false);
            inputRefs.current[0]?.focus();
        }, 600);
    }

    // ─── Simple unlock (no PIN required) ─────────────────────
    if (!requirePin) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'var(--background)' }}>
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute w-[600px] h-[600px] rounded-full animate-orb-1 opacity-10"
                        style={{ background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)', top: '20%', left: '30%' }} />
                    <div className="absolute w-[400px] h-[400px] rounded-full animate-orb-2 opacity-10"
                        style={{ background: 'radial-gradient(circle, var(--accent-secondary) 0%, transparent 70%)', bottom: '20%', right: '30%' }} />
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="relative z-10 text-center"
                >
                    <motion.div
                        className="flex justify-center mb-8"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        <CocoroLogo size={80} glow />
                    </motion.div>

                    <h2 className="text-2xl font-light mb-2" style={{ color: 'var(--foreground)' }}>
                        {nickname}さん
                    </h2>
                    <p className="text-base mb-10" style={{ color: 'var(--foreground-muted)' }}>
                        続けますか？
                    </p>

                    <motion.button
                        onClick={() => onUnlock()}
                        className="btn-primary text-base px-10 py-3.5 rounded-2xl"
                        style={{ boxShadow: '0 10px 40px var(--accent-glow)' }}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        続ける
                    </motion.button>

                    <p className="text-xs mt-6" style={{ color: 'var(--foreground-muted)', opacity: 0.5 }}>
                        30分間の非アクティブによりロックされました
                    </p>
                </motion.div>
            </div>
        );
    }

    // ─── PIN unlock screen ────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'var(--background)' }}>
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute w-[600px] h-[600px] rounded-full animate-orb-1 opacity-8"
                    style={{ background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)', top: '10%', left: '25%' }} />
                <div className="absolute w-[400px] h-[400px] rounded-full animate-orb-2 opacity-8"
                    style={{ background: 'radial-gradient(circle, var(--accent-secondary) 0%, transparent 70%)', bottom: '15%', right: '25%' }} />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="relative z-10 text-center"
            >
                <motion.div className="flex justify-center mb-6"
                    animate={{ scale: [1, 1.04, 1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                >
                    <CocoroLogo size={64} glow />
                </motion.div>

                <h2 className="text-xl font-light mb-1" style={{ color: 'var(--foreground)' }}>
                    {nickname}さん
                </h2>
                <p className="text-sm mb-8" style={{ color: 'var(--foreground-muted)' }}>
                    PIN を入力してください
                </p>

                {/* PIN dots display */}
                <div className="flex justify-center gap-3 mb-7" aria-hidden="true">
                    {pin.map((digit, i) => (
                        <motion.div
                            key={i}
                            className="w-3 h-3 rounded-full transition-all duration-200"
                            style={{
                                background: digit
                                    ? 'var(--accent-primary)'
                                    : 'var(--border)',
                                boxShadow: digit ? '0 0 8px var(--accent-glow)' : 'none',
                            }}
                        />
                    ))}
                </div>

                {/* Hidden inputs */}
                <motion.div
                    animate={shake ? { x: [-8, 8, -8, 8, -4, 4, 0] } : {}}
                    transition={{ duration: 0.5 }}
                    className="flex justify-center gap-3 mb-4"
                >
                    {[0, 1, 2, 3].map(i => (
                        <input
                            key={i}
                            ref={el => { inputRefs.current[i] = el; }}
                            type="password"
                            inputMode="numeric"
                            maxLength={1}
                            value={pin[i]}
                            onChange={e => handlePinInput(i, e.target.value)}
                            onKeyDown={e => handleKeyDown(i, e)}
                            className="w-12 h-12 rounded-xl text-center text-lg font-semibold outline-none transition-all"
                            style={{
                                background: 'var(--background-secondary)',
                                border: `2px solid ${pin[i] ? 'var(--accent-primary)' : error ? '#e57373' : 'var(--border)'}`,
                                color: 'var(--foreground)',
                                letterSpacing: '0.1em',
                            }}
                            disabled={loading}
                        />
                    ))}
                </motion.div>

                <AnimatePresence>
                    {error && (
                        <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="text-xs mb-4"
                            style={{ color: '#e57373' }}
                        >
                            PIN が正しくありません
                        </motion.p>
                    )}
                </AnimatePresence>

                {loading && (
                    <div className="flex justify-center gap-1">
                        {[0, 1, 2].map(i => (
                            <motion.div
                                key={i}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ background: 'var(--accent-primary)' }}
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                            />
                        ))}
                    </div>
                )}

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-2 mt-6 w-48 mx-auto">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                        <motion.button
                            key={n}
                            className="h-12 rounded-xl text-lg font-light transition-colors"
                            style={{
                                background: 'var(--background-secondary)',
                                color: 'var(--foreground)',
                                border: '1px solid var(--border)',
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                const nextEmpty = pin.findIndex(d => !d);
                                if (nextEmpty !== -1) handlePinInput(nextEmpty, String(n));
                            }}
                            disabled={loading}
                        >
                            {n}
                        </motion.button>
                    ))}
                    <div /> {/* spacer */}
                    <motion.button
                        className="h-12 rounded-xl text-lg font-light"
                        style={{
                            background: 'var(--background-secondary)',
                            color: 'var(--foreground)',
                            border: '1px solid var(--border)',
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                            const nextEmpty = pin.findIndex(d => !d);
                            if (nextEmpty !== -1) handlePinInput(nextEmpty, '0');
                        }}
                        disabled={loading}
                    >
                        0
                    </motion.button>
                    <motion.button
                        className="h-12 rounded-xl text-sm"
                        style={{
                            background: 'var(--background-tertiary)',
                            color: 'var(--foreground-muted)',
                            border: '1px solid var(--border)',
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                            const lastFilled = [...pin].reverse().findIndex(d => d);
                            if (lastFilled !== -1) {
                                const idx = 3 - lastFilled;
                                const newPin = [...pin];
                                newPin[idx] = '';
                                setPin(newPin);
                                inputRefs.current[idx]?.focus();
                            }
                        }}
                        disabled={loading}
                    >
                        ⌫
                    </motion.button>
                </div>
            </motion.div>
        </div>
    );
}
