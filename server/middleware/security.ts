/**
 * BOXIUM PTCG — Multi-Layer Security Middleware
 *
 * Layers:
 *  1. Rate Limiting  — per-IP limits on sensitive endpoints
 *  2. Bot Detection  — heuristic checks on User-Agent, header patterns
 *  3. Upload Safety  — MIME type allowlist, per-IP upload frequency
 *  4. Security Headers — lightweight helmet-style headers
 *  5. tRPC Router    — route tRPC requests to appropriate rate limiter
 *  6. Security Store — in-memory event log for Admin monitoring panel
 *
 * Design goals:
 *  - Normal users are completely unaffected (generous limits)
 *  - Suspicious traffic is challenged / slowed / blocked gracefully
 *  - All blocks are logged for audit; no silent drops
 */

import { Request, Response, NextFunction } from "express";
import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract real client IP, respecting common proxy headers */
export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return first.trim();
  }
  return req.socket?.remoteAddress ?? "unknown";
}

function jsonError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ error: { code, message } });
}

// ─── 6. Security Event Store (in-memory, capped) ─────────────────────────────

export type SecurityEventType = "BOT_BLOCKED" | "RATE_LIMITED" | "UPLOAD_REJECTED" | "MANUAL_BLOCK";

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  ip: string;
  userAgent: string;
  path: string;
  reason: string;
  timestamp: number;
  /** true = admin has manually unblocked this IP */
  unblocked?: boolean;
}

const MAX_LOG_SIZE = 1000;
const securityLog: SecurityEvent[] = [];
const manuallyBlockedIps = new Set<string>();
const manuallyUnblockedIps = new Set<string>();

let eventCounter = 0;

function recordEvent(
  type: SecurityEventType,
  req: Request,
  reason: string
): void {
  const event: SecurityEvent = {
    id: `${Date.now()}-${++eventCounter}`,
    type,
    ip: getClientIp(req),
    userAgent: req.headers["user-agent"] ?? "",
    path: req.path,
    reason,
    timestamp: Date.now(),
  };
  securityLog.unshift(event); // newest first
  if (securityLog.length > MAX_LOG_SIZE) {
    securityLog.splice(MAX_LOG_SIZE);
  }
}

/** Get recent security events (for Admin panel) */
export function getSecurityLog(limit = 200): SecurityEvent[] {
  return securityLog.slice(0, limit);
}

/** Get unique blocked IPs with event counts */
export interface BlockedIpSummary {
  ip: string;
  eventCount: number;
  lastSeen: number;
  topReason: string;
  manuallyBlocked: boolean;
  manuallyUnblocked: boolean;
}

export function getBlockedIpSummaries(): BlockedIpSummary[] {
  const map = new Map<string, { count: number; lastSeen: number; reasons: string[] }>();
  for (const ev of securityLog) {
    const entry = map.get(ev.ip) ?? { count: 0, lastSeen: 0, reasons: [] };
    entry.count++;
    if (ev.timestamp > entry.lastSeen) entry.lastSeen = ev.timestamp;
    entry.reasons.push(ev.reason);
    map.set(ev.ip, entry);
  }
  const result: BlockedIpSummary[] = [];
  for (const [ip, data] of map.entries()) {
    // Find most common reason
    const freq = new Map<string, number>();
    for (const r of data.reasons) freq.set(r, (freq.get(r) ?? 0) + 1);
    let topReason = "";
    let topCount = 0;
    for (const [r, c] of freq.entries()) {
      if (c > topCount) { topCount = c; topReason = r; }
    }
    result.push({
      ip,
      eventCount: data.count,
      lastSeen: data.lastSeen,
      topReason,
      manuallyBlocked: manuallyBlockedIps.has(ip),
      manuallyUnblocked: manuallyUnblockedIps.has(ip),
    });
  }
  return result.sort((a, b) => b.lastSeen - a.lastSeen);
}

