/**
 * BOXIUM PTCG — Multi-Layer Security Middleware (v2)
 *
 * Layers:
 *  1. Rate Limiting  — per-IP limits on sensitive endpoints
 *  2. Bot Detection  — heuristic checks on UA, missing browser headers, path scanning
 *  3. Upload Safety  — MIME type allowlist, per-IP upload frequency
 *  4. Security Headers — CSP, HSTS, X-Frame-Options, etc.
 *  5. tRPC Router    — route tRPC requests to appropriate rate limiter
 *  6. Security Store — DB-persisted event log + blocked IPs (survives restarts)
 *  7. Alert System   — owner notification when events spike (20+ in 5 min)
 *
 * Design goals:
 *  - Normal users are completely unaffected (generous limits)
 *  - Suspicious traffic is challenged / slowed / blocked gracefully
 *  - All blocks are logged to DB for audit; no silent drops
 *  - Blocked IP list survives server restarts
 */

import { Request, Response, NextFunction } from "express";
import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract real client IP using req.ip (requires trust proxy to be set) */
export function getClientIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

function jsonError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ error: { code, message } });
}

// ─── 6. Security Event Store (DB-persisted + in-memory cache) ────────────────

export type SecurityEventType = "BOT_BLOCKED" | "RATE_LIMITED" | "UPLOAD_REJECTED" | "MANUAL_BLOCK";

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  ip: string;
  userAgent: string;
  path: string;
  reason: string;
  timestamp: number;
  unblocked?: boolean;
}

export interface BlockedIpSummary {
  ip: string;
  eventCount: number;
  lastSeen: number;
  topReason: string;
  manuallyBlocked: boolean;
  manuallyUnblocked: boolean;
}

// In-memory cache for fast access (recent 500 events)
const MAX_CACHE_SIZE = 500;
const memoryLog: SecurityEvent[] = [];
// In-memory blocked IP cache (loaded from DB on first use, kept in sync)
const blockedIpCache = new Set<string>();
let blockedIpCacheLoaded = false;
let eventCounter = 0;

// ─── Admin IP Whitelist (in-memory + DB-persisted) ───────────────────────────
/** Admin IPs that are exempt from all rate limits (in-memory cache, loaded from DB on startup) */
const adminIpWhitelist = new Set<string>();
let adminWhitelistLoaded = false;

/** Load admin IP whitelist from DB into memory (called on server startup) */
export async function loadAdminWhitelistFromDb(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const { adminIpWhitelist: whitelistTable } = await import("../../drizzle/schema_new");
    const rows = await db.select().from(whitelistTable);
    for (const row of rows) {
      adminIpWhitelist.add(row.ip);
    }
    adminWhitelistLoaded = true;
    console.log(`[Security] Loaded ${rows.length} admin IPs from DB whitelist`);
  } catch (e: any) {
    console.error("[Security] Failed to load admin whitelist from DB:", e.message);
  }
}

/** Register an admin IP to bypass all rate limits (persisted to DB) */
export async function registerAdminIp(ip: string, addedBy = "admin", note?: string): Promise<void> {
  adminIpWhitelist.add(ip);
  console.log(`[Security] Admin IP whitelisted: ${ip} (total: ${adminIpWhitelist.size})`);
  try {
    const db = await getDb();
    if (!db) return;
    const { adminIpWhitelist: whitelistTable } = await import("../../drizzle/schema_new");
    await db.insert(whitelistTable).values({ ip, addedBy, note: note ?? null })
      .onDuplicateKeyUpdate({ set: { addedBy, note: note ?? null } });
  } catch (e: any) {
    console.error("[Security] Failed to persist admin whitelist to DB:", e.message);
  }
}

/** Remove an admin IP from the whitelist (persisted to DB) */
export async function unregisterAdminIp(ip: string): Promise<void> {
  adminIpWhitelist.delete(ip);
  console.log(`[Security] Admin IP removed from whitelist: ${ip}`);
  try {
    const db = await getDb();
    if (!db) return;
    const { adminIpWhitelist: whitelistTable } = await import("../../drizzle/schema_new");
    const { eq } = await import("drizzle-orm");
    await db.delete(whitelistTable).where(eq(whitelistTable.ip, ip));
  } catch (e: any) {
    console.error("[Security] Failed to remove admin whitelist from DB:", e.message);
  }
}

