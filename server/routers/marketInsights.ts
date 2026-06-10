/**
 * MarketInsights tRPC Router
 * Market analysis: top gainers, top searched, volatility, overview
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import * as db from "../db";

export const marketInsightsRouter = router({
    // Get top 5 cards with highest price increase in the past 7 days
    getTopGainers: publicProcedure
      .input(z.object({
        days: z.number().optional().default(7),
        limit: z.number().optional().default(5),
      }))
      .query(async ({ input }) => {
        const topGainers = await db.getTopPriceGainers(input.days, input.limit);
        return topGainers;
      }),

    // Get top cards with highest price decrease in the past N days
    getTopLosers: publicProcedure
      .input(z.object({
        days: z.number().optional().default(7),
        limit: z.number().optional().default(10),
      }))
      .query(async ({ input }) => {
        const topLosers = await db.getTopPriceLosers(input.days, input.limit);
        return topLosers;
      }),

    // Get top 5 most searched cards in the past 7 days
    getTopSearched: publicProcedure
      .input(z.object({
        days: z.number().optional().default(7),
        limit: z.number().optional().default(5),
      }))
      .query(async ({ input }) => {
        // userSearchLogs table removed, return empty array
        return [];
      }),

    // Get top 5 cards with highest price volatility in the past 7 days
    getTopVolatile: publicProcedure
      .input(z.object({
        days: z.number().optional().default(7),
        limit: z.number().optional().default(5),
      }))
      .query(async ({ input }) => {
        const topVolatile = await db.getTopVolatileCards(input.days, input.limit);
        return topVolatile;
      }),

    // Get market overview statistics
    getMarketOverview: publicProcedure
      .query(async () => {
        const overview = await db.getMarketOverview();
        return overview;
      }),

    // Generate market analysis using LLM
    generateAnalysis: publicProcedure
      .input(z.object({
        language: z.enum(["zh-TW", "en", "ja"]).optional().default("zh-TW"),
      }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import("../_core/llm");
        
        // Fetch market data
        const topGainers = await db.getTopPriceGainers(7, 5);
        // const topSearched = await db.getTopSearchedCards(7, 5); // userSearchLogs table removed
        const topSearched: any[] = []; // Placeholder
        const topVolatile = await db.getTopVolatileCards(7, 5);
        const overview = await db.getMarketOverview();

        // Prepare prompt based on language
        const languageMap = {
          "zh-TW": "繁體中文",
          "en": "English",
          "ja": "日本語",
        };

        const prompt = `你是一位專業的 PTCG（Pokémon Trading Card Game）市場分析師。請根據以下市場數據，生成一份專業的市場分析報告。

市場概況：
- 追蹤卡牌數量：${overview.totalCards}
- 價格記錄數量：${overview.totalPriceRecords}
- 用戶搜尋次數：${overview.totalSearches}
- 7 天平均漲幅：${overview.avgPriceChange7d.toFixed(2)}%

本週漲幅 Top 5：
${topGainers.map((card, i) => `${i + 1}. ${card.cardName} - 漲幅 ${card.priceChange.toFixed(2)}%`).join("\n")}

熱門搜尋 Top 5：
${topSearched.map((card, i) => `${i + 1}. ${card.cardName} - ${card.searchCount} 次搜尋`).join("\n")}

價格波動 Top 5：
${topVolatile.map((card, i) => `${i + 1}. ${card.cardName} - 波動率 ${card.volatility.toFixed(2)}%`).join("\n")}

請用${languageMap[input.language]}撰寫一份 200-300 字的市場分析報告，包含以下內容：
1. 本週市場整體趨勢分析
2. 重點卡牌分析（挑選 2-3 張最值得關注的卡牌）
3. 投資建議和風險提示

請使用專業但易懂的語言，避免過度技術性的術語。`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "你是一位專業的 PTCG 市場分析師，擅長分析卡牌市場趨勢和提供投資建議。" },
              { role: "user", content: prompt },
            ],
          });

          const analysis = response.choices[0]?.message?.content || "無法生成市場分析，請稍後再試。";
          return { analysis };
        } catch (error) {
          console.error("[LLM] Failed to generate market analysis:", error);
          return { analysis: "市場分析生成失敗，請稍後再試。" };
        }
      }),
});
