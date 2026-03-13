import { NextRequest } from 'next/server';
import { checkRate, requireSession, jsonSuccess } from '@/core/api-helper';

export async function POST(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    const sessionCheck = requireSession(request);
    if (sessionCheck) return sessionCheck;

    try {
        const { language } = await request.json();
        const valid = ['ja', 'en', 'zh'];
        if (!valid.includes(language)) {
            return jsonSuccess({ language: 'ja' });
        }
        // Store in Node.js process memory (lightweight; real persistence via localStorage on client)
        process.env.COCORO_UI_LANGUAGE = language;
        return jsonSuccess({ language });
    } catch {
        return jsonSuccess({ language: 'ja' });
    }
}

export async function GET(request: NextRequest) {
    const rateLimited = checkRate(request);
    if (rateLimited) return rateLimited;

    return jsonSuccess({ language: process.env.COCORO_UI_LANGUAGE ?? 'ja' });
}
