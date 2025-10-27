import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import { Request, Response } from 'express';

// Create a separate Redis client for rate limiting
const rateLimitClient = createClient({
    url: 'redis://localhost:6379',
});
rateLimitClient.connect().catch(console.error);

// Create a Redis store
const store = new RedisStore({
    sendCommand: (...args: string[]) =>
        rateLimitClient.sendCommand(args as any),
});

/**
 * Tenant-aware rate limiter.
 * This identifies the tenant from `req.tenantId` (set by auth middleware).
 */
export const tenantRateLimiter = rateLimit({
    store: store,
    windowMs: 15 * 60 * 1000,
    limit:40,
    standardHeaders: 'draft-7',
    legacyHeaders: false,

    // Use the tenantId as the key
    keyGenerator: (req: Request, res: Response): string => {
        return req.tenantId || req.ip || 'unknown';
    },
    
    handler: (req, res, next, options) => {
        res.status(options.statusCode).json({
            error: `Too many requests. You are limited to ${options.limit} requests per 15 minutes.`,
        });
    },
});