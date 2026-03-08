/**
 * Next.js Middleware entry point.
 * Delegates to the proxy security layer.
 */
import { proxy } from './security-middleware';
export { proxy as middleware };

export const config = {
    matcher: ['/((?!_next/static|_next/image).*)'],
};
