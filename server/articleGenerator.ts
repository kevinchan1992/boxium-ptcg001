import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { cards, priceHistory } from "../drizzle/schema_new";
import { eq, inArray, gte, desc, and, sql } from "drizzle-orm";

/**
 * Price statistics for a single card
 */
export interface CardPriceStats {
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  priceChange7d: number;
  priceChange30d: number;
  priceChange60d: number;
  totalVolume: number;
  avgDailyVolume: number;
}

/**
 * Article data context for AI generation
 * NEW: Each card now has its own price statistics
 */
export interface ArticleDataContext {
  cards: Array<{
    id: number;
    name: string;
    nameJa: string | null;
    series: string | null;
    setName: string | null;
    cardNumber: string | null;
    rarity: string | null;
    imageUrl: string | null;
    // NEW: Individual price statistics for each card
    psa10Stats: CardPriceStats;
    usedGradeAStats: CardPriceStats;
    peakPrice: number;
    peakDate: Date | null;
  }>;
  // DEPRECATED: Global aggregated stats (kept for backward compatibility)
  psa10Stats: {
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    priceChange7d: number;
    priceChange30d: number;
    priceChange60d: number;
    totalVolume: number;
    avgDailyVolume: number;
  };
  usedGradeAStats: {
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    priceChange7d: number;
    priceChange30d: number;
    priceChange60d: number;
    totalVolume: number;
    avgDailyVolume: number;
  };
  transactionStats: {
    peakPrice: number;
    peakDate: Date | null;
  };
}

/**
 * Calculate price statistics for a single card
 */
async function calculateCardPriceStats(
  db: any,
  cardId: number,
  grade: 'PSA10' | 'A',
  timeRange: '7d' | '30d' | '60d' | 'all'
): Promise<CardPriceStats> {
  const daysMap = { '7d': 7, '30d': 30, '60d': 60, 'all': 365 * 10 };
  const days = daysMap[timeRange];
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Query price history for this card
  const priceData = await db.select({
    price: priceHistory.price,
    soldAt: priceHistory.soldAt,
  }).from(priceHistory)
    .where(
      and(
        eq(priceHistory.cardId, cardId),
        eq(priceHistory.source, 'snkrdunk'),
        eq(priceHistory.grade, grade),
        gte(priceHistory.soldAt, startDate)
      )
    )
    .orderBy(desc(priceHistory.soldAt));

  // Calculate statistics
  const prices = priceData.map((p: { price: string }) => parseFloat(p.price));
  const avgPrice = prices.length > 0 ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : 0;
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const priceChange7d = calculatePriceChange(priceData, 7);
  const priceChange30d = calculatePriceChange(priceData, 30);
  const priceChange60d = calculatePriceChange(priceData, 60);
  const totalVolume = priceData.length;
  const avgDailyVolume = totalVolume / days;

  return {
    avgPrice,
    minPrice,
    maxPrice,
    priceChange7d,
    priceChange30d,
    priceChange60d,
    totalVolume,
    avgDailyVolume,
  };
}

/**
 * Get article data context from database
 * NEW: Calculates individual price statistics for each card
 */
