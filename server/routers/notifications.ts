import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllRead,
} from "../db/notifications";

export const notificationsRouter = router({
  // Get notifications for the current user
  getMyNotifications: protectedProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().min(0).default(0),
      unreadOnly: z.boolean().default(false),
      type: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const { limit = 20, offset = 0, unreadOnly = false, type } = input ?? {};
      const notifications = await getUserNotifications(ctx.user.id, { limit, offset, unreadOnly, type });
      return notifications;
    }),

  // Get unread notification count
  getUnreadCount: protectedProcedure
    .query(async ({ ctx }) => {
      const count = await getUnreadCount(ctx.user.id);
      return { count };
    }),

  // Mark a single notification as read
  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const success = await markAsRead(input.notificationId, ctx.user.id);
      return { success };
    }),

  // Mark all notifications as read
  markAllAsRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      const count = await markAllAsRead(ctx.user.id);
      return { count };
    }),

  // Delete a single notification
  deleteNotification: protectedProcedure
    .input(z.object({ notificationId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const success = await deleteNotification(input.notificationId, ctx.user.id);
      return { success };
    }),

  // Delete all read notifications
  deleteAllRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      const count = await deleteAllRead(ctx.user.id);
      return { count };
    }),
});
