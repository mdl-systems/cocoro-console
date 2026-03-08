/**
 * Cocoro Frontend API Client
 *
 * All state-changing requests include X-CSRF-Token header.
 * Reads token from cocoro_csrf cookie.
 */

function getCsrfToken(): string {
    if (typeof document === 'undefined') return '';
    const match = document.cookie.match(/cocoro_csrf=([^;]+)/);
    return match ? match[1] : '';
}

export async function apiGet(path: string): Promise<Response> {
    return fetch(path);
}

export async function apiPost(path: string, body?: Record<string, unknown>): Promise<Response> {
    return fetch(path, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCsrfToken(),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
}

export async function apiPut(path: string, body: Record<string, unknown>): Promise<Response> {
    return fetch(path, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCsrfToken(),
        },
        body: JSON.stringify(body),
    });
}

export async function apiDelete(path: string): Promise<Response> {
    return fetch(path, {
        method: 'DELETE',
        headers: {
            'X-CSRF-Token': getCsrfToken(),
        },
    });
}

export async function apiStream(
    path: string,
    body: Record<string, unknown>,
    signal?: AbortSignal
): Promise<Response> {
    let csrf = getCsrfToken();

    // If no CSRF token, refresh the session first
    if (!csrf) {
        try {
            const sessRes = await fetch('/api/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create' }),
            });
            const sessData = await sessRes.json();
            csrf = sessData.csrf_token || getCsrfToken();
        } catch { /* ignore */ }
    }

    return fetch(path, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrf,
        },
        body: JSON.stringify(body),
        signal,
    });
}


