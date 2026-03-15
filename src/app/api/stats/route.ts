export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { checkRate, requireSession, jsonSuccess } from '@/core/api-helper';
import { getDatabase } from '@/db';

export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const db = getDatabase();

        // 最近の会話（直近5件）
        const recentConversations = db.prepare(`
            SELECT id, title, created_at, updated_at
            FROM conversations
            ORDER BY updated_at DESC
            LIMIT 5
        `).all() as { id: string; title: string; created_at: string; updated_at: string }[];

        // 総会話数
        const totalConversations = (db.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number }).count;

        // 総メッセージ数
        let totalMessages = 0;
        try {
            totalMessages = (db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number }).count;
        } catch { /* messages テーブルが存在しない場合 */ }

        // エージェント使用状況（ダミー — role_id を保存する列がなければゼロ）
        const agentUsage = [
            { id: 'default', name: 'MDL', icon: '🤖', count: 0, color: '#d87898' },
            { id: 'lawyer', name: '弁護士', icon: '⚖️', count: 0, color: '#4a7ab5' },
            { id: 'accountant', name: '税理士', icon: '📊', count: 0, color: '#3a9a6a' },
            { id: 'engineer', name: 'エンジニア', icon: '💻', count: 0, color: '#4a6ab5' },
            { id: 'researcher', name: 'リサーチ', icon: '🔍', count: 0, color: '#c4782a' },
            { id: 'financial_advisor', name: 'FP', icon: '💰', count: 0, color: '#c4a42a' },
        ];

        // セキュリティログ（直近10件）
        const recentLogs = db.prepare(`
            SELECT event_type, ip, endpoint, status, timestamp, details
            FROM security_logs
            ORDER BY timestamp DESC
            LIMIT 10
        `).all() as { event_type: string; ip: string | null; endpoint: string | null; status: string | null; timestamp: string; details: string | null }[];

        return jsonSuccess({
            totalConversations,
            totalMessages,
            recentConversations,
            agentUsage,
            recentLogs,
            generatedAt: new Date().toISOString(),
        });
    } catch (e) {
        return jsonSuccess({
            totalConversations: 0,
            totalMessages: 0,
            recentConversations: [],
            agentUsage: [],
            recentLogs: [],
            error: (e as Error).message,
            generatedAt: new Date().toISOString(),
        });
    }
}
