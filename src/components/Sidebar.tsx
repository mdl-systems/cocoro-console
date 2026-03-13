'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    SquarePen,
    Search,
    Bot,
    Server,
    Network,
    Brain,
    Shield,
    Settings,
    LayoutDashboard,
    ClipboardList,
    PanelLeftClose,
    PanelLeftOpen,
    MessageCircle,
    Trash2,
    Menu,
    X,
} from 'lucide-react';
import CocoroLogo from './CocoroLogo';

export type NavPage = 'chat' | 'dashboard' | 'tasks' | 'agents' | 'node' | 'nodes' | 'memory' | 'security' | 'settings';

export interface Conversation {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

interface SidebarProps {
    currentPage: NavPage;
    onNavigate: (page: NavPage) => void;
    onNewChat: () => void;
    conversations: Conversation[];
    activeConversationId: string | null;
    onSelectConversation: (id: string) => void;
    onDeleteConversation: (id: string) => void;
    // Mobile
    mobileOpen?: boolean;
    onMobileClose?: () => void;
}

export default function Sidebar({
    currentPage,
    onNavigate,
    onNewChat,
    conversations,
    activeConversationId,
    onSelectConversation,
    onDeleteConversation,
    mobileOpen = false,
    onMobileClose,
}: SidebarProps) {
    const [expanded, setExpanded] = useState(false);
    const [hoveredConv, setHoveredConv] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        function check() { setIsMobile(window.innerWidth < 768); }
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const navigate = useCallback((page: NavPage) => {
        onNavigate(page);
        onMobileClose?.();
    }, [onNavigate, onMobileClose]);

    const bottomNav: { id: NavPage; icon: React.ComponentType<{ size?: number }>; label: string }[] = [
        { id: 'dashboard', icon: LayoutDashboard, label: 'ダッシュボード' },
        { id: 'tasks', icon: ClipboardList, label: 'タスク' },
        { id: 'agents', icon: Bot, label: 'エージェント' },
        { id: 'node', icon: Server, label: 'ノード監視' },
        { id: 'nodes', icon: Network, label: 'ノード管理' },
        { id: 'memory', icon: Brain, label: 'メモリ' },
        { id: 'security', icon: Shield, label: 'セキュリティ' },
        { id: 'settings', icon: Settings, label: '設定' },
    ];

    function groupConversations(convs: Conversation[]) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 86400000);
        const weekAgo = new Date(today.getTime() - 7 * 86400000);

        const groups: { label: string; items: Conversation[] }[] = [
            { label: '今日', items: [] },
            { label: '昨日', items: [] },
            { label: '過去7日間', items: [] },
            { label: 'それ以前', items: [] },
        ];

        for (const conv of convs) {
            const d = new Date(conv.updated_at);
            if (d >= today) groups[0].items.push(conv);
            else if (d >= yesterday) groups[1].items.push(conv);
            else if (d >= weekAgo) groups[2].items.push(conv);
            else groups[3].items.push(conv);
        }

