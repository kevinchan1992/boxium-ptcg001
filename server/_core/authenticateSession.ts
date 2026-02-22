import type { Request } from "express";
import { jwtVerify } from "jose";
import type { User } from "../../drizzle/schema_new";
import { users } from "../../drizzle/schema_new";
import { getDb } from "../db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

/**
 * Authenticate a request using session cookie
 * Returns the user if authenticated, null otherwise
 */
export async function authenticateSession(req: Request): Promise<User | null> {
  try {
    // Get session cookie
    console.log('[Auth] Checking session cookie...');
    console.log('[Auth] req.cookies exists:', !!req.cookies);
    console.log('[Auth] Available cookies:', Object.keys(req.cookies || {}));
    
    const sessionCookie = req.cookies?.session;
    
    if (!sessionCookie) {
      console.log("[Auth] No session cookie found");
      return null;
    }
    
    console.log('[Auth] Session cookie found:', sessionCookie.substring(0, 20) + '...');

    // Verify JWT token
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(sessionCookie, secret, {
      algorithms: ["HS256"],
    });

    const userId = payload.id as number;
    
    if (!userId) {
      console.warn("[Auth] Session payload missing id");
      console.warn("[Auth] Payload:", payload);
      return null;
    }
    
    console.log('[Auth] User ID from token:', userId);

    // Get user from database
    const db = await getDb();
    if (!db) {
      console.warn("[Auth] Database connection failed");
      return null;
    }
    
    const userResults = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userResults.length > 0 ? userResults[0] : null;
    
    if (!user) {
      console.warn("[Auth] User not found:", userId);
      return null;
    }
    
    console.log('[Auth] User authenticated:', user.email);
    return user;
  } catch (error) {
    console.warn("[Auth] Session authentication failed:", String(error));
    return null;
  }
}
