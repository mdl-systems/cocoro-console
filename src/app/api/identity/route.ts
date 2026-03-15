export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateDeviceIdentity } from '@/core/identity';
import { logAccess, checkRate, jsonSuccess, jsonError } from '@/core/api-helper';

export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    try {
        const identity = getOrCreateDeviceIdentity();

        logAccess(request, 'api_access', 'success', 'identity_retrieved');

        return jsonSuccess({
            device_id: identity.device_id,
            public_key: identity.public_key,
            creation_time: identity.creation_time,
        });
    } catch {
        return jsonError('INTERNAL_ERROR', 'Failed to retrieve device identity', 500);
    }
}
