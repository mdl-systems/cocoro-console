/**
 * Unit tests: src/core/validators.ts
 * Zod スキーマバリデーション + validateBody() のユニットテスト
 */

import { describe, it, expect } from 'vitest';
import {
    SessionActionSchema,
    ProfileUpdateSchema,
    ChatMessageSchema,
    AgentExecuteSchema,
    MemoryCreateSchema,
    validateBody,
} from './validators';

// ── SessionActionSchema ─────────────────────────────────────

describe('SessionActionSchema', () => {
    it('有効なアクション "create" を受け入れる', () => {
        expect(SessionActionSchema.safeParse({ action: 'create' }).success).toBe(true);
    });

    it('有効なアクション "unlock" を受け入れる', () => {
        expect(SessionActionSchema.safeParse({ action: 'unlock' }).success).toBe(true);
    });

    it('有効なアクション "destroy" を受け入れる', () => {
        expect(SessionActionSchema.safeParse({ action: 'destroy' }).success).toBe(true);
    });

    it('無効なアクション "login" を拒否する', () => {
        expect(SessionActionSchema.safeParse({ action: 'login' }).success).toBe(false);
    });

    it('action フィールドなしを拒否する', () => {
        expect(SessionActionSchema.safeParse({}).success).toBe(false);
    });
});

// ── ProfileUpdateSchema ─────────────────────────────────────

describe('ProfileUpdateSchema', () => {
    it('全てのフィールドが有効なオブジェクトを受け入れる', () => {
        const result = ProfileUpdateSchema.safeParse({
            name: 'テストユーザー',
            nickname: 'nico',
            interests: ['AI', 'プログラミング'],
            ai_preferences: {
                personality: 'friendly',
                language: 'ja',
                formality: 'casual',
            },
        });
        expect(result.success).toBe(true);
    });

    it('空オブジェクト（全フィールドオプション）を受け入れる', () => {
        expect(ProfileUpdateSchema.safeParse({}).success).toBe(true);
    });

    it('name が101文字以上で失敗する', () => {
        expect(ProfileUpdateSchema.safeParse({ name: 'a'.repeat(101) }).success).toBe(false);
    });

    it('無効な personality enum で失敗する', () => {
        expect(ProfileUpdateSchema.safeParse({
            ai_preferences: { personality: 'evil' }
        }).success).toBe(false);
    });

    it('interests の要素が51文字で失敗する', () => {
        expect(ProfileUpdateSchema.safeParse({
            interests: ['a'.repeat(51)]
        }).success).toBe(false);
    });
});

// ── ChatMessageSchema ───────────────────────────────────────

describe('ChatMessageSchema', () => {
    it('有効なメッセージを受け入れる', () => {
        const result = ChatMessageSchema.safeParse({ message: 'こんにちは' });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.message).toBe('こんにちは');
    });

    it('空文字列を拒否する', () => {
        expect(ChatMessageSchema.safeParse({ message: '' }).success).toBe(false);
    });

    it('4001文字のメッセージを拒否する', () => {
        expect(ChatMessageSchema.safeParse({ message: 'a'.repeat(4001) }).success).toBe(false);
    });

    it('4000文字のメッセージは受け入れる', () => {
        expect(ChatMessageSchema.safeParse({ message: 'a'.repeat(4000) }).success).toBe(true);
    });

    it('前後の空白をトリムする', () => {
        const result = ChatMessageSchema.safeParse({ message: '  hello  ' });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.message).toBe('hello');
    });
});

// ── AgentExecuteSchema ──────────────────────────────────────

describe('AgentExecuteSchema', () => {
    it('有効なエージェント実行リクエストを受け入れる', () => {
        const result = AgentExecuteSchema.safeParse({
            agent_id: 'researcher',
            task_name: 'AIトレンド調査',
            description: '2026年の主要トレンドを3つ',
        });
        expect(result.success).toBe(true);
    });

    it('description なしでも受け入れる（optional）', () => {
        expect(AgentExecuteSchema.safeParse({
            agent_id: 'dev',
            task_name: 'コード生成',
        }).success).toBe(true);
    });

    it('agent_id が空で拒否する', () => {
        expect(AgentExecuteSchema.safeParse({
            agent_id: '',
            task_name: 'test',
        }).success).toBe(false);
    });

    it('task_name が201文字で拒否する', () => {
        expect(AgentExecuteSchema.safeParse({
            agent_id: 'dev',
            task_name: 'a'.repeat(201),
        }).success).toBe(false);
    });
});

// ── MemoryCreateSchema ──────────────────────────────────────

describe('MemoryCreateSchema', () => {
    it('有効なメモリ作成リクエストを受け入れる', () => {
        const result = MemoryCreateSchema.safeParse({
            content: '重要な設計決定: REST over GraphQL',
            type: 'long_term',
            category: 'architecture',
        });
        expect(result.success).toBe(true);
    });

    it('type のデフォルトは short_term', () => {
        const result = MemoryCreateSchema.safeParse({ content: 'テスト' });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.type).toBe('short_term');
    });

    it('category のデフォルトは general', () => {
        const result = MemoryCreateSchema.safeParse({ content: 'テスト' });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.category).toBe('general');
    });

    it('content が空で拒否する', () => {
        expect(MemoryCreateSchema.safeParse({ content: '' }).success).toBe(false);
    });

    it('無効な type で拒否する', () => {
        expect(MemoryCreateSchema.safeParse({
            content: 'test',
            type: 'episodic',
        }).success).toBe(false);
    });
});

// ── validateBody() ──────────────────────────────────────────

describe('validateBody()', () => {
    it('有効なボディで success: true とデータを返す', () => {
        const result = validateBody({ message: 'hello' }, ChatMessageSchema);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.message).toBe('hello');
    });

    it('無効なボディで success: false とエラーメッセージを返す', () => {
        const result = validateBody({ message: '' }, ChatMessageSchema);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('message');
        }
    });

    it('null を渡したときも success: false を返す', () => {
        const result = validateBody(null, ChatMessageSchema);
        expect(result.success).toBe(false);
    });

    it('エラーメッセージには path 情報が含まれる', () => {
        const result = validateBody({ name: 'a'.repeat(101) }, ProfileUpdateSchema);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('name');
        }
    });
});
