'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Plus, Square } from 'lucide-react';
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
}

interface ChatPageProps {
    conversationId: string | null;
    onConversationCreated: (id: string) => void;
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
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    const isEmpty = messages.length === 0;

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
            setMessages(data.history || []);
        } catch { /* ignore */ }
    }

    const sendMessage = useCallback(async () => {
        if (!input.trim() || streaming) return;

        const content = input.trim();
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
                                    onConversationCreated(convIdFromServer);
                                }
                            }
                            if (currentEvent === 'chunk' && payload.text !== undefined) {
                                setMessages(prev => prev.map(m =>
                                    m.id === assistantMsg.id
                                        ? { ...m, content: m.content + payload.text }
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
        }
    }, [input, streaming, currentConvId, coreSessionId, onConversationCreated]);

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
            <div
                className="flex items-end gap-2 p-3 rounded-2xl transition-all"
                style={{
                    background: 'var(--background-secondary)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 1px 6px rgba(160, 120, 130, 0.06)',
                }}
            >
                <button
                    className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 transition-colors hover:bg-[rgba(216,120,152,0.06)]"
                    style={{ color: 'var(--foreground-muted)' }}
                    title="添付"
                >
                    <Plus size={18} />
                </button>
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="質問してみましょう"
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
                )}
            </div>
        </div>
    );

    // ─── Empty state ──────────────────────────────────────────
    if (isEmpty && !streaming) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center h-screen px-6">
                <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="text-2xl font-medium mb-8 text-center"
                    style={{ color: 'var(--foreground)' }}
                >
                    今日は何をしましょうか？
                </motion.h1>
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.15 }}
                    className="w-full"
                >
                    {inputBox}
                </motion.div>
            </div>
        );
    }

    // ─── Chat state ───────────────────────────────────────────
    return (
        <div className="flex-1 flex flex-col h-screen">
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-[720px] mx-auto px-6 py-6 space-y-1">
                    <AnimatePresence>
                        {messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-1`}
                            >
                                {msg.role === 'assistant' ? (
                                    // ── AI: 左側・プレーンテキスト ──────────────
                                    <div className="max-w-[85%] text-sm leading-relaxed prose-cocoro py-1"
                                        style={{ color: 'var(--foreground)' }}
                                    >
                                        {msg.content ? (
                                            <>
                                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                                    {msg.content}
                                                </ReactMarkdown>
                                                {msg.streaming && (
                                                    <span
                                                        className="inline-block w-0.5 h-4 ml-0.5 align-text-bottom animate-pulse"
                                                        style={{ background: 'var(--accent-primary)' }}
                                                    />
                                                )}
                                            </>
                                        ) : (
                                            // タイピングドット
                                            <div className="flex gap-1 py-2">
                                                {[0, 1, 2].map(i => (
                                                    <motion.div
                                                        key={i}
                                                        className="w-1.5 h-1.5 rounded-full"
                                                        style={{ background: 'var(--foreground-muted)' }}
                                                        animate={{ opacity: [0.3, 1, 0.3] }}
                                                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    // ── USER: 右側・バブル ───────────────────
                                    <div
                                        className="max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                                        style={{
                                            background: 'var(--background-secondary)',
                                            color: 'var(--foreground)',
                                            border: '1px solid var(--border)',
                                            borderBottomRightRadius: '6px',
                                        }}
                                    >
                                        {msg.content}
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Fixed input */}
            <div className="px-6 py-4">
                {inputBox}
                <p className="text-[10px] text-center mt-2" style={{ color: 'var(--foreground-muted)', opacity: 0.35 }}>
                    Cocoroは間違えることがあります。重要な情報は確認してください。
                </p>
            </div>
        </div>
    );
}
