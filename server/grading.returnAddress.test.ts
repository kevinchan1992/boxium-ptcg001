/**
 * Tests for returnAddress functionality in grading submissions.
 * Verifies that returnAddress is correctly serialized/deserialized as JSON.
 */
import { describe, it, expect } from "vitest";

// ─── Helper: Simulate JSON serialization/deserialization ─────────────────────
function serializeReturnAddress(addr: Record<string, string | undefined> | null): string | null {
  if (!addr) return null;
  return JSON.stringify(addr);
}

function deserializeReturnAddress(json: string | null): Record<string, string> | null {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("returnAddress serialization", () => {
  it("should serialize a normal address to JSON string", () => {
    const addr = {
      recipientName: "陳大文",
      phone: "91234567",
      address: "九龍旺角彌敦道 123 號 5 樓 A 室",
      district: "旺角",
      region: "香港",
    };
    const json = serializeReturnAddress(addr);
    expect(json).toBeTruthy();
    expect(json).toContain("陳大文");
    expect(json).toContain("91234567");
  });

  it("should serialize an SF Express station address", () => {
    const addr = {
      recipientName: "李小明",
      phone: "98765432",
      address: "順豐站",
      district: "沙田",
      region: "香港",
      sfStationCode: "HK-0001",
      sfStationName: "沙田順豐站",
    };
    const json = serializeReturnAddress(addr);
    expect(json).toBeTruthy();
    const parsed = JSON.parse(json!);
    expect(parsed.sfStationCode).toBe("HK-0001");
    expect(parsed.sfStationName).toBe("沙田順豐站");
  });

  it("should deserialize JSON string back to object", () => {
    const original = {
      recipientName: "王小華",
      phone: "61234567",
      address: "新界東涌逸東邨 1 座 101 室",
      district: "東涌",
      region: "香港",
    };
    const json = serializeReturnAddress(original);
    const deserialized = deserializeReturnAddress(json);
    expect(deserialized).toEqual(original);
  });

  it("should return null for null input", () => {
    expect(serializeReturnAddress(null)).toBeNull();
    expect(deserializeReturnAddress(null)).toBeNull();
  });

  it("should return null for invalid JSON", () => {
    expect(deserializeReturnAddress("not-valid-json")).toBeNull();
  });

  it("should handle optional fields gracefully", () => {
    const addr = {
      recipientName: "張三",
      phone: "51234567",
      address: "香港島中環皇后大道中 1 號",
      region: "香港",
    };
    const json = serializeReturnAddress(addr);
    const parsed = deserializeReturnAddress(json);
    expect(parsed?.recipientName).toBe("張三");
    expect(parsed?.district).toBeUndefined();
    expect(parsed?.sfStationCode).toBeUndefined();
  });
});

describe("returnAddress display formatting", () => {
  it("should format address parts correctly", () => {
    const addr = {
      district: "旺角",
      region: "香港",
      address: "彌敦道 123 號",
    };
    const formatted = [addr.district, addr.region, addr.address].filter(Boolean).join(" ");
    expect(formatted).toBe("旺角 香港 彌敦道 123 號");
  });

  it("should handle missing district in formatting", () => {
    const addr = {
      district: "",
      region: "香港",
      address: "中環皇后大道中 1 號",
    };
    const formatted = [addr.district, addr.region, addr.address].filter(Boolean).join(" ");
    expect(formatted).toBe("香港 中環皇后大道中 1 號");
  });
});
