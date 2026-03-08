import { NextRequest, NextResponse } from 'next/server';
import { createSession, validateSession, unlockSession, destroySession } from '@/core/sessions';
import { getOrCreateDeviceIdentity } from '@/core/identity';
import { logSecurityEvent } from '@/core/security';
import { validateBody, SessionActionSchema } from '@/core/validators';
import { checkRate, jsonSuccess, jsonError, getRequestContext } from '@/core/api-helper';

export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const token = request.cookies.get('cocoro_device_token')?.value;

    if (!token) {
        return NextResponse.json({ authenticated: false, locked: false, expired: false, pin_required: false });
    }

    const result = validateSession(token);
    const pinRequired = !!(process.env.COCORO_PIN && process.env.COCORO_PIN.length === 4);
    return NextResponse.json({
        authenticated: result.valid,
        locked: result.locked,
        expired: result.expired,
        pin_required: pinRequired,
    });
}

export async function POST(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    try {
        const body = await request.json();
        const validation = validateBody(body, SessionActionSchema);

        if (!validation.success) {
            return jsonError('VALIDATION_ERROR', validation.error, 400);
        }

        const { action } = validation.data;
        const ctx = getRequestContext(request);

        if (action === 'create') {
            const identity = getOrCreateDeviceIdentity();
            const { sessionToken, csrfToken } = createSession(identity.device_id, ctx.ip);

            logSecurityEvent({
                event_type: 'session_created',
                ip: ctx.ip,
                status: 'success',
                details: JSON.stringify({ device_id: identity.device_id }),
            });

            const response = jsonSuccess({ csrf_token: csrfToken });

            response.cookies.set('cocoro_device_token', sessionToken, {
                httpOnly: true,
                secure: false, // LAN access
                sameSite: 'strict',
                maxAge: 24 * 60 * 60,
                path: '/',
            });

            response.cookies.set('cocoro_csrf', csrfToken, {
                httpOnly: false, // JS reads this for X-CSRF-Token header
                secure: false,
                sameSite: 'strict',
                maxAge: 24 * 60 * 60,
                path: '/',
            });

            return response;
        }

        if (action === 'unlock') {
            const token = request.cookies.get('cocoro_device_token')?.value;
            if (!token) return jsonError('UNAUTHORIZED', 'No session', 401);

            // PIN validation (if COCORO_PIN is set)
            const requiredPin = process.env.COCORO_PIN;
            if (requiredPin && requiredPin.length === 4) {
                const { pin } = body as { action: string; pin?: string };
                if (!pin || pin !== requiredPin) {
                    logSecurityEvent({
                        event_type: 'access_denied',
                        ip: ctx.ip,
                        session_id: token,
                        endpoint: '/api/session',
                        status: 'wrong_pin',
                        user_agent: ctx.userAgent,
                    });
                    return jsonError('WRONG_PIN', 'Incorrect PIN', 401);
                }
            }

            const unlocked = unlockSession(token);
            if (unlocked) {
                logSecurityEvent({
                    event_type: 'session_unlocked',
                    ip: ctx.ip,
                    session_id: token,
                    status: 'success',
                });
                return jsonSuccess({});
            }
            return jsonError('UNLOCK_FAILED', 'Failed to unlock session', 400);
        }

        if (action === 'destroy') {
            const token = request.cookies.get('cocoro_device_token')?.value;
            if (token) {
                destroySession(token);
                logSecurityEvent({
                    event_type: 'session_destroyed',
                    ip: ctx.ip,
                    session_id: token,
                    status: 'success',
                });
            }
            const response = jsonSuccess({});
            response.cookies.delete('cocoro_device_token');
            response.cookies.delete('cocoro_csrf');
            return response;
        }

        return jsonError('INVALID_ACTION', 'Unknown action', 400);
    } catch {
        return jsonError('INTERNAL_ERROR', 'Server error', 500);
    }
}
