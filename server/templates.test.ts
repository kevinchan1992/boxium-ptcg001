import { describe, it, expect } from "vitest";
import { getAllTemplates, getTemplate, applyTemplate } from "./services/articleTemplates";
import { analyzeSEO, generateMetaDescription } from "./services/seoAnalyzer";

describe("Article Templates", () => {
  it("should return all available templates", () => {
    const templates = getAllTemplates();
    expect(templates).toHaveLength(4);
    expect(templates.map(t => t.id)).toContain("market-report");
    expect(templates.map(t => t.id)).toContain("card-review");
    expect(templates.map(t => t.id)).toContain("investment-guide");
    expect(templates.map(t => t.id)).toContain("news-brief");
  });

  it("should get template by ID", () => {
    const template = getTemplate("market-report");
    expect(template).not.toBeNull();
    expect(template?.name).toBe("市場快報");
    expect(template?.structure).toHaveProperty("titleFormat");
    expect(template?.structure).toHaveProperty("introduction");
    expect(template?.structure).toHaveProperty("mainSections");
    expect(template?.structure).toHaveProperty("conclusion");
  });

  it("should return null for invalid template ID", () => {
    const template = getTemplate("invalid-template");
    expect(template).toBeNull();
  });

  it("should apply template with variables", () => {
    const template = getTemplate("news-brief");
    expect(template).not.toBeNull();
    
    const variables = {
      newsTitle: "新卡發售公告",
      eventDate: "2026-02-21",
      source: "官方網站",
      impact: "價格上漲"
    };
    
    const content = applyTemplate(template!, variables);
    expect(content).toContain("新卡發售公告");
    expect(content).toContain("# 【快訊】新卡發售公告");
    expect(content).toContain("## 📰 事件詳情");
    expect(content).toContain("## 結論");
  });

  it("should have SEO guidelines in templates", () => {
    const template = getTemplate("card-review");
    expect(template).not.toBeNull();
    expect(template?.seoGuidelines).toHaveProperty("targetKeywordDensity");
    expect(template?.seoGuidelines).toHaveProperty("titleLength");
    expect(template?.seoGuidelines).toHaveProperty("metaDescLength");
    expect(template?.seoGuidelines).toHaveProperty("headingStructure");
    expect(template?.seoGuidelines.targetKeywordDensity).toBeGreaterThan(0);
  });
});

