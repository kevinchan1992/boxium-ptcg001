/**
 * AI 內容運營系統 - 新增 AI 程序
 * 策略生成、大綱生成、分段寫作、AI 校對、內容刷新建議
 */
import { z } from "zod";
import { adminProcedure, router } from "./_core/trpc";

export const blogAiRouter = router({
  // ─── 策略生成 ───
  generateStrategy: adminProcedure
    .input(z.object({
      topic: z.string(),
      targetAudience: z.string().optional(),
      purpose: z.string().optional(),
      seoKeywords: z.string().optional(),
      language: z.enum(['zh-TW', 'en', 'ja']).optional(),
    }))
    .mutation(async ({ input }) => {
      const { invokeLLM } = await import('./_core/llm');
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `你是 Boxium PTCG 平台的資深內容策略師。Boxium PTCG 是香港及台灣最專業的集換式卡牌（TCG）資訊平台，主要面向 Pokemon、遊戲王、Magic: The Gathering 等卡牌的玩家、收藏家及投資者。

你的任務是根據輸入的主題，制定一份完整的內容策略方案，包括：
1. 搜尋意圖分析（用戶為什麼搜尋這個主題）
2. 最佳文章類型（市場快報/卡牌研究/價格追蹤/收藏指南/平台新聞/SEO 長文）
3. 3-5 個標題方案（吸引點擊、含關鍵字、繁體中文）
4. 內容切入角度建議（從哪個切入點最有價值）
5. 目標讀者定義
6. CTA 建議（引導讀者下一步行動）
7. 內容集群建議（這篇文章應放在哪個主題群）

所有價格以港幣（HKD$）表示。保留 PSA、CGC、BGS 等評級術語不翻譯。`,
          },
          {
            role: 'user',
            content: `請為以下主題制定內容策略：

主題：${input.topic}
目標讀者：${input.targetAudience || '香港及台灣 TCG 玩家和收藏家'}
文章目的：${input.purpose || '提供市場資訊和投資參考'}
SEO 關鍵字：${input.seoKeywords || '（請根據主題自動建議）'}
語言：${input.language || 'zh-TW'}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'content_strategy',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                searchIntent: { type: 'string', description: '搜尋意圖分析' },
                articleType: { type: 'string', description: '建議文章類型' },
                titleOptions: { type: 'array', items: { type: 'string' }, description: '3-5 個標題方案' },
                contentAngle: { type: 'string', description: '內容切入角度' },
                targetAudience: { type: 'string', description: '目標讀者定義' },
                ctaSuggestion: { type: 'string', description: 'CTA 建議' },
                contentCluster: { type: 'string', description: '內容集群建議' },
                estimatedLength: { type: 'string', description: '建議文章長度（短/中/長）' },
                keyPoints: { type: 'array', items: { type: 'string' }, description: '3-5 個必須涵蓋的重點' },
              },
              required: ['searchIntent', 'articleType', 'titleOptions', 'contentAngle', 'targetAudience', 'ctaSuggestion', 'contentCluster', 'estimatedLength', 'keyPoints'],
              additionalProperties: false,
            },
          },
        },
        thinking: { budget_tokens: 2048 },
      });
      return JSON.parse(response.choices[0].message.content as string);
    }),

  // ─── 大綱生成 ───
  generateOutline: adminProcedure
    .input(z.object({
      title: z.string(),
      articleType: z.string(),
      contentAngle: z.string().optional(),
      keyPoints: z.array(z.string()).optional(),
      targetAudience: z.string().optional(),
      estimatedLength: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { invokeLLM } = await import('./_core/llm');
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `你是 Boxium PTCG 平台的專業文章結構師。你的任務是根據文章標題和策略，生成一份詳細的文章大綱。

大綱規範：
- H1（文章主標題，已確定）
- H2（主要章節，3-6 個）
- H3（每個 H2 下的子章節，1-3 個）
- 每個章節需要說明「這段要寫什麼」
- 標記建議插圖位置（圖表、卡牌圖片、數據表格）
- 包含 FAQ 章節（2-4 個常見問題）
- 包含結語和 CTA

文章風格要求：
- 繁體中文，香港口語與書面語混合（自然流暢）
- 數據導向，引用具體數字
- 保留 TCG 術語（PSA 10、CGC 10、GEM-MT 10 等）
- 所有價格以 HKD$ 表示`,
          },
          {
            role: 'user',
            content: `請為以下文章生成詳細大綱：

標題：${input.title}
文章類型：${input.articleType}
內容角度：${input.contentAngle || '（請根據標題自動判斷）'}
必須涵蓋重點：${input.keyPoints?.join('、') || '（請根據標題自動建議）'}
目標讀者：${input.targetAudience || 'TCG 玩家和收藏家'}
文章長度：${input.estimatedLength || '中'}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'article_outline',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                h1: { type: 'string', description: '文章主標題（可微調）' },
                sections: {
                  type: 'array',
                  description: '文章章節結構',
                  items: {
                    type: 'object',
                    properties: {
                      h2: { type: 'string', description: 'H2 章節標題' },
                      description: { type: 'string', description: '這段要寫什麼（給 AI 的寫作指引）' },
                      hasImage: { type: 'boolean', description: '是否建議插圖' },
                      imageNote: { type: 'string', description: '插圖說明（如：價格走勢圖、卡牌圖片）' },
                      subsections: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            h3: { type: 'string', description: 'H3 子章節標題' },
                            description: { type: 'string', description: '這段要寫什麼' },
                          },
                          required: ['h3', 'description'],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ['h2', 'description', 'hasImage', 'imageNote', 'subsections'],
                    additionalProperties: false,
                  },
                },
                faq: {
                  type: 'array',
                  description: 'FAQ 問答',
                  items: {
                    type: 'object',
                    properties: {
                      question: { type: 'string' },
                      answerHint: { type: 'string', description: '答案要點提示' },
                    },
                    required: ['question', 'answerHint'],
                    additionalProperties: false,
                  },
                },
                cta: { type: 'string', description: '結語和 CTA 建議' },
                estimatedWordCount: { type: 'string', description: '預估字數範圍' },
              },
              required: ['h1', 'sections', 'faq', 'cta', 'estimatedWordCount'],
              additionalProperties: false,
            },
          },
        },
        thinking: { budget_tokens: 2048 },
      });
      return JSON.parse(response.choices[0].message.content as string);
    }),

  // ─── 分段寫作 ───
  generateSection: adminProcedure
    .input(z.object({
      articleTitle: z.string(),
      articleType: z.string(),
      sectionTitle: z.string(),
      sectionDescription: z.string(),
      subsections: z.array(z.object({ h3: z.string(), description: z.string() })).optional(),
      dataContext: z.string().optional(),
      previousSections: z.string().optional(),
      tone: z.enum(['professional', 'casual', 'analytical']).optional(),
    }))
    .mutation(async ({ input }) => {
      const { invokeLLM } = await import('./_core/llm');
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `你是 Boxium PTCG 平台的專業文章撰稿人。你的任務是根據大綱和指引，撰寫文章的單一章節。

撰寫規範：
- 繁體中文，香港讀者口吻（自然、專業、有溫度）
- 每個 H2 章節約 200-400 字
- 數據導向：引用具體數字、百分比、時間範圍
- 保留 TCG 術語（PSA 10、CGC 10、GEM-MT 10、中古 A 級等）
- 所有價格以 HKD$ 表示
- 避免過度誇大（不用「最」「絕對」「保證」等字眼）
- 使用 Markdown 格式（粗體強調重點、列表整理數據）
- 如有子章節，使用 ### 標題
- 不要重複前面章節已說過的內容`,
          },
          {
            role: 'user',
            content: `請撰寫以下章節：

文章標題：${input.articleTitle}
文章類型：${input.articleType}

## ${input.sectionTitle}
寫作指引：${input.sectionDescription}
${input.subsections && input.subsections.length > 0 ? `
子章節：
${input.subsections.map(s => `### ${s.h3}\n指引：${s.description}`).join('\n')}` : ''}
${input.dataContext ? `
可用數據/資料：
${input.dataContext}` : ''}
${input.previousSections ? `
前面章節摘要（避免重複）：
${input.previousSections}` : ''}

語氣：${input.tone === 'casual' ? '輕鬆易讀' : input.tone === 'analytical' ? '分析性強、數據導向' : '專業嚴謹'}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'section_content',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                content: { type: 'string', description: '章節 Markdown 內容（包含 ## 標題）' },
                wordCount: { type: 'string', description: '實際字數' },
                dataUsed: { type: 'array', items: { type: 'string' }, description: '引用的數據點列表' },
              },
              required: ['content', 'wordCount', 'dataUsed'],
              additionalProperties: false,
            },
          },
        },
        thinking: { budget_tokens: 1024 },
      });
      return JSON.parse(response.choices[0].message.content as string);
    }),

  // ─── AI 校對 ───
  proofreadArticle: adminProcedure
    .input(z.object({
      title: z.string(),
      excerpt: z.string(),
      content: z.string(),
      seoKeywords: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { invokeLLM } = await import('./_core/llm');
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `你是 Boxium PTCG 平台的資深文章校對員。你的任務是對文章進行全面的品質審核，找出需要改進的地方。

審核標準：
1. 數據引用核實：是否有不具體的數字（如「大幅上漲」而非「上漲 35%」）
2. 重複內容：是否有重複的句子或段落
3. 誇大語句：是否有「最」「絕對」「保證」等過度誇大的表達
4. 平台語氣：是否符合 Boxium PTCG 的專業但親切的風格
5. SEO 優化：標題是否含關鍵字、摘要是否夠吸引、關鍵字密度是否適中
6. 結構完整性：是否有清晰的引言、主體、結論
7. TCG 術語準確性：PSA/CGC/BGS 等術語是否使用正確
8. 貨幣表示：是否統一使用 HKD$
9. AI 痕跡：文章是否過於機械化、缺乏人情味

請給出具體的問題位置和修改建議。`,
          },
          {
            role: 'user',
            content: `請校對以下文章：

標題：${input.title}
摘要：${input.excerpt}
SEO 關鍵字：${input.seoKeywords || '（未設定）'}

內容：
${input.content}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'proofread_result',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                overallScore: { type: 'string', description: '整體品質評分（優秀/良好/需改進/不合格）' },
                overallComment: { type: 'string', description: '整體評語（2-3 句）' },
                issues: {
                  type: 'array',
                  description: '發現的問題列表',
                  items: {
                    type: 'object',
                    properties: {
                      category: { type: 'string', description: '問題類別（數據引用/重複內容/誇大語句/語氣/SEO/結構/術語/貨幣/AI痕跡）' },
                      severity: { type: 'string', description: '嚴重程度（高/中/低）' },
                      description: { type: 'string', description: '問題描述' },
                      suggestion: { type: 'string', description: '修改建議' },
                      location: { type: 'string', description: '問題位置（如：第二段、標題、摘要）' },
                    },
                    required: ['category', 'severity', 'description', 'suggestion', 'location'],
                    additionalProperties: false,
                  },
                },
                seoAnalysis: {
                  type: 'object',
                  properties: {
                    titleScore: { type: 'string', description: '標題 SEO 評分（1-10）' },
                    excerptScore: { type: 'string', description: '摘要 SEO 評分（1-10）' },
                    keywordDensity: { type: 'string', description: '關鍵字密度評估' },
                    suggestions: { type: 'array', items: { type: 'string' }, description: 'SEO 改進建議' },
                  },
                  required: ['titleScore', 'excerptScore', 'keywordDensity', 'suggestions'],
                  additionalProperties: false,
                },
                readabilityScore: { type: 'string', description: '可讀性評分（1-10）' },
                aiDetectionRisk: { type: 'string', description: 'AI 痕跡風險（低/中/高）' },
                quickFixes: { type: 'array', items: { type: 'string' }, description: '3-5 個最重要的快速修改建議' },
              },
              required: ['overallScore', 'overallComment', 'issues', 'seoAnalysis', 'readabilityScore', 'aiDetectionRisk', 'quickFixes'],
              additionalProperties: false,
            },
          },
        },
        thinking: { budget_tokens: 2048 },
      });
      return JSON.parse(response.choices[0].message.content as string);
    }),

  // ─── 數據驅動研究技能 ───
  // 輸入：卡牌 ID 列表 + 研究主題 → 輸出：基於真實成交數據的研究 Brief
  researchWithData: adminProcedure
    .input(z.object({
      topic: z.string(),
      cardIds: z.array(z.number()).optional(),
      days: z.number().default(30),
      researchGoal: z.enum(['price-analysis', 'market-trend', 'investment-guide', 'news-brief']).default('price-analysis'),
    }))
    .mutation(async ({ input }) => {
      const { invokeLLM } = await import('./_core/llm');
      const db = await import('./db');

      // 拉取真實卡牌數據
      const cardDataSections: string[] = [];

      if (input.cardIds && input.cardIds.length > 0) {
        for (const cardId of input.cardIds.slice(0, 5)) {
          try {
            const card = await db.getCardById(cardId);
            if (!card) continue;
            const priceHist = await db.getCardPriceHistory(cardId, input.days);
            if (priceHist.length > 0) {
              const prices = priceHist.map((p: any) => p.price);
              const avgPrice = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
              const minPrice = Math.min(...prices);
              const maxPrice = Math.max(...prices);
              const latestPrice = prices[prices.length - 1];
              const oldestPrice = prices[0];
              const priceChange = oldestPrice > 0 ? ((latestPrice - oldestPrice) / oldestPrice * 100).toFixed(1) : '0';
              cardDataSections.push(`【${(card as any).nameZh || (card as any).name}】\n- 近 ${input.days} 天成交記錄：${priceHist.length} 筆\n- 最新成交價：HKD $${latestPrice.toLocaleString()}\n- 平均成交價：HKD $${Math.round(avgPrice).toLocaleString()}\n- 最高成交價：HKD $${maxPrice.toLocaleString()}\n- 最低成交價：HKD $${minPrice.toLocaleString()}\n- 價格變動：${priceChange}%`);
            } else {
              cardDataSections.push(`【${(card as any).nameZh || (card as any).name}】\n- 近 ${input.days} 天無成交記錄`);
            }
          } catch (_e) {
            // Skip cards with errors
          }
        }
      }

      // 如果沒有指定卡牌，拉取熱門趨勢
      if (cardDataSections.length === 0) {
        try {
          const trending = await db.getTrendingByPriceIncrease({ limit: 5, days: input.days });
          for (const item of (trending as any[]).slice(0, 5)) {
            cardDataSections.push(`【${item.nameZh || item.name || '未知卡牌'}】\n- 近 ${input.days} 天漲幅：+${item.priceChangePercent?.toFixed(1) || 0}%\n- 舊價：HKD $${Math.round(item.oldPrice || 0).toLocaleString()}\n- 新價：HKD $${Math.round(item.currentPrice || 0).toLocaleString()}`);
          }
        } catch (_e) {
          // Use topic only
        }
      }

      const dataContext = cardDataSections.length > 0
        ? `\n\n=== BOXIUM 平台真實成交數據（近 ${input.days} 天）===\n${cardDataSections.join('\n\n')}`
        : '';

      const goalMap: Record<string, string> = {
        'price-analysis': '深度價格分析，解釋價格變動原因，預測短期走勢',
        'market-trend': '市場趨勢報告，分析整體市場動態和投資機會',
        'investment-guide': '投資收藏指南，給出具體的買賣建議',
        'news-brief': '市場快訊，簡潔報導最新行情',
      };

      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `你是 Boxium PTCG 平台的首席研究員。你的任務是基於平台真實成交數據，制定一份詳細的文章研究 Brief。

核心原則：
1. 所有分析必須基於提供的真實數據，不得自行推測價格
2. 價格一律以港幣（HKD$）表示
3. 保留 PSA 10、CGC 10 等評級術語不翻譯
4. 研究 Brief 必須讓撰寫員能直接按照它寫出有價值的文章
5. 識別數據中的關鍵洞察（異常漲跌、成交量變化、市場信號）`,
          },
          {
            role: 'user',
            content: `研究主題：${input.topic}\n研究目標：${goalMap[input.researchGoal]}${dataContext}\n\n請基於以上數據，產出一份完整的文章研究 Brief。`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'research_brief',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                coreInsights: { type: 'array', description: '核心洞察列表', items: { type: 'string' } },
                contentAngle: { type: 'string', description: '最佳文章切入角度' },
                keyDataPoints: { type: 'array', description: '必須引用的關鍵數據點', items: { type: 'string' } },
                titleOptions: { type: 'array', description: '標題草案（3個）', items: { type: 'string' } },
                outlineSuggestion: { type: 'array', description: 'H2 大綱建議', items: { type: 'string' } },
                targetAudience: { type: 'string', description: '目標讀者描述' },
                searchIntent: { type: 'string', description: '主要搜尋意圖' },
                dataLimitations: { type: 'string', description: '數據局限性說明' },
                estimatedLength: { type: 'string', description: '建議文章長度（短/中/長）' },
                rawDataSummary: { type: 'string', description: '數據摘要（供撰寫員參考）' },
              },
              required: ['coreInsights', 'contentAngle', 'keyDataPoints', 'titleOptions', 'outlineSuggestion', 'targetAudience', 'searchIntent', 'dataLimitations', 'estimatedLength', 'rawDataSummary'],
              additionalProperties: false,
            },
          },
        },
        thinking: { budget_tokens: 4096 },
      });
      return JSON.parse(response.choices[0].message.content as string);
    }),

  // ─── 每日市場快報自動生成 ───
  // 輸入：天數範圍 → 輸出：基於平台數據的市場快報文章
  generateDailyReport: adminProcedure
    .input(z.object({
      days: z.number().default(1),
      reportType: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
    }))
    .mutation(async ({ input }) => {
      const { invokeLLM } = await import('./_core/llm');
      const db = await import('./db');

      const [overview, trendingUp, trendingDown] = await Promise.all([
        db.getMarketOverview(),
        db.getTrendingByPriceIncrease({ limit: 5, days: input.days }).catch(() => []),
        db.getTrendingByPriceDecrease({ limit: 5, days: input.days }).catch(() => []),
      ]);

      const reportLabel: Record<string, string> = { daily: '每日', weekly: '每週', monthly: '每月' };

      const trendingUpText = (trendingUp as any[]).slice(0, 5).map((item: any) =>
        `- ${item.nameZh || item.name || '未知'}：+${item.priceChangePercent?.toFixed(1) || 0}% (HKD $${Math.round(item.currentPrice || 0).toLocaleString()})`
      ).join('\n');

      const trendingDownText = (trendingDown as any[]).slice(0, 5).map((item: any) =>
        `- ${item.nameZh || item.name || '未知'}：${item.priceChangePercent?.toFixed(1) || 0}% (HKD $${Math.round(item.currentPrice || 0).toLocaleString()})`
      ).join('\n');

      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `你是 Boxium PTCG 平台的市場快報撰稿人。根據平台真實成交數據，撰寫專業市場快報文章。所有價格以 HKD$ 表示。文章格式為 Markdown。`,
          },
          {
            role: 'user',
            content: `請根據以下 BOXIUM 平台真實數據，撰寫一篇${reportLabel[input.reportType] || '每日'}市場快報：

=== 市場概覽 ===
- 平台總卡牌數：${overview.totalCards}
- 近期成交記錄：${overview.totalPriceRecords}
- 7 天平均價格變動：${(overview.avgPriceChange7d as number)?.toFixed(1) || 0}%

=== 漲幅榜（近 ${input.days} 天）===
${trendingUpText || '暫無數據'}

=== 跌幅榜（近 ${input.days} 天）===
${trendingDownText || '暫無數據'}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'daily_report',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string', description: '文章標題' },
                excerpt: { type: 'string', description: '文章摘要（100-150字）' },
                content: { type: 'string', description: 'Markdown 格式正文' },
                tags: { type: 'array', description: '建議標籤', items: { type: 'string' } },
                seoTitle: { type: 'string', description: 'SEO 標題' },
                seoDescription: { type: 'string', description: 'SEO 描述' },
              },
              required: ['title', 'excerpt', 'content', 'tags', 'seoTitle', 'seoDescription'],
              additionalProperties: false,
            },
          },
        },
        thinking: { budget_tokens: 4096 },
      });
      return JSON.parse(response.choices[0].message.content as string);
    }),

  // ─── 內容刷新建議 ───
  suggestRefresh: adminProcedure
    .input(z.object({
      postId: z.number(),
      title: z.string(),
      content: z.string(),
      publishedAt: z.number(),
      viewCount: z.number(),
      category: z.string().optional(),
      tags: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { invokeLLM } = await import('./_core/llm');
      const daysSincePublish = Math.floor((Date.now() - input.publishedAt) / (1000 * 60 * 60 * 24));
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `你是 Boxium PTCG 平台的內容運營分析師。你的任務是分析文章的生命週期狀態，判斷是否需要更新，並給出具體的刷新建議。

分析維度：
1. 時效性：TCG 市場資訊通常 30 天後就需要更新
2. 瀏覽量：低瀏覽量可能需要重寫標題或優化 SEO
3. 內容完整性：是否有可以補充的新資訊
4. 市場相關性：價格數據是否已過時

刷新優先級：
- 緊急（發布超過 60 天且含價格數據）
- 建議（發布超過 30 天且瀏覽量低）
- 可選（發布超過 14 天但內容仍相關）
- 不需要（發布不足 14 天或為常青內容）`,
          },
          {
            role: 'user',
            content: `請分析以下文章的刷新需求：

標題：${input.title}
分類：${input.category || '未分類'}
標籤：${input.tags || '無'}
發布天數：${daysSincePublish} 天前
累計瀏覽量：${input.viewCount} 次

文章摘要（前 500 字）：
${input.content.substring(0, 500)}...`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'refresh_suggestion',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                needsRefresh: { type: 'boolean', description: '是否需要刷新' },
                priority: { type: 'string', description: '刷新優先級（緊急/建議/可選/不需要）' },
                reason: { type: 'string', description: '判斷原因' },
                suggestions: {
                  type: 'array',
                  description: '具體刷新建議',
                  items: {
                    type: 'object',
                    properties: {
                      action: { type: 'string', description: '建議動作（重寫標題/補充數據/更新價格/擴充內容/重新標籤）' },
                      detail: { type: 'string', description: '具體說明' },
                    },
                    required: ['action', 'detail'],
                    additionalProperties: false,
                  },
                },
                estimatedImpact: { type: 'string', description: '預期改善效果' },
                contentAge: { type: 'string', description: '內容年齡評估（常青/時效性強/已過時）' },
              },
              required: ['needsRefresh', 'priority', 'reason', 'suggestions', 'estimatedImpact', 'contentAge'],
              additionalProperties: false,
            },
          },
        },
        thinking: { budget_tokens: 1024 },
      });
      return JSON.parse(response.choices[0].message.content as string);
    }),
});