        return groups.filter(g => g.items.length > 0);
    }

    // ── Shared conversation panel content ────────────────────
    const convPanel = (
        <>
            <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    チャット履歴
                </span>
                <button
                    onClick={() => { onNewChat(); onMobileClose?.(); }}
                    className="w-7 h-7 flex items-center justify-center rounded-md transition-colors hover:bg-[rgba(216,120,152,0.08)]"
                    style={{ color: 'var(--foreground-muted)' }}
                    title="新しいチャット"
                >
                    <SquarePen size={15} />
                </button>
            </div>

            <div className="px-3 pb-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: 'var(--background)', color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
                    <Search size={13} />
                    <span>検索...</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-3">
                {conversations.length === 0 ? (
                    <div className="text-center py-8">
                        <MessageCircle size={24} className="mx-auto mb-2" style={{ color: 'var(--foreground-muted)', opacity: 0.4 }} />
                        <p className="text-xs" style={{ color: 'var(--foreground-muted)', opacity: 0.6 }}>会話がありません</p>
                    </div>
                ) : (
                    groupConversations(conversations).map(group => (
                        <div key={group.label} className="mb-3">
                            <div className="text-[10px] font-medium px-2 py-1"
                                style={{ color: 'var(--foreground-muted)', opacity: 0.6 }}>
                                {group.label}
                            </div>
                            {group.items.map(conv => {
                                const isActive = conv.id === activeConversationId;
                                const isHovered = conv.id === hoveredConv;
                                return (
                                    <div key={conv.id} className="relative"
                                        onMouseEnter={() => setHoveredConv(conv.id)}
                                        onMouseLeave={() => setHoveredConv(null)}>
                                        <button
                                            onClick={() => { onSelectConversation(conv.id); onMobileClose?.(); }}
                                            className="w-full text-left px-2.5 py-2 rounded-lg text-sm truncate transition-colors"
                                            style={{
                                                color: isActive ? 'var(--foreground)' : 'var(--foreground-muted)',
                                                background: isActive ? 'rgba(216, 120, 152, 0.08)' : 'transparent',
                                                fontWeight: isActive ? 500 : 400,
                                            }}>
                                            {conv.title}
                                        </button>
                                        {isHovered && (
                                            <button
                                                onClick={e => { e.stopPropagation(); onDeleteConversation(conv.id); }}
                                                className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded transition-colors hover:bg-[rgba(208,96,96,0.1)]"
                                                style={{ color: 'var(--foreground-muted)' }}
                                                title="削除">
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))
                )}
            </div>
        </>
    );

    // ── Mobile: full-screen drawer overlay ───────────────────
    if (isMobile) {
        return (
            <AnimatePresence>
                {mobileOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-40"
                            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }}
                            onClick={onMobileClose}
                        />
                        {/* Drawer */}
                        <motion.div
                            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                            className="fixed inset-y-0 left-0 z-50 flex flex-col w-72"
                            style={{ background: 'var(--background-secondary)', borderRight: '1px solid var(--border)' }}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 pt-4 pb-2">
                                <div className="flex items-center gap-2">
                                    <CocoroLogo size={26} />
                                    <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Cocoro</span>
                                </div>
                                <button onClick={onMobileClose}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg"
                                    style={{ color: 'var(--foreground-muted)' }}>
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Nav shortcuts */}
                            <div className="grid grid-cols-4 gap-1 px-3 py-2">
                                {bottomNav.map(({ id, icon: Icon, label }) => {
                                    const isActive = currentPage === id;
                                    return (
                                        <button key={id} onClick={() => navigate(id)}
                                            className="flex flex-col items-center gap-0.5 py-2 rounded-lg transition-all"
                                            style={{
                                                background: isActive ? 'rgba(216,120,152,0.10)' : 'transparent',
                                                color: isActive ? 'var(--accent-primary)' : 'var(--foreground-muted)',
                                            }}>
                                            <Icon size={18} />
                                            <span className="text-[9px]">{label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div style={{ height: 1, background: 'var(--border)', margin: '0 12px' }} />

                            {/* Conversations */}
                            <div className="flex-1 flex flex-col overflow-hidden">
                                {convPanel}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        );
    }

    // ── Desktop: icon bar + expandable panel ─────────────────
    return (
        <>
            <aside
                className="flex flex-col items-center py-3 border-r flex-shrink-0"
                style={{ width: 52, background: 'var(--background-secondary)', borderColor: 'var(--border)' }}
            >
                <button onClick={() => navigate('chat')} className="mb-2 transition-transform hover:scale-105" title="Cocoro">
                    <CocoroLogo size={28} />
                </button>

                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors hover:bg-[rgba(216,120,152,0.08)] mb-1"
                    style={{ color: 'var(--foreground-muted)' }}
                    title={expanded ? '閉じる' : '履歴'}
                >
                    {expanded ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
                </button>

                <button
                    onClick={onNewChat}
                    className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors hover:bg-[rgba(216,120,152,0.08)]"
                    style={{ color: 'var(--foreground-muted)' }}
                    title="新しいチャット"
                >
                    <SquarePen size={18} />
                </button>

                <div className="flex-1" />

                <div className="space-y-1">
                    {bottomNav.map(({ id, icon: Icon, label }) => {
                        const isActive = currentPage === id;
                        return (
                            <button
                                key={id}
                                onClick={() => navigate(id)}
                                className="w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200"
                                style={{
                                    color: isActive ? 'var(--accent-primary)' : 'var(--foreground-muted)',
                                    background: isActive ? 'rgba(216, 120, 152, 0.10)' : 'transparent',
                                }}
                                title={label}
                            >
                                <Icon size={18} />
                            </button>
                        );
                    })}
                </div>

                <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
                        style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', color: '#fff' }}>
                        <LayoutDashboard size={14} />
                    </div>
                </div>
            </aside>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 260, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="h-screen flex flex-col border-r overflow-hidden flex-shrink-0"
                        style={{ background: 'var(--background-secondary)', borderColor: 'var(--border)' }}
                    >
                        {convPanel}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

// ── Mobile hamburger button (exported for page.tsx) ──────────
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl"
            style={{ color: 'var(--foreground-muted)', background: 'var(--background-secondary)' }}
            aria-label="メニューを開く"
        >
            <Menu size={20} />
        </button>
    );
}
