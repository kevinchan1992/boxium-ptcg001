import type { Request } from "express";
import { jwtVerify } from "jose";
import type { User } from "../../drizzle/schema_new";
import { users } from "../../drizzle/schema_new";
import { getDb } from "../db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// ─── Session cache (5 min TTL, max 200 entries) ─────────────────────────────
const _sessionCache = new Map<number, { user: User; expiry: number }>();
const SESSION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_CACHE_MAX = 200;

function getCachedUser(userId: number): User | null {
  const entry = _sessionCache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    _sessionCache.delete(userId);
    return null;
  }
  return entry.user;
}

function setCachedUser(userId: number, user: User): void {
  if (_sessionCache.size >= SESSION_CACHE_MAX) {
    const oldestKey = _sessionCache.keys().next().value;
    if (oldestKey !== undefined) _sessionCache.delete(oldestKey);
  }
  _sessionCache.set(userId, { user, expiry: Date.now() + SESSION_CACHE_TTL_MS });
}

/** Invalidate cached session for a specific user (e.g. after role change) */
export function invalidateSessionCache(userId: number): void {
  _sessionCache.delete(userId);
}

/** Update cached user data (e.g. after profile update) */
export function updateSessionCache(user: User): void {
  setCachedUser(user.id, user);
}

/**
 * Authenticate a request using session cookie.
 * Returns the user if authenticated, null otherwise.
 * Uses in-memory cache to avoid DB queries on every request.
 */
export async function authenticateSession(req: Request): Promise<User | null> {
  try {
    const sessionCookie = req.cookies?.session;
    if (!sessionCookie) return null;

    // Verify JWT token
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(sessionCookie, secret, {
      algorithms: ["HS256"],
    });

    const userId = payload.id as number;
    if (!userId) return null;

    // Check cache first
    const cached = getCachedUser(userId);
    if (cached) return cached;

    // Cache miss — query DB
    const db = await getDb();
    if (!db) return null;

    const userResults = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userResults.length > 0 ? userResults[0] : null;
    if (!user) return null;

    setCachedUser(userId, user);
    return user;
  } catch {
    return null;
  }
}
