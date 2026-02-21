import * as db from '../db';
import { generateRandomToken } from './utils';

const SESSION_EXPIRES_IN_DAYS = 7;

/**
 * Create a new session for a user
 */
export async function createSession(userId: number): Promise<string> {
  const sessionToken = generateRandomToken() + generateRandomToken(); // Extra long token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRES_IN_DAYS);

  await db.createSession({
    userId,
    token: sessionToken,
    expiresAt,
  });

  return sessionToken;
}

/**
 * Get user by session token
 */
export async function getUserBySession(sessionToken: string) {
  const session = await db.getSessionByToken(sessionToken);
  
  if (!session) {
    return null;
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    await db.deleteSession(session.id);
    return null;
  }

  // Get user
  const user = await db.getUserById(session.userId);
  
  if (!user) {
    await db.deleteSession(session.id);
    return null;
  }

  return user;
}

/**
 * Delete a session (logout)
 */
export async function deleteSession(sessionToken: string): Promise<void> {
  const session = await db.getSessionByToken(sessionToken);
  
  if (session) {
    await db.deleteSession(session.id);
  }
}

/**
 * Delete all sessions for a user (logout from all devices)
 */
export async function deleteAllUserSessions(userId: number): Promise<void> {
  await db.deleteAllUserSessions(userId);
}

/**
 * Clean up expired sessions (should be run periodically)
 */
export async function cleanupExpiredSessions(): Promise<void> {
  await db.deleteExpiredSessions();
}
