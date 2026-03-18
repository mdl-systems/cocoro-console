'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
    Sprout,
    Clock,
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
    mobileOpen?: boolean;
    onMobileClose?: () => void;
}

// ── Tooltip ───────────────────────────────────────────────────
function Tooltip({ label, children, show }: { label: string; children: React.ReactNode; show: boolean }) {
    const [visible, setVisible] = useState(false);
    if (!show) return <>{children}</>;
    return (
        <div className="relative flex w-full"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}>
            {children}
            <AnimatePresence>
                {visible && (
                    <motion.div
                        initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none"
                    >
                        <div className="px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
                            style={{ background: '#1a1a1a', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            {label}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Conversation grouping ─────────────────────────────────────
function groupConversations(convs: Conversation[]) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 86400000);

    const groups: { label: string; items: Conversation[] }[] = [
        { label: '過去7日間', items: [] },
        { label: 'それ以前', items: [] },
    ];

    for (const conv of convs) {
        const d = new Date(conv.updated_at);
        if (d >= weekAgo) groups[0].items.push(conv);
        else groups[1].items.push(conv);
    }

    return groups.filter(g => g.items.length > 0);
}

// ── Nav item ─────────────────────────────────────────────────
const NAV_ITEMS: { id: NavPage; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; label: string }[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'ホーム' },
    { id: 'tasks',     icon: ClipboardList,   label: 'タスク' },
    { id: 'agents',    icon: Bot,             label: '専門家' },
    { id: 'memory',    icon: Brain,           label: '記憶・学習' },
    { id: 'node',      icon: Server,          label: 'ノード' },
    { id: 'nodes',     icon: Network,         label: 'ネットワーク' },
    { id: 'security',  icon: Shield,          label: 'セキュリティ' },
    { id: 'settings',  icon: Settings,        label: '設定' },
];

// ══════════════════════════════════════════════════════════════
// Desktop Sidebar — claude.ai layout
// ══════════════════════════════════════════════════════════════
function DesktopSidebar({
    currentPage, onNavigate, onNewChat,
    conversations, activeConversationId, onSelectConversation, onDeleteConversation,
}: Omit<SidebarProps, 'mobileOpen' | 'onMobileClose'>) {
    const [collapsed, setCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [hoveredConv, setHoveredConv] = useState<string | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const sidebarWidth = collapsed ? 52 : 240;

    // Filter conversations by search
    const filtered = searchQuery.trim()
        ? conversations.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
        : conversations.slice(0, 30); // show max 30 recent

    const groups = groupConversations(filtered);

    return (
        <motion.aside
            animate={{ width: sidebarWidth }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="h-screen flex flex-col flex-shrink-0 overflow-hidden select-none"
            style={{ background: 'var(--background-secondary)', borderRight: '1px solid var(--border)' }}
        >
            {/* ── TOP: Logo + collapse ───────────────────────── */}
            <div className={`flex items-center flex-shrink-0 pt-3 px-2 mb-1 ${collapsed ? 'flex-col gap-1' : 'justify-between'}`}>
                {/* Logo */}
                <button
                    onClick={() => onNavigate('chat')}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[rgba(216,120,152,0.06)] min-w-0 overflow-hidden"
                    title="Cocoro OS"
                >
                    <CocoroLogo size={22} />
                    {!collapsed && (
                        <span className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                            Cocoro OS
                        </span>
                    )}
                </button>
                {/* Collapse toggle */}
                <Tooltip label={collapsed ? 'サイドバーを開く' : 'サイドバーを閉じる'} show={collapsed}>
                    <button
                        onClick={() => setCollapsed(c => !c)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 transition-colors hover:bg-[rgba(216,120,152,0.08)]"
                        style={{ color: 'var(--foreground-muted)' }}
                        title={collapsed ? 'サイドバーを開く' : 'サイドバーを閉じる'}
                    >
                        {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
                    </button>
                </Tooltip>
            </div>

            {/* ── NEW CHAT ──────────────────────────────────── */}
            <div className="px-2 mt-1 flex-shrink-0">
                <Tooltip label="新しいチャット" show={collapsed}>
                    <button
                        onClick={onNewChat}
                        className={`w-full flex items-center rounded-lg transition-all cursor-pointer hover:bg-[rgba(216,120,152,0.08)] ${
                            collapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2'
                        }`}
                        style={{ color: 'var(--foreground-muted)' }}
                    >
                        <SquarePen size={15} style={{ flexShrink: 0 }} />
                        {!collapsed && <span className="text-sm">新しいチャット</span>}
                    </button>
                </Tooltip>
            </div>

            {/* ── SEARCH ────────────────────────────────────── */}
            {!collapsed && (
                <div className="px-2 mt-1 flex-shrink-0">
                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ color: 'var(--foreground-muted)' }} />
                        <input
                            ref={searchRef}
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="チャットを検索..."
                            className="w-full pl-7 pr-7 py-1.5 text-xs rounded-lg outline-none transition-all"
                            style={{
                                background: 'var(--background)',
                                border: '1px solid var(--border)',
                                color: 'var(--foreground)',
                            }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2"
                                style={{ color: 'var(--foreground-muted)' }}
                            >
                                <X size={11} />
                            </button>
                        )}
                    </div>
                </div>
            )}
            {collapsed && (
                <div className="px-2 mt-1 flex-shrink-0">
                    <Tooltip label="検索" show={true}>
                        <button
                            onClick={() => { setCollapsed(false); setTimeout(() => searchRef.current?.focus(), 250); }}
                            className="w-full flex justify-center p-2 rounded-lg transition-colors hover:bg-[rgba(216,120,152,0.08)]"
                            style={{ color: 'var(--foreground-muted)' }}
                        >
                            <Search size={15} />
                        </button>
                    </Tooltip>
                </div>
            )}

            {/* ── DIVIDER ───────────────────────────────────── */}
            <div className="mx-2 my-2 flex-shrink-0" style={{ height: 1, background: 'var(--border)' }} />

            {/* ── NAVIGATION ────────────────────────────────── */}
            <nav className="px-2 space-y-0.5 flex-shrink-0">
                {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
                    const isActive = currentPage === id;
                    return (
                        <Tooltip key={id} label={label} show={collapsed}>
                            <button
                                onClick={() => onNavigate(id)}
                                className={`w-full flex items-center rounded-lg transition-all duration-150 text-sm text-left hover:bg-[rgba(216,120,152,0.06)] ${
                                    collapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-1.5'
                                }`}
                                style={{
                                    color: isActive ? 'var(--accent-primary)' : 'var(--foreground-muted)',
                                    background: isActive ? 'rgba(216, 120, 152, 0.10)' : 'transparent',
                                    fontWeight: isActive ? 500 : 400,
                                }}
                            >
                                <Icon size={15} style={{ flexShrink: 0 }} />
                                {!collapsed && <span>{label}</span>}
                            </button>
                        </Tooltip>
                    );
                })}
            </nav>

            {/* ── DIVIDER ───────────────────────────────────── */}
            {!collapsed && (
                <div className="mx-2 my-2 flex-shrink-0" style={{ height: 1, background: 'var(--border)' }} />
            )}

            {/* ── RECENT CONVERSATIONS ──────────────────────── */}
            {!collapsed && (
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Section header */}
                    <div className="flex items-center justify-between px-4 pt-1 pb-1.5 flex-shrink-0">
                        <span className="text-[10px] font-semibold uppercase tracking-wider"
                            style={{ color: 'var(--foreground-muted)', opacity: 0.5 }}>
                            最近の会話
                        </span>
                        <button
                            onClick={onNewChat}
                            className="w-5 h-5 flex items-center justify-center rounded transition-colors hover:bg-[rgba(216,120,152,0.1)]"
                            style={{ color: 'var(--foreground-muted)' }}
                            title="新しいチャット"
                        >
                            <SquarePen size={12} />
                        </button>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto px-2 pb-2" style={{ scrollbarWidth: 'thin' }}>
                        {conversations.length === 0 ? (
                            <div className="flex flex-col items-center py-6 gap-2">
                                <MessageCircle size={20} style={{ color: 'var(--foreground-muted)', opacity: 0.3 }} />
                                <p className="text-[10px]" style={{ color: 'var(--foreground-muted)', opacity: 0.45 }}>
                                    まだ会話がありません
                                </p>
                            </div>
                        ) : groups.length === 0 && searchQuery ? (
                            <p className="text-[10px] text-center py-4" style={{ color: 'var(--foreground-muted)', opacity: 0.5 }}>
                                「{searchQuery}」が見つかりません
                            </p>
                        ) : (
                            groups.map(group => (
                                <div key={group.label} className="mb-3">
                                    {/* Group label */}
                                    <div className="flex items-center gap-1 px-2 py-1 mb-0.5">
                                        <Clock size={9} style={{ color: 'var(--foreground-muted)', opacity: 0.4 }} />
                                        <span className="text-[9px] font-medium"
                                            style={{ color: 'var(--foreground-muted)', opacity: 0.45 }}>
                                            {group.label}
                                        </span>
                                    </div>
                                    {/* Items */}
                                    {group.items.map(conv => {
                                        const isActive = conv.id === activeConversationId;
                                        const isHovered = conv.id === hoveredConv;
                                        return (
                                            <div key={conv.id} className="relative group"
                                                onMouseEnter={() => setHoveredConv(conv.id)}
                                                onMouseLeave={() => setHoveredConv(null)}
                                            >
                                                <button
                                                    onClick={() => onSelectConversation(conv.id)}
                                                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs truncate transition-colors"
                                                    style={{
                                                        color: isActive ? 'var(--foreground)' : 'var(--foreground-muted)',
                                                        background: isActive ? 'rgba(216,120,152,0.10)' : 'transparent',
                                                        fontWeight: isActive ? 500 : 400,
                                                        paddingRight: isHovered ? '28px' : undefined,
                                                    }}
                                                >
                                                    {conv.title}
                                                </button>
                                                {isHovered && (
                                                    <button
                                                        onClick={e => { e.stopPropagation(); onDeleteConversation(conv.id); }}
                                                        className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded transition-colors hover:bg-[rgba(208,96,96,0.12)]"
                                                        style={{ color: 'var(--foreground-muted)' }}
                                                        title="削除"
                                                    >
                                                        <Trash2 size={11} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* collapsed時のスペーサー */}
            {collapsed && <div className="flex-1" />}

            {/* ── BOTTOM: User ──────────────────────────────── */}
            <div className="flex-shrink-0 px-2 py-2" style={{ borderTop: '1px solid var(--border)' }}>
                <Tooltip label="マイノード" show={collapsed}>
                    <div className={`flex items-center rounded-lg px-2 py-1.5 ${collapsed ? 'justify-center' : 'gap-2.5'}`}
                        style={{ cursor: 'default' }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', color: '#fff' }}>
                            <Sprout size={12} />
                        </div>
                        {!collapsed && (
                            <span className="text-xs truncate" style={{ color: 'var(--foreground-muted)' }}>
                                マイノード
                            </span>
                        )}
                    </div>
                </Tooltip>
            </div>
        </motion.aside>
    );
}

// ══════════════════════════════════════════════════════════════
// Mobile Drawer
// ══════════════════════════════════════════════════════════════
function MobileDrawer({
    currentPage, onNavigate, onNewChat,
    conversations, activeConversationId, onSelectConversation, onDeleteConversation,
    mobileOpen, onMobileClose,
}: SidebarProps) {
    const [hoveredConv, setHoveredConv] = useState<string | null>(null);
    const groups = groupConversations(conversations.slice(0, 20));

    const nav = useCallback((page: NavPage) => {
        onNavigate(page);
        onMobileClose?.();
    }, [onNavigate, onMobileClose]);

    return (
        <AnimatePresence>
            {mobileOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-40"
                        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
                        onClick={onMobileClose}
                    />
                    <motion.div
                        initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="fixed inset-y-0 left-0 z-50 flex flex-col w-72"
                        style={{ background: 'var(--background-secondary)', borderRight: '1px solid var(--border)' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <CocoroLogo size={22} />
                                <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Cocoro OS</span>
                            </div>
                            <button onClick={onMobileClose}
                                className="w-8 h-8 flex items-center justify-center rounded-lg"
                                style={{ color: 'var(--foreground-muted)' }}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* New chat */}
                        <div className="px-3 mb-1 flex-shrink-0">
                            <button onClick={() => { onNewChat(); onMobileClose?.(); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[rgba(216,120,152,0.08)]"
                                style={{ color: 'var(--foreground-muted)' }}>
                                <SquarePen size={15} />
                                <span>新しいチャット</span>
                            </button>
                        </div>

                        <div className="mx-3 mb-2 flex-shrink-0" style={{ height: 1, background: 'var(--border)' }} />

                        {/* Nav grid */}
                        <div className="grid grid-cols-4 gap-1 px-3 pb-2 flex-shrink-0">
                            {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
                                const isActive = currentPage === id;
                                return (
                                    <button key={id} onClick={() => nav(id)}
                                        className="flex flex-col items-center gap-0.5 py-2 rounded-lg transition-all"
                                        style={{
                                            background: isActive ? 'rgba(216,120,152,0.10)' : 'transparent',
                                            color: isActive ? 'var(--accent-primary)' : 'var(--foreground-muted)',
                                        }}>
                                        <Icon size={17} />
                                        <span className="text-[9px] text-center leading-tight">{label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mx-3 mb-1 flex-shrink-0" style={{ height: 1, background: 'var(--border)' }} />

                        {/* Recent chats */}
                        <div className="flex items-center justify-between px-4 py-1.5 flex-shrink-0">
                            <span className="text-[10px] font-semibold uppercase tracking-wider"
                                style={{ color: 'var(--foreground-muted)', opacity: 0.5 }}>
                                最近の会話
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto px-3 pb-3">
                            {conversations.length === 0 ? (
                                <p className="text-[10px] text-center py-4" style={{ color: 'var(--foreground-muted)', opacity: 0.5 }}>
                                    まだ会話がありません
                                </p>
                            ) : (
                                groups.map(group => (
                                    <div key={group.label} className="mb-3">
                                        <div className="text-[9px] font-medium px-1 py-0.5 mb-0.5"
                                            style={{ color: 'var(--foreground-muted)', opacity: 0.45 }}>
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
                                                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs truncate transition-colors"
                                                        style={{
                                                            color: isActive ? 'var(--foreground)' : 'var(--foreground-muted)',
                                                            background: isActive ? 'rgba(216,120,152,0.10)' : 'transparent',
                                                            fontWeight: isActive ? 500 : 400,
                                                        }}>
                                                        {conv.title}
                                                    </button>
                                                    {isHovered && (
                                                        <button
                                                            onClick={e => { e.stopPropagation(); onDeleteConversation(conv.id); }}
                                                            className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded"
                                                            style={{ color: 'var(--foreground-muted)' }}
                                                            title="削除">
                                                            <Trash2 size={11} />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* User */}
                        <div className="flex-shrink-0 px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                            <div className="flex items-center gap-2.5">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', color: '#fff' }}>
                                    <Sprout size={11} />
                                </div>
                                <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>マイノード</span>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// ══════════════════════════════════════════════════════════════
// Main export
// ══════════════════════════════════════════════════════════════
export default function Sidebar(props: SidebarProps) {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        function check() { setIsMobile(window.innerWidth < 768); }
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    if (isMobile) {
        return <MobileDrawer {...props} />;
    }

    return <DesktopSidebar {...props} />;
}

// ── Mobile hamburger ──────────────────────────────────────────
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
