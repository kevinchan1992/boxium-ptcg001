/**
 * P2: executeSellerPayout
 *
 * Transfers the seller's receivable amount from the platform's Stripe account
 * to the seller's connected Stripe account using Stripe Connect Transfers.
 *
 * Flow:
 * 1. Verify order is in "completed" status (buyer confirmed receipt)
 * 2. Verify seller has an active Stripe Connect account
 * 3. Look up stripeChargeId from cartOrders (source_transaction for Transfer)
 * 4. Create Stripe Transfer to seller's connected account
 * 5. Update marketplaceOrders.payoutStatus and stripeTransferId
 * 6. Create marketplacePayouts record for audit trail
 * 7. Notify seller of payout
 *
 * IMPORTANT: source_transaction requires the charge ID (ch_xxx), NOT the
 * payment intent ID (pi_xxx). The stripeChargeId is stored in cartOrders
 * after the checkout.session.completed webhook fires.
 */

import Stripe from "stripe";
import {
  getMarketplaceOrderById,
  updateMarketplaceOrder,
  getSellerProfileById,
  getCartOrderById,
} from "./db";
import { getDb } from "./db";
import { marketplacePayouts, marketplaceOrders } from "../drizzle/schema_new";
import { eq } from "drizzle-orm";
import { createNotification } from "./db/notifications";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

export type PayoutResult =
  | { success: true; transferId: string; amountHkd: number }
  | { success: false; error: string; retryable: boolean };

/**
 * Execute a Stripe Connect Transfer for a completed C2C order.
 *
 * @param orderId - The marketplaceOrders.id to pay out
 * @returns PayoutResult
 */
