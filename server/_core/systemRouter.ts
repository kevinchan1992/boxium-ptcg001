import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getSystemSetting, setSystemSetting } from "../db";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // Get platform settings (fee rate, etc.)
  getPlatformSettings: adminProcedure
    .query(async () => {
      const feeRateSetting = await getSystemSetting("platform_fee_rate");
      const feeRate = feeRateSetting ? parseFloat(feeRateSetting.settingValue) : 0.05;
      return {
        platformFeeRate: feeRate,
        platformFeeRatePercent: Math.round(feeRate * 100 * 100) / 100, // e.g. 5.00
      };
    }),

  // Update platform fee rate
  updatePlatformFeeRate: adminProcedure
    .input(
      z.object({
        feeRatePercent: z.number().min(0).max(30, "Fee rate cannot exceed 30%"),
      })
    )
    .mutation(async ({ input }) => {
      const feeRate = input.feeRatePercent / 100;
      await setSystemSetting(
        "platform_fee_rate",
        feeRate.toString(),
        `Platform fee rate for C2C marketplace listings (${input.feeRatePercent}%)`
      );
      return { success: true, feeRate, feeRatePercent: input.feeRatePercent };
    }),

  // Get marketplace timeout settings (public so order pages can read payment timeout)
  getTimeoutSettings: publicProcedure
    .query(async () => {
      const [paymentTimeout, offerPaymentTimeout, reminderMinutes] = await Promise.all([
        getSystemSetting('payment_timeout_minutes'),
        getSystemSetting('offer_payment_timeout_hours'),
        getSystemSetting('payment_reminder_minutes'),
      ]);
      return {
        paymentTimeoutMinutes: paymentTimeout ? parseInt(paymentTimeout.settingValue) : 30,
        offerPaymentTimeoutHours: offerPaymentTimeout ? parseInt(offerPaymentTimeout.settingValue) : 24,
        paymentReminderMinutes: reminderMinutes ? parseInt(reminderMinutes.settingValue) : 60,
      };
    }),

  // Update marketplace timeout settings
  updateTimeoutSettings: adminProcedure
    .input(
      z.object({
        paymentTimeoutMinutes: z.number().int().min(5).max(1440).optional(),
        offerPaymentTimeoutHours: z.number().int().min(1).max(168).optional(),
        paymentReminderMinutes: z.number().int().min(5).max(1440).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const updates: Promise<unknown>[] = [];
      if (input.paymentTimeoutMinutes !== undefined) {
        updates.push(setSystemSetting(
          'payment_timeout_minutes',
          input.paymentTimeoutMinutes.toString(),
          `Pending payment order auto-cancel timeout in minutes (default: 30)`
        ));
      }
      if (input.offerPaymentTimeoutHours !== undefined) {
        updates.push(setSystemSetting(
          'offer_payment_timeout_hours',
          input.offerPaymentTimeoutHours.toString(),
          `Accepted offer auto-expire timeout in hours (default: 24)`
        ));
      }
      if (input.paymentReminderMinutes !== undefined) {
        updates.push(setSystemSetting(
          'payment_reminder_minutes',
          input.paymentReminderMinutes.toString(),
          `Payment reminder email sent after N minutes (default: 60)`
        ));
      }
      await Promise.all(updates);
      return { success: true };
    }),
});
