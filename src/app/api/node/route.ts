import { NextRequest } from 'next/server';
import os from 'os';
import { getOrCreateDeviceIdentity } from '@/core/identity';
import { checkRate, requireSession, jsonSuccess, jsonError } from '@/core/api-helper';

export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const identity = getOrCreateDeviceIdentity();
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const uptime = os.uptime();

        return jsonSuccess({
            status: 'online',
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
            services: {
                console: 'running',
                api_gateway: 'running',
                identity_engine: 'active',
                memory_engine: 'standby',
                agent_runtime: 'standby',
            },
            version: '1.0.0',
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