export async function executeSellerPayout(orderId: number): Promise<PayoutResult> {
  const order = await getMarketplaceOrderById(orderId);
  if (!order) {
    return { success: false, error: `Order ${orderId} not found`, retryable: false };
  }

  // Only C2C seller orders require payout
  if (order.sellerType !== "seller") {
    return { success: false, error: "Platform orders do not require seller payout", retryable: false };
  }

  // Only completed orders should be paid out
  if (order.orderStatus !== "completed") {
    return {
      success: false,
      error: `Order ${order.orderNo} is not completed (status: ${order.orderStatus})`,
      retryable: false,
    };
  }

  // Check if already paid out
  const currentPayoutStatus = (order as any).payoutStatus;
  if (currentPayoutStatus === "paid") {
    return {
      success: false,
      error: `Order ${order.orderNo} already paid out`,
      retryable: false,
    };
  }

  // Verify seller has active Stripe Connect account
  if (!order.sellerId) {
    return { success: false, error: `Order ${order.orderNo} has no seller ID`, retryable: false };
  }
  const sellerProfile = await getSellerProfileById(order.sellerId);
  if (!sellerProfile) {
    return { success: false, error: `Seller profile ${order.sellerId} not found`, retryable: false };
  }
  if (!sellerProfile.stripeConnectId) {
    return {
      success: false,
      error: `Seller ${order.sellerId} has no Stripe Connect account`,
      retryable: false,
    };
  }
  if (sellerProfile.stripeConnectStatus !== "active") {
    return {
      success: false,
      error: `Seller ${order.sellerId} Stripe Connect status is ${sellerProfile.stripeConnectStatus}, not active`,
      retryable: sellerProfile.stripeConnectStatus === "pending",
    };
  }

  // Get stripeChargeId from cartOrders (required as source_transaction)
  const cartOrderId = (order as any).cartOrderId;
  let stripeChargeId: string | null = null;

  if (cartOrderId) {
    const cartOrder = await getCartOrderById(cartOrderId);
    stripeChargeId = cartOrder?.stripeChargeId ?? null;
  }

  // Fallback: try to retrieve charge from PaymentIntent if cartOrder doesn't have it
  if (!stripeChargeId && order.stripePaymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
      const latestCharge = (pi as any).latest_charge;
      if (typeof latestCharge === "string") {
        stripeChargeId = latestCharge;
        // Backfill cartOrders.stripeChargeId for future use
        if (cartOrderId) {
          const { updateCartOrder } = await import("./db");
          await updateCartOrder(cartOrderId, { stripeChargeId });
        }
      }
    } catch (piErr: any) {
      console.warn(`[executeSellerPayout] Could not retrieve PaymentIntent ${order.stripePaymentIntentId}:`, piErr.message);
    }
  }

  const sellerReceivable = parseFloat(order.sellerReceivableHkd as string);
  if (sellerReceivable <= 0) {
    return {
      success: false,
      error: `Order ${order.orderNo} seller receivable is ${sellerReceivable}, nothing to transfer`,
      retryable: false,
    };
  }

  // Mark payout as processing
  await updateMarketplaceOrder(orderId, { payoutStatus: "processing" as any });

  try {
    // Create Stripe Transfer
    const transferParams: Stripe.TransferCreateParams = {
      amount: Math.round(sellerReceivable * 100), // Convert to cents
      currency: "hkd",
      destination: sellerProfile.stripeConnectId,
      description: `Payout for order ${order.orderNo}`,
      metadata: {
        order_no: order.orderNo,
        order_id: orderId.toString(),
        seller_id: order.sellerId.toString(),
        buyer_id: order.buyerId.toString(),
      },
    };

    // Use source_transaction if we have the charge ID (preferred — avoids double-charging)
    if (stripeChargeId) {
      transferParams.source_transaction = stripeChargeId;
      console.log(`[executeSellerPayout] Using source_transaction: ${stripeChargeId}`);
    } else {
      console.warn(
        `[executeSellerPayout] No stripeChargeId for order ${order.orderNo} — Transfer will draw from platform balance instead of specific charge`
      );
    }

    const transfer = await stripe.transfers.create(transferParams);
    console.log(`[executeSellerPayout] Transfer ${transfer.id} created for order ${order.orderNo}, amount HKD ${sellerReceivable}`);

    // Update order payout status
    await updateMarketplaceOrder(orderId, {
      payoutStatus: "paid" as any,
      stripeTransferId: transfer.id,
    });

    // Create audit record in marketplacePayouts
    const db = await getDb();
    if (db) {
      await db.insert(marketplacePayouts).values({
        orderId,
        sellerId: order.sellerId,
        amountHkd: sellerReceivable.toFixed(2),
        stripeTransferId: transfer.id,
        status: "paid",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Notify seller
    await createNotification({
      userId: sellerProfile.userId,
      type: "trade",
      title: "賣款已轉帳 💰",
      body: `訂單 ${order.orderNo} 的賣款 HKD ${sellerReceivable.toFixed(2)} 已成功轉帳至你的 Stripe 帳戶。`,
      linkUrl: "/seller",
    }).catch(() => {});

    return { success: true, transferId: transfer.id, amountHkd: sellerReceivable };
  } catch (err: any) {
    console.error(`[executeSellerPayout] Transfer failed for order ${order.orderNo}:`, err.message);

    // Mark as failed
    await updateMarketplaceOrder(orderId, { payoutStatus: "failed" as any });

    // Create failed payout record
    const db = await getDb();
    if (db) {
      await db.insert(marketplacePayouts).values({
        orderId,
        sellerId: order.sellerId,
        amountHkd: sellerReceivable.toFixed(2),
        stripeTransferId: null,
        status: "failed",
        failureReason: err.message,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Determine if retryable
    const retryable = err.type === "StripeConnectionError" || err.code === "lock_timeout";

    return {
      success: false,
      error: err.message,
      retryable,
    };
  }
}

/**
 * Trigger payout for all completed C2C orders that haven't been paid out yet.
 * Called by the admin "batch payout" action or a scheduled job.
 */
export async function executePendingPayouts(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ orderId: number; error: string }>;
}> {
  const db = await getDb();
  if (!db) return { processed: 0, succeeded: 0, failed: 0, errors: [] };

  // Find all completed C2C orders with pending payout
  const pendingOrders = await db
    .select({ id: marketplaceOrders.id, orderNo: marketplaceOrders.orderNo })
    .from(marketplaceOrders)
    .where(
      eq(marketplaceOrders.orderStatus, "completed") as any
    )
    .limit(50); // Process in batches

  // Filter to only C2C seller orders with pending payout (Drizzle doesn't support multi-condition easily here)
  const results = { processed: 0, succeeded: 0, failed: 0, errors: [] as Array<{ orderId: number; error: string }> };

  for (const { id, orderNo } of pendingOrders) {
    const order = await getMarketplaceOrderById(id);
    if (!order || order.sellerType !== "seller" || (order as any).payoutStatus !== "pending") continue;

    results.processed++;
    const result = await executeSellerPayout(id);
    if (result.success) {
      results.succeeded++;
      console.log(`[executePendingPayouts] ✅ Order ${orderNo} paid out: ${result.transferId}`);
    } else {
      results.failed++;
      results.errors.push({ orderId: id, error: result.error });
      console.error(`[executePendingPayouts] ❌ Order ${orderNo} payout failed: ${result.error}`);
    }
  }

  return results;
}