describe("SEO Analyzer", () => {
  it("should analyze article and return SEO score", () => {
    const title = "寶可夢卡牌投資完全指南：如何選擇高價值卡牌";
    const content = `
# 寶可夢卡牌投資完全指南

## 基礎知識

寶可夢卡牌投資是一個充滿機會的領域。本文將介紹如何選擇高價值卡牌，幫助您做出明智的投資決策。

## 投資策略

1. 研究市場趨勢
2. 關注稀有度和人氣
3. 分散投資組合

## 案例分析

以皮卡丘 HR 卡為例，該卡在過去一年內價格上漲了 150%。這是因為該卡的稀有度高，且皮卡丘是最受歡迎的寶可夢之一。

## 專家建議

專家建議新手投資者從中低價位的卡牌開始，逐步建立投資經驗。

## 常見誤區

許多新手投資者會犯的錯誤包括：盲目跟風、忽視卡牌狀態、過度集中投資等。

## 結論

寶可夢卡牌投資需要耐心和研究。通過本指南的學習，您將能夠做出更明智的投資決策。
    `;
    const metaDescription = "了解寶可夢卡牌投資的完全指南，學習如何選擇高價值卡牌，掌握投資策略和專家建議，避免常見誤區，做出明智的投資決策。";

    const analysis = analyzeSEO(title, content, metaDescription);

    expect(analysis).toHaveProperty("score");
    expect(analysis.score).toBeGreaterThanOrEqual(0);
    expect(analysis.score).toBeLessThanOrEqual(100);
    expect(analysis).toHaveProperty("keywords");
    expect(analysis).toHaveProperty("title");
    expect(analysis).toHaveProperty("metaDescription");
    expect(analysis).toHaveProperty("content");
    expect(analysis).toHaveProperty("overallSuggestions");
  });

  it("should analyze keywords and density", () => {
    const content = `
寶可夢卡牌投資是一個重要的話題。寶可夢卡牌的價值取決於多個因素。
投資者應該了解寶可夢卡牌市場的趨勢。寶可夢卡牌投資需要考慮多個方面。
寶可夢卡牌的收藏價值和投資價值不同。投資寶可夢卡牌需要耐心。
    `;
    const analysis = analyzeSEO("寶可夢卡牌投資指南", content, "");

    expect(analysis.keywords.primary.length).toBeGreaterThan(0);
    expect(analysis.keywords.density).toBeTruthy();
    // Check that top keywords have positive density
    const topKeyword = analysis.keywords.primary[0];
    expect(analysis.keywords.density[topKeyword]).toBeGreaterThan(0);
  });

  it("should analyze title length", () => {
    const shortTitle = "短標題";
    const goodTitle = "寶可夢卡牌投資完全指南：如何選擇高價值卡牌並避免常見誤區";
    const longTitle = "這是一個非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常長的標題";

    const shortAnalysis = analyzeSEO(shortTitle, "content", "");
    const goodAnalysis = analyzeSEO(goodTitle, "content", "");
    const longAnalysis = analyzeSEO(longTitle, "content", "");

    expect(shortAnalysis.title.suggestions.length).toBeGreaterThan(0);
    expect(goodAnalysis.title.score).toBeGreaterThan(shortAnalysis.title.score);
    expect(longAnalysis.title.suggestions.length).toBeGreaterThan(0);
  });

  it("should analyze meta description", () => {
    const noMeta = "";
    const shortMeta = "太短的描述";
    const goodMeta = "這是一個長度適中的 meta 描述，包含了足夠的信息來吸引用戶點擊，同時也不會太長而被搜索引擎截斷。了解更多關於寶可夢卡牌投資的信息。";
    const longMeta = "這是一個非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常長的 meta 描述";

    const noMetaAnalysis = analyzeSEO("Title", "content", noMeta);
    const shortMetaAnalysis = analyzeSEO("Title", "content", shortMeta);
    const goodMetaAnalysis = analyzeSEO("Title", "content", goodMeta);
    const longMetaAnalysis = analyzeSEO("Title", "content", longMeta);

    expect(noMetaAnalysis.metaDescription.score).toBe(0);
    expect(shortMetaAnalysis.metaDescription.suggestions.length).toBeGreaterThan(0);
    expect(goodMetaAnalysis.metaDescription.score).toBeGreaterThan(shortMetaAnalysis.metaDescription.score);
    expect(longMetaAnalysis.metaDescription.suggestions.length).toBeGreaterThan(0);
  });

  it("should analyze content structure", () => {
    const poorContent = "這是一段沒有結構的短文本。";
    const goodContent = `
# 主標題

## 第一部分

這是第一部分的內容。包含多個段落。

這是第二個段落。

## 第二部分

這是第二部分的內容。

### 子標題

這是子標題下的內容。
    `;

    const poorAnalysis = analyzeSEO("Title", poorContent, "");
    const goodAnalysis = analyzeSEO("Title", goodContent, "");

    expect(poorAnalysis.content.suggestions.length).toBeGreaterThan(0);
    expect(goodAnalysis.content.headingStructure.length).toBeGreaterThan(0);
    expect(goodAnalysis.content.readabilityScore).toBeGreaterThan(poorAnalysis.content.readabilityScore);
  });

  it("should generate meta description from content", () => {
    const content = `
# 標題

這是文章的第一段，包含了文章的主要內容和重點。這段內容應該足夠長，能夠提取出一個好的 meta 描述。

這是第二段內容。
    `;

    const metaDesc = generateMetaDescription(content, 160);
    expect(metaDesc).toBeTruthy();
    expect(metaDesc.length).toBeLessThanOrEqual(160);
    expect(metaDesc).toContain("文章的主要內容");
  });

  it("should calculate overall SEO score", () => {
    const goodTitle = "寶可夢卡牌投資完全指南：如何選擇高價值卡牌";
    const goodContent = `
# 寶可夢卡牌投資完全指南

## 基礎知識

寶可夢卡牌投資是一個充滿機會的領域。本文將介紹如何選擇高價值卡牌。

## 投資策略

研究市場趨勢，關注稀有度和人氣，分散投資組合。

## 案例分析

以皮卡丘 HR 卡為例，該卡在過去一年內價格上漲了 150%。

## 結論

寶可夢卡牌投資需要耐心和研究。
    `;
    const goodMeta = "了解寶可夢卡牌投資的完全指南，學習如何選擇高價值卡牌，掌握投資策略和專家建議，做出明智的投資決策。";

    const analysis = analyzeSEO(goodTitle, goodContent, goodMeta);
    expect(analysis.score).toBeGreaterThan(60); // Should have a decent score
  });
});
