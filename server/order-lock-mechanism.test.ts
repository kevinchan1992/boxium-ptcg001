/**
 * Order Lock Mechanism Tests
 *
 * Tests for the order lock mechanism that prevents double-booking:
 * 1. reserveListingStock — atomically sets listing status to 'reserved' on order creation
 * 2. claimListingAsSold — accepts both 'active' and 'reserved' status
 * 3. restoreListingStock — restores 'reserved' → 'active' on cancellation
 * 4. createBatchStripeOrder — allows 'reserved' status for idempotent retry
 * 5. createBatchAlipayOrder — allows 'reserved' status for idempotent retry
 * 6. createAlipayOrder — calls reserveListingStock before creating order
 * 7. Cart.tsx — hasPendingOrder items are treated as available in checkout validation
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readFile(relativePath: string): string {
  return readFileSync(join(__dirname, '..', relativePath), 'utf-8');
}

function extractFunction(src: string, fnName: string): string {
  const fnStart = src.indexOf(`export async function ${fnName}`);
  if (fnStart === -1) return '';
  const fnEnd = src.indexOf('\nexport ', fnStart + 1);
  return src.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 3000);
}

// ============================================================
// 1. reserveListingStock — must set status to 'reserved'
// ============================================================
describe('reserveListingStock — atomically sets listing to reserved', () => {
  it('should export reserveListingStock function', async () => {
    const db = await import('./db');
    expect(typeof db.reserveListingStock).toBe('function');
  }, 15000);

  it('reserveListingStock SQL should set status = reserved', () => {
    const src = readFile('server/db.ts');
    const fnBody = extractFunction(src, 'reserveListingStock');
    expect(fnBody).toBeTruthy();
    // Must set status to 'reserved'
    expect(fnBody).toMatch(/status\s*=\s*['"]reserved['"]/);
    // Must only update when current status is 'active' (prevent double-booking)
    expect(fnBody).toMatch(/status\s*=\s*['"]active['"]/);
    // Must NOT set status to 'sold' (that's claimListingAsSold's job)
    expect(fnBody).not.toMatch(/status\s*=\s*['"]sold['"]/);
  });

  it('reserveListingStock should use atomic UPDATE (not SELECT then UPDATE)', () => {
    const src = readFile('server/db.ts');
    const fnBody = extractFunction(src, 'reserveListingStock');
    // Must use UPDATE statement (atomic)
    expect(fnBody).toContain('UPDATE');
    // Must check affectedRows to determine success
    expect(fnBody).toContain('affectedRows');
  });
});

// ============================================================
// 2. claimListingAsSold — accepts both 'active' and 'reserved'
// ============================================================
describe('claimListingAsSold — accepts active or reserved status', () => {
  it('claimListingAsSold SQL should accept both active and reserved status', () => {
    const src = readFile('server/db.ts');
    const fnBody = extractFunction(src, 'claimListingAsSold');
    expect(fnBody).toBeTruthy();
    // Must accept 'reserved' status (for orders created after lock mechanism)
    expect(fnBody).toContain('reserved');
    // Must set status to 'sold'
    expect(fnBody).toMatch(/status\s*=\s*['"]sold['"]/);
    // Must use IN clause to accept multiple statuses
    expect(fnBody).toContain('IN');
  });
});

// ============================================================
// 3. restoreListingStock — restores reserved → active
// ============================================================
describe('restoreListingStock — restores reserved to active', () => {
  it('restoreListingStock SQL should handle reserved status', () => {
    const src = readFile('server/db.ts');
    const fnBody = extractFunction(src, 'restoreListingStock');
    expect(fnBody).toBeTruthy();
    // Must handle 'reserved' status
    expect(fnBody).toContain('reserved');
    // Must restore to 'active'
    expect(fnBody).toContain('active');
  });
});

// ============================================================
// 4. createBatchStripeOrder — allows reserved status
// ============================================================
describe('createBatchStripeOrder — allows reserved status for idempotent retry', () => {
  it('createBatchStripeOrder should allow reserved status in listing validation', () => {
    const src = readFile('server/routers/marketplace.ts');
    // Find createBatchStripeOrder procedure
    const procStart = src.indexOf('createBatchStripeOrder: protectedProcedure');
    const procEnd = src.indexOf('\n  createBatchAlipayOrder:', procStart + 1);
    const procBody = src.slice(procStart, procEnd > 0 ? procEnd : procStart + 10000);
    expect(procBody).toBeTruthy();
    // Must allow 'reserved' status in validation
    expect(procBody).toContain("'reserved'");
    // Must NOT reject 'reserved' status outright
    expect(procBody).not.toMatch(/status\s*!==\s*['"]active['"]/);
  });

  it('createBatchStripeOrder should skip reserveListingStock for idempotent items', () => {
    const src = readFile('server/routers/marketplace.ts');
    const procStart = src.indexOf('createBatchStripeOrder: protectedProcedure');
    const procEnd = src.indexOf('\n  createBatchAlipayOrder:', procStart + 1);
    const procBody = src.slice(procStart, procEnd > 0 ? procEnd : procStart + 10000);
    // Must check for existing order before reserving
    expect(procBody).toContain('existingOrderForReserve');
    // Must skip reservation for idempotent items
    expect(procBody).toContain('skipping reserve');
  });
});

// ============================================================
// 5. createBatchAlipayOrder — allows reserved status
// ============================================================
describe('createBatchAlipayOrder — allows reserved status for idempotent retry', () => {
  it('createBatchAlipayOrder should allow reserved status in validation', () => {
    const src = readFile('server/routers/marketplace.ts');
    const procStart = src.indexOf('createBatchAlipayOrder: protectedProcedure');
    const procEnd = src.indexOf('\n  getOrderByNo:', procStart + 1);
    const procBody = src.slice(procStart, procEnd > 0 ? procEnd : procStart + 10000);
    expect(procBody).toBeTruthy();
    // Must allow 'reserved' status
    expect(procBody).toContain("'reserved'");
    // Must check for idempotent items
    expect(procBody).toContain('isIdempotent');
  });

  it('createBatchAlipayOrder should reuse existing order for idempotent items', () => {
    const src = readFile('server/routers/marketplace.ts');
    const procStart = src.indexOf('createBatchAlipayOrder: protectedProcedure');
    const procEnd = src.indexOf('\n  getOrderByNo:', procStart + 1);
    const procBody = src.slice(procStart, procEnd > 0 ? procEnd : procStart + 10000);
    // Must reuse existing order
    expect(procBody).toContain('existingAlipayOrderForReuse');
  });
});

// ============================================================
// 6. createAlipayOrder — calls reserveListingStock
// ============================================================
describe('createAlipayOrder — calls reserveListingStock before creating order', () => {
  it('createAlipayOrder should call reserveListingStock', () => {
    const src = readFile('server/routers/marketplace.ts');
    const procStart = src.indexOf('createAlipayOrder: protectedProcedure');
    const procEnd = src.indexOf('\n  createBatchStripeOrder:', procStart + 1);
    const procBody = src.slice(procStart, procEnd > 0 ? procEnd : procStart + 5000);
    expect(procBody).toBeTruthy();
    // Must call reserveListingStock
    expect(procBody).toContain('reserveListingStock');
    // Must allow 'reserved' status
    expect(procBody).toContain("'reserved'");
  });

  it('createAlipayOrder should restore stock when switching from Stripe to Alipay', () => {
    const src = readFile('server/routers/marketplace.ts');
    const procStart = src.indexOf('createAlipayOrder: protectedProcedure');
    const procEnd = src.indexOf('\n  createBatchStripeOrder:', procStart + 1);
    const procBody = src.slice(procStart, procEnd > 0 ? procEnd : procStart + 5000);
    // Must restore stock when cancelling Stripe order
    expect(procBody).toContain('restoreListingStock');
  });
});

// ============================================================
// 7. Cart.tsx — hasPendingOrder items are available in checkout
// ============================================================
describe('Cart.tsx — hasPendingOrder items treated as available in checkout', () => {
  it('Cart.tsx checkout validation should allow hasPendingOrder items', () => {
    const src = readFile('client/src/pages/Cart.tsx');
    // Find the checkout validation section
    const validationStart = src.indexOf('Pre-checkout inventory validation');
    const validationEnd = src.indexOf('setIsValidatingStock(false)', validationStart + 1);
    const validationBody = src.slice(validationStart, validationEnd > 0 ? validationEnd : validationStart + 1000);
    expect(validationBody).toBeTruthy();
    // Must check hasPendingOrder in the available IDs filter
    expect(validationBody).toContain('hasPendingOrder');
    // Must NOT only filter by status === 'active'
    expect(validationBody).not.toMatch(/filter\([^)]*status\s*===\s*['"]active['"]\s*\)/);
  });

  it('Cart.tsx activeItems should include hasPendingOrder items', () => {
    const src = readFile('client/src/pages/Cart.tsx');
    // Find the activeItems definition
    const activeStart = src.indexOf('const activeItems = useMemo');
    const activeEnd = src.indexOf(');', activeStart + 1);
    const activeBody = src.slice(activeStart, activeEnd > 0 ? activeEnd + 2 : activeStart + 500);
    expect(activeBody).toBeTruthy();
    // Must include hasPendingOrder items
    expect(activeBody).toContain('hasPendingOrder');
    // Must filter by status === 'active' OR hasPendingOrder
    expect(activeBody).toContain('active');
  });
});
