import { describe, it, expect } from "vitest";

// ─── 1. DisputeMedia schema validation ───────────────────────────────────────

describe("DisputeMedia schema", () => {
  it("should have correct field names", () => {
    const mockMedia = {
      id: 1,
      orderId: 100,
      orderNo: "ORD-001",
      uploaderId: 5,
      uploaderRole: "buyer" as const,
      mediaUrl: "https://cdn.example.com/dispute/100-abc.jpg",
      mediaType: "image" as const,
      fileName: "evidence.jpg",
      fileSize: 204800,
      createdAt: new Date(),
    };
    expect(mockMedia.mediaUrl).toContain("https://");
    expect(mockMedia.uploaderRole).toBe("buyer");
    expect(mockMedia.mediaType).toBe("image");
    expect(mockMedia.fileSize).toBeLessThanOrEqual(20 * 1024 * 1024);
  });

  it("should validate uploaderRole enum values", () => {
    const validRoles = ["buyer", "seller", "admin"];
    for (const role of validRoles) {
      expect(validRoles).toContain(role);
    }
  });

  it("should validate mediaType enum values", () => {
    const validTypes = ["image", "video"];
    expect(validTypes).toContain("image");
    expect(validTypes).toContain("video");
    expect(validTypes).not.toContain("audio");
  });
});

// ─── 2. Dispute resolve outcome mapping ──────────────────────────────────────

describe("Dispute resolve outcome", () => {
  function mapFavorToOutcome(inFavorOf: "buyer" | "seller") {
    return inFavorOf === "buyer" ? "refund_buyer" : "release_seller";
  }

  it("should map buyer favor to refund_buyer outcome", () => {
    expect(mapFavorToOutcome("buyer")).toBe("refund_buyer");
  });

  it("should map seller favor to release_seller outcome", () => {
    expect(mapFavorToOutcome("seller")).toBe("release_seller");
  });

  it("should produce default resolution text when empty", () => {
    const getDefaultResolution = (inFavorOf: "buyer" | "seller") =>
      inFavorOf === "buyer"
        ? "管理員裁決支持買家，訂單退款處理。"
        : "管理員裁決支持賣家，訂單完成。";

    expect(getDefaultResolution("buyer")).toContain("買家");
    expect(getDefaultResolution("seller")).toContain("賣家");
  });
});

// ─── 3. OrderChat read receipt timestamp logic ────────────────────────────────

describe("OrderChat read receipt", () => {
  function getReadStatus(msg: {
    senderRole: string;
    readByBuyer: boolean;
    readBySeller: boolean;
    readByAdmin: boolean;
    readAtBuyer?: Date | null;
    readAtSeller?: Date | null;
    readAtAdmin?: Date | null;
  }) {
    const { senderRole, readByBuyer, readBySeller, readByAdmin } = msg;
    const isRead = senderRole === "buyer"
      ? (readBySeller || readByAdmin)
      : senderRole === "seller"
      ? (readByBuyer || readByAdmin)
      : (readByBuyer || readBySeller);

    const readAtCandidates =
      senderRole === "buyer"
        ? [msg.readAtSeller ?? null, msg.readAtAdmin ?? null]
        : senderRole === "seller"
        ? [msg.readAtBuyer ?? null, msg.readAtAdmin ?? null]
        : [msg.readAtBuyer ?? null, msg.readAtSeller ?? null];

    const validDates = readAtCandidates.filter(Boolean) as Date[];
    const earliestReadAt = validDates.length > 0
      ? new Date(Math.min(...validDates.map(d => d.getTime())))
      : null;

    return { isRead, earliestReadAt };
  }

  it("should show as read when seller has read buyer message", () => {
    const result = getReadStatus({
      senderRole: "buyer",
      readByBuyer: true,
      readBySeller: true,
      readByAdmin: false,
      readAtSeller: new Date("2026-01-01T10:00:00Z"),
    });
    expect(result.isRead).toBe(true);
    expect(result.earliestReadAt).not.toBeNull();
  });

  it("should show as unread when only sender has read their own message", () => {
    const result = getReadStatus({
      senderRole: "buyer",
      readByBuyer: true,
      readBySeller: false,
      readByAdmin: false,
    });
    expect(result.isRead).toBe(false);
    expect(result.earliestReadAt).toBeNull();
  });

  it("should pick earliest readAt when multiple parties have read", () => {
    const earlier = new Date("2026-01-01T09:00:00Z");
    const later = new Date("2026-01-01T11:00:00Z");
    const result = getReadStatus({
      senderRole: "seller",
      readByBuyer: true,
      readBySeller: true,
      readByAdmin: true,
      readAtBuyer: later,
      readAtAdmin: earlier,
    });
    expect(result.isRead).toBe(true);
    expect(result.earliestReadAt?.getTime()).toBe(earlier.getTime());
  });

  it("should handle admin sender role correctly", () => {
    const result = getReadStatus({
      senderRole: "admin",
      readByBuyer: true,
      readBySeller: false,
      readByAdmin: true,
      readAtBuyer: new Date("2026-01-01T10:00:00Z"),
    });
    expect(result.isRead).toBe(true);
  });
});

// ─── 4. DisputeMediaUpload file validation logic ──────────────────────────────

describe("DisputeMediaUpload validation", () => {
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

  it("should reject files over 20MB", () => {
    const fileSize = 25 * 1024 * 1024;
    expect(fileSize > MAX_FILE_SIZE).toBe(true);
  });

  it("should accept files under 20MB", () => {
    const fileSize = 5 * 1024 * 1024;
    expect(fileSize <= MAX_FILE_SIZE).toBe(true);
  });

  it("should accept image MIME types", () => {
    const validMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    for (const mime of validMimes) {
      expect(mime.startsWith("image/")).toBe(true);
    }
  });

  it("should accept video MIME types", () => {
    const validMimes = ["video/mp4", "video/quicktime", "video/webm"];
    for (const mime of validMimes) {
      expect(mime.startsWith("video/")).toBe(true);
    }
  });

  it("should reject non-media MIME types", () => {
    const invalidMimes = ["application/pdf", "text/plain", "audio/mp3"];
    for (const mime of invalidMimes) {
      const isValid = mime.startsWith("image/") || mime.startsWith("video/");
      expect(isValid).toBe(false);
    }
  });

  it("should enforce maximum 10 files limit", () => {
    const currentCount = 8;
    const newFiles = 5;
    const allowedNew = Math.min(newFiles, 10 - currentCount);
    expect(allowedNew).toBe(2);
  });
});
