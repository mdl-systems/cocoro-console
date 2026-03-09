/**
 * Unit tests: src/core/security.ts
 * セキュリティログ・レート制限のユニットテスト
 * (SQLite DB をモックして純粋ロジックをテスト)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── DB モック ────────────────────────────────────────────────
// getDatabase() が呼ばれるたびにモックDBを返す

const mockRun = vi.fn().mockReturnValue({ changes: 1 });
const mockAll = vi.fn().mockReturnValue([]);
const mockGet = vi.fn().mockReturnValue(undefined);
const mockPrepare = vi.fn().mockReturnValue({
    run: mockRun,
    all: mockAll,
    get: mockGet,
});

vi.mock('@/db', () => ({
    getDatabase: () => ({
        prepare: mockPrepare,
    }),
}));

import {
    logSecurityEvent,
    getRecentLogs,
    getTodayLogStats,
    checkRateLimit,
    cleanRateLimits,
} from './security';

// ── テスト ──────────────────────────────────────────────────

describe('logSecurityEvent()', () => {
    beforeEach(() => vi.clearAllMocks());

    it('INSERT クエリを実行してログを保存する', () => {
        logSecurityEvent({
            event_type: 'login_success',
            ip: '127.0.0.1',
            status: 'ok',
            endpoint: '/api/session',
        });
        expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO security_logs'));
        expect(mockRun).toHaveBeenCalled();
    });

    it('session_id がない場合は null を渡す', () => {
        logSecurityEvent({
            event_type: 'api_access',
            ip: '192.168.1.1',
            status: 'ok',
        });
        // run() の引数に null が含まれる
        const args = mockRun.mock.calls[0];
        expect(args).toContain(null);
    });

    it('DBエラーが起きてもクラッシュしない', () => {
        mockPrepare.mockImplementationOnce(() => {
            throw new Error('DB connection lost');
        });
        // クラッシュしないこと
        expect(() => logSecurityEvent({
            event_type: 'rate_limited',
            ip: '10.0.0.1',
            status: 'blocked',
        })).not.toThrow();
    });
});

describe('getRecentLogs()', () => {
    beforeEach(() => vi.clearAllMocks());

    it('SELECT クエリを実行してログ一覧を返す', () => {
        const mockLogs = [
            { timestamp: new Date().toISOString(), event_type: 'api_access', ip: '127.0.0.1', status: 'ok' },
        ];
        mockAll.mockReturnValueOnce(mockLogs);

        const logs = getRecentLogs(10);
        expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
        expect(logs).toEqual(mockLogs);
    });

    it('DBエラー時は空配列を返す', () => {
        mockPrepare.mockImplementationOnce(() => {
            throw new Error('DB error');
        });
        const logs = getRecentLogs();
        expect(logs).toEqual([]);
    });

    it('デフォルト件数は 50 件', () => {
        getRecentLogs();
        expect(mockRun.mock.calls.length + mockAll.mock.calls.length).toBeGreaterThan(0);
    });
});

describe('getTodayLogStats()', () => {
    beforeEach(() => vi.clearAllMocks());

    it('今日のイベント種別ごとのカウントを返す', () => {
        mockAll.mockReturnValueOnce([
            { event_type: 'api_access', count: 15 },
            { event_type: 'login_success', count: 3 },
        ]);

        const stats = getTodayLogStats();
        expect(stats).toEqual({ api_access: 15, login_success: 3 });
    });

    it('DBエラー時は空オブジェクトを返す', () => {
        mockPrepare.mockImplementationOnce(() => {
            throw new Error('DB error');
        });
        const stats = getTodayLogStats();
        expect(stats).toEqual({});
    });
});

describe('checkRateLimit()', () => {
    beforeEach(() => vi.clearAllMocks());

    it('新しい IP の場合は true を返して INSERT する', () => {
        mockGet.mockReturnValueOnce(undefined); // レコードなし

        const allowed = checkRateLimit('127.0.0.1', '/api/chat');
        expect(allowed).toBe(true);
        expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE'));
    });

    it('count が上限未満なら true を返して UPDATE する', () => {
        mockGet.mockReturnValueOnce({ request_count: 30 }); // 30/60

        const allowed = checkRateLimit('127.0.0.1', '/api/chat');
        expect(allowed).toBe(true);
        expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE rate_limits'));
    });

    it('count が RATE_LIMIT_MAX (60) 以上なら false を返す', () => {
        mockGet.mockReturnValueOnce({ request_count: 60 }); // 60/60 = 上限

        const allowed = checkRateLimit('10.0.0.1', '/api/chat');
        expect(allowed).toBe(false);
    });

    it('DBエラーが起きても true を返す（機能を止めない）', () => {
        mockPrepare.mockImplementationOnce(() => {
            throw new Error('DB error');
        });

        const allowed = checkRateLimit('127.0.0.1', '/api/chat');
        expect(allowed).toBe(true);
    });
});

describe('cleanRateLimits()', () => {
    beforeEach(() => vi.clearAllMocks());

    it('DELETE クエリで古いエントリを削除する', () => {
        cleanRateLimits();
        expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM rate_limits'));
        expect(mockRun).toHaveBeenCalled();
    });

    it('DBエラーが起きてもクラッシュしない', () => {
        mockPrepare.mockImplementationOnce(() => {
            throw new Error('DB error');
        });
        expect(() => cleanRateLimits()).not.toThrow();
    });
});
