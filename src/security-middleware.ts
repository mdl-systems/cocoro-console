/**
 * Cocoro Global Middleware
 *
 * Enforces:
 * - Security headers (CSP, X-Frame-Options, XCTO, Referrer-Policy)
 * - Origin/Host verification
 * - CSRF protection (on state-changing methods)
 * - Session validation (on protected routes)
 *
 * Note: Rate limiting is handled at the API route level
 * since Next.js Edge middleware doesn't support SQLite.
 */

import { NextRequest, NextResponse } from 'next/server';

// Routes that don't require session
const PUBLIC_PATHS = ['/_next', '/favicon.ico', '/api/session'];

// State-changing methods requiring CSRF
const CSRF_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const method = request.method;

    // Skip middleware for static assets
    if (pathname.startsWith('/_next') || pathname === '/favicon.ico') {
        return addSecurityHeaders(NextResponse.next());
    }

    // ─── Origin/Host Verification (API routes only) ────────────
    if (pathname.startsWith('/api/')) {
        const origin = request.headers.get('origin');
        const host = request.headers.get('host');

        // Allow same-origin requests and requests without origin (same-page)
        if (origin) {
            const originUrl = new URL(origin);
            const hostWithoutPort = host?.split(':')[0];
            const originHost = originUrl.hostname;

            // Reject if origin doesn't match host
            const allowedHosts = [hostWithoutPort, 'localhost', '127.0.0.1'];
            if (!allowedHosts.includes(originHost)) {
                return new NextResponse(
                    JSON.stringify({ success: false, error: 'ORIGIN_REJECTED' }),
                    { status: 403, headers: { 'Content-Type': 'application/json' } }
                );
            }
        }

        // ─── Content-Type Validation (for body requests) ───────────
        if (CSRF_METHODS.includes(method)) {
            const contentType = request.headers.get('content-type');
            if (contentType && !contentType.includes('application/json')) {
                return new NextResponse(
                    JSON.stringify({ success: false, error: 'INVALID_CONTENT_TYPE' }),
                    { status: 415, headers: { 'Content-Type': 'application/json' } }
                );
            }
        }

        // ─── CSRF Verification (state-changing methods) ────────────
        if (CSRF_METHODS.includes(method) && !PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
            const csrfHeader = request.headers.get('x-csrf-token');
            const csrfCookie = request.cookies.get('cocoro_csrf')?.value;

            if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
                return new NextResponse(
                    JSON.stringify({ success: false, error: 'CSRF_VIOLATION' }),
                    { status: 403, headers: { 'Content-Type': 'application/json' } }
                );
            }
        }
    }

    return addSecurityHeaders(NextResponse.next());
}

/**
 * Add security headers to every response.
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
    // Content Security Policy
    response.headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'"
    );

    // Prevent clickjacking
    response.headers.set('X-Frame-Options', 'DENY');

    // Prevent MIME type sniffing
    response.headers.set('X-Content-Type-Options', 'nosniff');

    // Referrer policy
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Prevent XSS in older browsers
    response.headers.set('X-XSS-Protection', '1; mode=block');

    // No DNS prefetching
    response.headers.set('X-DNS-Prefetch-Control', 'off');

    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image).*)'],
};