export async function getArticleDataContext(
  cardIds: number[],
  timeRange: '7d' | '30d' | '60d' | 'all' = '30d'
): Promise<ArticleDataContext> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // 1. Query card basic info
  const cardData = await db.select({
    id: cards.id,
    name: cards.name,
    nameJa: cards.nameJa,
    series: cards.series,
    setName: cards.setName,
    cardNumber: cards.cardNumber,
    rarity: cards.rarity,
    imageUrl: cards.imageUrl,
  }).from(cards).where(inArray(cards.id, cardIds));

  // 2. Calculate individual price statistics for each card
  const cardsWithStats = await Promise.all(
    cardData.map(async (card) => {
      const psa10Stats = await calculateCardPriceStats(db, card.id, 'PSA10', timeRange);
      const usedGradeAStats = await calculateCardPriceStats(db, card.id, 'A', timeRange);
      
      // Calculate peak price for this card
      const peakPrice = Math.max(psa10Stats.maxPrice, usedGradeAStats.maxPrice);
      
      // Get peak date (most recent transaction)
      const peakDateQuery = await db.select({
        soldAt: priceHistory.soldAt,
      }).from(priceHistory)
        .where(
          and(
            eq(priceHistory.cardId, card.id),
            eq(priceHistory.source, 'snkrdunk')
          )
        )
        .orderBy(desc(priceHistory.soldAt))
        .limit(1);
      
      const peakDate = peakDateQuery.length > 0 ? peakDateQuery[0].soldAt : null;

      return {
        ...card,
        psa10Stats,
        usedGradeAStats,
        peakPrice,
        peakDate,
      };
    })
  );

  // 3. Calculate global aggregated statistics (for backward compatibility)
  const daysMap = { '7d': 7, '30d': 30, '60d': 60, 'all': 365 * 10 };
  const days = daysMap[timeRange];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Query all PSA10 transactions
  const psa10Data = await db.select({
    price: priceHistory.price,
    soldAt: priceHistory.soldAt,
  }).from(priceHistory)
    .where(
      and(
        inArray(priceHistory.cardId, cardIds),
        eq(priceHistory.source, 'snkrdunk'),
        eq(priceHistory.grade, 'PSA10'),
        gte(priceHistory.soldAt, startDate)
      )
    )
    .orderBy(desc(priceHistory.soldAt));

  // Query all Grade A transactions
  const usedGradeAData = await db.select({
    price: priceHistory.price,
    soldAt: priceHistory.soldAt,
  }).from(priceHistory)
    .where(
      and(
        inArray(priceHistory.cardId, cardIds),
        eq(priceHistory.source, 'snkrdunk'),
        eq(priceHistory.grade, 'A'),
        gte(priceHistory.soldAt, startDate)
      )
    )
    .orderBy(desc(priceHistory.soldAt));

  // Calculate global PSA10 statistics
  const psa10Prices = psa10Data.map(p => parseFloat(p.price));
  const psa10AvgPrice = psa10Prices.length > 0 ? psa10Prices.reduce((a, b) => a + b, 0) / psa10Prices.length : 0;
  const psa10MinPrice = psa10Prices.length > 0 ? Math.min(...psa10Prices) : 0;
  const psa10MaxPrice = psa10Prices.length > 0 ? Math.max(...psa10Prices) : 0;
  const psa10Change7d = calculatePriceChange(psa10Data, 7);
  const psa10Change30d = calculatePriceChange(psa10Data, 30);
  const psa10Change60d = calculatePriceChange(psa10Data, 60);
  const psa10TotalVolume = psa10Data.length;
  const psa10AvgDailyVolume = psa10TotalVolume / days;

  // Calculate global Grade A statistics
  const usedGradeAPrices = usedGradeAData.map(p => parseFloat(p.price));
  const usedGradeAAvgPrice = usedGradeAPrices.length > 0 ? usedGradeAPrices.reduce((a, b) => a + b, 0) / usedGradeAPrices.length : 0;
  const usedGradeAMinPrice = usedGradeAPrices.length > 0 ? Math.min(...usedGradeAPrices) : 0;
  const usedGradeAMaxPrice = usedGradeAPrices.length > 0 ? Math.max(...usedGradeAPrices) : 0;
  const usedGradeAChange7d = calculatePriceChange(usedGradeAData, 7);
  const usedGradeAChange30d = calculatePriceChange(usedGradeAData, 30);
  const usedGradeAChange60d = calculatePriceChange(usedGradeAData, 60);
  const usedGradeATotalVolume = usedGradeAData.length;
  const usedGradeAAvgDailyVolume = usedGradeATotalVolume / days;

  // Calculate global transaction statistics
  const peakPrice = Math.max(psa10MaxPrice, usedGradeAMaxPrice);
  const peakDate = psa10Data.length > 0 ? psa10Data[0].soldAt : (usedGradeAData.length > 0 ? usedGradeAData[0].soldAt : null);

  return {
    cards: cardsWithStats,
    psa10Stats: {
      avgPrice: psa10AvgPrice,
      minPrice: psa10MinPrice,
      maxPrice: psa10MaxPrice,
      priceChange7d: psa10Change7d,
      priceChange30d: psa10Change30d,
      priceChange60d: psa10Change60d,
      totalVolume: psa10TotalVolume,
      avgDailyVolume: psa10AvgDailyVolume,
    },
    usedGradeAStats: {
      avgPrice: usedGradeAAvgPrice,
      minPrice: usedGradeAMinPrice,
      maxPrice: usedGradeAMaxPrice,
      priceChange7d: usedGradeAChange7d,
      priceChange30d: usedGradeAChange30d,
      priceChange60d: usedGradeAChange60d,
      totalVolume: usedGradeATotalVolume,
      avgDailyVolume: usedGradeAAvgDailyVolume,
    },
    transactionStats: {
      peakPrice,
      peakDate,
    },
  };
}

