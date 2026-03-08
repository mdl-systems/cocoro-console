import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/db';
import { checkRate, requireSession } from '@/core/api-helper';
import { coreChat, CORE_ENABLED } from '@/lib/cocoro-core';
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
                } catch (err) {
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
        // Emit conversation context so client can update URL/state
        send('meta', {
            conversation_id: conversationId,
            user_message_id: userMsgId,
        });

        const assistantMsgId = `msg_${uuidv4().substring(0, 8)}`;
        let fullContent = '';

        if (CORE_ENABLED) {
            // ── Real cocoro-core call ──────────────────────────
            const coreRes = await coreChat(message, core_session_id);

            if (coreRes) {
                // Simulate streaming by chunking the response
                const words = coreRes.response.split(/(?<=\s)/);
                for (const chunk of words) {
                    fullContent += chunk;
                    send('chunk', { text: chunk });
                    await new Promise(r => setTimeout(r, 20));
                }

                send('done', {
                    id: assistantMsgId,
                    conversation_id: conversationId,
                    action: coreRes.action,
                    emotion: coreRes.emotion,
                    task_id: coreRes.task_id,
                    core_session_id: coreRes.session_id,
                });
            } else {
                // Core unavailable — fall back to mock
                fullContent = getMockResponse(message);
                const chars = fullContent.split('');
                for (const char of chars) {
                    send('chunk', { text: char });
                    await new Promise(r => setTimeout(r, 18));
                }
                send('done', { id: assistantMsgId, conversation_id: conversationId, action: 'mock' });
            }
        } else {
            // ── Mock streaming mode ────────────────────────────
            // Add a small initial delay for realism
            await new Promise(r => setTimeout(r, 400));

            fullContent = getMockResponse(message);
            const chars = fullContent.split('');
            for (const char of chars) {
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
