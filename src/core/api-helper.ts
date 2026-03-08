/**
 * Cocoro API Route Helper
 *
 * Provides consistent API response formats and session/rate-limiting checks.
 * API routes must remain thin — this helper contains shared logic.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession, touchSession } from '@/core/sessions';
import { logSecurityEvent, checkRateLimit, type SecurityEventType } from '@/core/security';

// ─── Response Helpers ────────────────────────────────────────

export function jsonSuccess(data: Record<string, unknown>, status: number = 200) {
    return NextResponse.json({ success: true, ...data }, { status });
}

export function jsonError(errorCode: string, message?: string, status: number = 400) {
    return NextResponse.json(
        { success: false, error: errorCode, message: message || errorCode },
        { status }
    );
}

// ─── Request Context ─────────────────────────────────────────

export interface RequestContext {
    ip: string;
    sessionToken: string | null;
    userAgent: string;
}

export function getRequestContext(request: NextRequest): RequestContext {
    return {
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || '127.0.0.1',
        sessionToken: request.cookies.get('cocoro_device_token')?.value || null,
        userAgent: request.headers.get('user-agent') || 'unknown',
    };
}

// ─── Route Guards ────────────────────────────────────────────

/**
 * Check rate limit for the current request.
 * Returns a 429 response if rate limited.
 */
export function checkRate(request: NextRequest): NextResponse | null {
    const ctx = getRequestContext(request);
    const endpoint = new URL(request.url).pathname;

    if (!checkRateLimit(ctx.ip, endpoint)) {
        logSecurityEvent({
            event_type: 'rate_limited',
            ip: ctx.ip,
            endpoint,
            status: 'blocked',
            user_agent: ctx.userAgent,
        });
        return jsonError('RATE_LIMITED', 'Too many requests', 429);
    }
    return null;
}

/**
 * Validate session for the current request.
 * Returns a 401 response if not authenticated.
 * Touches session on success.
 */
export function requireSession(request: NextRequest): NextResponse | null {
    const ctx = getRequestContext(request);

    if (!ctx.sessionToken) {
        logSecurityEvent({
            event_type: 'access_denied',
            ip: ctx.ip,
            endpoint: new URL(request.url).pathname,
            status: 'no_session',
            user_agent: ctx.userAgent,
        });
        return jsonError('UNAUTHORIZED', 'Session required', 401);
    }

    const validation = validateSession(ctx.sessionToken);

    if (!validation.valid) {
        return jsonError('SESSION_EXPIRED', 'Session expired', 401);
    }

    if (validation.locked) {
        return jsonError('SESSION_LOCKED', 'Session locked', 423);
    }

    // Touch session on valid access
    touchSession(ctx.sessionToken);
    return null;
}

/**
 * Log an API access event.
 */
export function logAccess(
    request: NextRequest,
    eventType: SecurityEventType,
    status: string,
    details?: string
) {
    const ctx = getRequestContext(request);
    logSecurityEvent({
        event_type: eventType,
        ip: ctx.ip,
        session_id: ctx.sessionToken || undefined,
        endpoint: new URL(request.url).pathname,
        status,
        details,
        user_agent: ctx.userAgent,
    });
}
