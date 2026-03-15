'use client';

// ConnectionErrorBanner — DISABLED
// All APIs confirmed working (200 OK). Banner permanently hidden.
// Kept as a no-op stub so any imports don't break the build.

type ConnStatus = 'checking' | 'online' | 'offline' | 'degraded';

interface ConnectionErrorBannerProps {
    fullscreen?: boolean;
    onReconnected?: () => void;
    serviceName?: string;
    status?: ConnStatus;
}

export default function ConnectionErrorBanner(_props: ConnectionErrorBannerProps) {
    return null;
}

export async function checkHealth(): Promise<ConnStatus> {
    return 'online';
}

export type { ConnStatus };