/**
 * Calculate price change percentage
 */
function calculatePriceChange(
  priceData: Array<{ price: string; soldAt: Date | null }>,
  days: number
): number {
  if (priceData.length < 2) return 0;

  const now = new Date();
  const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const recentPrices = priceData.filter(p => p.soldAt && p.soldAt >= cutoffDate);
  const oldPrices = priceData.filter(p => p.soldAt && p.soldAt < cutoffDate);

  if (recentPrices.length === 0 || oldPrices.length === 0) return 0;

  const recentAvg = recentPrices.reduce((sum, p) => sum + parseFloat(p.price), 0) / recentPrices.length;
  const oldAvg = oldPrices.reduce((sum, p) => sum + parseFloat(p.price), 0) / oldPrices.length;

  return ((recentAvg - oldAvg) / oldAvg) * 100;
}

/**
 * Article generation options
 */
export interface ArticleGenerationOptions {
  articleType: 'daily-report' | 'card-analysis' | 'market-trend' | 'news';
  dataInput?: {
    cardIds?: number[];
    timeRange?: '7d' | '30d' | '60d' | 'all';
    topic?: string;
  };
  imageInput?: {
    imageUrls: string[];
    extractedText?: string;
  };
  textInput?: {
    content: string;
    topic: string;
  };
  options?: {
    language?: 'zh-TW' | 'en' | 'ja';
    tone?: 'professional' | 'casual' | 'technical';
    length?: 'short' | 'medium' | 'long';
  };
}

/**
 * Generated article result
 */
export interface GeneratedArticle {
  title: string;
  excerpt: string;
  content: string;
  suggestedTags: string[];
  suggestedCategory: string;
  featuredImage?: string;
  seoMetadata: {
    metaTitle: string;
    metaDescription: string;
    keywords: string[];
  };
}

/**
 * Build AI prompt for article generation
 */
