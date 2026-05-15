import type { Request } from "express";
import { jwtVerify } from "jose";
import type { User } from "../../drizzle/schema_new";
import { users } from "../../drizzle/schema_new";
import { getDb } from "../db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// ─── In-memory session cache (TTL: 5 minutes) ────────────────────────────────
// Avoids a DB round-trip on every request when the JWT already carries user data.
// The cache is keyed by userId and evicted after 5 minutes so that role/block
// changes propagate within a reasonable window without requiring a re-login.
interface CacheEntry {
  user: User;
  expiresAt: number;
}
const SESSION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const sessionCache = new Map<number, CacheEntry>();

/** Invalidate a specific user's session cache (call after role/block changes). */
export function invalidateSessionCache(userId: number): void {
  sessionCache.delete(userId);
}

/** Invalidate all cached sessions (e.g., after a mass-block operation). */
export function clearSessionCache(): void {
  sessionCache.clear();
}

/** Update a user in the session cache (call after profile updates). */
export function updateSessionCache(user: User): void {
  sessionCache.set(user.id, { user, expiresAt: Date.now() + SESSION_CACHE_TTL_MS });
}

// Periodically evict expired entries to prevent unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of sessionCache.entries()) {
    if (now > entry.expiresAt) sessionCache.delete(id);
  }
}, 60_000); // run every 60 seconds

// ─── JWT payload shape ────────────────────────────────────────────────────────
interface JwtUserPayload {
  id: number;
  email: string;
  role: string;
  name?: string | null;
  phone?: string | null;
  emailVerified?: boolean;
  isBlocked?: boolean;
  loginMethod?: string;
  googleId?: string | null;
  createdAt?: number; // Unix ms
  updatedAt?: number;
  lastSignedIn?: number;
  // v2 flag: indicates the JWT carries the full user snapshot
  v?: number;
}

/**
 * Authenticate a request using session cookie.
 *
 * Fast path (no DB query):
 *   1. Check in-memory cache (keyed by userId, TTL 5 min).
 *   2. If JWT carries a v2 full-user payload, reconstruct the User object directly.
 *
 * Slow path (one DB query, only for legacy v1 tokens):
 *   3. Fall back to a DB lookup when the JWT only contains { id, email, role }.
 *
 * Returns the User if authenticated, null otherwise.
 */
export async function authenticateSession(req: Request): Promise<User | null> {
  try {
    const sessionCookie = req.cookies?.session;
    if (!sessionCookie) return null;

    // Verify JWT signature
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(sessionCookie, secret, {
      algorithms: ["HS256"],
    });

    const p = payload as unknown as JwtUserPayload;
    const userId = p.id;
    if (!userId) return null;

    // ── 1. In-memory cache hit ────────────────────────────────────────────────
    const cached = sessionCache.get(userId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.user;
    }

    // ── 2. Full-user JWT (v2) — no DB query needed ───────────────────────────
    if (p.v === 2) {
      const user: User = {
        id: p.id,
        email: p.email,
        role: (p.role as "user" | "admin") ?? "user",
        name: p.name ?? null,
        phone: p.phone ?? null,
        emailVerified: p.emailVerified ?? false,
        isBlocked: p.isBlocked ?? false,
        loginMethod: (p.loginMethod as "password" | "google") ?? "password",
        googleId: p.googleId ?? null,
        passwordHash: null, // never stored in JWT
        emailVerificationToken: null,
        emailVerificationExpiry: null,
        createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
        updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
        lastSignedIn: p.lastSignedIn ? new Date(p.lastSignedIn) : new Date(),
        blockReason: null,
      };

      // Reject blocked users immediately
      if (user.isBlocked) return null;

      // Populate cache
      sessionCache.set(userId, { user, expiresAt: Date.now() + SESSION_CACHE_TTL_MS });
      return user;
    }

    // ── 3. Legacy v1 JWT — fall back to DB lookup ────────────────────────────
    const db = await getDb();
    if (!db) return null;

    const userResults = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userResults.length > 0 ? userResults[0] : null;
    if (!user) return null;
    if (user.isBlocked) return null;

    // Populate cache so subsequent requests within 5 min skip the DB
    sessionCache.set(userId, { user, expiresAt: Date.now() + SESSION_CACHE_TTL_MS });
    return user;
  } catch {
    return null;
  }
}
