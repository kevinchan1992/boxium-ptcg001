import type { Request } from "express";
import { jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

/**
 * Authenticate a request using session cookie
 * Returns the user if authenticated, null otherwise
 */
export async function authenticateSession(req: Request): Promise<User | null> {
  try {
    // Get session cookie
    const sessionCookie = req.cookies?.session;
    
    if (!sessionCookie) {
      console.log("[Auth] No session cookie found");
      return null;
    }

    // Verify JWT token
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(sessionCookie, secret, {
      algorithms: ["HS256"],
    });

    const userId = payload.userId as number;
    
    if (!userId) {
      console.warn("[Auth] Session payload missing userId");
      return null;
    }

    // Get user from database
    const user = await db.getUserById(userId);
    
    if (!user) {
      console.warn("[Auth] User not found:", userId);
      return null;
    }

    return user;
  } catch (error) {
    console.warn("[Auth] Session authentication failed:", String(error));
    return null;
  }
}
