import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllRead,
  getNotificationById,
} from "../db/notifications";

export const notificationsRouter = router({
  /**
   * Get user's notifications with pagination
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(20),
        offset: z.number().min(0).optional().default(0),
        unreadOnly: z.boolean().optional().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      return await getUserNotifications(ctx.user.id, input);
    }),

  /**
   * Get unread notification count
   */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return await getUnreadCount(ctx.user.id);
  }),

  /**
   * Mark a notification as read
   */
  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const success = await markAsRead(input.notificationId, ctx.user.id);
      if (!success) {
        throw new Error("Notification not found or already read");
      }
      return { success: true };
    }),

  /**
   * Mark all notifications as read
   */
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const count = await markAllAsRead(ctx.user.id);
    return { count };
  }),

  /**
   * Delete a notification
   */
  delete: protectedProcedure
    .input(z.object({ notificationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const success = await deleteNotification(input.notificationId, ctx.user.id);
      if (!success) {
        throw new Error("Notification not found");
      }
      return { success: true };
    }),

  /**
   * Delete all read notifications
   */
  deleteAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const count = await deleteAllRead(ctx.user.id);
    return { count };
  }),

  /**
   * Get a single notification by ID
   */
  getById: protectedProcedure
    .input(z.object({ notificationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const notification = await getNotificationById(input.notificationId, ctx.user.id);
      if (!notification) {
        throw new Error("Notification not found");
      }
      return notification;
    }),

  /**
   * Create a test notification (for development/testing)
   */
  createTest: protectedProcedure
    .input(
      z.object({
        type: z.enum(["price_alert", "system", "trade", "announcement"]),
        title: z.string(),
        content: z.string(),
        priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
        relatedCardId: z.number().optional(),
        relatedUrl: z.string().optional(),
        metadata: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await createNotification({
        userId: ctx.user.id,
        ...input,
      });
    }),
});
