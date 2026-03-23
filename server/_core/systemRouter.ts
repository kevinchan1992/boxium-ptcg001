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
});