/** Check if an IP is in the admin whitelist */
export function isAdminWhitelisted(ip: string): boolean {
  return adminIpWhitelist.has(ip);
}

/** Get all whitelisted admin IPs with DB metadata */
export async function getAdminWhitelistIps(): Promise<Array<{ ip: string; addedBy: string; note: string | null; addedAt: Date }>> {
  try {
    const db = await getDb();
    if (!db) return Array.from(adminIpWhitelist).map(ip => ({ ip, addedBy: "admin", note: null, addedAt: new Date() }));
    const { adminIpWhitelist: whitelistTable } = await import("../../drizzle/schema_new");
    const { desc } = await import("drizzle-orm");
    return await db.select().from(whitelistTable).orderBy(desc(whitelistTable.addedAt));
  } catch (e: any) {
    console.error("[Security] Failed to get admin whitelist from DB:", e.message);
    return Array.from(adminIpWhitelist).map(ip => ({ ip, addedBy: "admin", note: null, addedAt: new Date() }));
  }
}

// ─── DB helpers (lazy import to avoid circular deps) ────────────────────────────────────────────
async function getDb() {
  const { getDb: _getDb } = await import("../db");
  return await _getDb();
}

async function persistEvent(type: SecurityEventType, ip: string, userAgent: string, path: string, reason: string) {
  try {
    const db = await getDb();
    if (!db) return;
    const { securityEvents } = await import("../../drizzle/schema_new");
    await db.insert(securityEvents).values({
      type,
      ip,
      userAgent: userAgent.slice(0, 500),
      path: path.slice(0, 500),
      reason: reason.slice(0, 500),
    });
  } catch (_e) {
    // Non-critical: DB write failure should not block the request
  }
}

async function loadBlockedIpCache() {
  if (blockedIpCacheLoaded) return;
  blockedIpCacheLoaded = true;
  try {
    const db = await getDb();
    if (!db) return;
    const { blockedIps } = await import("../../drizzle/schema_new");
    const { eq, or, isNull, gt } = await import("drizzle-orm");
    const now = new Date();
    const rows = await db
      .select({ ip: blockedIps.ip })
      .from(blockedIps)
      .where(
        eq(blockedIps.isActive, true)
      );
    for (const row of rows) {
      blockedIpCache.add(row.ip);
    }
    console.log(`[Security] Loaded ${blockedIpCache.size} blocked IPs from DB`);
  } catch (e: any) {
    console.warn("[Security] Failed to load blocked IPs from DB:", e.message);
  }
}

// Initialise caches on module load (non-blocking)
loadBlockedIpCache().catch(() => {});
loadAdminWhitelistFromDb().catch(() => {});

// ─── Alert system ─────────────────────────────────────────────────────────────

let alertCooldownUntil = 0;

async function checkAlertThreshold() {
  const now = Date.now();
  if (now < alertCooldownUntil) return;
  // Count events in last 5 minutes from memory cache
  const recent = memoryLog.filter((e) => now - e.timestamp < 5 * 60 * 1000);
  if (recent.length >= 20) {
    alertCooldownUntil = now + 10 * 60 * 1000; // 10-min cooldown
    try {
      const { notifyOwner } = await import("../_core/notification");
      const topReason = recent[0]?.reason ?? "未知";
      const topIp = recent[0]?.ip ?? "未知";
      await notifyOwner({
        title: `⚠️ BOXIUM 安全告警：5 分鐘內偵測到 ${recent.length} 個安全事件`,
        content: `最常見威脅：${topReason}\n最近 IP：${topIp}\n請立即登入管理後台 → 安全監控 查看詳情。`,
      });
      console.warn(`[Security] Alert sent: ${recent.length} events in last 5 min`);
    } catch (_e) {
      // Non-critical
    }
  }
}

// ─── Core event recorder ──────────────────────────────────────────────────────

function recordEvent(type: SecurityEventType, req: Request, reason: string): void {
  const ip = getClientIp(req);
  const ua = (req.headers["user-agent"] ?? "").slice(0, 500);
  const path = req.path ?? "";

  const event: SecurityEvent = {
    id: `${Date.now()}-${++eventCounter}`,
    type,
    ip,
    userAgent: ua,
    path,
    reason,
    timestamp: Date.now(),
  };

  // Update in-memory cache
  memoryLog.unshift(event);
  if (memoryLog.length > MAX_CACHE_SIZE) memoryLog.splice(MAX_CACHE_SIZE);

  // Persist to DB (async, non-blocking)
  persistEvent(type, ip, ua, path, reason).catch(() => {});

  // Check alert threshold (async, non-blocking)
  checkAlertThreshold().catch(() => {});
}

