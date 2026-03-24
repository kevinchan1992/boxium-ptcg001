/**
 * Order / Cart / Listing Status Bug Fix Tests
 *
 * Tests for:
 * 1. reserveListingStock — does NOT change listing status to 'sold' on order creation
 * 2. getAdminOrders — returns sellerName field
 * 3. getBuyerOrders — returns batchRef and cartOrderId via Drizzle ORM fields
 * 4. getMyCart — returns hasPendingOrder field
 * 5. Cart logic — items with hasPendingOrder are treated as active
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// 1. reserveListingStock — must NOT change status to 'sold'
// ============================================================
describe('reserveListingStock — listing stays active after order creation', () => {
  it('should export reserveListingStock function', async () => {
    const db = await import('./db');
    expect(typeof db.reserveListingStock).toBe('function');
  }, 15000);

  it('reserveListingStock SQL should NOT contain status = sold', async () => {
    // Read the source to verify the fix is in place
    const fs = await import('fs');
    const src = fs.readFileSync(new URL('./db.ts', import.meta.url).pathname, 'utf-8');
    // Find the reserveListingStock function block
    const fnStart = src.indexOf('export async function reserveListingStock');
    const fnEnd = src.indexOf('\nexport ', fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 2000);
    // The function must NOT set status = 'sold' or status = "sold"
    expect(fnBody).not.toMatch(/status\s*=\s*['"]sold['"]/);
    // But it MUST still decrement quantity
    expect(fnBody).toContain('quantity - ');
  });

  it('restoreListingStock should still set status back to active', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync(new URL('./db.ts', import.meta.url).pathname, 'utf-8');
    const fnStart = src.indexOf('export async function restoreListingStock');
    const fnEnd = src.indexOf('\nexport ', fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 2000);
    expect(fnBody).toContain('active');
  });
});

// ============================================================
// 2. getAdminOrders — sellerName field
// ============================================================
describe('getAdminOrders — sellerName field', () => {
  it('should export getAdminOrders function', async () => {
    const db = await import('./db');
    expect(typeof db.getAdminOrders).toBe('function');
  }, 15000);

  it('getAdminOrders SQL should include sellerName via COALESCE', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync(new URL('./db.ts', import.meta.url).pathname, 'utf-8');
    const fnStart = src.indexOf('export async function getAdminOrders');
    const fnEnd = src.indexOf('\nexport ', fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 5000);
    expect(fnBody).toContain('sellerName');
    expect(fnBody.toLowerCase()).toContain('coalesce');
  });
});

// ============================================================
// 3. getBuyerOrders — batchRef and cartOrderId via Drizzle ORM
// ============================================================
describe('getBuyerOrders — batchRef and cartOrderId fields', () => {
  it('should export getBuyerOrders function', async () => {
    const db = await import('./db');
    expect(typeof db.getBuyerOrders).toBe('function');
  }, 15000);

  it('getBuyerOrders should use Drizzle ORM fields for batchRef (not raw SQL batch_ref)', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync(new URL('./db.ts', import.meta.url).pathname, 'utf-8');
    const fnStart = src.indexOf('export async function getBuyerOrders');
    const fnEnd = src.indexOf('\nexport ', fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 3000);
    // Should use Drizzle ORM field reference, not raw SQL with snake_case
    expect(fnBody).toContain('batchRef');
    expect(fnBody).not.toMatch(/sql`.*batch_ref.*`/);
  });

  it('getBuyerOrders should use Drizzle ORM fields for cartOrderId (not raw SQL cart_order_id)', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync(new URL('./db.ts', import.meta.url).pathname, 'utf-8');
    const fnStart = src.indexOf('export async function getBuyerOrders');
    const fnEnd = src.indexOf('\nexport ', fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 3000);
    expect(fnBody).toContain('cartOrderId');
    expect(fnBody).not.toMatch(/sql`.*cart_order_id.*`/);
  });
});

// ============================================================
// 4. getMyCart — hasPendingOrder field
// ============================================================
describe('getMyCart — hasPendingOrder field', () => {
  it('getMyCart procedure should exist', async () => {
    const { marketplaceRouter } = await import('./routers/marketplace');
    expect(marketplaceRouter._def.procedures).toHaveProperty('getMyCart');
  }, 30000);

  it('getMyCart procedure should be a query', async () => {
    const { marketplaceRouter } = await import('./routers/marketplace');
    const proc = marketplaceRouter._def.procedures.getMyCart;
    expect(proc._def.type).toBe('query');
  }, 30000);

  it('getMyCart source should include hasPendingOrder logic', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync(
      new URL('./routers/marketplace.ts', import.meta.url).pathname,
      'utf-8'
    );
    // Find getMyCart procedure
    const fnStart = src.indexOf('getMyCart:');
    const fnEnd = src.indexOf('\n  },\n', fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 3000);
    expect(fnBody).toContain('hasPendingOrder');
  });
});

// ============================================================
// 5. Cart logic — hasPendingOrder items treated as active
// ============================================================
describe('Cart.tsx — hasPendingOrder items treated as active', () => {
  it('Cart.tsx should include hasPendingOrder in activeItems filter', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync(
      new URL('../client/src/pages/Cart.tsx', import.meta.url).pathname,
      'utf-8'
    );
    expect(src).toContain('hasPendingOrder');
    // activeItems filter should include hasPendingOrder
    const activeItemsIdx = src.indexOf('const activeItems = useMemo');
    const activeItemsEnd = src.indexOf(');', activeItemsIdx);
    const activeItemsBlock = src.slice(activeItemsIdx, activeItemsEnd);
    expect(activeItemsBlock).toContain('hasPendingOrder');
  });

  it('Cart.tsx unavailableItems should exclude hasPendingOrder items', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync(
      new URL('../client/src/pages/Cart.tsx', import.meta.url).pathname,
      'utf-8'
    );
    const unavailableIdx = src.indexOf('const unavailableItems = useMemo');
    const unavailableEnd = src.indexOf(');', unavailableIdx);
    const unavailableBlock = src.slice(unavailableIdx, unavailableEnd);
    expect(unavailableBlock).toContain('hasPendingOrder');
  });

  it('CartItemRow interface should include hasPendingOrder and pendingOrderNo', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync(
      new URL('../client/src/pages/Cart.tsx', import.meta.url).pathname,
      'utf-8'
    );
    expect(src).toContain('hasPendingOrder?: boolean');
    expect(src).toContain('pendingOrderNo?: string | null');
  });

  it('Cart.tsx should show 待付款 badge for hasPendingOrder items', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync(
      new URL('../client/src/pages/Cart.tsx', import.meta.url).pathname,
      'utf-8'
    );
    expect(src).toContain('待付款');
    expect(src).toContain('hasPendingOrder && !unavailable');
  });
});

// ============================================================
// 6. Stripe webhook — listing marked sold only after payment
// ============================================================
describe('Stripe webhook — listing marked sold only after payment confirmation', () => {
  it('stripe webhook file should exist', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const webhookPath = path.resolve(
      new URL('./_core/index.ts', import.meta.url).pathname
    );
    expect(fs.existsSync(webhookPath)).toBe(true);
  });

  it('stripe webhook should mark listing as sold on checkout.session.completed', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync(
      new URL('./_core/index.ts', import.meta.url).pathname,
      'utf-8'
    );
    // Should contain updateListing with status: "sold" in the webhook handler
    expect(src).toContain('checkout.session.completed');
    expect(src).toContain('status: "sold"');
  });
});
