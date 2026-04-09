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

  // Get platform settings (tiered fee rate)
  getPlatformSettings: adminProcedure
    .query(async () => {
      const [t1max, t1rate, t2max, t2rate, t3rate] = await Promise.all([
        getSystemSetting('fee_tier_1_max'),
        getSystemSetting('fee_tier_1_rate'),
        getSystemSetting('fee_tier_2_max'),
        getSystemSetting('fee_tier_2_rate'),
        getSystemSetting('fee_tier_3_rate'),
      ]);
      return {
        tier1Max:  t1max  ? parseFloat(t1max.settingValue)  : 5000,
        tier1Rate: t1rate ? parseFloat(t1rate.settingValue) : 0.05,
        tier2Max:  t2max  ? parseFloat(t2max.settingValue)  : 10000,
        tier2Rate: t2rate ? parseFloat(t2rate.settingValue) : 0.04,
        tier3Rate: t3rate ? parseFloat(t3rate.settingValue) : 0.03,
        // Legacy compat: return tier1 rate as platformFeeRate
        platformFeeRate: t1rate ? parseFloat(t1rate.settingValue) : 0.05,
        platformFeeRatePercent: t1rate ? Math.round(parseFloat(t1rate.settingValue) * 100 * 100) / 100 : 5,
      };
    }),

  // Update tiered platform fee rates
  updatePlatformFeeRate: adminProcedure
    .input(
      z.object({
        tier1Max:  z.number().min(1).optional(),
        tier1Rate: z.number().min(0).max(30).optional(),
        tier2Max:  z.number().min(1).optional(),
        tier2Rate: z.number().min(0).max(30).optional(),
        tier3Rate: z.number().min(0).max(30).optional(),
        // Legacy single-rate compat
        feeRatePercent: z.number().min(0).max(30).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const updates: Promise<any>[] = [];
      if (input.tier1Max  !== undefined) updates.push(setSystemSetting('fee_tier_1_max',  input.tier1Max.toString(),  'Tier 1 max price threshold (HKD)'));
      if (input.tier1Rate !== undefined) updates.push(setSystemSetting('fee_tier_1_rate', (input.tier1Rate / 100).toString(), `Tier 1 fee rate (${input.tier1Rate}%)` ));
      if (input.tier2Max  !== undefined) updates.push(setSystemSetting('fee_tier_2_max',  input.tier2Max.toString(),  'Tier 2 max price threshold (HKD)'));
      if (input.tier2Rate !== undefined) updates.push(setSystemSetting('fee_tier_2_rate', (input.tier2Rate / 100).toString(), `Tier 2 fee rate (${input.tier2Rate}%)` ));
      if (input.tier3Rate !== undefined) updates.push(setSystemSetting('fee_tier_3_rate', (input.tier3Rate / 100).toString(), `Tier 3 fee rate (${input.tier3Rate}%)` ));
      // Legacy compat: if only feeRatePercent provided, update tier1 rate
      if (input.feeRatePercent !== undefined && input.tier1Rate === undefined) {
        updates.push(setSystemSetting('fee_tier_1_rate', (input.feeRatePercent / 100).toString(), `Tier 1 fee rate (${input.feeRatePercent}%)`));
      }
      await Promise.all(updates);
      return { success: true };
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

  // Get all "more settings" (order lifecycle, listing, cart, SLA)
  getMoreSettings: adminProcedure
    .query(async () => {
      const [
        autoCompleteDays,
        minListingPrice,
        cartRetentionDays,
        cartExpiryReminderDays,
        maxOffersPerDay,
        alipayReviewSlaHours,
        disputeSlaHours,
        meetupCancelDays,
        paymentTimeout,
        offerPaymentTimeout,
        reminderMinutes,
      ] = await Promise.all([
        getSystemSetting('auto_complete_days'),
        getSystemSetting('min_listing_price_hkd'),
        getSystemSetting('cart_retention_days'),
        getSystemSetting('cart_expiry_reminder_days'),
        getSystemSetting('max_offers_per_day'),
        getSystemSetting('alipay_review_sla_hours'),
        getSystemSetting('dispute_sla_hours'),
        getSystemSetting('meetup_cancel_days'),
        getSystemSetting('payment_timeout_minutes'),
        getSystemSetting('offer_payment_timeout_hours'),
        getSystemSetting('payment_reminder_minutes'),
      ]);
      return {
        autoCompleteDays: autoCompleteDays ? parseInt(autoCompleteDays.settingValue) : 14,
        minListingPriceHkd: minListingPrice ? parseFloat(minListingPrice.settingValue) : 4.00,
        cartRetentionDays: cartRetentionDays ? parseInt(cartRetentionDays.settingValue) : 14,
        cartExpiryReminderDays: cartExpiryReminderDays ? parseInt(cartExpiryReminderDays.settingValue) : 3,
        maxOffersPerDay: maxOffersPerDay ? parseInt(maxOffersPerDay.settingValue) : 3,
        alipayReviewSlaHours: alipayReviewSlaHours ? parseInt(alipayReviewSlaHours.settingValue) : 24,
        disputeSlaHours: disputeSlaHours ? parseInt(disputeSlaHours.settingValue) : 72,
        meetupCancelDays: meetupCancelDays ? parseInt(meetupCancelDays.settingValue) : 7,
        paymentTimeoutMinutes: paymentTimeout ? parseInt(paymentTimeout.settingValue) : 30,
        offerPaymentTimeoutHours: offerPaymentTimeout ? parseInt(offerPaymentTimeout.settingValue) : 24,
        paymentReminderMinutes: reminderMinutes ? parseInt(reminderMinutes.settingValue) : 60,
      };
    }),

  // Update all "more settings"
  updateMoreSettings: adminProcedure
    .input(
      z.object({
        autoCompleteDays: z.number().int().min(1).max(365).optional(),
        minListingPriceHkd: z.number().min(0.01).max(99999).optional(),
        cartRetentionDays: z.number().int().min(1).max(365).optional(),
        cartExpiryReminderDays: z.number().int().min(1).max(90).optional(),
        maxOffersPerDay: z.number().int().min(1).max(999).optional(),
        alipayReviewSlaHours: z.number().int().min(1).max(720).optional(),
        disputeSlaHours: z.number().int().min(1).max(2160).optional(),
        meetupCancelDays: z.number().int().min(1).max(90).optional(),
        paymentTimeoutMinutes: z.number().int().min(5).max(10080).optional(),
        offerPaymentTimeoutHours: z.number().int().min(1).max(720).optional(),
        paymentReminderMinutes: z.number().int().min(5).max(10080).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const updates: Promise<unknown>[] = [];
      if (input.autoCompleteDays !== undefined)
        updates.push(setSystemSetting('auto_complete_days', input.autoCompleteDays.toString(), '出貨後自動完成訂單天數 (default: 14)'));
      if (input.minListingPriceHkd !== undefined)
        updates.push(setSystemSetting('min_listing_price_hkd', input.minListingPriceHkd.toString(), '最低出售金額 HKD (default: 4.00)'));
      if (input.cartRetentionDays !== undefined)
        updates.push(setSystemSetting('cart_retention_days', input.cartRetentionDays.toString(), '購物車商品保留天數 (default: 14)'));
      if (input.cartExpiryReminderDays !== undefined)
        updates.push(setSystemSetting('cart_expiry_reminder_days', input.cartExpiryReminderDays.toString(), '購物車到期提醒提前天數 (default: 3)'));
      if (input.maxOffersPerDay !== undefined)
        updates.push(setSystemSetting('max_offers_per_day', input.maxOffersPerDay.toString(), '每個商品每買家每24小時最多出價次數 (default: 3)'));
      if (input.alipayReviewSlaHours !== undefined)
        updates.push(setSystemSetting('alipay_review_sla_hours', input.alipayReviewSlaHours.toString(), 'Alipay 審核 SLA 時限小時 (default: 24)'));
      if (input.disputeSlaHours !== undefined)
        updates.push(setSystemSetting('dispute_sla_hours', input.disputeSlaHours.toString(), '爭議處理 SLA 時限小時 (default: 72)'));
      if (input.meetupCancelDays !== undefined)
        updates.push(setSystemSetting('meetup_cancel_days', input.meetupCancelDays.toString(), '面交訂單未確認自動取消天數 (default: 7)'));
      if (input.paymentTimeoutMinutes !== undefined)
        updates.push(setSystemSetting('payment_timeout_minutes', input.paymentTimeoutMinutes.toString(), '待付款訂單自動取消時限分鐘 (default: 30)'));
      if (input.offerPaymentTimeoutHours !== undefined)
        updates.push(setSystemSetting('offer_payment_timeout_hours', input.offerPaymentTimeoutHours.toString(), '接受出價後付款時限小時 (default: 24)'));
      if (input.paymentReminderMinutes !== undefined)
        updates.push(setSystemSetting('payment_reminder_minutes', input.paymentReminderMinutes.toString(), '付款提醒郵件發送時機分鐘 (default: 60)'));
      await Promise.all(updates);
      return { success: true };
    }),
});
