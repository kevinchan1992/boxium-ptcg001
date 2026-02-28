import { cards, priceHistory } from "../drizzle/schema_new";
import { eq, inArray, gte, desc, and, sql } from "drizzle-orm";
import { getDb } from "./db";
import type { Message } from "./_core/llm";

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
 * v2: Fixed to respect timeRange parameter for both PSA10 and Grade A
 */
async function calculateCardPriceStats(
  db: any,
  cardId: number,
  grade: 'PSA10' | 'A',
  timeRange: '7d' | '30d' | '60d' | 'all'
): Promise<CardPriceStats> {
  // Map timeRange to days
  const daysMap = { '7d': 7, '30d': 30, '60d': 60, 'all': 365 * 10 };
  const days = daysMap[timeRange];
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Query price history for this card within the specified time range
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

  // Calculate transaction statistics
  const allTransactions = [...psa10Data, ...usedGradeAData];
  const allPrices = allTransactions.map(p => parseFloat(p.price));
  const peakPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;
  const peakDateQuery = allTransactions.sort((a, b) => {
    const dateA = a.soldAt instanceof Date ? a.soldAt.getTime() : (a.soldAt ? new Date(a.soldAt as any).getTime() : 0);
    const dateB = b.soldAt instanceof Date ? b.soldAt.getTime() : (b.soldAt ? new Date(b.soldAt as any).getTime() : 0);
    return dateB - dateA;
  })[0];
  const peakDate = peakDateQuery ? peakDateQuery.soldAt : null;

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
 * Calculate price change percentage over N days
 */
function calculatePriceChange(priceData: any[], days: number): number {
  if (priceData.length < 2) return 0;

  const now = new Date();
  const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Find oldest and newest prices within the time range
  const recentPrices = priceData.filter(p => new Date(p.soldAt) >= cutoffDate);
  
  if (recentPrices.length < 2) {
    return 0;
  }

  const newestPrice = parseFloat(recentPrices[0].price);
  const oldestPrice = parseFloat(recentPrices[recentPrices.length - 1].price);

  if (oldestPrice === 0) return 0;
  return ((newestPrice - oldestPrice) / oldestPrice) * 100;
}

/**
 * Format card data context into a text prompt for LLM
 */
function formatCardDataForPrompt(dataContext: ArticleDataContext): string {
  const lines: string[] = [];
  lines.push('=== 卡牌市場數據（港幣 HKD）===');
  for (const card of dataContext.cards) {
    lines.push(`\n【${card.name}】`);
    if (card.nameJa) lines.push(`日文名：${card.nameJa}`);
    if (card.cardNumber) lines.push(`編號：${card.cardNumber}`);
    if (card.series) lines.push(`系列：${card.series}`);
    if (card.setName) lines.push(`套組：${card.setName}`);
    if (card.rarity) lines.push(`稀有度：${card.rarity}`);

    if (card.psa10Stats.totalVolume > 0) {
      lines.push(`PSA10 鑑定卡：`);
      lines.push(`  平均價格：HKD$${Math.round(card.psa10Stats.avgPrice).toLocaleString()}`);
      lines.push(`  價格區間：HKD$${Math.round(card.psa10Stats.minPrice).toLocaleString()} ~ HKD$${Math.round(card.psa10Stats.maxPrice).toLocaleString()}`);
      lines.push(`  7天變化：${card.psa10Stats.priceChange7d >= 0 ? '+' : ''}${card.psa10Stats.priceChange7d.toFixed(1)}%`);
      lines.push(`  30天變化：${card.psa10Stats.priceChange30d >= 0 ? '+' : ''}${card.psa10Stats.priceChange30d.toFixed(1)}%`);
      lines.push(`  成交量：${card.psa10Stats.totalVolume} 筆`);
    } else {
      lines.push(`PSA10 鑑定卡：暫無成交記錄`);
    }

    if (card.usedGradeAStats.totalVolume > 0) {
      lines.push(`中古 A 級：`);
      lines.push(`  平均價格：HKD$${Math.round(card.usedGradeAStats.avgPrice).toLocaleString()}`);
      lines.push(`  價格區間：HKD$${Math.round(card.usedGradeAStats.minPrice).toLocaleString()} ~ HKD$${Math.round(card.usedGradeAStats.maxPrice).toLocaleString()}`);
      lines.push(`  7天變化：${card.usedGradeAStats.priceChange7d >= 0 ? '+' : ''}${card.usedGradeAStats.priceChange7d.toFixed(1)}%`);
      lines.push(`  30天變化：${card.usedGradeAStats.priceChange30d >= 0 ? '+' : ''}${card.usedGradeAStats.priceChange30d.toFixed(1)}%`);
      lines.push(`  成交量：${card.usedGradeAStats.totalVolume} 筆`);
    } else {
      lines.push(`中古 A 級：暫無成交記錄`);
    }

    if (card.peakPrice > 0) {
      lines.push(`歷史最高價：HKD$${Math.round(card.peakPrice).toLocaleString()}${card.peakDate ? `（${new Date(card.peakDate).toLocaleDateString('zh-TW')}）` : ''}`);
    }
  }
  return lines.join('\n');
}

/**
 * Get article type prompt instructions
 */
function getArticleTypeInstructions(articleType: string): string {
  const instructions: Record<string, string> = {
    'daily-report': `請撰寫一篇每日市場快報文章，包含：
1. 今日市場概況（2-3 句）
2. 重點卡牌分析（逐一分析每張卡牌的價格走勢）
3. 市場趨勢觀察
4. 投資建議
文章風格：專業、簡潔、數據導向`,
    'card-analysis': `請撰寫一篇深度卡牌研究文章，包含：
1. 卡牌介紹（背景、稀有度、設計特色）
2. 詳細價格分析（PSA10 和中古 A 級的完整數據解讀）
3. 歷史價格走勢分析
4. 市場需求分析
5. 收藏與投資建議
文章風格：深入、詳盡、適合收藏家閱讀`,
    'market-trend': `請撰寫一篇市場趨勢報告，包含：
1. 市場整體趨勢分析
2. 各卡牌的價格趨勢對比
3. 影響市場的關鍵因素分析
4. 未來走勢預測
5. 風險提示
文章風格：分析性強、有數據支撐、專業客觀`,
    'news': `請撰寫一篇市場快訊新聞，包含：
1. 重要市場動態（標題式開頭）
2. 關鍵數據摘要
3. 市場反應分析
4. 對收藏家的影響
文章風格：新聞式、簡潔有力、重點突出`,
  };
  return instructions[articleType] || instructions['card-analysis'];
}

/**
 * Scrape URL content for article generation
 */
async function scrapeUrlContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Boxium/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    // Strip HTML tags and extract text content
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 8000); // Limit to 8000 chars
    return text;
  } catch (err: any) {
    throw new Error(`無法讀取網址內容：${err.message}`);
  }
}

