'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MessageSquarePlus, Brain, LayoutDashboard, ClipboardList, Plus, Settings, Server, Shield, Bot, Network } from 'lucide-react';

// ─── コマンド定義 ──────────────────────────────────────────────
export interface Command {
    id: string;
    label: string;
    icon: React.ReactNode;
    group: string;
    shortcut?: string;
    action: () => void;
    keywords?: string[];
}

type CommandPaletteProps = {
    open: boolean;
    onClose: () => void;
    onNewChat: () => void;
    onNavigate: (page: string) => void;
};

// ─── Keyboard shortcut badge ──────────────────────────────────
function KbdBadge({ keys }: { keys: string }) {
    return (
        <span className="flex items-center gap-0.5 flex-shrink-0">
            {keys.split('+').map(k => (
                <kbd key={k}
                    className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                    style={{
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid var(--border)',
                        color: 'var(--foreground-muted)',
                    }}>
                    {k}
                </kbd>
            ))}
        </span>
    );
}

// ─── Main component ────────────────────────────────────────────
export default function CommandPalette({ open, onClose, onNewChat, onNavigate }: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [selectedIdx, setSelectedIdx] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // ─── Command定義 ─────────────────────────────────────────────
    const commands: Command[] = [
        // 最近のアクション
        {
            id: 'new-chat',
            label: '新しい会話を始める',
            icon: <MessageSquarePlus size={15} />,
            group: '最近のアクション',
            shortcut: '⌘N',
            keywords: ['new', 'chat', '新規', '会話'],
            action: () => { onNewChat(); onClose(); },
        },
        {
            id: 'memory',
            label: '記憶を確認する',
            icon: <Brain size={15} />,
            group: '最近のアクション',
            keywords: ['memory', '記憶', 'メモリ'],
            action: () => { onNavigate('memory'); onClose(); },
        },
        {
            id: 'dashboard',
            label: 'ダッシュボードを開く',
            icon: <LayoutDashboard size={15} />,
            group: '最近のアクション',
            keywords: ['dashboard', 'ダッシュボード'],
            action: () => { onNavigate('dashboard'); onClose(); },
        },

        // エージェント
        {
            id: 'agent-law',
            label: '弁護士エージェントに切り替え',
            icon: <span className="text-sm">⚖️</span>,
            group: 'エージェント',
            keywords: ['lawyer', '弁護士', 'law'],
            action: () => { onNavigate('chat'); onClose(); },
        },
        {
            id: 'agent-tax',
            label: '税理士エージェントに切り替え',
            icon: <span className="text-sm">📊</span>,
            group: 'エージェント',
            keywords: ['tax', '税理士', 'accountant'],
            action: () => { onNavigate('chat'); onClose(); },
        },
        {
            id: 'agent-eng',
            label: 'エンジニアエージェントに切り替え',
            icon: <span className="text-sm">💻</span>,
            group: 'エージェント',
            keywords: ['engineer', 'エンジニア', 'code', 'coding'],
            action: () => { onNavigate('chat'); onClose(); },
        },
        {
            id: 'agent-research',
            label: 'リサーチエージェントに切り替え',
            icon: <span className="text-sm">🔍</span>,
            group: 'エージェント',
            keywords: ['research', 'リサーチ', 'search'],
            action: () => { onNavigate('chat'); onClose(); },
        },

        // タスク
        {
            id: 'tasks',
            label: 'タスク一覧を開く',
            icon: <ClipboardList size={15} />,
            group: 'タスク',
            keywords: ['tasks', 'タスク', 'task'],
            action: () => { onNavigate('tasks'); onClose(); },
        },
        {
            id: 'new-task',
            label: '新しいタスクを作成',
            icon: <Plus size={15} />,
            group: 'タスク',
            keywords: ['new task', 'タスク作成', '新規タスク'],
            action: () => { onNavigate('tasks'); onClose(); },
        },

        // 設定・システム
        {
            id: 'agents-page',
            label: 'エージェント管理',
            icon: <Bot size={15} />,
            group: 'システム',
            keywords: ['agents', 'エージェント'],
            action: () => { onNavigate('agents'); onClose(); },
        },
        {
            id: 'nodes',
            label: 'ノード管理',
            icon: <Network size={15} />,
            group: 'システム',
            keywords: ['nodes', 'ノード'],
            action: () => { onNavigate('nodes'); onClose(); },
        },
        {
            id: 'node-monitor',
            label: 'ノード監視',
            icon: <Server size={15} />,
            group: 'システム',
            keywords: ['node', 'monitor', '監視'],
            action: () => { onNavigate('node'); onClose(); },
        },
        {
            id: 'security',
            label: 'セキュリティ',
            icon: <Shield size={15} />,
            group: 'システム',
            keywords: ['security', 'セキュリティ'],
            action: () => { onNavigate('security'); onClose(); },
        },
        {
            id: 'settings',
            label: '設定を開く',
            icon: <Settings size={15} />,
            group: 'システム',
            keywords: ['settings', '設定', 'config'],
            action: () => { onNavigate('settings'); onClose(); },
        },
    ];

    // ─── Filtering ────────────────────────────────────────────────
    const q = query.toLowerCase().trim();
    const filtered = q
        ? commands.filter(c =>
            c.label.toLowerCase().includes(q) ||
            c.group.toLowerCase().includes(q) ||
            c.keywords?.some(k => k.includes(q))
        )
        : commands;

    // Group the filtered results
    const groups = filtered.reduce((acc, cmd) => {
        if (!acc[cmd.group]) acc[cmd.group] = [];
        acc[cmd.group].push(cmd);
        return acc;
    }, {} as Record<string, Command[]>);

    const flatList = Object.values(groups).flat();
    const safeIdx = Math.min(selectedIdx, flatList.length - 1);

    // ─── Reset on open ────────────────────────────────────────────
    useEffect(() => {
        if (open) {
            setQuery('');
            setSelectedIdx(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    // Reset selection on query change
    useEffect(() => { setSelectedIdx(0); }, [query]);

    // Scroll selected into view
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-idx="${safeIdx}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [safeIdx]);

    // ─── Keyboard handling ────────────────────────────────────────
    const handleKey = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIdx(i => Math.min(i + 1, flatList.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIdx(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            flatList[safeIdx]?.action();
        } else if (e.key === 'Escape') {
            onClose();
        }
    }, [flatList, safeIdx, onClose]);

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-[99998]"
                        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
                        onClick={onClose}
                    />

                    {/* Palette */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: -12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -12 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="fixed inset-x-0 top-[18%] z-[99999] mx-auto w-full max-w-xl px-4"
                        onKeyDown={handleKey}
                    >
                        <div className="rounded-2xl overflow-hidden shadow-2xl"
                            style={{
                                background: 'var(--background-secondary)',
                                border: '1px solid var(--border)',
                                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                            }}>

                            {/* Search input */}
                            <div className="flex items-center gap-3 px-4 py-3"
                                style={{ borderBottom: '1px solid var(--border)' }}>
                                <Search size={16} style={{ color: 'var(--foreground-muted)', flexShrink: 0 }} />
                                <input
                                    ref={inputRef}
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder="何をしますか？"
                                    className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-40"
                                    style={{ color: 'var(--foreground)' }}
                                    spellCheck={false}
                                />
                                <KbdBadge keys="Esc" />
                            </div>

                            {/* Results */}
                            <div ref={listRef} className="max-h-[420px] overflow-y-auto py-2">
                                {flatList.length === 0 ? (
                                    <p className="py-10 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>
                                        「{query}」に一致するコマンドはありません
                                    </p>
                                ) : (
                                    (() => {
                                        let globalIdx = 0;
                                        return Object.entries(groups).map(([groupName, cmds]) => (
                                            <div key={groupName}>
                                                {/* Group header */}
                                                <div className="px-4 py-1.5">
                                                    <span className="text-[10px] font-semibold uppercase tracking-widest"
                                                        style={{ color: 'var(--foreground-muted)', opacity: 0.5 }}>
                                                        {groupName}
                                                    </span>
                                                </div>

                                                {/* Commands */}
                                                {cmds.map(cmd => {
                                                    const idx = globalIdx++;
                                                    const isSelected = idx === safeIdx;
                                                    return (
                                                        <button
                                                            key={cmd.id}
                                                            data-idx={idx}
                                                            onClick={cmd.action}
                                                            onMouseEnter={() => setSelectedIdx(idx)}
                                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                                                            style={{
                                                                background: isSelected
                                                                    ? 'rgba(216,120,152,0.10)'
                                                                    : 'transparent',
                                                                borderLeft: isSelected
                                                                    ? '2px solid var(--accent-primary)'
                                                                    : '2px solid transparent',
                                                            }}
                                                        >
                                                            <span className="w-5 h-5 flex items-center justify-center flex-shrink-0"
                                                                style={{ color: isSelected ? 'var(--accent-primary)' : 'var(--foreground-muted)' }}>
                                                                {cmd.icon}
                                                            </span>
                                                            <span className="flex-1 text-sm"
                                                                style={{ color: isSelected ? 'var(--foreground)' : 'var(--foreground-muted)' }}>
                                                                {cmd.label}
                                                            </span>
                                                            {cmd.shortcut && <KbdBadge keys={cmd.shortcut} />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ));
                                    })()
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-4 py-2.5 flex items-center gap-4 text-[10px]"
                                style={{ borderTop: '1px solid var(--border)', color: 'var(--foreground-muted)', opacity: 0.5 }}>
                                <span><KbdBadge keys="↑+↓" /> 移動</span>
                                <span><KbdBadge keys="↵" /> 実行</span>
                                <span><KbdBadge keys="Esc" /> 閉じる</span>
                                <span className="ml-auto">{flatList.length} 件</span>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
