export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import os from 'os';
import { getOrCreateDeviceIdentity } from '@/core/identity';
import { checkRate, requireSession, jsonSuccess, jsonError } from '@/core/api-helper';
import { coreNodeStatus, coreHealth, coreEmotionState, CORE_ENABLED } from '@/lib/cocoro-core';

export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const identity = getOrCreateDeviceIdentity();

        // ── ローカル OS 情報（常に取得）──────────────────────
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const uptime = os.uptime();

        const localInfo = {
            device_id: identity.device_id,
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            uptime_seconds: Math.floor(uptime),
            uptime_human: formatUptime(uptime),
            cpu: {
                model: cpus[0]?.model || 'Unknown',
                cores: cpus.length,
                usage: getCpuUsage(),
            },
            memory: {
                total_gb: (totalMem / (1024 ** 3)).toFixed(2),
                used_gb: ((totalMem - freeMem) / (1024 ** 3)).toFixed(2),
                free_gb: (freeMem / (1024 ** 3)).toFixed(2),
                usage_percent: ((1 - freeMem / totalMem) * 100).toFixed(1),
            },
            network: { interfaces: getNetworkInfo() },
            version: '1.0.0',
        };

        // ── cocoro-core 情報（CORE_ENABLED 時に取得）─────────
        let coreStatus: {
            core_connected: boolean;
            core_status?: string;
            core_uptime?: number;
            core_cpu?: number;
            core_memory?: number;
            core_active_connections?: number;
            core_emotion?: string;
            services: Record<string, string>;
        };

        if (CORE_ENABLED) {
            const [dashboard, healthy, emotion] = await Promise.allSettled([
                coreNodeStatus(),
                coreHealth(),
                coreEmotionState(),
            ]);

            const dash = dashboard.status === 'fulfilled' ? dashboard.value : null;
            const health = healthy.status === 'fulfilled' ? healthy.value : false;
            const emo = emotion.status === 'fulfilled' ? emotion.value : null;

            coreStatus = {
                core_connected: health,
                core_status: dash?.status ?? (health ? 'ok' : 'unreachable'),
                core_uptime: dash?.uptime,
                core_cpu: dash?.cpu_usage,
                core_memory: dash?.memory_usage,
                core_active_connections: dash?.active_agents,
                core_emotion: emo?.current_emotion,
                services: {
                    console: 'running',
                    api_gateway: 'running',
                    identity_engine: 'active',
                    memory_engine: health ? 'running' : 'standby',
                    agent_runtime: health ? 'running' : 'standby',
                    cocoro_core: health ? 'running' : 'offline',
                },
            };
        } else {
            coreStatus = {
                core_connected: false,
                services: {
                    console: 'running',
                    api_gateway: 'running',
                    identity_engine: 'active',
                    memory_engine: 'standby',
                    agent_runtime: 'standby',
                    cocoro_core: 'disabled',
                },
            };
        }

        return jsonSuccess({
            status: coreStatus.core_connected ? 'online' : 'local',
            ...localInfo,
            ...coreStatus,
        });
    } catch {
        return jsonError('INTERNAL_ERROR', 'Failed to get node status', 500);
    }
}

function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    return parts.join(' ');
}

function getCpuUsage(): string {
    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;
    for (const cpu of cpus) {
        for (const type in cpu.times) {
            totalTick += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdle += cpu.times.idle;
    }
    return ((1 - totalIdle / totalTick) * 100).toFixed(1) + '%';
}

function getNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const result: Record<string, string> = {};
    for (const [name, addrs] of Object.entries(interfaces)) {
        if (addrs) {
            for (const addr of addrs) {
                if (addr.family === 'IPv4' && !addr.internal) {
                    result[name] = addr.address;
                }
            }
        }
    }
    return result;
}