/** Get top User-Agents from blocked events */
export function getTopBlockedUserAgents(limit = 10): Array<{ ua: string; count: number }> {
  const freq = new Map<string, number>();
  for (const ev of securityLog) {
    if (ev.userAgent) freq.set(ev.userAgent, (freq.get(ev.userAgent) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([ua, count]) => ({ ua, count }));
}

/** Admin: manually block an IP */
export function adminBlockIp(ip: string, reason: string): void {
  manuallyBlockedIps.add(ip);
  manuallyUnblockedIps.delete(ip);
  securityLog.unshift({
    id: `${Date.now()}-${++eventCounter}`,
    type: "MANUAL_BLOCK",
    ip,
    userAgent: "",
    path: "(admin action)",
    reason: `Manual block: ${reason}`,
    timestamp: Date.now(),
  });
  if (securityLog.length > MAX_LOG_SIZE) securityLog.splice(MAX_LOG_SIZE);
}

/** Admin: unblock an IP (removes from manual block + marks as unblocked in log) */
export function adminUnblockIp(ip: string): void {
  manuallyBlockedIps.delete(ip);
  manuallyUnblockedIps.add(ip);
  // Mark all log entries for this IP as unblocked
  for (const ev of securityLog) {
    if (ev.ip === ip) ev.unblocked = true;
  }
}

/** Check if an IP is currently manually blocked */
export function isManuallyBlocked(ip: string): boolean {
  return manuallyBlockedIps.has(ip) && !manuallyUnblockedIps.has(ip);
}

/** Get security stats summary */
export function getSecurityStats() {
  const now = Date.now();
  const last1h = securityLog.filter((e) => now - e.timestamp < 60 * 60 * 1000);
  const last24h = securityLog.filter((e) => now - e.timestamp < 24 * 60 * 60 * 1000);
  return {
    totalEvents: securityLog.length,
    last1hEvents: last1h.length,
    last24hEvents: last24h.length,
    manuallyBlockedCount: manuallyBlockedIps.size,
    uniqueBlockedIps: new Set(securityLog.map((e) => e.ip)).size,
    byType: {
      BOT_BLOCKED: securityLog.filter((e) => e.type === "BOT_BLOCKED").length,
      RATE_LIMITED: securityLog.filter((e) => e.type === "RATE_LIMITED").length,
      UPLOAD_REJECTED: securityLog.filter((e) => e.type === "UPLOAD_REJECTED").length,
      MANUAL_BLOCK: securityLog.filter((e) => e.type === "MANUAL_BLOCK").length,
    },
  };
}

// ─── Manual Block Middleware ──────────────────────────────────────────────────

/** Check if the requesting IP is manually blocked by admin */
export function manualBlockCheck(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  if (isManuallyBlocked(ip)) {
    console.warn(`[ManualBlock] Blocked IP attempted access — IP: ${ip} path: ${req.path}`);
    return jsonError(res, 403, "IP_BLOCKED", "Your IP address has been blocked.");
  }
  next();
}

// ─── 1. Rate Limiters ─────────────────────────────────────────────────────────

/**
 * Factory: create a rate limiter with sensible defaults.
 * windowMs  — sliding window in milliseconds
 * max       — max requests per window per IP
 * message   — error code returned to client
 */
function makeLimiter(
  windowMs: number,
  max: number,
  message: string
): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => getClientIp(req),
    handler: (req, res) => {
      const ip = getClientIp(req);
      console.warn(`[RateLimit] ${message} — IP: ${ip} path: ${req.path}`);
      recordEvent("RATE_LIMITED", req, message);
      jsonError(res, 429, "RATE_LIMITED", message);
    },
    skip: (req) => {
      return req.path === "/api/dev/health";
    },
  });
}

/** Auth endpoints: login, register, password reset — 10 req / 15 min */
export const authLimiter = makeLimiter(
  15 * 60 * 1000,
  10,
  "Too many authentication attempts. Please try again in 15 minutes."
);

/** Search / listing query endpoints — 120 req / min (generous for real users) */
export const searchLimiter = makeLimiter(
  60 * 1000,
  120,
  "Search rate limit exceeded. Please slow down."
);

/** AI generation endpoints (blog AI, LLM calls) — 20 req / min per IP */
export const aiLimiter = makeLimiter(
  60 * 1000,
  20,
  "AI generation rate limit exceeded. Please wait a moment."
);

/** Order / checkout / bid creation — 30 req / min */
export const orderLimiter = makeLimiter(
  60 * 1000,
  30,
  "Too many order requests. Please slow down."
);

/** Image / file upload endpoints — 20 req / 5 min */
export const uploadLimiter = makeLimiter(
  5 * 60 * 1000,
  20,
  "Upload rate limit exceeded. Please wait before uploading more files."
);

/** General tRPC API — 300 req / min (catches everything not matched above) */
export const trpcGeneralLimiter = makeLimiter(
  60 * 1000,
  300,
  "API rate limit exceeded. Please slow down."
);

/** Admin API — 60 req / min (admin users do bulk ops but shouldn't hammer) */
export const adminLimiter = makeLimiter(
  60 * 1000,
  60,
  "Admin API rate limit exceeded."
);

// ─── 2. Bot / Scraper Detection ───────────────────────────────────────────────

/** Known bad bot User-Agent patterns (case-insensitive) */
const BAD_BOT_PATTERNS = [
  /python-requests/i,
  /go-http-client/i,
  /java\/\d/i,
  /curl\//i,
  /wget\//i,
  /scrapy/i,
  /phantomjs/i,
  /headlesschrome/i,
  /selenium/i,
  /puppeteer/i,
  /playwright/i,
  /axios\/\d/i,
  /okhttp/i,
  /libwww-perl/i,
  /masscan/i,
  /nmap/i,
  /zgrab/i,
  /nuclei/i,
  /sqlmap/i,
  /nikto/i,
  /dirbuster/i,
  /gobuster/i,
  /wfuzz/i,
  /burpsuite/i,
];

