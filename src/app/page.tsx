'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiPost, apiDelete } from '@/lib/api-client';
import CocoroLogo from '@/components/CocoroLogo';
import Sidebar, { NavPage, Conversation, MobileMenuButton } from '@/components/Sidebar';
import ChatPage from '@/components/ChatPage';
import AgentsPage from '@/components/AgentsPage';
import NodePage from '@/components/NodePage';
import NodesPage from '@/components/NodesPage';
import DashboardPage from '@/components/DashboardPage';
import TasksPage from '@/components/TasksPage';
import MemoryPage from '@/components/MemoryPage';
import SecurityPage from '@/components/SecurityPage';
import SettingsPage from '@/components/SettingsPage';
import LockScreen from '@/components/LockScreen';
import SetupWizard from '@/components/SetupWizard';
import ToastContainer from '@/components/ToastContainer';
import DailyBriefingBanner from '@/components/DailyBriefingBanner';
import SplashScreen from '@/components/SplashScreen';
import CommandPalette from '@/components/CommandPalette';
import ConnectionErrorBanner from '@/components/ConnectionErrorBanner';

export default function ConsolePage() {
  const [currentPage, setCurrentPage] = useState<NavPage>('chat');
  const [nickname, setNickname] = useState('ユーザー');
  const [locked, setLocked] = useState(false);
  const [pinRequired, setPinRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [splashDone, setSplashDone] = useState(false);
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Init
  useEffect(() => {
    async function init() {
      try {
        const sessionRes = await fetch('/api/session');
        const sessionData = await sessionRes.json();

        if (!sessionData.authenticated) {
          await fetch('/api/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create' }),
          });
        } else {
          setLocked(sessionData.locked);
          setPinRequired(sessionData.pin_required || false);
        }

        const profileRes = await fetch('/api/profile');
        const profile = await profileRes.json();
        if (profile.nickname) setNickname(profile.nickname);
      } catch { /* Show UI even if APIs fail */ }

      // Setup status — separate try/catch to avoid false-positive skip
      try {
        const setupRes = await fetch('/api/setup?action=status');
        const setupData = await setupRes.json();
        // jsonSuccess spreads data flat: { success, setup_completed } (no .data wrapper)
        const completed = setupData?.setup_completed ?? setupData?.data?.setup_completed ?? true;
        console.info('[setup] status check:', JSON.stringify(setupData), '→ completed:', completed);
        setSetupCompleted(completed);
      } catch (e) {
        // If setup status fetch fails, skip wizard to avoid blocking UI
        console.warn('[setup] status fetch failed, skipping wizard:', (e as Error).message);
        setSetupCompleted(true);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Fetch conversation list
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat?list=1');
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!loading && !locked) {
      fetchConversations();
    }
  }, [loading, locked, fetchConversations]);

  // Session keep-alive
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/session');
        const data = await res.json();
        if (data.locked) setLocked(true);
        if (data.expired) {
          await fetch('/api/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create' }),
          });
          setLocked(false);
        }
      } catch { /* ignore */ }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleUnlock = useCallback(async (pin?: string) => {
    try {
      const res = await apiPost('/api/session', { action: 'unlock', pin });
      const data = await res.json();
      if (data.success) setLocked(false);
    } catch { /* ignore */ }
  }, []);

  // Chat actions
  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
    setCurrentPage('chat');
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setCurrentPage('chat');
  }, []);

  const handleConversationCreated = useCallback((id: string) => {
    setActiveConversationId(id);
    fetchConversations();
  }, [fetchConversations]);

  const handleDeleteConversation = useCallback(async (id: string) => {
    try {
      await apiDelete(`/api/chat?conversation_id=${id}`);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
      }
    } catch { /* ignore */ }
  }, [activeConversationId]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'k') { e.preventDefault(); setCmdPaletteOpen(o => !o); }
      if (e.key === 'Escape') { setCmdPaletteOpen(false); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // ── Splash screen ─────────────────────────────────────────
  // Show skeleton logo while data loads, then SplashScreen animation
  if (loading || setupCompleted === null) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <CocoroLogo size={48} glow />
      </div>
    );
  }

  if (!splashDone) {
    return <SplashScreen onComplete={() => setSplashDone(true)} />;
  }

  // ── Boot Wizard (first launch) ─────────────────────────────
  if (!setupCompleted) {
    return <SetupWizard onComplete={() => setSetupCompleted(true)} />;
  }

  // ── Lock screen ────────────────────────────────────────────
  if (locked) {
    return <LockScreen nickname={nickname} onUnlock={handleUnlock} requirePin={pinRequired} />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'chat':
        return (
          <ChatPage
            conversationId={activeConversationId}
            onConversationCreated={handleConversationCreated}
          />
        );
      case 'agents': return <AgentsPage />;
      case 'dashboard': return <DashboardPage />;
      case 'tasks': return <TasksPage />;
      case 'node': return <NodePage />;
      case 'nodes': return <NodesPage />;
      case 'memory': return <MemoryPage />;
      case 'security': return <SecurityPage />;
      case 'settings': return <SettingsPage />;
      default:
        return (
          <ChatPage
            conversationId={activeConversationId}
            onConversationCreated={handleConversationCreated}
          />
        );
    }
  };

  return (
    <div className="flex h-screen" style={{ background: 'var(--background)' }}>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 flex items-center gap-3 px-4 py-2.5"
        style={{ background: 'var(--background-secondary)', borderBottom: '1px solid var(--border)' }}>
        <MobileMenuButton onClick={() => setMobileMenuOpen(true)} />
        <CocoroLogo size={22} />
        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Cocoro</span>
      </div>
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onNewChat={handleNewChat}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <main className="flex-1 flex flex-col overflow-hidden md:pt-0 pt-14">
        {currentPage === 'chat' && (
          <DailyBriefingBanner onNavigateTasks={() => setCurrentPage('tasks')} />
        )}
        {/* Inline connection error bar — only shown on chat page when core is needed */}
        {currentPage === 'chat' && (
          <ConnectionErrorBanner serviceName="cocoro-core" />
        )}
        {renderPage()}
      </main>
      <ToastContainer onNavigateTasks={() => setCurrentPage('tasks')} />
      <CommandPalette
        open={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        onNewChat={handleNewChat}
        onNavigate={(page) => setCurrentPage(page as NavPage)}
      />
    </div>
  );
}
