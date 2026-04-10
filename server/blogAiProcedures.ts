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

  // ─── 內容優先級引擎 ───
  getContentPriorities: adminProcedure
    .input(z.object({
      topN: z.number().optional().default(10),
    }))
    .query(async ({ input }) => {
      const { invokeLLM } = await import('./_core/llm');
      const blogDb = await import('./blogDb');
      const { getTrendingByPriceIncrease } = await import('./db');

      const postsData = await blogDb.getPosts({ limit: 100, sortBy: 'newest' });
      const now = new Date();
      const existingPostsSummary = postsData.posts.map((p: any) => {
        const daysSinceUpdate = Math.floor((now.getTime() - new Date(p.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
        return `- ${p.title}（${p.category || '未分類'}，${p.status}，${daysSinceUpdate} 天前更新，${p.viewCount} 次瀏覽）`;
      }).join('\n');

      let trendingCardsSummary = '（暫無市場數據）';
      try {
        const trending = await getTrendingByPriceIncrease({ limit: 10, days: 7 });
        trendingCardsSummary = trending.slice(0, 10).map((c: any) =>
          `- ${c.name || c.nameJa}：7 日漲幅 ${c.priceChange7d || c.priceChange}%，現價 HKD$${c.currentPrice || c.latestPrice}`
        ).join('\n');
      } catch (e) { /* 市場數據暫時不可用 */ }

      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `你是 Boxium PTCG 平台的內容策劃員。根據市場熱度、現有文章缺口、內容時效性，為今日生成「內容優先級清單」，告訴管理員今天最值得寫哪些文章。

判斷標準（按重要性排序）：
1. 市場熱度：卡牌漲跌幅大 → 優先寫
2. 內容缺口：市場熱但平台沒有相關文章 → 優先寫
3. 內容過時：相關文章超過 30 天未更新 → 建議刷新
4. 流量潛力：SEO 搜尋需求高的主題 → 優先寫
5. 平台特色：與平台卡牌數據強相關的主題 → 優先寫`,
          },
          {
            role: 'user',
            content: `今日日期：${now.toLocaleDateString('zh-TW')}

現有文章（最近 100 篇）：
${existingPostsSummary}

市場熱門卡牌（7 日漲幅榜）：
${trendingCardsSummary}

請生成今日內容優先級清單（${input.topN} 個建議）`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'content_priorities',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                generatedAt: { type: 'string', description: '生成時間（ISO 格式）' },
                marketSummary: { type: 'string', description: '今日市場概況（1-2 句）' },
                priorities: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      rank: { type: 'number' },
                      title: { type: 'string', description: '建議文章標題' },
                      articleType: { type: 'string', description: '文章類型（daily-report/card-analysis/market-trend/news/beginner-guide）' },
                      priority: { type: 'string', description: '優先級（緊急/高/中/低）' },
                      reason: { type: 'string', description: '為什麼現在要寫這篇（具體理由）' },
                      relatedCards: { type: 'array', items: { type: 'string' }, description: '相關卡牌名稱' },
                      estimatedImpact: { type: 'string', description: '預期效果（流量/SEO/用戶價值）' },
                      actionType: { type: 'string', description: '建議動作（新寫/刷新/翻譯/補充數據）' },
                    },
                    required: ['rank', 'title', 'articleType', 'priority', 'reason', 'relatedCards', 'estimatedImpact', 'actionType'],
                    additionalProperties: false,
                  },
                },
                contentGaps: { type: 'array', items: { type: 'string' }, description: '平台內容缺口（3-5 個主題）' },
                quickWins: { type: 'array', items: { type: 'string' }, description: '快速見效的行動建議（2-3 條）' },
              },
              required: ['generatedAt', 'marketSummary', 'priorities', 'contentGaps', 'quickWins'],
              additionalProperties: false,
            },
          },
        },
        thinking: { budget_tokens: 2048 },
      });
      const result = JSON.parse(response.choices[0].message.content as string);
      result.generatedAt = now.toISOString();
      return result;
    }),

  // ─── 文章健康度計算 ───
  getArticleHealthScore: adminProcedure
    .input(z.object({
      postId: z.number(),
      title: z.string(),
      excerpt: z.string().optional(),
      content: z.string(),
      publishedAt: z.number().optional(),
      viewCount: z.number().optional(),
      metaKeywords: z.string().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      relatedCardIds: z.string().optional(),
      hasEnTranslation: z.boolean().optional(),
      hasJaTranslation: z.boolean().optional(),
    }))
    .query(async ({ input }) => {
      const now = Date.now();
      const daysSincePublish = input.publishedAt
        ? Math.floor((now - input.publishedAt) / (1000 * 60 * 60 * 24))
        : 0;

      // SEO 分數（0-100）
      let seoScore = 100;
      const seoIssues: string[] = [];
      if (!input.title || input.title.length < 10) { seoScore -= 20; seoIssues.push('標題過短'); }
      if (input.title && input.title.length > 60) { seoScore -= 10; seoIssues.push('標題過長'); }
      if (!input.excerpt || input.excerpt.length < 50) { seoScore -= 15; seoIssues.push('摘要不足'); }
      if (!input.metaKeywords || input.metaKeywords.split(',').filter((k: string) => k.trim()).length < 3) {
        seoScore -= 15; seoIssues.push('SEO 關鍵字不足');
      }
      const h2Count = (input.content.match(/^## /gm) || []).length;
      if (h2Count < 2) { seoScore -= 15; seoIssues.push('缺少 H2 標題結構'); }
      if (input.content.length < 500) { seoScore -= 20; seoIssues.push('內容過短'); }
      seoScore = Math.max(0, seoScore);

      // 內容新鮮度（0-100）
      let freshnessScore = 100;
      const freshnessIssues: string[] = [];
      if (daysSincePublish > 90) { freshnessScore -= 40; freshnessIssues.push('超過 90 天未更新'); }
      else if (daysSincePublish > 60) { freshnessScore -= 25; freshnessIssues.push('超過 60 天未更新'); }
      else if (daysSincePublish > 30) { freshnessScore -= 15; freshnessIssues.push('超過 30 天未更新'); }
      const hasCardData = !!(input.relatedCardIds && input.relatedCardIds !== '[]');
      if (hasCardData && daysSincePublish > 14) { freshnessScore -= 20; freshnessIssues.push('卡牌數據文章建議每 14 天更新'); }
      freshnessScore = Math.max(0, freshnessScore);

      // 可讀性（0-100）
      let readabilityScore = 100;
      const readabilityIssues: string[] = [];
      const wordCount = input.content.replace(/[#*`\[\]]/g, '').length;
      if (wordCount < 300) { readabilityScore -= 30; readabilityIssues.push('字數過少（< 300 字）'); }
      else if (wordCount < 600) { readabilityScore -= 15; readabilityIssues.push('字數偏少（< 600 字）'); }
      if (h2Count === 0) { readabilityScore -= 20; readabilityIssues.push('缺少章節結構'); }
      if (!input.content.includes('**')) { readabilityScore -= 10; readabilityIssues.push('缺少重點標記（粗體）'); }
      if (!input.content.includes('\n- ') && !input.content.includes('\n1. ')) { readabilityScore -= 10; readabilityIssues.push('缺少列表結構'); }
      readabilityScore = Math.max(0, readabilityScore);

      // 數據可信度（0-100）
      let dataCredibilityScore = 100;
      const dataIssues: string[] = [];
      if (!hasCardData) { dataCredibilityScore -= 30; dataIssues.push('未關聯平台卡牌數據'); }
      if (!/HKD\$\d+|\d+%|\d+\s*元/.test(input.content)) { dataCredibilityScore -= 25; dataIssues.push('缺少具體數字/價格引用'); }
      if (!/\d{4}年|\d{1,2}月|今日|本週|本月/.test(input.content)) { dataCredibilityScore -= 15; dataIssues.push('缺少時間參照'); }
      dataCredibilityScore = Math.max(0, dataCredibilityScore);

      // 多語言完整度（0-100）
      const i18nScore = (input.hasEnTranslation ? 50 : 0) + (input.hasJaTranslation ? 50 : 0);

      // 內容集群關聯度（0-100）
      let clusterScore = 50;
      const clusterIssues: string[] = [];
      if (!input.category) { clusterScore -= 20; clusterIssues.push('未設置分類'); }
      if (!input.tags || input.tags.length === 0) { clusterScore -= 20; clusterIssues.push('未設置標籤'); }
      if (input.tags && input.tags.length > 0) clusterScore += 20;
      clusterScore = Math.min(100, Math.max(0, clusterScore));

      // 整體健康度（加權平均）
      const overallScore = Math.round(
        seoScore * 0.25 +
        freshnessScore * 0.20 +
        readabilityScore * 0.20 +
        dataCredibilityScore * 0.20 +
        i18nScore * 0.05 +
        clusterScore * 0.10
      );

      const healthGrade =
        overallScore >= 80 ? '優秀' :
        overallScore >= 60 ? '良好' :
        overallScore >= 40 ? '一般' : '需改善';

      return {
        postId: input.postId,
        overallScore,
        healthGrade,
        dimensions: {
          seo: { score: seoScore, issues: seoIssues },
          freshness: { score: freshnessScore, issues: freshnessIssues, daysSincePublish },
          readability: { score: readabilityScore, issues: readabilityIssues, wordCount },
          dataCredibility: { score: dataCredibilityScore, issues: dataIssues, hasCardData },
          i18n: { score: i18nScore, hasEn: !!input.hasEnTranslation, hasJa: !!input.hasJaTranslation },
          cluster: { score: clusterScore, issues: clusterIssues },
        },
        topIssues: [...seoIssues.slice(0, 2), ...freshnessIssues.slice(0, 1), ...readabilityIssues.slice(0, 1), ...dataIssues.slice(0, 1)].slice(0, 5),
        recommendedActions: [
          ...(seoScore < 60 ? ['優化 SEO 關鍵字和標題結構'] : []),
          ...(freshnessScore < 60 ? ['更新文章數據和內容'] : []),
          ...(readabilityScore < 60 ? ['改善文章結構和可讀性'] : []),
          ...(dataCredibilityScore < 60 ? ['補充卡牌成交數據引用'] : []),
          ...(i18nScore < 50 ? ['新增英文或日文翻譯'] : []),
        ].slice(0, 3),
      };
    }),

  // ─── 內部連結建議 ───
  suggestInternalLinks: adminProcedure
    .input(z.object({
      postId: z.number(),
      title: z.string(),
      content: z.string(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const { invokeLLM } = await import('./_core/llm');
      const blogDb = await import('./blogDb');

      const postsData = await blogDb.getPosts({ status: 'published', limit: 50 });
      const publishedPosts = postsData.posts
        .filter((p: any) => p.id !== input.postId)
        .map((p: any) => `- [ID:${p.id}] ${p.title}（${p.category || '未分類'}）：${p.excerpt?.substring(0, 80) || '無摘要'}`);

      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `你是 Boxium PTCG 平台的 SEO 專家。分析當前文章，從現有文章庫中找出最適合做內部連結的文章。

內部連結原則：
1. 相關性：主題高度相關的文章優先
2. 自然性：連結應自然嵌入文章內容，不強行插入
3. 錨文字：建議具體的錨文字（不要用「點擊這裡」）
4. 數量：每篇文章建議 3-5 個內部連結
5. 避免重複：不連結到當前文章本身`,
          },
          {
            role: 'user',
            content: `當前文章：
標題：${input.title}
分類：${input.category || '未分類'}
標籤：${input.tags?.join('、') || '無'}
內容摘要：${input.content.substring(0, 400)}...

現有已發布文章庫：
${publishedPosts.join('\n')}

請建議最適合的內部連結`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'internal_links',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                suggestions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      targetPostId: { type: 'number' },
                      targetTitle: { type: 'string' },
                      anchorText: { type: 'string', description: '建議錨文字' },
                      insertionContext: { type: 'string', description: '建議插入位置（引用當前文章的相關段落）' },
                      relevanceReason: { type: 'string', description: '為什麼相關' },
                    },
                    required: ['targetPostId', 'targetTitle', 'anchorText', 'insertionContext', 'relevanceReason'],
                    additionalProperties: false,
                  },
                },
                missingTopics: { type: 'array', items: { type: 'string' }, description: '應該有但平台缺少的相關文章主題' },
              },
              required: ['suggestions', 'missingTopics'],
              additionalProperties: false,
            },
          },
        },
        thinking: { budget_tokens: 1024 },
      });
      return JSON.parse(response.choices[0].message.content as string);
    }),

  // ─── 內容集群分析 ───
  analyzeContentCluster: adminProcedure
    .input(z.object({
      clusterTopic: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { invokeLLM } = await import('./_core/llm');
      const blogDb = await import('./blogDb');

      const postsData = await blogDb.getPosts({ limit: 100 });
      const allPostsSummary = postsData.posts.map((p: any) =>
        `- [${p.status}] ${p.title}（${p.category || '未分類'}，標籤：${p.tags?.map((t: any) => t.name).join('/') || '無'}，${p.viewCount} 瀏覽）`
      ).join('\n');

      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `你是 Boxium PTCG 平台的 SEO 策略師。分析平台所有文章，識別現有的內容集群，找出缺口，並建議如何建立更強的 Topic Cluster 結構。

Topic Cluster 結構：
- 支柱文章（Pillar Page）：廣泛覆蓋某個主題的長文
- 支援文章（Cluster Content）：深入探討支柱文章的某個子主題
- 內部連結：支援文章連回支柱文章，支柱文章連向支援文章

Boxium PTCG 的核心主題集群應包括：
1. Pokémon TCG 市場分析
2. One Piece TCG 市場分析
3. 卡牌評級指南（PSA/CGC/BGS）
4. 收藏入門教學
5. 市場趨勢與投資`,
          },
          {
            role: 'user',
            content: `${input.clusterTopic ? `重點分析主題：${input.clusterTopic}\n\n` : ''}平台現有文章（共 ${postsData.posts.length} 篇）：
${allPostsSummary}

請分析內容集群結構並提供建議`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'content_cluster_analysis',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                existingClusters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      clusterName: { type: 'string' },
                      pillarArticleId: { type: 'number', description: '建議的支柱文章 ID（-1 表示尚未有）' },
                      pillarArticleTitle: { type: 'string' },
                      clusterArticleIds: { type: 'array', items: { type: 'number' } },
                      strength: { type: 'string', description: '集群強度（強/中/弱）' },
                      gaps: { type: 'array', items: { type: 'string' }, description: '缺少的子主題' },
                    },
                    required: ['clusterName', 'pillarArticleId', 'pillarArticleTitle', 'clusterArticleIds', 'strength', 'gaps'],
                    additionalProperties: false,
                  },
                },
                missingClusters: { type: 'array', items: { type: 'string' }, description: '平台應有但缺少的主題集群' },
                topPriorityActions: { type: 'array', items: { type: 'string' }, description: '最優先執行的 3-5 個行動' },
                overallClusterHealth: { type: 'string', description: '整體集群健康度評估' },
              },
              required: ['existingClusters', 'missingClusters', 'topPriorityActions', 'overallClusterHealth'],
              additionalProperties: false,
            },
          },
        },
        thinking: { budget_tokens: 2048 },
      });
      return JSON.parse(response.choices[0].message.content as string);
    }),

  // ─── 模板化文章生成 ───
  generateFromTemplate: adminProcedure
    .input(z.object({
      templateType: z.enum(['market-report', 'card-research', 'trend-analysis', 'beginner-guide', 'platform-news']),
      variables: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const { invokeLLM } = await import('./_core/llm');

      const templates: Record<string, { name: string; skeleton: string; systemNote: string }> = {
        'market-report': {
          name: '市場快報模板',
          skeleton: `# 【市場快報】{日期} Pokémon TCG 市場動態\n\n## 今日市場概況\n{市場整體走勢，2-3 句}\n\n## 重點卡牌動態\n### {卡牌名稱 1}\n- 現價：HKD${'{'}現價{'}'} | 7 日漲跌：{漲跌幅}%\n- 分析：{1-2 句分析}\n\n## 市場趨勢觀察\n{2-3 個趨勢觀察}\n\n## 投資建議\n{具體建議，包含風險提示}\n\n---\n*數據來源：Boxium PTCG 平台成交記錄*`,
          systemNote: '市場快報要求：數據準確、語氣專業、重點突出、字數 600-800 字',
        },
        'card-research': {
          name: '單卡研究模板',
          skeleton: `# {卡牌名稱} 深度研究報告\n\n## 卡牌基本資料\n- **系列**：{系列名稱}\n- **稀有度**：{稀有度}\n- **評級版本**：PSA 10 / CGC 10 / 中古 A 級\n\n## 價格分析\n### PSA 10 評級版\n- 現價：HKD${'{'}現價{'}'} | 30 日均價：HKD${'{'}30日均價{'}'}\n- 30 日漲跌：{漲跌幅}%\n\n## 歷史走勢分析\n{價格歷史走勢分析，包含高點和低點}\n\n## 市場需求分析\n{為什麼這張卡受歡迎，競爭格局}\n\n## 收藏與投資建議\n{具體建議，包含風險提示}\n\n## 常見問題\n**Q: {問題 1}**\nA: {答案 1}\n\n---\n*數據來源：Boxium PTCG 平台成交記錄 | 更新日期：{日期}*`,
          systemNote: '單卡研究要求：數據詳盡、分析深入、適合收藏家閱讀、字數 1000-1500 字',
        },
        'trend-analysis': {
          name: '趨勢報告模板',
          skeleton: `# {時間段} Pokémon TCG 市場趨勢報告\n\n## 執行摘要\n{3-5 句核心結論}\n\n## 市場整體走勢\n{整體趨勢分析}\n\n## 各類別表現\n### PSA 10 評級市場\n{分析}\n\n### 中古 A 級市場\n{分析}\n\n## 熱門卡牌排行\n{漲幅榜 Top 5}\n\n## 影響市場的關鍵因素\n1. {因素 1}\n2. {因素 2}\n3. {因素 3}\n\n## 未來走勢預測\n{預測，包含風險提示}\n\n## 結語\n{總結和 CTA}\n\n---\n*數據來源：Boxium PTCG 平台成交記錄*`,
          systemNote: '趨勢報告要求：分析性強、有數據支撐、專業客觀、字數 1000-1500 字',
        },
        'beginner-guide': {
          name: '收藏入門教學模板',
          skeleton: `# {主題} 完全入門指南\n\n## 前言\n{為什麼要讀這篇文章}\n\n## 基礎概念\n### {概念 1}\n{解釋}\n\n### {概念 2}\n{解釋}\n\n## 入門步驟\n1. **第一步：{步驟名稱}**\n   {詳細說明}\n\n2. **第二步：{步驟名稱}**\n   {詳細說明}\n\n## 常見錯誤\n- ❌ {錯誤 1}：{解釋}\n- ❌ {錯誤 2}：{解釋}\n\n## 常見問題\n**Q: {問題}**\nA: {答案}\n\n## 結語\n{鼓勵性結語 + CTA}\n\n---\n*Boxium PTCG — 香港最專業的 TCG 資訊平台*`,
          systemNote: '入門教學要求：淺白易懂、步驟清晰、適合新手、字數 800-1200 字',
        },
        'platform-news': {
          name: '平台公告模板',
          skeleton: `# {公告標題}\n\n## 重要更新\n{核心公告內容，1-2 段}\n\n## 詳細說明\n{詳細說明新功能或變更}\n\n## 如何使用\n1. {步驟 1}\n2. {步驟 2}\n\n## 常見問題\n**Q: {問題}**\nA: {答案}\n\n## 聯絡我們\n如有任何疑問，歡迎透過平台聯絡我們。\n\n---\n*Boxium PTCG 團隊*`,
          systemNote: '平台公告要求：清晰直接、重點突出、友善語氣、字數 400-600 字',
        },
      };

      const template = templates[input.templateType];
      const variablesText = input.variables
        ? Object.entries(input.variables).map(([k, v]) => `- ${k}：${v}`).join('\n')
        : '（請根據模板骨架自動填充）';

      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `你是 Boxium PTCG 平台的專業文章撰稿人。根據提供的模板骨架，生成一篇完整的文章。

${template.systemNote}

規範：
- 繁體中文，香港口語與書面語混合
- 所有價格以 HKD$ 表示
- 保留 TCG 術語（PSA 10、CGC 10、GEM-MT 10 等）
- 使用 Markdown 格式
- 數據導向，引用具體數字
- 不捏造數據，如無數據則說明`,
          },
          {
            role: 'user',
            content: `模板類型：${template.name}\n\n模板骨架：\n${template.skeleton}\n\n填充變量：\n${variablesText}\n\n請根據模板骨架生成完整文章（保留 Markdown 格式，替換所有 {佔位符}）`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'template_article',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string', description: '文章標題' },
                excerpt: { type: 'string', description: '文章摘要（50-160 字）' },
                content: { type: 'string', description: '完整 Markdown 正文' },
                templateUsed: { type: 'string', description: '使用的模板名稱' },
                suggestedTags: { type: 'array', items: { type: 'string' }, description: '建議標籤' },
                seoTitle: { type: 'string', description: 'SEO 標題' },
                seoKeywords: { type: 'string', description: 'SEO 關鍵字（逗號分隔）' },
              },
              required: ['title', 'excerpt', 'content', 'templateUsed', 'suggestedTags', 'seoTitle', 'seoKeywords'],
              additionalProperties: false,
            },
          },
        },
        thinking: { budget_tokens: 4096 },
      });
      return JSON.parse(response.choices[0].message.content as string);
    }),
});
