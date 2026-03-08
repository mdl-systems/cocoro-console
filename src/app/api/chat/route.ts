import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/db';
import { validateBody, ChatMessageSchema } from '@/core/validators';
import { checkRate, requireSession, jsonSuccess, jsonError } from '@/core/api-helper';
import { encryptMessage, decryptHistory } from '@/lib/chat-crypto';

// ─── Message Classification ─────────────────────────────────

const SYSTEM_RESPONSES: Record<string, string[]> = {
    greeting: [
        'こんにちは！何かお手伝いできることはありますか？',
        'お疲れ様です。今日はどのようなことをしましょうか？',
        'やあ！準備OKです。何でもどうぞ！',
    ],
    thinking: [
        'なるほど、それについて考えてみましょう。',
        'いい質問ですね。分析してみます。',
        '深く考える必要がありますね。少しお時間をください。',
    ],
    task: [
        '了解しました！そのタスクに取り掛かります。',
        '承知しました。最適なエージェントに委任します。',
        'わかりました。バックグラウンドで処理を開始します。',
    ],
    memory: [
        'その情報を記憶に保存しました。',
        '覚えておきます。次回から活用しますね。',
        '大切な学びですね。しっかり記録しておきます。',
    ],
    default: [
        'はい、理解しました。',
        'なるほど。もう少し詳しく教えていただけますか？',
        'わかりました。他に何かありますか？',
    ],
};

function classifyMessage(message: string): string {
    const lower = message.toLowerCase();
    if (/こんにちは|おはよう|こんばんは|やあ|hello|hi/.test(lower)) return 'greeting';
    if (/考え|分析|検討|なぜ|理由|think/.test(lower)) return 'thinking';
    if (/作って|作成|実行|タスク|make|create/.test(lower)) return 'task';
    if (/覚え|記憶|メモ|保存|learn|remember/.test(lower)) return 'memory';
    return 'default';
}

function getResponse(category: string): string {
    const responses = SYSTEM_RESPONSES[category] || SYSTEM_RESPONSES.default;
    return responses[Math.floor(Math.random() * responses.length)];
}

function generateTitle(message: string): string {
    // Take first 30 chars of the first user message as title
    const cleaned = message.replace(/\n/g, ' ').trim();
    return cleaned.length > 30 ? cleaned.substring(0, 30) + '...' : cleaned;
}

// ─── Routes ──────────────────────────────────────────────────

// GET /api/chat?conversation_id=xxx — get messages for a conversation
// GET /api/chat?list=1 — list all conversations
export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const db = getDatabase();
        const url = new URL(request.url);
        const listMode = url.searchParams.get('list');
        const conversationId = url.searchParams.get('conversation_id');

        if (listMode === '1') {
            // Return all conversations sorted by last update
            const conversations = db.prepare(
                'SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 50'
            ).all();
            return jsonSuccess({ conversations });
        }

        if (conversationId) {
            const messages = db.prepare(
                'SELECT * FROM chat_history WHERE conversation_id = ? ORDER BY timestamp ASC'
            ).all(conversationId) as Array<{ content: string;[key: string]: unknown }>;
            return jsonSuccess({ history: decryptHistory(messages), conversation_id: conversationId });
        }

        // Default: return latest conversation messages
        const messages = db.prepare(
            'SELECT * FROM chat_history ORDER BY timestamp DESC LIMIT 50'
        ).all().reverse() as Array<{ content: string;[key: string]: unknown }>;

        return jsonSuccess({ history: decryptHistory(messages) });
    } catch {
        return jsonError('INTERNAL_ERROR', 'Failed to get chat history', 500);
    }
}

// POST /api/chat — send a message
export async function POST(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const body = await request.json();
        const validation = validateBody(body, ChatMessageSchema);

        if (!validation.success) {
            return jsonError('VALIDATION_ERROR', validation.error, 400);
        }

        const { message } = validation.data;
        const conversationId = body.conversation_id || `conv_${uuidv4().substring(0, 8)}`;
        const action = classifyMessage(message);
        const db = getDatabase();
        const now = new Date().toISOString();

        // Ensure conversation exists
        const existing = db.prepare('SELECT id FROM conversations WHERE id = ?').get(conversationId);
        if (!existing) {
            db.prepare(
                'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
            ).run(conversationId, generateTitle(message), now, now);
        } else {
            db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, conversationId);
        }

        // Save user message (encrypted)
        const userMsgId = `msg_${uuidv4().substring(0, 8)}`;
        db.prepare(
            'INSERT INTO chat_history (id, conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)'
        ).run(userMsgId, conversationId, 'user', encryptMessage(message), now);

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));

        // Save assistant response (encrypted)
        const assistantMsgId = `msg_${uuidv4().substring(0, 8)}`;
        const assistantContent = getResponse(action);
        const assistantTimestamp = new Date().toISOString();
        db.prepare(
            'INSERT INTO chat_history (id, conversation_id, role, content, action, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(assistantMsgId, conversationId, 'assistant', encryptMessage(assistantContent), action, assistantTimestamp);

        return jsonSuccess({
            message: {
                id: assistantMsgId,
                role: 'assistant',
                content: assistantContent,
                action,
                timestamp: assistantTimestamp,
            },
            conversation_id: conversationId,
            action,
        });
    } catch {
        return jsonError('INTERNAL_ERROR', 'Failed to process message', 500);
    }
}

// DELETE /api/chat?conversation_id=xxx — delete a specific conversation
// DELETE /api/chat — delete all
export async function DELETE(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const db = getDatabase();
        const url = new URL(request.url);
        const conversationId = url.searchParams.get('conversation_id');

        if (conversationId) {
            db.prepare('DELETE FROM chat_history WHERE conversation_id = ?').run(conversationId);
            db.prepare('DELETE FROM conversations WHERE id = ?').run(conversationId);
            return jsonSuccess({ message: 'Conversation deleted' });
        }

        db.prepare('DELETE FROM chat_history').run();
        db.prepare('DELETE FROM conversations').run();
        return jsonSuccess({ message: 'All conversations cleared' });
    } catch {
        return jsonError('INTERNAL_ERROR', 'Failed to clear history', 500);
    }
}
