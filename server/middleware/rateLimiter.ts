import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * 開發環境爬蟲 API 的速率限制
 * 限制：每分鐘最多 20 個請求
 */
export const devScraperLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分鐘
  max: 20, // 最多 20 個請求
  message: { 
    error: 'Too many requests, please try again later',
    retryAfter: '60 seconds'
  },
  standardHeaders: true, // 返回 RateLimit-* headers
  legacyHeaders: false, // 禁用 X-RateLimit-* headers
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimiter] Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: 60
    });
  }
});
