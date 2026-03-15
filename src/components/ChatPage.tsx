'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Plus, Square, Bot, X, Loader2, CheckCircle2, Search, PenLine, Code2, BarChart3, ChevronDown, Mic, Copy, Check, FileText, Paperclip, ChevronRight } from 'lucide-react';
import { apiStream } from '@/lib/api-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    streaming?: boolean;
    attachedFileName?: string;
}

interface FileAttachment {
    file: File;
    name: string;
    size: number;
    ext: string;
}

const ACCEPTED_TYPES = '.pdf,.txt,.md,.csv,.json';
const ACCEPTED_MIME = ['application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json'];

function fmtSize(bytes: number) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// ─── Agent types ──────────────────────────────────────────
const AGENT_TYPES = [
    { id: 'research', emoji: '🔍', label: 'リサーチ', desc: 'Web検索・情報収集', color: '#06b6d4', Icon: Search },
    { id: 'write', emoji: '📝', label: 'ライティング', desc: '文章作成・編集', color: '#f472b6', Icon: PenLine },
    { id: 'code', emoji: '💻', label: 'コーディング', desc: 'コード生成・レビュー', color: '#34d399', Icon: Code2 },
    { id: 'analyze', emoji: '📊', label: '分析', desc: 'データ分析・レポート', color: '#f59e0b', Icon: BarChart3 },
] as const;
type AgentTypeId = typeof AGENT_TYPES[number]['id'];