/**
 * Generate article using AI (LLM)
 * Supports: card data input, URL input, image input, text input
 */
export async function generateArticle(input: any): Promise<any> {
  const { invokeLLM } = await import('./_core/llm');

  const articleType = input.articleType || 'card-analysis';
  const language = input.options?.language || 'zh-TW';
  const tone = input.options?.tone || 'professional';
  const length = input.options?.length || 'medium';

  const lengthMap: Record<string, string> = { short: '500-800字', medium: '800-1200字', long: '1200-2000字' };
  const toneMap: Record<string, string> = { professional: '專業正式', casual: '輕鬆易讀', technical: '技術深入' };
  const langMap: Record<string, string> = { 'zh-TW': '繁體中文', 'en': 'English', 'ja': '日本語' };
  const lengthGuide = lengthMap[length] || '800-1200字';
  const toneGuide = toneMap[tone] || '專業正式';
  const langGuide = langMap[language as string] || '繁體中文';

  const systemPrompt = `你是 Boxium PTCG 平台的專業文章撰寫員，專門撰寫 Pokémon Trading Card Game（PTCG）相關的市場分析和收藏指南文章。
你的文章特點：
- 語言：${langGuide}
- 風格：${toneGuide}
- 字數：${lengthGuide}
- 所有價格以港幣（HKD$）表示
- 使用 Markdown 格式（標題用 ##、### ，重點用 **粗體**，列表用 - ）
- 文章結構清晰，有引言、主體分析、結論
- 數據準確，直接引用提供的市場數據
- 不要捏造數據，只使用提供的真實數據`;

  let userPrompt = '';
  let featuredImage: string | undefined;

  // ── Case 1: Card data input (from CardSelectionDialog) ──
  if (input.dataInput?.cardIds && input.dataInput.cardIds.length > 0) {
    const timeRange = input.dataInput.timeRange || '30d';
    const dataContext = await getArticleDataContext(input.dataInput.cardIds, timeRange);
    const cardDataText = formatCardDataForPrompt(dataContext);
    const typeInstructions = getArticleTypeInstructions(articleType);

    // Use first card's image as featured image
    const firstCardWithImage = dataContext.cards.find(c => c.imageUrl);
    if (firstCardWithImage?.imageUrl) featuredImage = firstCardWithImage.imageUrl;

    userPrompt = `${typeInstructions}

以下是從資料庫提取的真實市場數據，請根據這些數據撰寫文章：

${cardDataText}

重要提示：
- 所有價格數據均為港幣（HKD$），請直接使用這些數字
- 請分析每張卡牌的價格走勢和市場表現
- 如果某張卡牌成交量為 0，請說明暫無成交記錄
- 文章標題要吸引人，包含主要卡牌名稱`;

  // ── Case 2: Text input (may include card data from CardSelectionDialog) ──
  } else if (input.textInput?.content) {
    const typeInstructions = getArticleTypeInstructions(articleType);
    userPrompt = `${typeInstructions}

以下是參考資料（可能包含卡牌市場數據）：

${input.textInput.content}

主題：${input.textInput.topic || '市場快訊'}

重要提示：
- 如果參考資料中有 HKD$ 價格數據，請直接使用這些數字
- 文章標題要吸引人`;

  // ── Case 3: URL input ──
  } else if (input.urlInput?.url) {
    let urlContent = '';
    try {
      urlContent = await scrapeUrlContent(input.urlInput.url);
    } catch (err: any) {
      urlContent = `（無法讀取網址內容：${err.message}，請根據網址主題生成文章）`;
    }
    const targetLang = input.urlInput.targetLanguage || 'zh-TW';
    const targetLangLookup: Record<string, string> = { 'zh-TW': '繁體中文', 'en': 'English', 'ja': '日本語' };
    const targetLangGuide = targetLangLookup[targetLang] || '繁體中文';
    const typeInstructions = getArticleTypeInstructions(articleType);

    userPrompt = `${typeInstructions}

請根據以下網址的內容，撰寫一篇${targetLangGuide}的 PTCG 相關文章：

網址：${input.urlInput.url}

網頁內容摘要：
${urlContent}

重要提示：
- 請將內容改寫為 Boxium PTCG 平台風格的文章
- 如有價格資訊，請換算為港幣（HKD$）顯示
- 文章標題要吸引人`;

  // ── Case 4: Image input ──
  } else if (input.imageInput?.imageUrls && input.imageInput.imageUrls.length > 0) {
    const typeInstructions = getArticleTypeInstructions(articleType);
    featuredImage = input.imageInput.imageUrls[0];

    // Build messages with image content
    const imageMessages: Message[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          {
            type: 'text' as const,
            text: `${typeInstructions}

請根據以下圖片內容，撰寫一篇 PTCG 相關文章。

重要提示：
- 如圖片中有價格資訊，請換算為港幣（HKD$）顯示
- 文章標題要吸引人
- 使用 Markdown 格式`,
          },
          ...input.imageInput.imageUrls.slice(0, 4).map((url: string) => ({
            type: 'image_url' as const,
            image_url: { url, detail: 'auto' as const },
          })),
        ],
      },
    ];

    try {
      const response = await invokeLLM({ messages: imageMessages });
      const msgContent = response.choices[0]?.message?.content;
      const rawContent = typeof msgContent === 'string' ? msgContent : '';
      return parseGeneratedArticle(rawContent, articleType, featuredImage);
    } catch (err: any) {
      throw new Error(`AI 生成失敗：${err.message}`);
    }

  // ── Fallback: no valid input ──
  } else {
    throw new Error('請提供卡牌數據、文字內容、網址或圖片來生成文章');
  }

  // Call LLM for text-based inputs
  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    const msgContent = response.choices[0]?.message?.content;
    const rawContent = typeof msgContent === 'string' ? msgContent : '';
    return parseGeneratedArticle(rawContent, articleType, featuredImage);
  } catch (err: any) {
    throw new Error(`AI 生成失敗：${err.message}`);
  }
}

