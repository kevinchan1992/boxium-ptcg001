/**
 * Article Template System
 * Provides predefined templates for consistent article generation
 */

export interface ArticleTemplate {
  id: string;
  name: string;
  description: string;
  structure: {
    titleFormat: string;
    introduction: string;
    mainSections: string[];
    conclusion: string;
  };
  variables: string[]; // Available variables like {cardName}, {price}, {date}
  seoGuidelines: {
    targetKeywordDensity: number; // 2-3%
    titleLength: { min: number; max: number }; // 50-60 chars
    metaDescLength: { min: number; max: number }; // 150-160 chars
    headingStructure: string[]; // ["H1", "H2", "H3"]
  };
}

/**
 * Predefined article templates
 */
export const ARTICLE_TEMPLATES: Record<string, ArticleTemplate> = {
  "market-report": {
    id: "market-report",
    name: "市場快報",
    description: "每日市場動態和價格趨勢報告",
    structure: {
      titleFormat: "{date} TCG 卡牌市場快報：{mainTopic}",
      introduction: "今日市場概況：簡述當日主要市場動態和值得關注的卡牌。",
      mainSections: [
        "## 📈 價格漲幅榜\n列出今日漲幅最大的卡牌，分析漲價原因。",
        "## 📉 價格跌幅榜\n列出今日跌幅最大的卡牌，分析跌價原因。",
        "## 🔥 熱門交易\n分析今日交易量最大的卡牌和市場熱度。",
        "## 💡 投資建議\n基於當日數據，提供短期和長期投資建議。"
      ],
      conclusion: "總結當日市場趨勢，展望未來走勢。"
    },
    variables: ["date", "mainTopic", "topGainers", "topLosers", "hotCards"],
    seoGuidelines: {
      targetKeywordDensity: 2.5,
      titleLength: { min: 50, max: 60 },
      metaDescLength: { min: 150, max: 160 },
      headingStructure: ["H1", "H2", "H3"]
    }
  },
  
  "card-review": {
    id: "card-review",
    name: "卡牌評測",
    description: "深度卡牌分析和投資價值評估",
    structure: {
      titleFormat: "{cardName} 深度評測：{aspect}分析",
      introduction: "介紹卡牌基本信息（系列、稀有度、發行時間）和評測目的。",
      mainSections: [
        "## 🎴 卡牌基本資料\n詳細列出卡牌的系列、編號、稀有度、藝術家等信息。",
        "## 💰 價格走勢分析\n分析歷史價格數據，展示價格圖表和趨勢。",
        "## 🎨 收藏價值評估\n從藝術性、稀有度、人氣等角度評估收藏價值。",
        "## 📊 投資潛力分析\n分析供需關係、市場熱度、未來升值空間。",
        "## ⚠️ 風險提示\n指出投資風險和注意事項。"
      ],
      conclusion: "總結評測結果，給出明確的投資建議（買入/持有/觀望）。"
    },
    variables: ["cardName", "aspect", "series", "rarity", "currentPrice", "priceHistory"],
    seoGuidelines: {
      targetKeywordDensity: 3.0,
      titleLength: { min: 45, max: 55 },
      metaDescLength: { min: 150, max: 160 },
      headingStructure: ["H1", "H2", "H3"]
    }
  },
  
  "investment-guide": {
    id: "investment-guide",
    name: "投資指南",
    description: "投資策略和市場分析指南",
    structure: {
      titleFormat: "{topic}：TCG 卡牌投資完全指南",
      introduction: "說明投資主題的重要性和本指南的目標讀者。",
      mainSections: [
        "## 📚 基礎知識\n介紹相關的基礎概念和術語。",
        "## 🎯 投資策略\n詳細說明具體的投資策略和操作方法。",
        "## 📈 案例分析\n通過實際案例展示策略的應用。",
        "## 💡 專家建議\n提供專業的投資建議和經驗分享。",
        "## ⚠️ 常見誤區\n指出新手常犯的錯誤和避免方法。"
      ],
      conclusion: "總結關鍵要點，鼓勵讀者實踐並持續學習。"
    },
    variables: ["topic", "targetAudience", "keyStrategies", "caseStudies"],
    seoGuidelines: {
      targetKeywordDensity: 2.0,
      titleLength: { min: 50, max: 65 },
      metaDescLength: { min: 155, max: 165 },
      headingStructure: ["H1", "H2", "H3", "H4"]
    }
  },
  
  "news-brief": {
    id: "news-brief",
    name: "新聞快訊",
    description: "及時報導行業新聞和重要事件",
    structure: {
      titleFormat: "【快訊】{newsTitle}",
      introduction: "簡潔地概述新聞事件的核心內容（5W1H）。",
      mainSections: [
        "## 📰 事件詳情\n詳細報導事件的來龍去脈。",
        "## 💬 市場反應\n分析市場和玩家社群的反應。",
        "## 📊 影響分析\n評估事件對市場價格和趨勢的影響。",
        "## 🔮 未來展望\n預測事件的後續發展和長期影響。"
      ],
      conclusion: "總結新聞要點，提醒讀者關注後續動態。"
    },
    variables: ["newsTitle", "eventDate", "source", "impact"],
    seoGuidelines: {
      targetKeywordDensity: 2.5,
      titleLength: { min: 40, max: 50 },
      metaDescLength: { min: 145, max: 155 },
      headingStructure: ["H1", "H2"]
    }
  }
};

/**
 * Get template by ID
 */
export function getTemplate(templateId: string): ArticleTemplate | null {
  return ARTICLE_TEMPLATES[templateId] || null;
}

/**
 * Get all available templates
 */
export function getAllTemplates(): ArticleTemplate[] {
  return Object.values(ARTICLE_TEMPLATES);
}

/**
 * Apply template to generate article structure
 */
export function applyTemplate(
  template: ArticleTemplate,
  variables: Record<string, string>
): string {
  let structure = `# ${replaceVariables(template.structure.titleFormat, variables)}\n\n`;
  structure += `${replaceVariables(template.structure.introduction, variables)}\n\n`;
  
  for (const section of template.structure.mainSections) {
    structure += `${replaceVariables(section, variables)}\n\n`;
  }
  
  structure += `## 結論\n\n${replaceVariables(template.structure.conclusion, variables)}`;
  
  return structure;
}

/**
 * Replace template variables with actual values
 */
function replaceVariables(text: string, variables: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}