/** Legitimate crawler User-Agents that should be allowed */
const ALLOWED_CRAWLERS = [
  /googlebot/i,
  /bingbot/i,
  /slurp/i,
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /whatsapp/i,
  /applebot/i,
];

/**
 * Bot detection middleware.
 * - Blocks known bad bots immediately (403)
 * - Allows known good crawlers
 * - Flags requests with no User-Agent header on API paths
 */
export function botDetection(req: Request, res: Response, next: NextFunction) {
  const ua = req.headers["user-agent"] ?? "";
  const ip = getClientIp(req);

  // Allow known good crawlers
  if (ALLOWED_CRAWLERS.some((p) => p.test(ua))) {
    return next();
  }

  // Block known bad bots
  if (BAD_BOT_PATTERNS.some((p) => p.test(ua))) {
    console.warn(`[BotDetect] Bad bot UA blocked — IP: ${ip} UA: "${ua}" path: ${req.path}`);
    recordEvent("BOT_BLOCKED", req, `Bad bot UA: ${ua.slice(0, 80)}`);
    return jsonError(res, 403, "BOT_DETECTED", "Automated access is not permitted.");
  }

  // Flag missing UA on API paths
  if (!ua && req.path.startsWith("/api/")) {
    console.warn(`[BotDetect] Missing UA on API — IP: ${ip} path: ${req.path}`);
    recordEvent("BOT_BLOCKED", req, "Missing User-Agent on API path");
    return jsonError(res, 403, "BOT_DETECTED", "Missing User-Agent header.");
  }

  next();
}

// ─── 3. Upload MIME Type Allowlist ────────────────────────────────────────────

const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const ALLOWED_PAYMENT_PROOF_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/**
 * Validate uploaded image MIME type.
 * Attach to upload routes AFTER multer so req.file is populated.
 */
export function validateImageMime(req: Request, res: Response, next: NextFunction) {
  if (!req.file) return next();
  if (!ALLOWED_IMAGE_MIMES.has(req.file.mimetype)) {
    console.warn(
      `[Upload] Rejected MIME "${req.file.mimetype}" — IP: ${getClientIp(req)} path: ${req.path}`
    );
    recordEvent("UPLOAD_REJECTED", req, `Rejected MIME: ${req.file.mimetype}`);
    return jsonError(
      res,
      415,
      "INVALID_FILE_TYPE",
      `File type "${req.file.mimetype}" is not allowed. Please upload a JPEG, PNG, WebP, or GIF image.`
    );
  }
  next();
}

/**
 * Validate payment proof MIME type (allows HEIC for iPhone screenshots).
 */
export function validatePaymentProofMime(req: Request, res: Response, next: NextFunction) {
  if (!req.file) return next();
  if (!ALLOWED_PAYMENT_PROOF_MIMES.has(req.file.mimetype)) {
    console.warn(
      `[Upload] Rejected payment proof MIME "${req.file.mimetype}" — IP: ${getClientIp(req)}`
    );
    recordEvent("UPLOAD_REJECTED", req, `Rejected payment proof MIME: ${req.file.mimetype}`);
    return jsonError(
      res,
      415,
      "INVALID_FILE_TYPE",
      `File type "${req.file.mimetype}" is not allowed for payment proof. Please upload a JPEG, PNG, or WebP image.`
    );
  }
  next();
}

// ─── 4. Security Headers ──────────────────────────────────────────────────────

/**
 * Add basic security headers to all responses.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(self)"
  );
  next();
}

// ─── 5. tRPC Path-Based Rate Limit Router ─────────────────────────────────────

/**
 * Route tRPC requests to the appropriate rate limiter based on procedure path.
 */
export function trpcRateLimitRouter(req: Request, res: Response, next: NextFunction) {
  const url = req.url ?? "";

  if (url.includes("auth.login") || url.includes("auth.register") || url.includes("auth.")) {
    return authLimiter(req, res, next);
  }

  if (
    url.includes("blogAi.") ||
    url.includes("ai.") ||
    url.includes("generateBlogPost") ||
    url.includes("invokeLLM")
  ) {
    return aiLimiter(req, res, next);
  }

  if (
    url.includes("createOrder") ||
    url.includes("createCheckout") ||
    url.includes("createBid") ||
    url.includes("createOffer") ||
    url.includes("acceptOffer") ||
    url.includes("checkout")
  ) {
    return orderLimiter(req, res, next);
  }

  if (url.includes("admin.")) {
    return adminLimiter(req, res, next);
  }

  if (
    url.includes("search") ||
    url.includes("getListings") ||
    url.includes("getCards") ||
    url.includes("getPricing") ||
    url.includes("getAuctions")
  ) {
    return searchLimiter(req, res, next);
  }

  return trpcGeneralLimiter(req, res, next);
}
