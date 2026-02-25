import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { cards, priceHistory } from "../drizzle/schema_new";
import { eq, inArray, gte, desc, and, sql } from "drizzle-orm";

/**
 * Article data context for AI generation
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
  }>;
  priceStats: {
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    priceChange7d: number;
    priceChange30d: number;
    priceChange60d: number;
  };
  transactionStats: {
    totalVolume: number;
    avgDailyVolume: number;
    peakPrice: number;
    peakDate: Date | null;
  };
}

/**
 * Get article data context from database
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

  // 2. Calculate date range
  const now = new Date();
  const daysMap = { '7d': 7, '30d': 30, '60d': 60, 'all': 365 * 10 };
  const days = daysMap[timeRange];
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // 3. Query price history (SNKRDUNK PSA 10 only)
  const priceData = await db.select({
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

  // 4. Calculate price statistics
  const prices = priceData.map(p => parseFloat(p.price));
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

  // Calculate price changes
  const priceChange7d = calculatePriceChange(priceData, 7);
  const priceChange30d = calculatePriceChange(priceData, 30);
  const priceChange60d = calculatePriceChange(priceData, 60);

  // 5. Calculate transaction statistics
  const totalVolume = priceData.length;
  const avgDailyVolume = totalVolume / days;
  const peakPrice = maxPrice;
  const peakDate = priceData.length > 0 ? priceData[0].soldAt : null;

  return {
    cards: cardData,
    priceStats: {
      avgPrice,
      minPrice,
      maxPrice,
      priceChange7d,
      priceChange30d,
      priceChange60d,
    },
    transactionStats: {
      totalVolume,
      avgDailyVolume,
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

  let prompt = `你是 BOXIUM PTCG 的專業內容創作者，負責撰寫 Pokémon TCG 相關文章。\n\n【重要】本網站主要服務香港地區用戶，所有價格和金錢相關內容必須使用港幣（HKD）為預設貨幣單位。\n\n`;

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
    prompt += `\n【卡牌資訊】\n`;
    dataContext.cards.forEach(card => {
      prompt += `- ${card.name}${card.nameJa ? ` (${card.nameJa})` : ''}\n`;
      if (card.series) prompt += `  系列：${card.series}\n`;
      if (card.setName) prompt += `  套裝：${card.setName}\n`;
      if (card.rarity) prompt += `  稀有度：${card.rarity}\n`;
    });

    prompt += `\n【價格數據】\n`;
    prompt += `- 平均價格：HKD ${dataContext.priceStats.avgPrice.toFixed(2)}\n`;
    prompt += `- 最低價格：HKD ${dataContext.priceStats.minPrice.toFixed(2)}\n`;
    prompt += `- 最高價格：HKD ${dataContext.priceStats.maxPrice.toFixed(2)}\n`;
    prompt += `- 7日漲跌：${dataContext.priceStats.priceChange7d.toFixed(2)}%\n`;
    prompt += `- 30日漲跌：${dataContext.priceStats.priceChange30d.toFixed(2)}%\n`;
    prompt += `- 60日漲跌：${dataContext.priceStats.priceChange60d.toFixed(2)}%\n`;

    prompt += `\n【交易統計】\n`;
    prompt += `- 總交易量：${dataContext.transactionStats.totalVolume} 筆\n`;
    prompt += `- 日均交易量：${dataContext.transactionStats.avgDailyVolume.toFixed(1)} 筆\n`;
    prompt += `- 歷史最高價：HKD ${dataContext.transactionStats.peakPrice.toFixed(2)}\n`;
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
  prompt += `5. 包含數據支撐，避免主觀臆測\n`;
  prompt += `6. 提供可操作的建議\n`;
  prompt += `7. **所有價格和金錢相關內容必須使用港幣（HKD）**，格式範例：HKD 1,234.56\n\n`;
  
  prompt += `【Markdown 排版要求】\n`;
  prompt += `1. 每個段落之間用空行分隔（\\n\\n）\n`;
  prompt += `2. 使用 ## 二級標題劃分章節，標題前後各留一個空行\n`;
  prompt += `3. 列表項目之間不需要空行，但列表前後要留空行\n`;
  prompt += `4. 重要數據使用 **粗體** 標記\n`;
  prompt += `5. 引用區塊使用 > 符號，用於重點提示\n`;
  prompt += `6. 避免過長的段落，每段 2-4 句為佳\n\n`;

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
  if (options.dataInput && options.dataInput.cardIds && options.dataInput.cardIds.length > 0) {
    dataContext = await getArticleDataContext(
      options.dataInput.cardIds,
      options.dataInput.timeRange || '30d'
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
