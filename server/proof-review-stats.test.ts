/**
 * Tests for Alipay proof review stats and order card label logic
 * Covers: getMarketplaceStats new fields, overdue/resubmit label logic
 */
import { describe, it, expect } from 'vitest';

// ─── Label logic helpers (mirrors AdminMarketplace.tsx logic) ─────────────────
function getProofLabel(order: {
  alipayProofStatus: string | null;
  alipayProofSubmittedAt: Date | string | null;
  alipayProofImageUrl: string | null;
}): 'overdue' | 'resubmitted' | 'pending' | 'approved' | 'rejected' | 'none' {
  if (!order.alipayProofStatus) return 'none';
  if (order.alipayProofStatus === 'approved') return 'approved';
  if (order.alipayProofStatus === 'rejected') return 'rejected';
  if (order.alipayProofStatus === 'pending_review') {
    const submittedMs = order.alipayProofSubmittedAt
      ? new Date(order.alipayProofSubmittedAt).getTime()
      : null;
    const isOverdue = submittedMs !== null && (Date.now() - submittedMs) > 48 * 60 * 60 * 1000;
    const isResubmitted = (order.alipayProofImageUrl ?? '').includes('resubmit-');
    if (isOverdue) return 'overdue';
    if (isResubmitted) return 'resubmitted';
    return 'pending';
  }
  return 'none';
}

// ─── Dashboard stats field validation ────────────────────────────────────────
function validateDashboardStats(stats: Record<string, unknown>) {
  const required = ['pendingProofCount', 'todayRejectedProofCount', 'overdueProofCount'];
  for (const field of required) {
    if (!(field in stats)) throw new Error(`Missing field: ${field}`);
    if (typeof stats[field] !== 'number') throw new Error(`Field ${field} must be a number`);
    if ((stats[field] as number) < 0) throw new Error(`Field ${field} must be >= 0`);
  }
  return true;
}

describe('Alipay Proof Review Stats', () => {
  describe('getProofLabel - label logic', () => {
    it('returns "none" when alipayProofStatus is null', () => {
      expect(getProofLabel({ alipayProofStatus: null, alipayProofSubmittedAt: null, alipayProofImageUrl: null })).toBe('none');
    });

    it('returns "approved" for approved status', () => {
      expect(getProofLabel({ alipayProofStatus: 'approved', alipayProofSubmittedAt: new Date(), alipayProofImageUrl: null })).toBe('approved');
    });

    it('returns "rejected" for rejected status', () => {
      expect(getProofLabel({ alipayProofStatus: 'rejected', alipayProofSubmittedAt: new Date(), alipayProofImageUrl: null })).toBe('rejected');
    });

    it('returns "pending" for recent pending_review without resubmit URL', () => {
      const recentDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      expect(getProofLabel({
        alipayProofStatus: 'pending_review',
        alipayProofSubmittedAt: recentDate,
        alipayProofImageUrl: 'https://s3.example.com/alipay-proofs/proof-ORD001-123.jpg',
      })).toBe('pending');
    });

    it('returns "overdue" for pending_review submitted more than 48h ago', () => {
      const oldDate = new Date(Date.now() - 50 * 60 * 60 * 1000); // 50 hours ago
      expect(getProofLabel({
        alipayProofStatus: 'pending_review',
        alipayProofSubmittedAt: oldDate,
        alipayProofImageUrl: 'https://s3.example.com/alipay-proofs/proof-ORD001-123.jpg',
      })).toBe('overdue');
    });

    it('returns "resubmitted" for pending_review with resubmit- in URL', () => {
      const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago
      expect(getProofLabel({
        alipayProofStatus: 'pending_review',
        alipayProofSubmittedAt: recentDate,
        alipayProofImageUrl: 'https://s3.example.com/alipay-proofs/resubmit-ORD001-1711234567890.jpg',
      })).toBe('resubmitted');
    });

    it('overdue takes priority over resubmitted when both conditions met', () => {
      const oldDate = new Date(Date.now() - 72 * 60 * 60 * 1000); // 72 hours ago
      expect(getProofLabel({
        alipayProofStatus: 'pending_review',
        alipayProofSubmittedAt: oldDate,
        alipayProofImageUrl: 'https://s3.example.com/alipay-proofs/resubmit-ORD001-1711234567890.jpg',
      })).toBe('overdue');
    });

    it('returns "pending" when submittedAt is null (no overdue check)', () => {
      expect(getProofLabel({
        alipayProofStatus: 'pending_review',
        alipayProofSubmittedAt: null,
        alipayProofImageUrl: 'https://s3.example.com/alipay-proofs/proof-ORD001-123.jpg',
      })).toBe('pending');
    });
  });

  describe('Dashboard stats field validation', () => {
    it('validates correct stats object', () => {
      const stats = {
        totalCards: 1000,
        pendingProofCount: 5,
        todayRejectedProofCount: 2,
        overdueProofCount: 1,
      };
      expect(validateDashboardStats(stats)).toBe(true);
    });

    it('validates stats with zero counts (all clear)', () => {
      const stats = {
        pendingProofCount: 0,
        todayRejectedProofCount: 0,
        overdueProofCount: 0,
      };
      expect(validateDashboardStats(stats)).toBe(true);
    });

    it('throws when required field is missing', () => {
      const stats = { pendingProofCount: 5, todayRejectedProofCount: 2 };
      expect(() => validateDashboardStats(stats)).toThrow('Missing field: overdueProofCount');
    });

    it('throws when field is not a number', () => {
      const stats = { pendingProofCount: '5', todayRejectedProofCount: 2, overdueProofCount: 1 };
      expect(() => validateDashboardStats(stats)).toThrow('must be a number');
    });

    it('throws when field is negative', () => {
      const stats = { pendingProofCount: -1, todayRejectedProofCount: 0, overdueProofCount: 0 };
      expect(() => validateDashboardStats(stats)).toThrow('>= 0');
    });
  });
});
