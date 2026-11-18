const MAX_BUCKETS = 10000;

/**
 * Lightweight, memory-bounded in-memory rate limiter middleware.
 * Relies on Express `trust proxy` to resolve real client IPs behind Nginx.
 */
const createRateLimiter = ({
  windowMs = 15 * 60 * 1000,
  max = 100,
  message = 'Too many requests, please try again later.',
  keyGenerator,
} = {}) => {
  const buckets = new Map();

  // Periodic cleanup so expired entries never accumulate
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets.entries()) {
      if (entry.resetTime <= now) {
        buckets.delete(key);
      }
    }
  }, Math.min(windowMs, 5 * 60 * 1000));
  if (cleanupInterval.unref) cleanupInterval.unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = typeof keyGenerator === 'function'
      ? keyGenerator(req)
      : (req.ip || req.socket?.remoteAddress || 'unknown');

    let entry = buckets.get(key);
    if (!entry || entry.resetTime <= now) {
      // Bound map size against memory exhaustion from spoofed/distributed IPs
      if (buckets.size >= MAX_BUCKETS) {
        const oldestKey = buckets.keys().next().value;
        if (oldestKey !== undefined) buckets.delete(oldestKey);
      }
      entry = { count: 0, resetTime: now + windowMs };
      buckets.set(key, entry);
    }

    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetTime / 1000)));

    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, retryAfterSeconds)));
      return res.status(429).json({
        success: false,
        message,
      });
    }

    next();
  };
};

// General API rate limit: 250 requests per 15 minutes per IP
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 250,
  message: 'Too many requests from this IP. Please slow down and try again shortly.',
});

// Login brute-force protection: 15 attempts per 15 minutes per IP
const authLoginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many login attempts. Please wait 15 minutes before trying again.',
});

// Register & resend verification protection (prevents Gmail SMTP spam & bcrypt CPU DoS): 5 per 15 minutes
const authEmailLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many verification requests. Please wait 15 minutes before trying again.',
});

// Presigned S3 upload URL protection (prevents orphaned S3 file spam): 30 per 15 minutes per user/IP
const uploadPresignLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many upload requests. Please wait a few minutes before uploading again.',
  keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : (req.ip || 'unknown')),
});

module.exports = {
  createRateLimiter,
  apiLimiter,
  authLoginLimiter,
  authEmailLimiter,
  uploadPresignLimiter,
};