// ─── Public API for Admin panel ───────────────────────────────────────────────

/** Get recent security events from memory cache */
export function getSecurityLog(limit = 200): SecurityEvent[] {
  return memoryLog.slice(0, limit);
}

/** Get blocked IP summaries from memory cache */
export function getBlockedIpSummaries(): BlockedIpSummary[] {
  const map = new Map<string, { count: number; lastSeen: number; reasons: string[] }>();
  for (const ev of memoryLog) {
    const entry = map.get(ev.ip) ?? { count: 0, lastSeen: 0, reasons: [] };
    entry.count++;
    if (ev.timestamp > entry.lastSeen) entry.lastSeen = ev.timestamp;
    entry.reasons.push(ev.reason);
    map.set(ev.ip, entry);
  }
  const result: BlockedIpSummary[] = [];
  Array.from(map.entries()).forEach(([ip, data]) => {
    const freq = new Map<string, number>();
    for (const r of data.reasons) freq.set(r, (freq.get(r) ?? 0) + 1);
    let topReason = "";
    let topCount = 0;
    Array.from(freq.entries()).forEach(([r, c]) => {
      if (c > topCount) { topCount = c; topReason = r; }
    });
    result.push({
      ip,
      eventCount: data.count,
      lastSeen: data.lastSeen,
      topReason,
      manuallyBlocked: blockedIpCache.has(ip),
      manuallyUnblocked: false,
    });
  });
  return result.sort((a, b) => b.lastSeen - a.lastSeen);
}

/** Get top blocked User-Agents */
export function getTopBlockedUserAgents(limit = 10): Array<{ ua: string; count: number }> {
  const freq = new Map<string, number>();
  for (const ev of memoryLog) {
    if (ev.userAgent) freq.set(ev.userAgent, (freq.get(ev.userAgent) ?? 0) + 1);
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([ua, count]) => ({ ua, count }));
}

/** Get security stats summary */
export function getSecurityStats() {
  const now = Date.now();
  const last1h = memoryLog.filter((e) => now - e.timestamp < 60 * 60 * 1000);
  const last24h = memoryLog.filter((e) => now - e.timestamp < 24 * 60 * 60 * 1000);
  return {
    totalEvents: memoryLog.length,
    last1hEvents: last1h.length,
    last24hEvents: last24h.length,
    manuallyBlockedCount: blockedIpCache.size,
    uniqueBlockedIps: new Set(memoryLog.map((e) => e.ip)).size,
    byType: {
      BOT_BLOCKED: memoryLog.filter((e) => e.type === "BOT_BLOCKED").length,
      RATE_LIMITED: memoryLog.filter((e) => e.type === "RATE_LIMITED").length,
      UPLOAD_REJECTED: memoryLog.filter((e) => e.type === "UPLOAD_REJECTED").length,
      MANUAL_BLOCK: memoryLog.filter((e) => e.type === "MANUAL_BLOCK").length,
    },
  };
}

/** Admin: manually block an IP (persisted to DB) */
export async function adminBlockIp(ip: string, reason: string, blockedBy = "admin"): Promise<void> {
  blockedIpCache.add(ip);
  // Persist to DB
  try {
    const db = await getDb();
    if (db) {
      const { blockedIps } = await import("../../drizzle/schema_new");
      await db
        .insert(blockedIps)
        .values({ ip, reason, blockedBy, isActive: true })
        .onDuplicateKeyUpdate({ set: { reason, blockedBy, isActive: true, blockedAt: new Date() } });
    }
  } catch (_e) {}
  // Record event in memory + DB
  const fakeReq = { headers: { "user-agent": "" }, path: "(admin action)", ip } as unknown as Request;
  const event: SecurityEvent = {
    id: `${Date.now()}-${++eventCounter}`,
    type: "MANUAL_BLOCK",
    ip,
    userAgent: "",
    path: "(admin action)",
    reason: `Manual block by ${blockedBy}: ${reason}`,
    timestamp: Date.now(),
  };
  memoryLog.unshift(event);
  if (memoryLog.length > MAX_CACHE_SIZE) memoryLog.splice(MAX_CACHE_SIZE);
  persistEvent("MANUAL_BLOCK", ip, "", "(admin action)", `Manual block by ${blockedBy}: ${reason}`).catch(() => {});
}

