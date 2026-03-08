import { NextRequest } from 'next/server';
import { getUserProfile, updateUserProfile } from '@/core/identity';
import { validateBody, ProfileUpdateSchema } from '@/core/validators';
import { checkRate, requireSession, jsonSuccess, jsonError, logAccess } from '@/core/api-helper';

export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    try {
        const profile = getUserProfile();
        return jsonSuccess(profile as unknown as Record<string, unknown>);
    } catch {
        return jsonError('INTERNAL_ERROR', 'Failed to get profile', 500);
    }
}

export async function PUT(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const body = await request.json();
        const validation = validateBody(body, ProfileUpdateSchema);

        if (!validation.success) {
            return jsonError('VALIDATION_ERROR', validation.error, 400);
        }

        const profile = updateUserProfile(validation.data as Parameters<typeof updateUserProfile>[0]);

        logAccess(request, 'api_access', 'success', 'profile_updated');

        return jsonSuccess(profile as unknown as Record<string, unknown>);
    } catch {
        return jsonError('INTERNAL_ERROR', 'Failed to update profile', 500);
    }
}