function buildArticlePrompt(
  articleType: string,
  dataContext: ArticleDataContext | null,
  userInput: string,
  options: ArticleGenerationOptions['options']
): string {
  const language = options?.language || 'zh-TW';
  const tone = options?.tone || 'professional';
  const length = options?.length || 'medium';

  const lengthMap = {
    short: '600-1000字',
    medium: '1200-1800字',
    long: '2000-3000字',
  };

  // Get current date
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDate = now.getDate();
  const currentDateStr = `${currentYear}年${currentMonth}月${currentDate}日`;

  let prompt = `你是 BOXIUM PTCG 的專業內容創作者，負責撰寫 Pokémon TCG 相關文章。\n\n【重要】本網站主要服務香港地區用戶，所有價格和金錢相關內容必須使用港幣（HKD）為預設貨幣單位。\n\n`;
  prompt += `【當前日期】${currentDateStr}\n\n`;
  prompt += `**重要：所有文章標題和內容中的日期、年份、月份必須使用當前日期（${currentYear}年${currentMonth}月），不要使用過去的年份（例如 2024年、2025年）。**\n\n`;

  // Add article type specific instructions
  if (articleType === 'daily-report') {
    prompt += `【文章類型】每日市場快報\n\n`;
    prompt += `【要求】\n`;
    prompt += `1. 生成吸引人的標題（格式：「MM/DD TCG 快報 🔥 | 主要亮點」）\n`;
    prompt += `2. 使用專業但易懂的語言\n`;
    prompt += `3. 突出價格變化最大的卡牌\n`;
    prompt += `4. 提供市場趨勢分析和投資建議\n`;
  } else if (articleType === 'card-analysis') {
    prompt += `【文章類型】卡牌深度研究\n\n`;
    prompt += `【要求】\n`;
    prompt += `1. 生成專業的標題（格式：「{卡牌名稱}：市場分析與投資價值研究」）\n`;
    prompt += `2. 分析價格走勢的原因（供需、市場熱度、稀有度等）\n`;
    prompt += `3. 提供不同評級的投資建議\n`;
    prompt += `4. 預測未來價格趨勢\n`;
  } else if (articleType === 'market-trend') {
    prompt += `【文章類型】市場趨勢報告\n\n`;
    prompt += `【要求】\n`;
    prompt += `1. 生成專業的標題（格式：「{時間段} Pokémon TCG 市場趨勢報告」）\n`;
    prompt += `2. 分析市場整體走勢（牛市/熊市/震盪）\n`;
    prompt += `3. 識別投資機會和風險\n`;
    prompt += `4. 提供具體的投資策略建議\n`;
  } else if (articleType === 'news') {
    prompt += `【文章類型】新聞快訊\n\n`;
    prompt += `【要求】\n`;
    prompt += `1. 生成吸引眼球的標題（15-30字）\n`;
    prompt += `2. 快速傳達核心資訊\n`;
    prompt += `3. 如果涉及價格變化，引用平台數據\n`;
    prompt += `4. 分析對市場的影響\n`;
  }

  // Add data context if available
  if (dataContext && dataContext.cards.length > 0) {
    prompt += `\n【卡牌資訊與價格數據】\n`;
    prompt += `**重要：以下是系統為每張卡牌提供的完整資訊和價格數據，文章中必須使用這些數據，不可以創造或估算任何價格**\n\n`;
    
    // NEW: Provide individual price data for each card
    dataContext.cards.forEach((card, index) => {
      prompt += `\n### 卡牌 ${index + 1}: ${card.name}${card.nameJa ? ` (${card.nameJa})` : ''}\n`;
      if (card.cardNumber) prompt += `- 編號：${card.cardNumber}\n`;
      if (card.series) prompt += `- 系列：${card.series}\n`;
      if (card.setName) prompt += `- 套裝：${card.setName}\n`;
      if (card.rarity) prompt += `- 稀有度：${card.rarity}\n`;
      if (card.imageUrl) prompt += `- **圖片 URL（必須使用）**：${card.imageUrl}\n`;
      
      // PSA10 price data for this card
      prompt += `\n**PSA10 價格數據**（此卡牌專屬）：\n`;
      if (card.psa10Stats.totalVolume > 0) {
        prompt += `- 當前參考價格（最近交易平均值）：HKD ${card.psa10Stats.avgPrice.toFixed(2)}\n`;
        prompt += `- 價格區間最低值：HKD ${card.psa10Stats.minPrice.toFixed(2)}\n`;
        prompt += `- 價格區間最高值：HKD ${card.psa10Stats.maxPrice.toFixed(2)}\n`;
        prompt += `- 7日價格變化：${card.psa10Stats.priceChange7d.toFixed(2)}%\n`;
        prompt += `- 30日價格變化：${card.psa10Stats.priceChange30d.toFixed(2)}%\n`;
        prompt += `- 60日價格變化：${card.psa10Stats.priceChange60d.toFixed(2)}%\n`;
        prompt += `- 總交易筆數：${card.psa10Stats.totalVolume} 筆\n`;
        prompt += `- 日均交易量：${card.psa10Stats.avgDailyVolume.toFixed(1)} 筆\n`;
      } else {
        prompt += `- **數據不足**：此卡牌在查詢時間範圍內沒有 PSA10 交易記錄\n`;
      }
      
      // Grade A price data for this card
      prompt += `\n**中古品 A 價格數據**（此卡牌專屬）：\n`;
      if (card.usedGradeAStats.totalVolume > 0) {
        prompt += `- 當前參考價格（最近交易平均值）：HKD ${card.usedGradeAStats.avgPrice.toFixed(2)}\n`;
        prompt += `- 價格區間最低值：HKD ${card.usedGradeAStats.minPrice.toFixed(2)}\n`;
        prompt += `- 價格區間最高值：HKD ${card.usedGradeAStats.maxPrice.toFixed(2)}\n`;
        prompt += `- 7日價格變化：${card.usedGradeAStats.priceChange7d.toFixed(2)}%\n`;
        prompt += `- 30日價格變化：${card.usedGradeAStats.priceChange30d.toFixed(2)}%\n`;
        prompt += `- 60日價格變化：${card.usedGradeAStats.priceChange60d.toFixed(2)}%\n`;
        prompt += `- 總交易筆數：${card.usedGradeAStats.totalVolume} 筆\n`;
        prompt += `- 日均交易量：${card.usedGradeAStats.avgDailyVolume.toFixed(1)} 筆\n`;
      } else {
        prompt += `- **數據不足**：此卡牌在查詢時間範圍內沒有中古品 A 交易記錄\n`;
      }
      
      // Peak price for this card
      if (card.peakPrice > 0) {
        prompt += `\n**歷史最高價**：HKD ${card.peakPrice.toFixed(2)}\n`;
      }
    });
    
    prompt += `\n\n**圖片插入格式**（必須嚴格遵守）：\n`;
    prompt += `![{卡牌名稱}]({圖片URL})\n`;
    prompt += `\n**範例**：\n`;
    prompt += `- 如果卡牌名稱是 "Lillie SR"，圖片 URL 是 "https://cdn.snkrdunk.com/upload_bg_removed/20230508074833-0.webp"\n`;
    prompt += `- 那麼圖片語法就是：![Lillie SR](https://cdn.snkrdunk.com/upload_bg_removed/20230508074833-0.webp)\n`;
    prompt += `\n**【嚴格禁止】**：\n`;
    prompt += `1. 絕對不可以創造 boxium.io 或 boxium.asia 的圖片連結\n`;
    prompt += `2. 絕對不可以創造 /images/cards/ 路徑\n`;
    prompt += `3. 絕對不可以使用 Pokemon TCG 官網的圖片 URL\n`;
    prompt += `4. 必須使用上述【卡牌資訊與價格數據】中提供的圖片 URL，一字不漏地複製\n`;
    prompt += `5. **絕對不可以創造、估算或推測任何價格數據**，只能使用上述為每張卡牌提供的具體價格數值\n`;
    prompt += `6. 如果某張卡牌顯示「數據不足」，文章中必須明確說明該卡牌數據不足，不可猜測價格\n`;

    // DEPRECATED: Keep global stats for backward compatibility, but add warning
    prompt += `\n【全局聚合統計】（僅供參考，不要用於個別卡牌描述）\n`;
    prompt += `**警告：以下是所有卡牌的聚合統計，不代表任何單一卡牌的價格。描述個別卡牌時，必須使用上方為每張卡牌提供的專屬價格數據**\n\n`;
    prompt += `PSA10 全局統計：\n`;
    prompt += `- 平均價格：HKD ${dataContext.psa10Stats.avgPrice.toFixed(2)}\n`;
    prompt += `- 總交易筆數：${dataContext.psa10Stats.totalVolume} 筆\n`;
    prompt += `\n中古品 A 全局統計：\n`;
    prompt += `- 平均價格：HKD ${dataContext.usedGradeAStats.avgPrice.toFixed(2)}\n`;
    prompt += `- 總交易筆數：${dataContext.usedGradeAStats.totalVolume} 筆\n`;
  }

  // Add user input
  if (userInput) {
    prompt += `\n【用戶提供的資訊】\n${userInput}\n`;
  }

  // Add general requirements
  prompt += `\n【通用要求】\n`;
  prompt += `1. 使用繁體中文\n`;
  prompt += `2. 文章長度：${lengthMap[length]}\n`;
  prompt += `3. 語氣：${tone === 'professional' ? '專業' : tone === 'casual' ? '輕鬆' : '技術性'}\n`;
  prompt += `4. 內容格式：Markdown\n`;
  prompt += `5. **【嚴格要求】所有價格數據必須直接使用上方【PSA10 價格數據】和【中古品 A 價格數據】中提供的數值，絕對不可以創造、估算或推測任何價格數據**\n`;
  prompt += `5.1. **【嚴格要求】所有卡牌圖片必須使用上方【卡牌資訊】中提供的圖片 URL，絕對不可以創造或使用其他來源的圖片連結**\n`;
  prompt += `6. **【嚴格要求】不要創造「月初價格」、「月底價格」、「上週價格」等系統未提供的數據。只使用「平均價格」、「最低價格」、「最高價格」和「漲跌幅」**\n`;
  prompt += `7. **【嚴格要求】如果系統提供的數據不足以支撐某個論點，明確說明「數據不足」，而不是猜測或創造數據**\n`;
  prompt += `8. 提供可操作的建議\n`;
  prompt += `9. **所有價格和金錢相關內容必須使用港幣（HKD）**，格式範例：HKD 1,234.56\n\n`;
  
  prompt += `【Markdown 排版要求】\n`;
  prompt += `1. 每個段落之間用空行分隔（\\n\\n）\n`;
  prompt += `2. 使用 ## 二級標題劃分章節，標題前後各留一個空行\n`;
  prompt += `3. 列表項目之間不需要空行，但列表前後要留空行\n`;
  prompt += `4. 重要數據使用 **粗體** 標記\n`;
  prompt += `5. 引用區塊使用 > 符號，用於重點提示\n`;
  prompt += `6. 避免過長的段落，每段 2-4 句為佳\n`;
  prompt += `7. **引用卡牌圖片**：在文章中介紹每張卡牌時，**必須**在卡牌名稱後立即使用 Markdown 圖片語法插入圖片，格式：![{卡牌名稱}]({圖片URL})。例如：\n\n`;
  prompt += `   **Lillie SR**\n\n`;
  prompt += `   ![Lillie SR](https://cdn.snkrdunk.com/upload_bg_removed/20230508074833-0.webp)\n\n`;
  prompt += `   **重要**：必須使用上方【卡牌資訊】中提供的圖片 URL，不可以創造其他 URL。\n\n`;
  prompt += `   這張來自《VMAX Climax》的CHR...\n\n`;
  prompt += `   **重要**：每張卡牌都必須包含圖片，圖片 URL 已在【卡牌資訊】中提供（「圖片：{url}」）。\n\n`;

  prompt += `請返回 JSON 格式：\n`;
  prompt += `{\n`;
  prompt += `  "title": "文章標題",\n`;
  prompt += `  "excerpt": "文章摘要（150-200字）",\n`;
  prompt += `  "content": "文章內容（Markdown 格式）",\n`;
  prompt += `  "suggestedTags": ["標籤1", "標籤2", "標籤3"],\n`;
  prompt += `  "suggestedCategory": "建議分類",\n`;
  prompt += `  "seoMetadata": {\n`;
  prompt += `    "metaTitle": "SEO 標題",\n`;
  prompt += `    "metaDescription": "SEO 描述",\n`;
  prompt += `    "keywords": ["關鍵字1", "關鍵字2"]\n`;
  prompt += `  }\n`;
  prompt += `}`;

  return prompt;
}

