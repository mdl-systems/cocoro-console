'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiPost, apiDelete } from '@/lib/api-client';
import CocoroLogo from '@/components/CocoroLogo';
import Sidebar, { NavPage, Conversation } from '@/components/Sidebar';
import ChatPage from '@/components/ChatPage';
import AgentsPage from '@/components/AgentsPage';
import NodePage from '@/components/NodePage';
import MemoryPage from '@/components/MemoryPage';
import SecurityPage from '@/components/SecurityPage';
import SettingsPage from '@/components/SettingsPage';
import LockScreen from '@/components/LockScreen';
import SetupWizard from '@/components/SetupWizard';

export default function ConsolePage() {
  const [currentPage, setCurrentPage] = useState<NavPage>('chat');
  const [nickname, setNickname] = useState('ユーザー');
  const [locked, setLocked] = useState(false);
  const [pinRequired, setPinRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);

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

  // ── Loading screen ─────────────────────────────────────────
  if (loading || setupCompleted === null) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <CocoroLogo size={48} glow />
      </div>
    );
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
      case 'node': return <NodePage />;
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
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onNewChat={handleNewChat}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {renderPage()}
      </main>
    </div>
  );
}
