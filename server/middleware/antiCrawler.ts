/**
 * Anti-Crawler Middleware
 * 
 * 免費的反爬取機制，包括：
 * 1. 全局 API Rate Limiting
 * 2. User-Agent 黑名單
 * 3. IP 臨時封鎖
 * 4. 請求日誌和監控
 */
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// ==================== IP 封鎖管理 ====================

interface BlockedIP {
  ip: string;
  blockedAt: number;
  reason: string;
  expiresAt: number;
}

// 臨時封鎖的 IP 列表（存儲在內存中）
const blockedIPs = new Map<string, BlockedIP>();

// 每 5 分鐘清理過期的封鎖
setInterval(() => {
  const now = Date.now();
  const ipsToDelete: string[] = [];
  blockedIPs.forEach((block, ip) => {
    if (block.expiresAt < now) {
      ipsToDelete.push(ip);
    }
  });
  ipsToDelete.forEach(ip => {
    blockedIPs.delete(ip);
    console.log(`[AntiCrawler] IP ${ip} unblocked (expired)`);
  });
}, 5 * 60 * 1000);

/**
 * 封鎖 IP（臨時）
 */
export function blockIP(ip: string, reason: string, durationMs: number = 60 * 60 * 1000) {
  const now = Date.now();
  blockedIPs.set(ip, {
    ip,
    blockedAt: now,
    reason,
    expiresAt: now + durationMs,
  });
  console.warn(`[AntiCrawler] IP ${ip} blocked for ${durationMs / 1000}s. Reason: ${reason}`);
}

/**
 * 檢查 IP 是否被封鎖
 */
export function isIPBlocked(ip: string): boolean {
  const block = blockedIPs.get(ip);
  if (!block) return false;
  
  if (block.expiresAt < Date.now()) {
    blockedIPs.delete(ip);
    return false;
  }
  
  return true;
}

/**
 * 獲取所有被封鎖的 IP（用於 Admin 監控）
 */
export function getBlockedIPs(): BlockedIP[] {
  return Array.from(blockedIPs.values());
}

/**
 * 解除 IP 封鎖
 */
export function unblockIP(ip: string): boolean {
  const existed = blockedIPs.has(ip);
  if (existed) {
    blockedIPs.delete(ip);
    console.log(`[AntiCrawler] IP ${ip} manually unblocked`);
  }
  return existed;
}

// ==================== User-Agent 黑名單 ====================

const BLOCKED_USER_AGENTS = [
  // 常見爬蟲工具
  'python-requests',
  'python-urllib',
  'curl',
  'wget',
  'scrapy',
  'httpie',
  'axios', // 可能是腳本
  'node-fetch', // 可能是腳本
  'got', // 可能是腳本
  
  // 自動化工具
  'selenium',
  'puppeteer',
  'playwright',
  'phantomjs',
  'headless',
  
  // 已知惡意爬蟲
  'bot',
  'crawler',
  'spider',
  'scraper',
  'harvester',
];

/**
 * 檢查 User-Agent 是否在黑名單中
 */
function isBlockedUserAgent(userAgent: string | undefined): boolean {
  if (!userAgent) return true; // 沒有 User-Agent 視為可疑
  
  const ua = userAgent.toLowerCase();
  return BLOCKED_USER_AGENTS.some(blocked => ua.includes(blocked));
}

// ==================== Middleware ====================

/**
 * IP 封鎖檢查 Middleware
 */
export function checkIPBlock(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  if (isIPBlocked(ip)) {
    const block = blockedIPs.get(ip);
    const remainingTime = block ? Math.ceil((block.expiresAt - Date.now()) / 1000) : 0;
    
    console.warn(`[AntiCrawler] Blocked IP ${ip} attempted to access ${req.path}`);
    
    return res.status(403).json({
      error: 'Access Denied',
      message: 'Your IP has been temporarily blocked due to suspicious activity.',
      retryAfter: remainingTime,
    });
  }
  
  next();
}

/**
 * User-Agent 黑名單檢查 Middleware
 */
