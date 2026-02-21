import { describe, it, expect } from "vitest";

describe("Google OAuth Configuration", () => {
  it("should have valid Google OAuth credentials", () => {
    // 檢查環境變數是否存在
    expect(process.env.GOOGLE_CLIENT_ID).toBeDefined();
    expect(process.env.GOOGLE_CLIENT_SECRET).toBeDefined();

    // 檢查 Client ID 格式（應該是 Google 的標準格式）
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    expect(clientId).toMatch(/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/);

    // 檢查 Client Secret 格式（應該是 GOCSPX- 開頭）
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    expect(clientSecret).toMatch(/^GOCSPX-[a-zA-Z0-9_-]+$/);

    // 檢查長度合理性
    expect(clientId.length).toBeGreaterThan(30);
    expect(clientSecret.length).toBeGreaterThan(20);
  });
});
