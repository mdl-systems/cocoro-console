/**
 * Cocoro Input Validation
 *
 * All request bodies validated using Zod schemas.
 * Reject invalid input immediately.
 */

import { z } from 'zod';

// ─── Session ─────────────────────────────────────────────────

export const SessionActionSchema = z.object({
    action: z.enum(['create', 'unlock', 'destroy']),
});

// ─── Profile ─────────────────────────────────────────────────

export const ProfileUpdateSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    nickname: z.string().min(1).max(50).optional(),
    interests: z.array(z.string().max(50)).max(20).optional(),
    ai_preferences: z.object({
        personality: z.enum(['friendly', 'professional', 'creative', 'analytical']).optional(),
        language: z.enum(['ja', 'en']).optional(),
        formality: z.enum(['casual', 'polite', 'formal']).optional(),
    }).optional(),
});

// ─── Chat ────────────────────────────────────────────────────

export const ChatMessageSchema = z.object({
    message: z.string().min(1).max(4000).trim(),
});

// ─── Agent ───────────────────────────────────────────────────

export const AgentExecuteSchema = z.object({
    agent_id: z.string().min(1).max(50),
    task_name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
});

// ─── Memory ──────────────────────────────────────────────────

export const MemoryCreateSchema = z.object({
    content: z.string().min(1).max(10000),
    type: z.enum(['short_term', 'long_term', 'vector']).optional().default('short_term'),
    category: z.string().min(1).max(50).optional().default('general'),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

// ─── Utility ─────────────────────────────────────────────────

export type SessionAction = z.infer<typeof SessionActionSchema>;
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type AgentExecute = z.infer<typeof AgentExecuteSchema>;
export type MemoryCreate = z.infer<typeof MemoryCreateSchema>;

/**
 * Validate request body against a Zod schema.
 * Returns { success: true, data } or { success: false, error }.
 */
export function validateBody<T>(
    body: unknown,
    schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
    const result = schema.safeParse(body);
    if (result.success) {
        return { success: true, data: result.data };
    }
    const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { success: false, error: messages };
}