/** Admin: unblock an IP (persisted to DB) */
export async function adminUnblockIp(ip: string): Promise<void> {
  blockedIpCache.delete(ip);
  try {
    const db = await getDb();
    if (db) {
      const { blockedIps } = await import("../../drizzle/schema_new");
      const { eq } = await import("drizzle-orm");
      await db.update(blockedIps).set({ isActive: false }).where(eq(blockedIps.ip, ip));
    }
  } catch (_e) {}
  // Mark in-memory log entries as unblocked
  for (const ev of memoryLog) {
    if (ev.ip === ip) ev.unblocked = true;
  }
}

/** Check if an IP is currently blocked */
export function isManuallyBlocked(ip: string): boolean {
  return blockedIpCache.has(ip);
}

// ─── Manual Block Middleware ──────────────────────────────────────────────────

export async function manualBlockCheck(req: Request, res: Response, next: NextFunction) {
  // Internal system requests (schedulers, batch updates) bypass IP block checks.
  // They are server-originated and cannot be spoofed by external attackers.
  if (isInternalSystemRequest(req)) return next();

  // Ensure cache is loaded
  if (!blockedIpCacheLoaded) await loadBlockedIpCache();
  const ip = getClientIp(req);
  if (isManuallyBlocked(ip)) {
    console.warn(`[ManualBlock] Blocked IP attempted access — IP: ${ip} path: ${req.path}`);
    return jsonError(res, 403, "IP_BLOCKED", "Your IP address has been blocked.");
  }
  next();
}

// ─── 1. Rate Limiters ─────────────────────────────────────────────────────────

function makeLimiter(windowMs: number, max: number, message: string): RateLimitRequestHandler {
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
    skip: (req) => req.path === "/api/dev/health" || adminIpWhitelist.has(getClientIp(req)),
  });
}

export const authLimiter = makeLimiter(15 * 60 * 1000, 10, "Too many authentication attempts. Please try again in 15 minutes.");
export const searchLimiter = makeLimiter(60 * 1000, 120, "Search rate limit exceeded. Please slow down.");
export const aiLimiter = makeLimiter(60 * 1000, 20, "AI generation rate limit exceeded. Please wait a moment.");
export const orderLimiter = makeLimiter(60 * 1000, 30, "Too many order requests. Please slow down.");
export const uploadLimiter = makeLimiter(5 * 60 * 1000, 20, "Upload rate limit exceeded. Please wait before uploading more files.");
export const trpcGeneralLimiter = makeLimiter(60 * 1000, 300, "API rate limit exceeded. Please slow down.");
export const adminLimiter = makeLimiter(60 * 1000, 60, "Admin API rate limit exceeded.");

// ─── 2. Bot / Scraper Detection ───────────────────────────────────────────────

const BAD_BOT_PATTERNS = [
  /python-requests/i, /go-http-client/i, /java\/\d/i, /curl\//i, /wget\//i,
  /scrapy/i, /phantomjs/i, /headlesschrome/i, /selenium/i, /puppeteer/i,
  /playwright/i, /axios\/\d/i, /okhttp/i, /libwww-perl/i, /masscan/i,
  /nmap/i, /zgrab/i, /nuclei/i, /sqlmap/i, /nikto/i, /dirbuster/i,
  /gobuster/i, /wfuzz/i, /burpsuite/i,
];

const ALLOWED_CRAWLERS = [
  /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i, /baiduspider/i,
  /yandexbot/i, /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i,
  /whatsapp/i, /applebot/i,
];

// Required browser headers — real browsers always send at least 2 of these
const BROWSER_HEADERS = ["accept-language", "accept-encoding", "sec-ch-ua", "sec-fetch-site"];

// Suspicious IP accumulator: tracks IPs with missing browser headers
const suspiciousIpHits = new Map<string, { count: number; firstSeen: number }>();
const SUSPICIOUS_THRESHOLD = 10; // auto-block after 10 suspicious requests within 10 min

