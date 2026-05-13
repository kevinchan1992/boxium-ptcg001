/**
 * pushTokenDb.ts
 * Database helpers for device push token management (Capacitor APP)
 */

import { getDb } from "./db";
import { devicePushTokens } from "../drizzle/schema_new";
import { eq, and } from "drizzle-orm";

/**
 * Upsert a push token for a user.
 * If the same token already exists (any user), we re-activate it and reassign to the current user.
 * If the user already has a token for the same deviceId, we update it.
 */
export async function upsertPushToken(params: {
  userId: number;
  token: string;
  platform: "ios" | "android" | "web";
  deviceId?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { userId, token, platform, deviceId } = params;

  // Check if this exact token already exists
  const existing = await db
    .select()
    .from(devicePushTokens)
    .where(eq(devicePushTokens.token, token))
    .limit(1);

  if (existing.length > 0) {
    // Re-activate and reassign to current user
    await db
      .update(devicePushTokens)
      .set({ userId, platform, deviceId: deviceId ?? null, isActive: true })
      .where(eq(devicePushTokens.token, token));
    return;
  }

  // If deviceId provided, deactivate old tokens for this device
  if (deviceId) {
    await db
      .update(devicePushTokens)
      .set({ isActive: false })
      .where(
        and(
          eq(devicePushTokens.userId, userId),
          eq(devicePushTokens.deviceId, deviceId)
        )
      );
  }

  // Insert new token
  await db.insert(devicePushTokens).values({
    userId,
    token,
    platform,
    deviceId: deviceId ?? null,
    isActive: true,
  });
}

/**
 * Deactivate a push token (e.g., on logout)
 */
export async function deactivatePushToken(token: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(devicePushTokens)
    .set({ isActive: false })
    .where(eq(devicePushTokens.token, token));
}

/**
 * Get all active push tokens for a user
 */
export async function getActiveTokensForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(devicePushTokens)
    .where(
      and(
        eq(devicePushTokens.userId, userId),
        eq(devicePushTokens.isActive, true)
      )
    );
}

/**
 * Get all active push tokens for multiple users (for batch notifications)
 */
export async function getActiveTokensForUsers(userIds: number[]) {
  if (userIds.length === 0) return [];
  const db = await getDb();
  if (!db) return [];
  const results = await db
    .select()
    .from(devicePushTokens)
    .where(eq(devicePushTokens.isActive, true));
  return results.filter((r) => userIds.includes(r.userId));
}
