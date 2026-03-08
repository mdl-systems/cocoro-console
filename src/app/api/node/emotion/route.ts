import { NextRequest } from 'next/server';
import { checkRate, requireSession, jsonSuccess, jsonError } from '@/core/api-helper';
import { coreEmotionState, CORE_ENABLED } from '@/lib/cocoro-core';

// Mock emotion state for offline development
const MOCK_EMOTION = {
    current_emotion: 'calm',
    valence: 0.3,
    arousal: 0.4,
    sync_rate: 0.72,
    dominant_trait: 'empathetic',
    updated_at: new Date().toISOString(),
};

export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    // ── Try real cocoro-core ──────────────────────────────────
    if (CORE_ENABLED) {
        const emotion = await coreEmotionState();
        if (emotion) {
            return jsonSuccess({ emotion, source: 'core' });
        }
        // core enabled but unreachable — return mock with flag
        return jsonSuccess({ emotion: MOCK_EMOTION, source: 'offline' });
    }

    // ── Mock mode ─────────────────────────────────────────────
    return jsonSuccess({ emotion: null, source: 'disabled' });
}
