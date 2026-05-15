/**
 * mobile.ts
 * tRPC router for Capacitor mobile APP features:
 * - Push token registration / deregistration
 */

import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { upsertPushToken, deactivatePushToken, getActiveTokensForUser } from "../pushTokenDb";

export const mobileRouter = router({
  /**
   * Register (or refresh) a device push token.
   * Called by CapacitorInit on every APP launch after permission is granted.
   */
  registerPushToken: protectedProcedure
    .input(
      z.object({
        token: z.string().min(10).max(512),
        platform: z.enum(["ios", "android", "web"]),
        deviceId: z.string().max(256).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await upsertPushToken({
        userId: ctx.user.id,
        token: input.token,
        platform: input.platform,
        deviceId: input.deviceId,
      });
      return { success: true };
    }),

  /**
   * Deregister a push token (called on logout or when user disables notifications).
   */
  deregisterPushToken: protectedProcedure
    .input(
      z.object({
        token: z.string().min(10).max(512),
      })
    )
    .mutation(async ({ input }) => {
      await deactivatePushToken(input.token);
      return { success: true };
    }),

  /**
   * Get active push tokens for the current user (for debugging / admin use).
   */
  getMyPushTokens: protectedProcedure.query(async ({ ctx }) => {
    const tokens = await getActiveTokensForUser(ctx.user.id);
    return tokens.map((t) => ({
      id: t.id,
      platform: t.platform,
      deviceId: t.deviceId,
      createdAt: t.createdAt,
    }));
  }),
});
