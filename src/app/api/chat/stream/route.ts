export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/db';
import { checkRate, requireSession } from '@/core/api-helper';
import { coreChatStream, CORE_ENABLED } from '@/lib/cocoro-core';
import { encryptMessage } from '@/lib/chat-crypto';

// ─── Mock responses ───────────────────────────────────────────
const MOCK_RESPONSES: Record<string, string[]> = {
    greeting: [
        'こんにちは！Cocoroです 🌸 今日はどのようなことをお手伝いしましょうか？',
        'お疲れ様です！何かお役に立てることはありますか？',
    ],
    thinking: [
        'いい質問ですね。もう少し詳しく教えていただけますか？\n\n考えを整理するために、いくつかの観点から分析してみましょう。',
        'それは興味深い問いかけですね。様々な側面を考慮する必要がありそうです。',
    ],
    task: [
        '承知しました！そのタスクを処理します。\n\n```\n処理中...\n✓ 受信完了\n✓ エージェントに委任\n```\n\nバックグラウンドで進行中です。',
        '了解です。すぐに取り掛かります。',
    ],
    default: [
        'なるほど、理解しました。もう少し詳しく教えていただけますか？',
        'わかりました。他に何かお手伝いできることはありますか？',
        'ありがとうございます。その点についてもう少し考えてみますね。',
    ],
};

function classifyMessage(msg: string): string {
    const lower = msg.toLowerCase();
    if (/こんにちは|おはよう|こんばんは|やあ|hello|hi/.test(lower)) return 'greeting';
    if (/考え|分析|検討|なぜ|理由|think|why/.test(lower)) return 'thinking';
    if (/作って|作成|実行|タスク|make|create|do/.test(lower)) return 'task';
    return 'default';
}

function getMockResponse(msg: string): string {
    const cat = classifyMessage(msg);
    const pool = MOCK_RESPONSES[cat] || MOCK_RESPONSES.default;
    return pool[Math.floor(Math.random() * pool.length)];
}

function generateTitle(message: string): string {
    const cleaned = message.replace(/\n/g, ' ').trim();
    return cleaned.length > 30 ? cleaned.substring(0, 30) + '...' : cleaned;
}

// ─── SSE stream helper ────────────────────────────────────────
function createStream(handler: (send: (event: string, data: unknown) => void, done: () => void) => Promise<void>) {
    const encoder = new TextEncoder();

    return new Response(
        new ReadableStream({
            async start(controller) {
                const send = (event: string, data: unknown) => {
                    const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
                    controller.enqueue(encoder.encode(chunk));
                };
                const done = () => controller.close();
                try {
                    await handler(send, done);
                } catch {
                    send('error', { message: 'Stream error' });
                    done();
                }
            },
        }),
        {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            },
        }
    );
}

// ─── POST /api/chat/stream ────────────────────────────────────
export async function POST(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    let body: { message?: string; conversation_id?: string; core_session_id?: string };
    try {
        body = await request.json();
    } catch {
        return new Response('Bad Request', { status: 400 });
    }

    const { message, conversation_id, core_session_id } = body;
    if (!message?.trim()) return new Response('Bad Request', { status: 400 });

    const db = getDatabase();
    const conversationId = conversation_id || `conv_${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();
    const userMsgId = `msg_${uuidv4().substring(0, 8)}`;

    // Ensure conversation exists
    const exists = db.prepare('SELECT id FROM conversations WHERE id = ?').get(conversationId);
    if (!exists) {
        db.prepare('INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
            .run(conversationId, generateTitle(message), now, now);
    } else {
        db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, conversationId);
    }

    // Save user message immediately (encrypted)
    db.prepare('INSERT INTO chat_history (id, conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)')
        .run(userMsgId, conversationId, 'user', encryptMessage(message), now);

    return createStream(async (send, done) => {
        // Emit conversation context
        send('meta', {
            conversation_id: conversationId,
            user_message_id: userMsgId,
        });

        const assistantMsgId = `msg_${uuidv4().substring(0, 8)}`;
        let fullContent = '';

        if (CORE_ENABLED) {
            // ── 直接 HTTP ストリーミング（cocoro-core /chat/stream）───
            const rawStream = await coreChatStream(message, core_session_id);

            if (rawStream) {
                try {
                    let buffer = '';
                    let coreSessionId: string | undefined;
                    let coreAction = 'talk';
                    let coreEmotion = 'neutral';

                    const reader = rawStream.getReader();
                    for (; ;) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        buffer += value;
                        const lines = buffer.split('\n');
                        buffer = lines.pop() ?? '';
                        for (const line of lines) {
                            if (!line.startsWith('data:')) continue;
                            const raw = line.slice(5).trim();
                            if (!raw || raw === '[DONE]') continue;
                            try {
                                const payload = JSON.parse(raw) as {
                                    text?: string; chunk?: string;
                                    action?: string; session_id?: string;
                                    emotion?: string | { dominant?: string };
                                };
                                const text = payload.text ?? payload.chunk ?? '';
                                if (text) { fullContent += text; send('chunk', { text }); }
                                if (payload.action) coreAction = payload.action;
                                if (payload.session_id) coreSessionId = payload.session_id;
                                if (payload.emotion) {
                                    coreEmotion = typeof payload.emotion === 'string'
                                        ? payload.emotion
                                        : (payload.emotion.dominant ?? 'neutral');
                                }
                            } catch { /* JSON parse errors ignored */ }
                        }
                    }

                    send('done', {
                        id: assistantMsgId,
                        conversation_id: conversationId,
                        action: coreAction,
                        emotion: coreEmotion,
                        core_session_id: coreSessionId ?? core_session_id,
                    });
                } catch (err) {
                    console.error('[stream] cocoro-core streaming error:', err);
                    if (!fullContent) {
                        fullContent = getMockResponse(message);
                        for (const char of fullContent.split('')) {
                            send('chunk', { text: char });
                            await new Promise(r => setTimeout(r, 18));
                        }
                    }
                    send('done', { id: assistantMsgId, conversation_id: conversationId, action: 'fallback' });
                }
            } else {
                // ストリーム取得失敗 → モックにフォールバック
                fullContent = getMockResponse(message);
                for (const char of fullContent.split('')) {
                    send('chunk', { text: char });
                    await new Promise(r => setTimeout(r, 18));
                }
                send('done', { id: assistantMsgId, conversation_id: conversationId, action: 'mock' });
            }

        } else {
            // ── モックストリームモード ────────────────────────────
            await new Promise(r => setTimeout(r, 400));
            fullContent = getMockResponse(message);
            for (const char of fullContent.split('')) {
                send('chunk', { text: char });
                await new Promise(r => setTimeout(r, 18));
            }
            send('done', { id: assistantMsgId, conversation_id: conversationId, action: 'mock' });
        }

        // Persist assistant response (encrypted)
        if (fullContent) {
            const assistantTimestamp = new Date().toISOString();
            db.prepare('INSERT INTO chat_history (id, conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)')
                .run(assistantMsgId, conversationId, 'assistant', encryptMessage(fullContent), assistantTimestamp);
        }

        done();
    });
}