/**
 * Generate article using AI
 */
export async function generateArticle(
  options: ArticleGenerationOptions
): Promise<GeneratedArticle> {
  let dataContext: ArticleDataContext | null = null;
  let userInput = '';

  // 1. Extract data context if data-driven
  let cardIds = options.dataInput?.cardIds || [];
  
  // Try to extract card IDs from topic if provided
  if (cardIds.length === 0 && options.dataInput?.topic) {
    const { extractCardIdsFromTopic } = await import('./topicCardSearch');
    cardIds = await extractCardIdsFromTopic(
      options.dataInput.topic,
      20 // Limit to 20 cards
    );
    console.log('[ArticleGenerator] Extracted cards from topic:', cardIds.length, 'cards');
  }
  
  // Auto-select cards if still not provided
  if (cardIds.length === 0 && (options.articleType === 'daily-report' || options.articleType === 'market-trend')) {
    const { autoSelectCardsForArticle } = await import('./articleDataHelper');
    const timeRange = options.dataInput?.timeRange;
    const autoTimeRange: '7d' | '30d' = (timeRange === '7d' || timeRange === '30d') ? timeRange : '7d';
    cardIds = await autoSelectCardsForArticle(
      options.articleType,
      autoTimeRange
    );
    console.log('[ArticleGenerator] Auto-selected cards:', cardIds);
  }
  
  if (cardIds.length > 0) {
    dataContext = await getArticleDataContext(
      cardIds,
      options.dataInput?.timeRange || '30d'
    );
  }

  // 2. Process user input
  if (options.imageInput) {
    userInput = options.imageInput.extractedText || '';
    // Note: Do not include base64 image URLs in the prompt as they are too large
    // The images are only used for preview in the frontend
    if (!userInput) {
      userInput = '用戶上傳了圖片，請根據文章類型生成相應的內容。';
    }
  } else if (options.textInput) {
    userInput = options.textInput.content;
    if (options.textInput.topic) {
      userInput = `【主題】${options.textInput.topic}\n\n${userInput}`;
    }
  }

  // 3. Build AI prompt
  const prompt = buildArticlePrompt(
    options.articleType,
    dataContext,
    userInput,
    options.options
  );

  // 4. Call LLM to generate article
  console.log('[ArticleGenerator] Calling LLM with prompt length:', prompt.length);
  console.log('[ArticleGenerator] Article type:', options.articleType);
  
  let response;
  try {
    response = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: 'You are a professional Pokémon TCG market analyst and content writer for BOXIUM PTCG. You generate data-driven, professional articles in Traditional Chinese. IMPORTANT: This website primarily serves Hong Kong users, so all prices and monetary values MUST use Hong Kong Dollars (HKD) as the default currency. Always format prices as "HKD X,XXX.XX".',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'article',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            excerpt: { type: 'string' },
            content: { type: 'string' },
            suggestedTags: {
              type: 'array',
              items: { type: 'string' },
            },
            suggestedCategory: { type: 'string' },
            seoMetadata: {
              type: 'object',
              properties: {
                metaTitle: { type: 'string' },
                metaDescription: { type: 'string' },
                keywords: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: ['metaTitle', 'metaDescription', 'keywords'],
              additionalProperties: false,
            },
          },
          required: ['title', 'excerpt', 'content', 'suggestedTags', 'suggestedCategory', 'seoMetadata'],
          additionalProperties: false,
        },
      },
    },
    });
    console.log('[ArticleGenerator] LLM response received:', response ? 'success' : 'null');
  } catch (error) {
    console.error('[ArticleGenerator] LLM invocation failed:', error);
    throw new Error(`AI 生成失敗：${error instanceof Error ? error.message : String(error)}`);
  }

  // 5. Parse and return result
  if (!response || !response.choices || response.choices.length === 0) {
    throw new Error('AI 生成失敗：無法獲取 LLM 回應');
  }

  const messageContent = response.choices[0].message.content;
  if (!messageContent) {
    throw new Error('AI 生成失敗：回應內容為空');
  }

  const contentString = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent);
  const article = JSON.parse(contentString || '{}');

  return {
    title: article.title || '',
    excerpt: article.excerpt || '',
    content: article.content || '',
    suggestedTags: article.suggestedTags || [],
    suggestedCategory: article.suggestedCategory || '',
    seoMetadata: article.seoMetadata || {
      metaTitle: '',
      metaDescription: '',
      keywords: [],
    },
  };
}