// ─── Agent Modal ──────────────────────────────────────────
function AgentModal({ onClose }: { onClose: () => void }) {
    const [selectedType, setSelectedType] = useState<AgentTypeId>('research');
    const [task, setTask] = useState('');
    const [phase, setPhase] = useState<'select' | 'running' | 'done' | 'error'>('select');
    const [progress, setProgress] = useState(0);
    const [step, setStep] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const type = AGENT_TYPES.find(t => t.id === selectedType)!;

    async function handleRun() {
        if (!task.trim()) return;
        setPhase('running');
        setProgress(10);
        setStep('タスクをキューに投入中...');

        try {
            const res = await fetch('/api/agent-proxy?path=/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: task.trim(), type: selectedType }),
            });
            const data = await res.json();

            if (!data.success && !data.task_id && !data.data?.task_id) {
                throw new Error(data.error || '投入失敗');
            }

            // Simulate progress (real polling would use /tasks/:id)
            setProgress(40); setStep('エージェントがタスクを受信しました...');
            await new Promise(r => setTimeout(r, 800));
            setProgress(70); setStep('処理中...');
            await new Promise(r => setTimeout(r, 800));
            setProgress(100); setStep('完了');
            setPhase('done');
        } catch (e) {
            setErrorMsg((e as Error).message);
            setPhase('error');
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                className="w-full max-w-md rounded-2xl p-6"
                style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>

                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                        <Bot size={16} style={{ color: 'var(--accent-primary)' }} />
                        エージェントに依頼
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/[0.06] transition-colors">
                        <X size={16} style={{ color: 'var(--foreground-muted)' }} />
                    </button>
                </div>

                {/* select phase */}
                {phase === 'select' && (
                    <>
                        {/* Agent type */}
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {AGENT_TYPES.map(t => (
                                <button key={t.id}
                                    onClick={() => setSelectedType(t.id)}
                                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all"
                                    style={{
                                        background: selectedType === t.id ? `${t.color}18` : 'var(--background-tertiary)',
                                        border: `1.5px solid ${selectedType === t.id ? t.color : 'var(--border)'}`,
                                        color: selectedType === t.id ? t.color : 'var(--foreground-muted)',
                                    }}>
                                    <t.Icon size={16} />
                                    <div>
                                        <div className="text-xs font-semibold" style={{ color: selectedType === t.id ? t.color : 'var(--foreground)' }}>
                                            {t.emoji} {t.label}
                                        </div>
                                        <div className="text-[10px] mt-0.5">{t.desc}</div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Task input */}
                        <div className="mb-4">
                            <label className="text-[11px] mb-1 block" style={{ color: 'var(--foreground-muted)' }}>
                                タスクの指示 *
                            </label>
                            <textarea
                                value={task}
                                onChange={e => setTask(e.target.value)}
                                rows={3}
                                placeholder={`例: ${selectedType === 'research' ? 'AIのトレンドを調査してまとめて' :
                                    selectedType === 'write' ? 'ブログ記事のアウトラインを作成して' :
                                        selectedType === 'code' ? 'TypeScriptでHTTPクライアントを実装して' :
                                            'ユーザーデータをもとにレポートを作成して'
                                    }`}
                                autoFocus
                                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none transition-all"
                                style={{
                                    background: 'var(--background-tertiary)',
                                    border: `1.5px solid ${task.trim() ? type.color : 'var(--border)'}`,
                                    color: 'var(--foreground)',
                                }}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button onClick={onClose}
                                className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
                                style={{ border: '1px solid var(--border)', color: 'var(--foreground-muted)' }}>
                                キャンセル
                            </button>
                            <button onClick={handleRun} disabled={!task.trim()}
                                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-40"
                                style={{ background: `linear-gradient(135deg, ${type.color}, ${type.color}cc)` }}>
                                実行
                            </button>
                        </div>
                    </>
                )}

                {/* running phase */}
                {phase === 'running' && (
                    <div className="py-4 space-y-4">
                        <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--foreground)' }}>
                            <Loader2 size={16} className="animate-spin" style={{ color: type.color }} />
                            {step}
                        </div>
                        <div className="h-1.5 rounded-full" style={{ background: 'var(--background-tertiary)' }}>
                            <motion.div
                                className="h-full rounded-full"
                                style={{ background: type.color }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                            />
                        </div>
                        <p className="text-[11px] text-center" style={{ color: 'var(--foreground-muted)' }}>
                            {type.emoji} {type.label} エージェントが処理中です
                        </p>
                    </div>
                )}

                {/* done phase */}
                {phase === 'done' && (
                    <div className="py-4 space-y-4 text-center">
                        <CheckCircle2 size={40} className="mx-auto" style={{ color: '#34d399' }} />
                        <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>タスクを投入しました</p>
                            <p className="text-[11px] mt-1" style={{ color: 'var(--foreground-muted)' }}>
                                エージェント画面から進捗を確認できます
                            </p>
                        </div>
                        <button onClick={onClose}
                            className="px-6 py-2 rounded-xl text-sm font-medium"
                            style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                            閉じる
                        </button>
                    </div>
                )}

                {/* error phase */}
                {phase === 'error' && (
                    <div className="py-4 space-y-4 text-center">
                        <p className="text-sm" style={{ color: '#f87171' }}>エラーが発生しました</p>
                        <p className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{errorMsg}</p>
                        <div className="flex gap-3">
                            <button onClick={() => { setPhase('select'); setErrorMsg(''); }}
                                className="flex-1 py-2 rounded-xl text-sm transition-colors"
                                style={{ border: '1px solid var(--border)', color: 'var(--foreground-muted)' }}>
                                戻る
                            </button>
                            <button onClick={onClose}
                                className="flex-1 py-2 rounded-xl text-sm"
                                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                                閉じる
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
}

// ─── Agent list ─────────────────────────────────────────
const AGENTS = [
    { id: 'default', name: 'MDL', icon: '🤖', description: 'あなたのAI', color: '#d87898' },
    { id: 'lawyer', name: '弁護士', icon: '⚖️', description: '法律・契約', color: '#4a7ab5' },
    { id: 'accountant', name: '税理士', icon: '📊', description: '税務・会計', color: '#3a9a6a' },
    { id: 'engineer', name: 'エンジニア', icon: '💻', description: '開発・設計', color: '#4a6ab5' },
    { id: 'researcher', name: 'リサーチ', icon: '🔍', description: '調査・分析', color: '#c4782a' },
    { id: 'financial_advisor', name: 'FP', icon: '💰', description: '資産運用', color: '#c4a42a' },
] as const;
type AgentId = typeof AGENTS[number]['id'];

// ─── Agent selection bar ─────────────────────────────────
function AgentBar({ selected, onSelect }: { selected: AgentId; onSelect: (id: AgentId) => void }) {
    return (
        <div
            className="agent-scroll-row flex-1 py-2 px-1"
        >
            {AGENTS.map(agent => {
                const active = selected === agent.id;
                const c = agent.color;
                return (
                    <motion.button
                        key={agent.id}
                        onClick={() => onSelect(agent.id)}
                        whileTap={{ scale: 0.92 }}
                        layout
                        className="flex items-center rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all duration-250"
                        style={{
                            padding: '6px 14px',
                            background: active ? `${c}20` : 'var(--background-secondary)',
                            border: `1.5px solid ${active ? c : 'var(--border)'}`,
                            color: active ? c : 'var(--foreground-muted)',
                            boxShadow: active ? `0 2px 10px ${c}30` : 'none',
                        }}
                    >
                        {agent.name}
                    </motion.button>
                );
            })}
        </div>
    );
}

interface ChatPageProps {
    conversationId: string | null;
    onConversationCreated: (id: string) => void;
}

// ─── Emotion config ─────────────────────────────────────────
const EMOTION_MAP: Record<string, { emoji: string; label: string; color: string }> = {
    curious: { emoji: '🔍', label: '好奇心', color: '#06b6d4' },
    happy: { emoji: '😊', label: '喜び', color: '#f59e0b' },
    calm: { emoji: '😌', label: '平静', color: '#34d399' },
    excited: { emoji: '⚡', label: '興奮', color: '#a78bfa' },
    focused: { emoji: '🎯', label: '集中', color: '#d87898' },
    trust: { emoji: '🤝', label: '信頼', color: '#3b82f6' },
    surprised: { emoji: '✨', label: '驚き', color: '#f472b6' },
    surprise: { emoji: '✨', label: '驚き', color: '#f472b6' },
    joy: { emoji: '😊', label: '喜び', color: '#f59e0b' },
    neutral: { emoji: '😐', label: 'ニュートラル', color: 'var(--foreground-muted)' },
    anxious: { emoji: '😰', label: '不安', color: '#f97316' },
    sad: { emoji: '😢', label: '悲しみ', color: '#6366f1' },
    angry: { emoji: '😤', label: '怒り', color: '#ef4444' },
};

interface EmotionState {
    current_emotion: string;
    sync_rate: number;
    valence: number;
    arousal: number;
    dominant_trait: string;
}

// ─── Emotion Widget ─────────────────────────────────────────
function EmotionWidget({ emotion }: { emotion: EmotionState | null }) {
    const [collapsed, setCollapsed] = useState(false);
    if (!emotion) return null;

    const conf = EMOTION_MAP[emotion.current_emotion.toLowerCase()] ??
        { emoji: '🌸', label: emotion.current_emotion, color: 'var(--accent-primary)' };
    const pct = Math.round(emotion.sync_rate * 100);

    return (
        <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1.5 flex-shrink-0"
        >
            <button
                onClick={() => setCollapsed(c => !c)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all"
                style={{
                    background: `${conf.color}14`,
                    border: `1px solid ${conf.color}30`,
                    color: 'var(--foreground)',
                }}
                title="AIの感情状態"
            >
                <motion.span
                    key={conf.emoji}
                    initial={{ scale: 0.7 }}
                    animate={{ scale: 1 }}
                    style={{ fontSize: 14, lineHeight: 1 }}
                >
                    {conf.emoji}
                </motion.span>
                <AnimatePresence initial={false}>
                    {!collapsed && (
                        <motion.span
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 'auto', opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            className="overflow-hidden whitespace-nowrap"
                        >
                            <span style={{ color: conf.color }}>{conf.label}</span>
                            <span className="ml-1.5 inline-flex items-center gap-0.5">
                                <span className="flex gap-0.5">
                                    {[...Array(5)].map((_, i) => (
                                        <span key={i}
                                            className="inline-block h-1.5 rounded-full"
                                            style={{
                                                width: 6,
                                                background: i < Math.round(pct / 20) ? conf.color : `${conf.color}25`,
                                            }}
                                        />
                                    ))}
                                </span>
                                <span className="ml-1 text-[10px] tabular-nums" style={{ color: 'var(--foreground-muted)' }}>{pct}%</span>
                            </span>
                        </motion.span>
                    )}
                </AnimatePresence>
                <ChevronDown size={10} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`}
                    style={{ color: 'var(--foreground-muted)' }} />
            </button>
        </motion.div>
    );
}

// ─── Copy Button ─────────────────────────────────────────────
function CopyButton({ content }: { content: string }) {
    const [copied, setCopied] = useState(false);
    function copy() {
        navigator.clipboard.writeText(content).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }).catch(() => { /* no clipboard access */ });
    }
    return (
        <button
            onClick={copy}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/[0.06]"
            title="コピー"
            style={{ color: copied ? '#34d399' : 'var(--foreground-muted)' }}
        >
            {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
    );
}

// ─── Expandable Content (long AI responses) ───────────────────
const COLLAPSE_LIMIT = 600;
function ExpandableContent({
    content,
    isLong,
    streaming,
    cursorColor,
    markdownComponents,
}: {
    content: string;
    isLong: boolean;
    streaming: boolean;
    cursorColor: string;
    markdownComponents: object;
}) {
    const [expanded, setExpanded] = useState(false);
    const displayContent = isLong && !expanded ? content.slice(0, COLLAPSE_LIMIT) + '…' : content;
    return (
        <>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents as Parameters<typeof ReactMarkdown>[0]['components']}>
                {displayContent}
            </ReactMarkdown>
            {streaming && (
                <span className="inline-block w-0.5 h-4 ml-0.5 align-text-bottom animate-pulse"
                    style={{ background: cursorColor }} />
            )}
            {isLong && !streaming && (
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="mt-2 flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
                    style={{ color: 'var(--accent-primary)' }}
                >
                    {expanded ? '折りたたむ' : '全文を見る'}
                    <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </button>
            )}
        </>
    );
}

// ─── Code theme (cream) ───────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const codeTheme: any = {
    'pre[class*="language-"]': { background: '#F5EDE4', borderRadius: '0', padding: '16px', fontSize: '13px', overflow: 'auto', margin: 0 },
    'code[class*="language-"]': { color: '#3A2E2E', fontFamily: "'Fira Code', 'Consolas', monospace" },
    comment: { color: '#9C8888', fontStyle: 'italic' },
    keyword: { color: '#C4607C', fontWeight: 'bold' },
    string: { color: '#5A8A50' },
    number: { color: '#D4844C' },
    function: { color: '#C4607C' },
    operator: { color: '#6098C8' },
    punctuation: { color: '#9C8888' },
    'class-name': { color: '#D87898' },
    boolean: { color: '#D4844C' },
};

export default function ChatPage({ conversationId, onConversationCreated }: ChatPageProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [coreSessionId, setCoreSessionId] = useState<string | null>(null);
    const [currentConvId, setCurrentConvId] = useState<string | null>(conversationId);
    const [selectedAgent, setSelectedAgent] = useState<AgentId>('default');
    const [emotion, setEmotion] = useState<EmotionState | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const pendingConvNotify = useRef<string | null>(null);
    const [agentModalOpen, setAgentModalOpen] = useState(false);
    const [attachedFile, setAttachedFile] = useState<FileAttachment | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isEmpty = messages.length === 0;
    const currentAgent = AGENTS.find(a => a.id === selectedAgent)!;

    // Fetch emotion state
    const fetchEmotion = useCallback(async () => {
        try {
            const res = await fetch('/api/node/emotion');
            if (!res.ok) return;
            const data = await res.json();
            const emo = data.data?.emotion ?? data.emotion;
            if (emo) setEmotion(emo);
        } catch { /* ignore — core may be offline */ }
    }, []);

    // Initial emotion fetch
    useEffect(() => { fetchEmotion(); }, [fetchEmotion]);

    // ── File helpers ──────────────────────────────────────────
    function handleFileSelect(file: File) {
        const ok = ACCEPTED_MIME.includes(file.type) ||
            ACCEPTED_TYPES.split(',').some(ext => file.name.endsWith(ext.replace('.', '')));
        if (!ok) { alert('対応ファイル: PDF, TXT, MD, CSV, JSON'); return; }
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        setAttachedFile({ file, name: file.name, size: file.size, ext });
    }

    function onDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragging(true); }
    function onDragLeave(e: React.DragEvent) {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
    }
    function onDrop(e: React.DragEvent) {
        e.preventDefault(); setIsDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) handleFileSelect(f);
    }

    // Voice input (Web Speech API)
    function startVoiceInput() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) { alert('このブラウザは音声入力に対応していません'); return; }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recognition = new SpeechRecognition() as any;
        recognition.lang = 'ja-JP';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        setIsRecording(true);
        recognition.start();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (e: any) => {
            const transcript = e.results[0][0].transcript as string;
            setInput(prev => (prev ? prev + ' ' : '') + transcript);
            setIsRecording(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        };
        recognition.onerror = () => setIsRecording(false);
        recognition.onend = () => setIsRecording(false);
    }

    // エージェント切り替え時はチャットをリセット
    function handleAgentSelect(id: AgentId) {
        if (id === selectedAgent) return;
        setSelectedAgent(id);
        setMessages([]);
        setCurrentConvId(null);
        abortRef.current?.abort();
        setTimeout(() => inputRef.current?.focus(), 50);
    }

    // Load history when conversationId changes
    useEffect(() => {
        setCurrentConvId(conversationId);
        if (conversationId) {
            fetchMessages(conversationId);
        } else {
            setMessages([]);
        }
        // Cancel any in-flight stream when switching
        abortRef.current?.abort();
        // 会話切り替え時に入力欄へフォーカス
        setTimeout(() => inputRef.current?.focus(), 50);
    }, [conversationId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
        }
    }, [input]);

    async function fetchMessages(convId: string) {
        try {
            const res = await fetch(`/api/chat?conversation_id=${convId}`);
            const data = await res.json();
            setMessages((data.history || []).map((m: Message) => ({ ...m, content: m.content.replace(/\r/g, '') })));
        } catch { /* ignore */ }
    }

    const sendMessage = useCallback(async () => {
        if (!input.trim() || streaming) return;

        const content = input.trim().replace(/\r/g, '');
        const userMsg: Message = {
            id: `temp_user_${Date.now()}`,
            role: 'user',
            content,
            timestamp: new Date().toISOString(),
        };
        const assistantMsg: Message = {
            id: `temp_assistant_${Date.now()}`,
            role: 'assistant',
            content: '',
            timestamp: new Date().toISOString(),
            streaming: true,
        };

        setMessages(prev => [...prev, userMsg, assistantMsg]);
        setInput('');
        setStreaming(true);

        const abort = new AbortController();
        abortRef.current = abort;

        try {
            const res = await apiStream('/api/chat/stream', {
                message: content,
                conversation_id: currentConvId || undefined,
                core_session_id: coreSessionId || undefined,
                ...(selectedAgent !== 'default' ? { role_id: selectedAgent } : {}),
            }, abort.signal);

            if (!res.ok || !res.body) throw new Error('Stream failed');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let convIdFromServer: string | null = null;
            let assistantIdFromServer: string | null = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                let currentEvent = 'chunk';
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        try {
                            const payload = JSON.parse(line.slice(6));
                            if (currentEvent === 'meta') {
                                convIdFromServer = payload.conversation_id || convIdFromServer;
                                if (!currentConvId && convIdFromServer) {
                                    setCurrentConvId(convIdFromServer);
                                    // Don't call onConversationCreated yet — defer until after stream
                                    // to avoid parent re-render that would overwrite streaming state
                                    pendingConvNotify.current = convIdFromServer;
                                }
                            }
                            if (currentEvent === 'chunk' && payload.text !== undefined) {
                                setMessages(prev => prev.map(m =>
                                    m.id === assistantMsg.id
                                        ? { ...m, content: m.content + payload.text.replace(/\r/g, '') }
                                        : m
                                ));

                            }
                            if (currentEvent === 'done') {
                                assistantIdFromServer = payload.id;
                                if (payload.core_session_id) setCoreSessionId(payload.core_session_id);
                            }
                        } catch { /* skip malformed */ }
                        currentEvent = 'chunk'; // reset after data
                    }
                }
            }

            // Finalize messages with real IDs
            setMessages(prev => prev.map(m => {
                if (m.id === assistantMsg.id) return { ...m, streaming: false, id: assistantIdFromServer || m.id };
                if (m.id === userMsg.id) return { ...m, id: `user_${Date.now()}` };
                return m;
            }));

            // Now safely notify parent (stream is done, state won't be clobbered)
            if (pendingConvNotify.current) {
                onConversationCreated(pendingConvNotify.current);
                pendingConvNotify.current = null;
            }

        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') {
                // Cancelled by user
                setMessages(prev => prev.map(m =>
                    m.id === assistantMsg.id ? { ...m, streaming: false } : m
                ));
            } else {
                setMessages(prev => prev.map(m =>
                    m.id === assistantMsg.id
                        ? { ...m, content: 'エラーが発生しました。もう一度お試しください。', streaming: false }
                        : m
                ));
            }
        } finally {
            setStreaming(false);
            abortRef.current = null;
            inputRef.current?.focus();
            // 会話後に感情状態を更新
            fetchEmotion();
        }
    }, [input, streaming, currentConvId, coreSessionId, onConversationCreated, fetchEmotion]);

    function stopStream() {
        abortRef.current?.abort();
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    // ─── Markdown components ──────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markdownComponents: any = {
        code({ className, children }: { className?: string; children?: React.ReactNode }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            if (match) {
                return (
                    <div className="my-3 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                        <div
                            className="flex items-center justify-between px-4 py-2 text-xs"
                            style={{ background: 'var(--background-tertiary)', color: 'var(--foreground-muted)' }}
                        >
                            <span>{match[1]}</span>
                            <button
                                onClick={() => navigator.clipboard.writeText(codeString)}
                                className="hover:opacity-70 transition-opacity"
                            >
                                コピー
                            </button>
                        </div>
                        <SyntaxHighlighter style={codeTheme} language={match[1]} PreTag="div">
                            {codeString}
                        </SyntaxHighlighter>
                    </div>
                );
            }
            return (
                <code className="px-1.5 py-0.5 rounded text-[13px]"
                    style={{ background: 'var(--background-tertiary)', color: 'var(--accent-secondary)' }}>
                    {children}
                </code>
            );
        },
        p({ children }: { children?: React.ReactNode }) { return <p className="mb-2 last:mb-0">{children}</p>; },
        ul({ children }: { children?: React.ReactNode }) { return <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>; },
        ol({ children }: { children?: React.ReactNode }) { return <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>; },
        table({ children }: { children?: React.ReactNode }) {
            return (
                <div className="my-2 overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
                    <table className="w-full text-sm">{children}</table>
                </div>
            );
        },
        th({ children }: { children?: React.ReactNode }) {
            return <th className="px-3 py-2 text-left text-xs font-medium" style={{ background: 'var(--background-tertiary)', color: 'var(--foreground-muted)', borderBottom: '1px solid var(--border)' }}>{children}</th>;
        },
        td({ children }: { children?: React.ReactNode }) {
            return <td className="px-3 py-2 text-sm" style={{ borderBottom: '1px solid var(--border)' }}>{children}</td>;
        },
        blockquote({ children }: { children?: React.ReactNode }) {
            return <blockquote className="pl-4 my-2" style={{ borderLeft: '3px solid var(--accent-primary)', color: 'var(--foreground-muted)' }}>{children}</blockquote>;
        },
        a({ href, children }: { href?: string; children?: React.ReactNode }) {
            return <a href={href} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent-primary)' }}>{children}</a>;
        },
        strong({ children }: { children?: React.ReactNode }) {
            return <strong className="font-semibold" style={{ color: 'var(--foreground)' }}>{children}</strong>;
        },
        h1({ children }: { children?: React.ReactNode }) { return <h1 className="text-xl font-bold mb-2 mt-1" style={{ color: 'var(--foreground)' }}>{children}</h1>; },
        h2({ children }: { children?: React.ReactNode }) { return <h2 className="text-lg font-semibold mb-1.5 mt-1" style={{ color: 'var(--foreground)' }}>{children}</h2>; },
        h3({ children }: { children?: React.ReactNode }) { return <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--foreground)' }}>{children}</h3>; },
        hr() { return <hr className="my-3" style={{ borderColor: 'var(--border)' }} />; },
    };

    // ─── Input box ────────────────────────────────────────────
    const inputBox = (
        <div className="w-full max-w-[720px] mx-auto">
            {/* File preview bar */}
            {attachedFile && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl"
                    style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
                    <FileText size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <span className="flex-1 text-xs truncate" style={{ color: 'var(--foreground)' }}>
                        {attachedFile.name}
                    </span>
                    <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--foreground-muted)' }}>
                        {fmtSize(attachedFile.size)}
                    </span>
                    <button onClick={() => setAttachedFile(null)}
                        className="p-0.5 rounded hover:bg-white/[0.06] flex-shrink-0"
                        style={{ color: 'var(--foreground-muted)' }}>
                        <X size={12} />
                    </button>
                </div>
            )}
            <div
                className="flex items-end gap-2 p-3 rounded-2xl transition-all"
                style={{
                    background: 'var(--background-secondary)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 1px 6px rgba(160, 120, 130, 0.06)',
                }}
            >
                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES}
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 transition-colors hover:bg-[rgba(216,120,152,0.06)]"
                    style={{ color: attachedFile ? 'var(--accent-primary)' : 'var(--foreground-muted)' }}
                    title="ファイルを添付 (PDF / TXT / MD / CSV)"
                >
                    {attachedFile ? <Paperclip size={16} /> : <Plus size={18} />}
                </button>
                <button
                    onClick={() => setAgentModalOpen(true)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 transition-all hover:bg-[rgba(216,120,152,0.1)]"
                    style={{ color: agentModalOpen ? 'var(--accent-primary)' : 'var(--foreground-muted)' }}
                    title="エージェントに依頼"
                >
                    <Bot size={17} />
                </button>
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedAgent === 'default' ? '質問してみましょう' : `${currentAgent.name}エージェントに質問する...`}
                    rows={1}
                    className="flex-1 bg-transparent py-1.5 px-1 text-sm outline-none resize-none leading-relaxed"
                    style={{ color: 'var(--foreground)', maxHeight: 200 }}
                    disabled={streaming}
                />
                {streaming ? (
                    <button
                        onClick={stopStream}
                        className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 transition-all duration-200"
                        style={{ background: 'var(--foreground)', color: 'var(--background)' }}
                        title="停止"
                    >
                        <Square size={14} fill="currentColor" />
                    </button>
                ) : (
                    <>
                        {/* Mic button */}
                        <button
                            onClick={startVoiceInput}
                            disabled={streaming}
                            className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 transition-all"
                            style={{
                                color: isRecording ? '#f87171' : 'var(--foreground-muted)',
                                background: isRecording ? 'rgba(248,113,113,0.12)' : 'transparent',
                                animation: isRecording ? 'pulse 1s infinite' : 'none',
                            }}
                            title="音声入力"
                        >
                            <Mic size={16} />
                        </button>
                        {/* Send button */}
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim()}
                            className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 transition-all duration-200 disabled:opacity-30"
                            style={{
                                background: input.trim() ? 'var(--foreground)' : 'var(--foreground-muted)',
                                color: 'var(--background)',
                            }}
                            title="送信"
                        >
                            <Send size={15} />
                        </button>
                    </>
                )}
            </div>
            {/* Char count + hint */}
            <div className="flex items-center justify-between mt-1 px-1">
                <p className="text-[10px]" style={{ color: 'var(--foreground-muted)', opacity: 0.35 }}>
                    Cocoroは間違えることがあります。重要な情報は確認してください。
                </p>
                {input.length > 0 && (
                    <span className="text-[10px] tabular-nums" style={{ color: input.length > 1800 ? '#f87171' : 'var(--foreground-muted)', opacity: 0.5 }}>
                        {input.length}/2000
                    </span>
                )}
            </div>
        </div>
    );

    // ─── Empty state ──────────────────────────────────────────
    if (isEmpty && !streaming) {
        return (
            <div className="flex-1 flex flex-col h-screen">
                {/* Agent bar */}
                <div className="px-6 pt-3 pb-1 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                    <AgentBar selected={selectedAgent} onSelect={handleAgentSelect} />
                    <EmotionWidget emotion={emotion} />
                </div>

                {/* Center content */}
                <div className="flex-1 flex flex-col items-center justify-center px-6">
                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="text-2xl font-medium mb-2 text-center"
                        style={{ color: 'var(--foreground)' }}
                    >
                        {selectedAgent === 'default' ? '今日は何をしましょうか？' : `${currentAgent.name}に相談する`}
                    </motion.h1>
                    {selectedAgent !== 'default' && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.4, delay: 0.1 }}
                            className="text-sm mb-8"
                            style={{ color: 'var(--foreground-muted)' }}
                        >
                            {currentAgent.description}の専門家として回答します
                        </motion.p>
                    )}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.15 }}
                        className="w-full max-w-[720px]"
                        style={selectedAgent === 'default' ? { marginTop: '2rem' } : {}}
                    >
                        {inputBox}
                    </motion.div>
                </div>

                {/* Agent modal */}
                <AnimatePresence>
                    {agentModalOpen && <AgentModal onClose={() => setAgentModalOpen(false)} />}
                </AnimatePresence>
            </div>
        );
    }

    // ─── Chat state ───────────────────────────────────────────
    return (
        <div
            className="flex-1 flex flex-col h-screen relative"
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {/* D&D overlay */}
            <AnimatePresence>
                {isDragging && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 pointer-events-none"
                        style={{
                            background: 'rgba(0,0,0,0.6)',
                            backdropFilter: 'blur(4px)',
                            border: '2px dashed var(--accent-primary)',
                            borderRadius: '16px',
                        }}
                    >
                        <FileText size={48} style={{ color: 'var(--accent-primary)', opacity: 0.8 }} />
                        <p className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                            ファイルをここにドロップ
                        </p>
                        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                            PDF • TXT • MD • CSV • JSON に対応
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Agent bar + header */}
            <div className="px-6 pt-3 pb-1 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="text-xl flex-shrink-0">{currentAgent.icon}</span>
                <AgentBar selected={selectedAgent} onSelect={handleAgentSelect} />
                <EmotionWidget emotion={emotion} />
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-[720px] mx-auto px-6 py-6 space-y-1">
                    <AnimatePresence>
                        {messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-3`}
                            >
                                {msg.role === 'assistant' ? (
                                    // ── AI: 左側・アイコン付き ──────────────
                                    <div className="flex items-start gap-2.5 max-w-[85%]">
                                        <div
                                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-base"
                                            style={{ background: `${currentAgent.color}18`, border: `1px solid ${currentAgent.color}30` }}
                                            title={currentAgent.name}
                                        >
                                            {currentAgent.icon}
                                        </div>
                                        <div>
                                            <div className="text-sm leading-relaxed prose-cocoro py-1"
                                                style={{ color: 'var(--foreground)' }}
                                            >
                                                {msg.content ? (() => {
                                                    const LIMIT = 600;
                                                    const isLong = !msg.streaming && msg.content.length > LIMIT;
                                                    return (
                                                        <ExpandableContent
                                                            content={msg.content}
                                                            isLong={isLong}
                                                            streaming={!!msg.streaming}
                                                            cursorColor={currentAgent.color}
                                                            markdownComponents={markdownComponents}
                                                        />
                                                    );
                                                })() : (
                                                    <div className="flex gap-1 py-2">
                                                        {[0, 1, 2].map(i => (
                                                            <motion.div
                                                                key={i}
                                                                className="w-1.5 h-1.5 rounded-full"
                                                                style={{ background: currentAgent.color }}
                                                                animate={{ opacity: [0.3, 1, 0.3] }}
                                                                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {!msg.streaming && msg.content && (
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px]" style={{ color: 'var(--foreground-muted)', opacity: 0.45 }}>
                                                        {new Date(msg.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <CopyButton content={msg.content} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    // ── USER: 右側・テーマカラーバブル ──────────
                                    <div className="flex flex-col items-end gap-1">
                                        <div
                                            className="chat-bubble max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                                            style={{
                                                background: `${currentAgent.color}18`,
                                                color: 'var(--foreground)',
                                                border: `1px solid ${currentAgent.color}28`,
                                                borderBottomRightRadius: '6px',
                                            }}
                                        >
                                            {msg.content.replace(/\r/g, '')}
                                        </div>
                                        <div className="text-[10px] pr-1" style={{ color: 'var(--foreground-muted)', opacity: 0.45 }}>
                                            {new Date(msg.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                )}\r
                            </motion.div>

                        ))}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Fixed input — chat-input-bar pins to bottom on mobile */}
            <div className="chat-input-bar px-6 py-4">
                {inputBox}
                <p className="text-[10px] text-center mt-2 hidden md:block" style={{ color: 'var(--foreground-muted)', opacity: 0.35 }}>
                    Cocoroは間違えることがあります。重要な情報は確認してください。
                </p>
            </div>

            {/* Agent modal */}
            <AnimatePresence>
                {agentModalOpen && <AgentModal onClose={() => setAgentModalOpen(false)} />}
            </AnimatePresence>
        </div>
    );
}
