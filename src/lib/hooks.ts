'use client';

import { useState, useEffect, useCallback } from 'react';

export function useSession() {
    const [authenticated, setAuthenticated] = useState(false);
    const [locked, setLocked] = useState(false);
    const [loading, setLoading] = useState(true);

    const checkSession = useCallback(async () => {
        try {
            const res = await fetch('/api/session');
            const data = await res.json();
            setAuthenticated(data.authenticated);
            setLocked(data.locked);
        } catch {
            setAuthenticated(false);
        } finally {
            setLoading(false);
        }
    }, []);

    const createSession = useCallback(async () => {
        try {
            const res = await fetch('/api/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create' }),
            });
            const data = await res.json();
            if (data.success) {
                setAuthenticated(true);
                setLocked(false);
            }
            return data.success;
        } catch {
            return false;
        }
    }, []);

    const unlockSession = useCallback(async () => {
        try {
            const res = await fetch('/api/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unlock' }),
            });
            const data = await res.json();
            if (data.success) {
                setLocked(false);
            }
            return data.success;
        } catch {
            return false;
        }
    }, []);

    useEffect(() => {
        checkSession();
        const interval = setInterval(checkSession, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [checkSession]);

    return { authenticated, locked, loading, createSession, unlockSession, checkSession };
}

export function useProfile() {
    const [profile, setProfile] = useState<{
        name: string;
        nickname: string;
        interests: string[];
        ai_preferences: { personality: string; language: string; formality: string };
    } | null>(null);

    const fetchProfile = useCallback(async () => {
        try {
            const res = await fetch('/api/profile');
            const data = await res.json();
            setProfile(data);
        } catch {
            // Default
        }
    }, []);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    return { profile, refetch: fetchProfile };
}

export function useNodeStatus() {
    const [status, setStatus] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchStatus = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/node');
            const data = await res.json();
            setStatus(data);
        } catch {
            setStatus(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 60000); // 60秒ごと（429対策）
        return () => clearInterval(interval);
    }, [fetchStatus]);

    return { status, loading, refetch: fetchStatus };
}