/**
 * Parse LLM output into structured article format
 */
function parseGeneratedArticle(rawContent: string, articleType: string, featuredImage?: string): any {
  // Extract title from first # heading or first line
  let title = '';
  let content = rawContent;

  const titleMatch = rawContent.match(/^#{1,2}\s+(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1].trim();
    // Remove the title line from content to avoid duplication
    content = rawContent.replace(titleMatch[0], '').trim();
  } else {
    // Use first non-empty line as title
    const lines = rawContent.split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      title = lines[0].replace(/^#+\s*/, '').trim();
      content = lines.slice(1).join('\n').trim();
    }
  }

  // Extract excerpt (first paragraph)
  const excerptMatch = content.match(/^([^#\n]{20,200})/);
  const excerpt = excerptMatch ? excerptMatch[1].trim().substring(0, 200) : title;

  // Suggest category based on article type
  const categoryMap: Record<string, string> = {
    'daily-report': '市場分析',
    'card-analysis': '卡牌評測',
    'market-trend': '市場趨勢',
    'news': '新聞資訊',
  };

  // Suggest tags
  const tagsMap: Record<string, string[]> = {
    'daily-report': ['每日快報', '市場分析', 'PTCG'],
    'card-analysis': ['卡牌評測', '收藏指南', 'PTCG'],
    'market-trend': ['市場趨勢', '投資分析', 'PTCG'],
    'news': ['最新消息', 'PTCG', '市場動態'],
  };

  return {
    title: title || '市場分析報告',
    content: rawContent, // Return full content including title
    excerpt,
    status: 'draft',
    dataSource: 'ai-generated',
    suggestedCategory: categoryMap[articleType] || '市場分析',
    suggestedTags: tagsMap[articleType] || ['PTCG'],
    seoMetadata: {
      keywords: ['PTCG', 'Pokémon TCG', '寶可夢卡牌', '市場分析', 'HKD', '香港'],
    },
    featuredImage,
  };
}
