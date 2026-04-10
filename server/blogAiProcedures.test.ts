/**
 * AI 內容運營系統 - blogAiProcedures 測試
 * 測試五大技能的 schema 和基本邏輯
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock invokeLLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            // Strategy mock
            searchIntent: "用戶想了解 PSA 10 卡牌的市場價格",
            articleType: "價格追蹤",
            titleOptions: ["2024 PSA 10 市場分析", "PSA 10 收藏指南", "PSA 10 投資回報"],
            contentAngle: "從投資角度分析 PSA 10 的性價比",
            targetAudience: "香港 TCG 收藏家和投資者",
            ctaSuggestion: "查看最新成交記錄",
            contentCluster: "PSA 評級卡牌",
            estimatedLength: "中",
            keyPoints: ["PSA 10 溢價分析", "近期成交趨勢", "投資建議"],
            // Outline mock
            h1: "2024 PSA 10 市場完全指南",
            sections: [
              {
                h2: "什麼是 PSA 10？",
                description: "解釋 PSA 10 評級標準",
                hasImage: false,
                imageNote: "",
                subsections: [],
              },
            ],
            faq: [{ question: "PSA 10 值得投資嗎？", answerHint: "分析溢價和流動性" }],
            cta: "立即查看最新 PSA 10 成交記錄",
            estimatedWordCount: "1500-2000",
            // Section mock
            content: "## 什麼是 PSA 10？\n\nPSA 10 是最高評級...",
            wordCount: "250",
            dataUsed: ["PSA 10 溢價 35%"],
            // Proofread mock
            overallScore: "良好",
            overallComment: "文章整體品質良好，數據引用充分。",
            issues: [],
            seoAnalysis: {
              titleScore: "8",
              excerptScore: "7",
              keywordDensity: "適中",
              suggestions: ["增加長尾關鍵字"],
            },
            readabilityScore: "8",
            aiDetectionRisk: "低",
            quickFixes: ["優化標題加入年份", "補充更多具體數據"],
            // Research Brief mock
            coreInsights: ["近 30 天漲幅 25%", "成交量增加 40%"],
            keyDataPoints: ["最新成交價 HKD $5,000", "30 天漲幅 25%"],
            outlineSuggestion: ["市場概況", "價格分析", "投資建議"],
            dataLimitations: "數據僅來自 BOXIUM 平台",
            estimatedLength: "中",
            rawDataSummary: "近 30 天共 15 筆成交記錄",
            // Daily Report mock
            title: "2024-04-10 PTCG 市場快報",
            excerpt: "今日市場整體上漲，Charizard 系列表現亮眼。",
            tags: ["市場快報", "PTCG", "價格分析"],
            seoTitle: "2024-04-10 PTCG 市場快報 | BOXIUM",
            seoDescription: "今日 PTCG 市場行情，最新漲跌幅榜。",
            // Refresh mock
            needsRefresh: true,
            priority: "建議",
            reason: "文章發布超過 30 天，價格數據已過時",
            suggestions: [{ action: "更新價格", detail: "更新最新成交價格數據" }],
            estimatedImpact: "提升 SEO 排名和用戶參與度",
            contentAge: "時效性強",
          }),
        },
      },
    ],
  }),
}));

// Mock db module
vi.mock("./db", () => ({
  getCardById: vi.fn().mockResolvedValue({ id: 1, name: "Charizard", nameZh: "噴火龍" }),
  getCardPriceHistory: vi.fn().mockResolvedValue([
    { price: 5000, date: new Date() },
    { price: 5500, date: new Date() },
    { price: 6000, date: new Date() },
  ]),
  getMarketTrends: vi.fn().mockResolvedValue({ trend: "上漲" }),
  getTrendingByPriceIncrease: vi.fn().mockResolvedValue([
    { nameZh: "噴火龍", name: "Charizard", priceChangePercent: 25, oldPrice: 4000, currentPrice: 5000 },
  ]),
  getTrendingByPriceDecrease: vi.fn().mockResolvedValue([]),
  getMarketOverview: vi.fn().mockResolvedValue({
    totalCards: 1000,
    totalPriceRecords: 50000,
    avgPriceChange7d: 5.2,
  }),
}));

describe("blogAiProcedures", () => {
  describe("Schema validation", () => {
    it("should have all required procedures defined", async () => {
      const { blogAiRouter } = await import("./blogAiProcedures");
      expect(blogAiRouter).toBeDefined();

      // Check all 7 procedures exist
      const procedures = Object.keys(blogAiRouter._def.procedures);
      expect(procedures).toContain("generateStrategy");
      expect(procedures).toContain("generateOutline");
      expect(procedures).toContain("generateSection");
      expect(procedures).toContain("proofreadArticle");
      expect(procedures).toContain("suggestRefresh");
      expect(procedures).toContain("researchWithData");
      expect(procedures).toContain("generateDailyReport");
    });

    it("should have 7 total AI procedures", async () => {
      const { blogAiRouter } = await import("./blogAiProcedures");
      const procedures = Object.keys(blogAiRouter._def.procedures);
      expect(procedures.length).toBe(7);
    });
  });

  describe("Data-driven research skill", () => {
    it("researchWithData should accept topic and optional cardIds", async () => {
      const { blogAiRouter } = await import("./blogAiProcedures");
      const procedure = blogAiRouter._def.procedures.researchWithData;
      expect(procedure).toBeDefined();

      // Validate input schema
      const inputSchema = procedure._def.inputs[0];
      const validInput = inputSchema.parse({
        topic: "Charizard PSA 10 市場分析",
        cardIds: [1, 2, 3],
        days: 30,
        researchGoal: "price-analysis",
      });
      expect(validInput.topic).toBe("Charizard PSA 10 市場分析");
      expect(validInput.cardIds).toEqual([1, 2, 3]);
      expect(validInput.days).toBe(30);
    });

    it("researchWithData should use default values", async () => {
      const { blogAiRouter } = await import("./blogAiProcedures");
      const procedure = blogAiRouter._def.procedures.researchWithData;
      const inputSchema = procedure._def.inputs[0];
      const validInput = inputSchema.parse({ topic: "市場分析" });
      expect(validInput.days).toBe(30);
      expect(validInput.researchGoal).toBe("price-analysis");
    });
  });

  describe("Daily report skill", () => {
    it("generateDailyReport should accept reportType and days", async () => {
      const { blogAiRouter } = await import("./blogAiProcedures");
      const procedure = blogAiRouter._def.procedures.generateDailyReport;
      expect(procedure).toBeDefined();

      const inputSchema = procedure._def.inputs[0];
      const validInput = inputSchema.parse({ days: 1, reportType: "daily" });
      expect(validInput.reportType).toBe("daily");
      expect(validInput.days).toBe(1);
    });

    it("generateDailyReport should reject invalid reportType", async () => {
      const { blogAiRouter } = await import("./blogAiProcedures");
      const procedure = blogAiRouter._def.procedures.generateDailyReport;
      const inputSchema = procedure._def.inputs[0];
      expect(() => inputSchema.parse({ reportType: "invalid" })).toThrow();
    });
  });

  describe("Strategy skill", () => {
    it("generateStrategy should accept topic and optional fields", async () => {
      const { blogAiRouter } = await import("./blogAiProcedures");
      const procedure = blogAiRouter._def.procedures.generateStrategy;
      const inputSchema = procedure._def.inputs[0];
      const validInput = inputSchema.parse({
        topic: "PSA 10 市場分析",
        targetAudience: "香港收藏家",
        language: "zh-TW",
      });
      expect(validInput.topic).toBe("PSA 10 市場分析");
      expect(validInput.language).toBe("zh-TW");
    });
  });

  describe("Proofread skill", () => {
    it("proofreadArticle should require title and content", async () => {
      const { blogAiRouter } = await import("./blogAiProcedures");
      const procedure = blogAiRouter._def.procedures.proofreadArticle;
      const inputSchema = procedure._def.inputs[0];

      // Should fail without required fields
      expect(() => inputSchema.parse({})).toThrow();
      expect(() => inputSchema.parse({ title: "Test" })).toThrow();

      // Should succeed with required fields
      const validInput = inputSchema.parse({
        title: "Test Article",
        excerpt: "Test excerpt",
        content: "Test content",
      });
      expect(validInput.title).toBe("Test Article");
    });
  });

  describe("Refresh skill", () => {
    it("suggestRefresh should require all core fields", async () => {
      const { blogAiRouter } = await import("./blogAiProcedures");
      const procedure = blogAiRouter._def.procedures.suggestRefresh;
      const inputSchema = procedure._def.inputs[0];

      const validInput = inputSchema.parse({
        postId: 1,
        title: "Test Post",
        content: "Test content",
        publishedAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        viewCount: 150,
      });
      expect(validInput.postId).toBe(1);
      expect(validInput.viewCount).toBe(150);
    });
  });
});
