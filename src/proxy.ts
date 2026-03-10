/**
 * Next.js Proxy entry point (formerly middleware.ts).
 * Renamed from "middleware" to "proxy" per Next.js 16 convention.
 * Delegates to the proxy security layer.
 *
 * @see https://nextjs.org/docs/messages/middleware-to-proxy
 */
import { proxy } from './security-middleware';
export { proxy };

export const config = {
    matcher: ['/((?!_next/static|_next/image).*)'],
};