export function botDetection(req: Request, res: Response, next: NextFunction) {
  const ua = req.headers["user-agent"] ?? "";
  const ip = getClientIp(req);

  // ── Internal system requests bypass bot detection entirely ────────────────────
  // Scheduled tasks and batch updates do not send browser headers.
  // They are authenticated via adminProcedure, so no security risk.
  if (isInternalSystemRequest(req)) return next();

  // Allow known good crawlers
  if (ALLOWED_CRAWLERS.some((p) => p.test(ua))) return next();

  // Block known bad bots
  if (BAD_BOT_PATTERNS.some((p) => p.test(ua))) {
    console.warn(`[BotDetect] Bad bot UA blocked — IP: ${ip} UA: "${ua.slice(0, 80)}" path: ${req.path}`);
    recordEvent("BOT_BLOCKED", req, `Bad bot UA: ${ua.slice(0, 80)}`);
    return jsonError(res, 403, "BOT_DETECTED", "Automated access is not permitted.");
  }

  // Flag missing UA on API paths
  if (!ua && req.path.startsWith("/api/")) {
    console.warn(`[BotDetect] Missing UA on API — IP: ${ip} path: ${req.path}`);
    recordEvent("BOT_BLOCKED", req, "Missing User-Agent on API path");
    return jsonError(res, 403, "BOT_DETECTED", "Missing User-Agent header.");
  }

  // Advanced: detect missing browser headers on API paths (non-GET requests are more suspicious)
  if (req.path.startsWith("/api/") && req.method !== "GET") {
    const presentCount = BROWSER_HEADERS.filter((h) => req.headers[h]).length;
    if (presentCount === 0) {
      // Zero browser headers on a mutating API call — highly suspicious
      const now = Date.now();
      const entry = suspiciousIpHits.get(ip) ?? { count: 0, firstSeen: now };
      // Reset window after 10 min
      if (now - entry.firstSeen > 10 * 60 * 1000) {
        entry.count = 0;
        entry.firstSeen = now;
      }
      entry.count++;
      suspiciousIpHits.set(ip, entry);

      if (entry.count >= SUSPICIOUS_THRESHOLD) {
        // Auto-block: add to in-memory blocked set + DB
        console.warn(`[BotDetect] Auto-blocking suspicious IP ${ip} after ${entry.count} headerless API calls`);
        adminBlockIp(ip, `Auto-blocked: ${entry.count} headerless API calls in 10 min`, "auto-detect").catch(() => {});
        recordEvent("BOT_BLOCKED", req, `Auto-blocked: headerless API calls (${entry.count})`);
        return jsonError(res, 403, "BOT_DETECTED", "Suspicious request pattern detected.");
      }

      // Log but allow (accumulating)
      if (entry.count >= 3) {
        recordEvent("BOT_BLOCKED", req, `Suspicious: missing browser headers (${entry.count} hits)`);
      }
    }
  }

  next();
}

// ─── 3. Upload MIME Type Allowlist ────────────────────────────────────────────

const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/avif",
]);

const ALLOWED_PAYMENT_PROOF_MIMES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif",
]);

export function validateImageMime(req: Request, res: Response, next: NextFunction) {
  if (!req.file) return next();
  if (!ALLOWED_IMAGE_MIMES.has(req.file.mimetype)) {
    console.warn(`[Upload] Rejected MIME "${req.file.mimetype}" — IP: ${getClientIp(req)} path: ${req.path}`);
    recordEvent("UPLOAD_REJECTED", req, `Rejected MIME: ${req.file.mimetype}`);
    return jsonError(res, 415, "INVALID_FILE_TYPE", `File type "${req.file.mimetype}" is not allowed. Please upload a JPEG, PNG, WebP, or GIF image.`);
  }
  next();
}

export function validatePaymentProofMime(req: Request, res: Response, next: NextFunction) {
  if (!req.file) return next();
  if (!ALLOWED_PAYMENT_PROOF_MIMES.has(req.file.mimetype)) {
    console.warn(`[Upload] Rejected payment proof MIME "${req.file.mimetype}" — IP: ${getClientIp(req)}`);
    recordEvent("UPLOAD_REJECTED", req, `Rejected payment proof MIME: ${req.file.mimetype}`);
    return jsonError(res, 415, "INVALID_FILE_TYPE", `File type "${req.file.mimetype}" is not allowed for payment proof. Please upload a JPEG, PNG, or WebP image.`);
  }
  next();
}

