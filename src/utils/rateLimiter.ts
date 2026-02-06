/**
 * Client-side rate limiter for preventing abuse
 * Works in conjunction with server-side rate limiting
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60000, // 1 minute
};

// Specific limits for different actions
const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  login: { maxRequests: 5, windowMs: 300000 }, // 5 attempts per 5 minutes
  signup: { maxRequests: 3, windowMs: 600000 }, // 3 attempts per 10 minutes
  passwordReset: { maxRequests: 3, windowMs: 300000 }, // 3 per 5 minutes
  whatsappMessage: { maxRequests: 30, windowMs: 60000 }, // 30 per minute
  bulkMessage: { maxRequests: 5, windowMs: 300000 }, // 5 bulk sends per 5 minutes
  apiCall: { maxRequests: 100, windowMs: 60000 }, // 100 API calls per minute
  formSubmit: { maxRequests: 10, windowMs: 60000 }, // 10 form submits per minute
};

/**
 * Check if an action is rate limited
 * @param key Unique key for the rate limit (e.g., 'login:user@email.com')
 * @param action Type of action to check limits for
 * @returns Object with allowed status and remaining requests
 */
export function checkRateLimit(
  key: string,
  action: keyof typeof RATE_LIMIT_CONFIGS | 'default' = 'default'
): { allowed: boolean; remaining: number; resetIn: number } {
  const config = action === 'default' ? DEFAULT_CONFIG : RATE_LIMIT_CONFIGS[action] || DEFAULT_CONFIG;
  const now = Date.now();
  const fullKey = `${action}:${key}`;
  
  const entry = rateLimitStore.get(fullKey);
  
  // No existing entry or window expired
  if (!entry || now - entry.windowStart >= config.windowMs) {
    rateLimitStore.set(fullKey, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
    };
  }
  
  // Within window
  const remaining = config.maxRequests - entry.count - 1;
  const resetIn = config.windowMs - (now - entry.windowStart);
  
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn,
    };
  }
  
  // Increment count
  entry.count++;
  rateLimitStore.set(fullKey, entry);
  
  return {
    allowed: true,
    remaining: Math.max(0, remaining),
    resetIn,
  };
}

/**
 * Reset rate limit for a specific key
 */
export function resetRateLimit(key: string, action: keyof typeof RATE_LIMIT_CONFIGS | 'default' = 'default'): void {
  const fullKey = `${action}:${key}`;
  rateLimitStore.delete(fullKey);
}

/**
 * Get time until rate limit resets
 */
export function getRateLimitResetTime(
  key: string,
  action: keyof typeof RATE_LIMIT_CONFIGS | 'default' = 'default'
): number {
  const config = action === 'default' ? DEFAULT_CONFIG : RATE_LIMIT_CONFIGS[action] || DEFAULT_CONFIG;
  const fullKey = `${action}:${key}`;
  const entry = rateLimitStore.get(fullKey);
  
  if (!entry) return 0;
  
  const elapsed = Date.now() - entry.windowStart;
  return Math.max(0, config.windowMs - elapsed);
}

/**
 * Format reset time for display
 */
export function formatResetTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} segundos`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
}

/**
 * Cleanup expired entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  const maxWindowMs = Math.max(...Object.values(RATE_LIMIT_CONFIGS).map(c => c.windowMs));
  
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart >= maxWindowMs) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(cleanupRateLimits, 300000);
}
