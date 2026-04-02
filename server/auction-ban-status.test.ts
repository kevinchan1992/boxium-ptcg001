import { describe, it, expect } from "vitest";

/**
 * Tests for auction ban status pre-check feature
 * Validates the logic for determining ban status from violations
 */

// Simulate the ban status logic from getMyBanStatus procedure
function computeBanStatus(violations: Array<{
  penalty: string;
  type: string;
  banExpiresAt: Date | null;
  createdAt: Date;
  adminNote: string | null;
}>) {
  const now = new Date();
  const penaltyOrder: Record<string, number> = { permanent: 0, ban_30d: 1, ban_7d: 2, warning: 3 };

  const activeBan = violations
    .filter(v => {
      if (v.penalty === 'permanent') return true;
      if ((v.penalty === 'ban_7d' || v.penalty === 'ban_30d') && v.banExpiresAt) {
        return new Date(v.banExpiresAt) > now;
      }
      return false;
    })
    .sort((a, b) => (penaltyOrder[a.penalty] ?? 9) - (penaltyOrder[b.penalty] ?? 9))[0];

  const warningCount = violations.filter(v => v.penalty === 'warning').length;
  const noPaymentCount = violations.filter(v => v.type === 'no_payment').length;

  if (!activeBan) {
    return { isBanned: false, warningCount, noPaymentCount, activeBan: null };
  }
  return {
    isBanned: true,
    warningCount,
    noPaymentCount,
    activeBan: {
      penalty: activeBan.penalty,
      type: activeBan.type,
      banExpiresAt: activeBan.banExpiresAt,
      adminNote: activeBan.adminNote,
    },
  };
}

describe("Auction Ban Status Pre-check", () => {
  it("returns not banned when no violations", () => {
    const result = computeBanStatus([]);
    expect(result.isBanned).toBe(false);
    expect(result.warningCount).toBe(0);
    expect(result.noPaymentCount).toBe(0);
    expect(result.activeBan).toBeNull();
  });

  it("returns not banned for warning-only violations", () => {
    const result = computeBanStatus([
      { penalty: 'warning', type: 'no_payment', banExpiresAt: null, createdAt: new Date(), adminNote: null },
      { penalty: 'warning', type: 'no_payment', banExpiresAt: null, createdAt: new Date(), adminNote: null },
    ]);
    expect(result.isBanned).toBe(false);
    expect(result.warningCount).toBe(2);
    expect(result.noPaymentCount).toBe(2);
  });

  it("returns banned for active 7-day ban", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const result = computeBanStatus([
      { penalty: 'ban_7d', type: 'no_payment', banExpiresAt: future, createdAt: new Date(), adminNote: null },
    ]);
    expect(result.isBanned).toBe(true);
    expect(result.activeBan?.penalty).toBe('ban_7d');
    expect(result.activeBan?.banExpiresAt).toEqual(future);
  });

  it("returns not banned for expired 7-day ban", () => {
    const past = new Date(Date.now() - 1000); // 1 second ago
    const result = computeBanStatus([
      { penalty: 'ban_7d', type: 'no_payment', banExpiresAt: past, createdAt: new Date(), adminNote: null },
    ]);
    expect(result.isBanned).toBe(false);
  });

  it("returns banned for active 30-day ban", () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const result = computeBanStatus([
      { penalty: 'ban_30d', type: 'no_payment', banExpiresAt: future, createdAt: new Date(), adminNote: null },
    ]);
    expect(result.isBanned).toBe(true);
    expect(result.activeBan?.penalty).toBe('ban_30d');
  });

  it("returns banned for permanent ban", () => {
    const result = computeBanStatus([
      { penalty: 'permanent', type: 'fake_bid', banExpiresAt: null, createdAt: new Date(), adminNote: 'Repeated violations' },
    ]);
    expect(result.isBanned).toBe(true);
    expect(result.activeBan?.penalty).toBe('permanent');
    expect(result.activeBan?.adminNote).toBe('Repeated violations');
  });

  it("selects most severe ban when multiple active bans exist", () => {
    const future7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const future30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const result = computeBanStatus([
      { penalty: 'ban_7d', type: 'no_payment', banExpiresAt: future7, createdAt: new Date(), adminNote: null },
      { penalty: 'ban_30d', type: 'no_payment', banExpiresAt: future30, createdAt: new Date(), adminNote: null },
    ]);
    expect(result.isBanned).toBe(true);
    expect(result.activeBan?.penalty).toBe('ban_30d'); // More severe takes priority
  });

  it("counts no_payment violations correctly", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const result = computeBanStatus([
      { penalty: 'warning', type: 'no_payment', banExpiresAt: null, createdAt: new Date(), adminNote: null },
      { penalty: 'warning', type: 'no_payment', banExpiresAt: null, createdAt: new Date(), adminNote: null },
      { penalty: 'ban_7d', type: 'no_payment', banExpiresAt: future, createdAt: new Date(), adminNote: null },
    ]);
    expect(result.noPaymentCount).toBe(3);
    expect(result.warningCount).toBe(2);
    expect(result.isBanned).toBe(true);
  });

  it("shows ban reason type correctly", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const result = computeBanStatus([
      { penalty: 'ban_7d', type: 'fake_bid', banExpiresAt: future, createdAt: new Date(), adminNote: null },
    ]);
    expect(result.activeBan?.type).toBe('fake_bid');
  });
});