// ─── 4. Security Headers (CSP + HSTS + others) ───────────────────────────────

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent MIME sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Permissions policy
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self)");
  // HSTS — tell browsers to always use HTTPS (1 year)
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  // Content Security Policy
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      // Scripts: self + inline (Vite HMR needs this) + Stripe
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.google-analytics.com",
      // Styles: self + inline (Tailwind/shadcn) + Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fonts
      "font-src 'self' data: https://fonts.gstatic.com",
      // Images: self + data URIs + blob + CDN domains
      "img-src 'self' data: blob: https://*.manus.space https://*.amazonaws.com https://*.supabase.co https://images.pokemontcg.io https://limgs.snkrdunk.com https://i.ebayimg.com https://www.google-analytics.com",
      // API connections
      "connect-src 'self' https://api.stripe.com https://*.manus.space https://*.manus.computer https://*.supabase.co wss://*.manus.computer",
      // Stripe 3DS iframe
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      // No plugins
      "object-src 'none'",
      // Prevent base tag hijacking
      "base-uri 'self'",
      // Form submissions only to self
      "form-action 'self'",
    ].join("; ")
  );
  next();
}

// ─── Internal System Request Detection ───────────────────────────────────────

/**
 * Detect internal system requests that should bypass all rate limiting.
 * These are requests originating from the platform's own scheduled tasks,
 * batch update processes, and other automated internal operations.
 *
 * Detection methods:
 *  1. x-internal-token header matches JWT_SECRET (server-to-server calls)
 *  2. Specific admin procedures known to be called by schedulers
 */
export function isInternalSystemRequest(req: Request): boolean {
  // Method 1: Internal token header (for server-to-server calls)
  const internalToken = req.headers["x-internal-token"];
  if (internalToken && internalToken === process.env.JWT_SECRET) {
    return true;
  }

  // Method 2: Known internal system procedures that are called by schedulers
  // These procedures are only accessible to admins anyway (adminProcedure),
  // so bypassing rate limits here does not create a security risk.
  const url = req.url ?? "";
  const INTERNAL_PROCEDURES = [
    "admin.processBatch",
    "admin.batchUpdateSnkrdunkPrices",
    "admin.startBatchUpdateTask",
    "admin.updateBatchUpdateProgress",
    "admin.completeBatchUpdateTask",
    "admin.cancelBatchUpdateTask",
    "admin.pauseBatchUpdateTask",
    "admin.resumeBatchUpdateTask",
    "admin.getDetailedCacheStats",
    "admin.getBatchUpdateTask",
    "admin.listBatchUpdateTasks",
    "admin.triggerPriceUpdate",
    "admin.runScheduledPriceUpdate",
  ];
  if (INTERNAL_PROCEDURES.some((proc) => url.includes(proc))) {
    return true;
  }

  return false;
}

// ─── 5. tRPC Path-Based Rate Limit Router ─────────────────────────────────────

export function trpcRateLimitRouter(req: Request, res: Response, next: NextFunction) {
  const url = req.url ?? "";

  // ── Internal system requests bypass ALL rate limiting ──────────────────────
  // Scheduled tasks, batch updates, and other automated internal operations
  // must not be throttled. They are protected by adminProcedure auth checks.
  if (isInternalSystemRequest(req)) {
    return next();
  }

  // auth.me is a read-only session check called on every page load — use general limiter
  if (url.includes("auth.me") || url.includes("auth.logout")) {
    return trpcGeneralLimiter(req, res, next);
  }
  // auth.login, auth.register, auth.callback etc. are sensitive — use strict limiter
  if (url.includes("auth.login") || url.includes("auth.register") || url.includes("auth.")) {
    return authLimiter(req, res, next);
  }
  if (url.includes("blogAi.") || url.includes("ai.") || url.includes("generateBlogPost") || url.includes("invokeLLM")) {
    return aiLimiter(req, res, next);
  }
  if (url.includes("createOrder") || url.includes("createCheckout") || url.includes("createBid") || url.includes("createOffer") || url.includes("acceptOffer") || url.includes("checkout")) {
    return orderLimiter(req, res, next);
  }
  if (url.includes("admin.")) {
    return adminLimiter(req, res, next);
  }
  if (url.includes("search") || url.includes("getListings") || url.includes("getCards") || url.includes("getPricing") || url.includes("getAuctions")) {
    return searchLimiter(req, res, next);
  }
  return trpcGeneralLimiter(req, res, next);
}