export function checkUserAgent(req: Request, res: Response, next: NextFunction) {
  const userAgent = req.get('User-Agent');
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  if (isBlockedUserAgent(userAgent)) {
    console.warn(`[AntiCrawler] Blocked User-Agent from IP ${ip}: ${userAgent}`);
    
    // 第一次違規：警告
    // 第二次違規：封鎖 1 小時
    blockIP(ip, `Blocked User-Agent: ${userAgent}`, 60 * 60 * 1000);
    
    return res.status(403).json({
      error: 'Access Denied',
      message: 'Automated access is not allowed. Please use a web browser.',
    });
  }
  
  next();
}

/**
 * 全局 API Rate Limiting
 * 限制：每個 IP 每分鐘最多 60 個請求
 */
export const globalAPIRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分鐘
  max: 60, // 最多 60 個請求
  message: {
    error: 'Too Many Requests',
    message: 'You have exceeded the rate limit. Please slow down.',
    retryAfter: 60,
  },
  standardHeaders: true, // 返回 RateLimit-* headers
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    console.warn(`[AntiCrawler] Rate limit exceeded for IP ${ip} on ${req.path}`);
    
    // 連續超過速率限制 3 次，封鎖 1 小時
    const violations = (req as any).rateLimit?.current || 0;
    if (violations > 180) { // 60 * 3 = 180
      blockIP(ip, 'Excessive rate limit violations', 60 * 60 * 1000);
    }
    
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'You have exceeded the rate limit. Please slow down.',
      retryAfter: 60,
    });
  },
  skip: (req: Request) => {
    // 跳過 Admin 用戶（如果已登入）
    // 可以根據需要調整
    return false;
  },
});

/**
 * 嚴格的 API Rate Limiting（用於敏感端點）
 * 限制：每個 IP 每分鐘最多 10 個請求
 */
export const strictAPIRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    error: 'Too Many Requests',
    message: 'You have exceeded the rate limit for this endpoint.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    console.warn(`[AntiCrawler] Strict rate limit exceeded for IP ${ip} on ${req.path}`);
    
    // 立即封鎖 30 分鐘
    blockIP(ip, 'Strict rate limit violation', 30 * 60 * 1000);
    
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'You have exceeded the rate limit for this endpoint.',
      retryAfter: 60,
    });
  },
});

// ==================== 請求日誌 ====================

interface RequestLog {
  ip: string;
  path: string;
  method: string;
  userAgent: string;
  timestamp: number;
}

// 最近的請求日誌（最多保留 1000 條）
const requestLogs: RequestLog[] = [];
const MAX_LOGS = 1000;

/**
 * 請求日誌 Middleware
 */
export function logRequest(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  
  requestLogs.push({
    ip,
    path: req.path,
    method: req.method,
    userAgent,
    timestamp: Date.now(),
  });
  
  // 保持日誌數量在限制內
  if (requestLogs.length > MAX_LOGS) {
    requestLogs.shift();
  }
  
  next();
}

/**
 * 獲取請求日誌（用於 Admin 監控）
 */
export function getRequestLogs(limit: number = 100): RequestLog[] {
  return requestLogs.slice(-limit);
}

/**
 * 分析異常請求模式
 */
export function analyzeRequestPatterns(): {
  suspiciousIPs: string[];
  topUserAgents: { userAgent: string; count: number }[];
  topPaths: { path: string; count: number }[];
} {
  const ipCounts = new Map<string, number>();
  const uaCounts = new Map<string, number>();
  const pathCounts = new Map<string, number>();
  
  // 統計最近 5 分鐘的請求
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  const recentLogs = requestLogs.filter(log => log.timestamp > fiveMinutesAgo);
  
  for (const log of recentLogs) {
    ipCounts.set(log.ip, (ipCounts.get(log.ip) || 0) + 1);
    uaCounts.set(log.userAgent, (uaCounts.get(log.userAgent) || 0) + 1);
    pathCounts.set(log.path, (pathCounts.get(log.path) || 0) + 1);
  }
  
  // 找出可疑 IP（5 分鐘內超過 100 個請求）
  const suspiciousIPs = Array.from(ipCounts.entries())
    .filter(([ip, count]) => count > 100)
    .map(([ip]) => ip);
  
  // 排序 User-Agent
  const topUserAgents = Array.from(uaCounts.entries())
    .map(([userAgent, count]) => ({ userAgent, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // 排序路徑
  const topPaths = Array.from(pathCounts.entries())
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return { suspiciousIPs, topUserAgents, topPaths };
}
