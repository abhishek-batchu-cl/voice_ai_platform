import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../services/RedisService';
import { UserAuthRequest } from './userAuth';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      keyPrefix: 'rate_limit',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config,
    };
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Skip if Redis is not available
      if (!RedisService.isAvailable()) {
        return next();
      }

      const key = this.getKey(req);
      const windowSeconds = Math.floor(this.config.windowMs / 1000);

      try {
        // Get current count
        const current = await RedisService.incr(key);

        // Set expiry on first request
        if (current === 1) {
          await RedisService.expire(key, windowSeconds);
        }

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', this.config.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', Math.max(0, this.config.maxRequests - current).toString());
        res.setHeader('X-RateLimit-Reset', (Date.now() + windowSeconds * 1000).toString());

        // Check if limit exceeded
        if (current > this.config.maxRequests) {
          res.setHeader('Retry-After', windowSeconds.toString());
          return res.status(429).json({
            error: 'Too many requests',
            message: `Rate limit exceeded. Please try again in ${windowSeconds} seconds.`,
            retryAfter: windowSeconds,
          });
        }

        next();
      } catch (error) {
        console.error('Rate limiter error:', error);
        // Continue without rate limiting on error
        next();
      }
    };
  }

  private getKey(req: Request): string {
    const userReq = req as UserAuthRequest;

    // Priority: User ID > Organization ID > IP Address
    if (userReq.user?.id) {
      return `${this.config.keyPrefix}:user:${userReq.user.id}`;
    } else if (userReq.currentOrg?.id) {
      return `${this.config.keyPrefix}:org:${userReq.currentOrg.id}`;
    } else {
      const ip = this.getClientIp(req);
      return `${this.config.keyPrefix}:ip:${ip}`;
    }
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || 'unknown';
  }
}

// Pre-configured rate limiters for different tiers
export const rateLimiters = {
  // Global API rate limit (unauthenticated)
  global: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    keyPrefix: 'rl_global',
  }),

  // Free tier (authenticated users)
  free: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    keyPrefix: 'rl_free',
  }),

  // Pro tier
  pro: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyPrefix: 'rl_pro',
  }),

  // Enterprise tier
  enterprise: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000,
    keyPrefix: 'rl_enterprise',
  }),

  // Auth endpoints (stricter limits)
  auth: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyPrefix: 'rl_auth',
  }),

  // WebSocket connections
  websocket: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    keyPrefix: 'rl_ws',
  }),

  // AI API calls (expensive operations)
  ai: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    keyPrefix: 'rl_ai',
  }),
};

// Middleware to select rate limiter based on user tier
export function adaptiveRateLimiter(req: UserAuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return rateLimiters.global.middleware()(req, res, next);
  }

  // Get user's plan/tier from organization
  const tier = req.currentOrg?.tier || 'free';

  switch (tier) {
    case 'enterprise':
      return rateLimiters.enterprise.middleware()(req, res, next);
    case 'pro':
      return rateLimiters.pro.middleware()(req, res, next);
    case 'free':
    default:
      return rateLimiters.free.middleware()(req, res, next);
  }
}
