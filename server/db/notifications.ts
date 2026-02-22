import { getDb } from "../db";
import { notifications, type Notification, type InsertNotification } from "../../drizzle/schema_new";
import { eq, and, desc, count } from "drizzle-orm";

/**
 * Create a new notification
 */
export async function createNotification(data: InsertNotification): Promise<Notification> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [notification] = await db.insert(notifications).values(data).$returningId();
  const [created] = await db.select().from(notifications).where(eq(notifications.id, notification.id));
  return created;
}

/**
 * Get notifications for a user with pagination
 */
export async function getUserNotifications(
  userId: number,
  options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  } = {}
): Promise<Notification[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { limit = 20, offset = 0, unreadOnly = false } = options;

  if (unreadOnly) {
    return await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);
  }

  return await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select({ count: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  return result[0]?.count || 0;
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));

  return (result[0]?.affectedRows || 0) > 0;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  return result[0]?.affectedRows || 0;
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .delete(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));

  return (result[0]?.affectedRows || 0) > 0;
}

/**
 * Delete all read notifications for a user
 */
export async function deleteAllRead(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .delete(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, true)));

  return result[0]?.affectedRows || 0;
}

/**
 * Get a single notification by ID
 */
export async function getNotificationById(notificationId: number, userId: number): Promise<Notification | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [notification] = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));

  return notification || null;
}
