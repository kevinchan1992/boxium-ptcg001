import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { extractSnkrdunkId, scrapeSnkrdunkPage, convertJpyToHkd } from "./snkrdunkScraper";
import { searchAndSaveEbaySoldItems, extractCardNumber, cleanCardNameForSearch } from "./ebayService";
import { searchEbayItems, convertUsdToHkd, getUsdToHkdRate } from "./ebay";
import { getUpdateStatus, manualUpdateDataSource, getSchedulerStatus, triggerManualUpdateAll } from "./scheduler";

export const appRouter = router({
  system: systemRouter,
  
  // Auth router removed - now using Supabase Auth

  cards: router({
    search: publicProcedure
      .input(z.object({
        query: z.string(),
        limit: z.number().optional().default(20),
      }))
      .query(async ({ input }) => {
        const results = await db.searchCards(input.query, input.limit);
        return results;
      }),

    getById: publicProcedure
      .input(z.object({
        id: z.number(),
      }))
      .query(async ({ input }) => {
        const card = await db.getCardById(input.id);
        return card;
      }),

    getByCardId: publicProcedure
      .input(z.object({
        cardId: z.string(),
      }))
      .query(async ({ input }) => {
        const card = await db.getCardByCardId(input.cardId);
        return card;
      }),

    getPopular: publicProcedure
      .input(z.object({
        limit: z.number().optional().default(10),
      }))
      .query(async ({ input }) => {
        const cards = await db.getPopularCards(input.limit);
        return cards;
      }),

    getTrending: publicProcedure
      .input(z.object({
        limit: z.number().optional().default(5),
      }))
      .query(async ({ input }) => {
        try {
          // Get all cards with price history
          const allCards = await db.getAllCards();
          const now = new Date();
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

          const trendingCards = [];

          for (const card of allCards) {
            // Get price history for this card (PSA 10 only)
            const allHistory = await db.getPriceHistoryByCardId(card.id);
            const psa10History = allHistory.filter(r => 
              r.grade === "PSA 10" || r.grade === "PSA10"
            );

            if (psa10History.length === 0) continue;

            // Calculate recent 7 days average (last 7 days)
            const recentPrices = psa10History
              .filter(r => {
                const date = new Date(r.soldAt || r.createdAt);
                return date >= sevenDaysAgo && date <= now;
              })
              .map(r => parseFloat(r.price));

            // Calculate previous 7 days average (7-14 days ago)
            const previousPrices = psa10History
              .filter(r => {
                const date = new Date(r.soldAt || r.createdAt);
                return date >= fourteenDaysAgo && date < sevenDaysAgo;
              })
              .map(r => parseFloat(r.price));

            // Need both periods to have data
            if (recentPrices.length === 0 || previousPrices.length === 0) continue;

            const recentAvg = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
            const previousAvg = previousPrices.reduce((a, b) => a + b, 0) / previousPrices.length;
            const priceChange = ((recentAvg - previousAvg) / previousAvg) * 100;

            // Only include cards with positive price change
            if (priceChange > 0) {
              trendingCards.push({
                ...card,
                currentPrice: recentAvg,
                priceChange,
                priceChangeFormatted: `+${priceChange.toFixed(1)}%`,
              });
            }
          }

          // Sort by price change descending and return top N
          const topTrending = trendingCards
            .sort((a, b) => b.priceChange - a.priceChange)
            .slice(0, input.limit);

          return topTrending;
        } catch (error: any) {
          console.error("[getTrending] Error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to get trending cards: ${error.message}`,
          });
        }
      }),

    getPriceTrendData: publicProcedure
      .input(z.object({
        cardId: z.number(),
        days: z.number().optional().default(90),
      }))
      .query(async ({ input }) => {
        try {
          const card = await db.getCardById(input.cardId);
          if (!card) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
          }

          // Get all price history for this card (PSA 10 only)
          const allHistory = await db.getPriceHistoryByCardId(input.cardId);
          
          // Filter by date range (last N days) and grade (PSA 10 only)
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - input.days);
          
          const recentHistory = allHistory.filter(record => 
            new Date(record.soldAt || record.createdAt) >= cutoffDate &&
            (record.grade === "PSA 10" || record.grade === "PSA10")
          );

          // Group by date and source
          const groupedByDate = new Map<string, { snkrdunk: any[]; ebay: any[] }>();
          
          for (const record of recentHistory) {
            // Only include PSA 10 records
            if (record.grade !== "PSA 10" && record.grade !== "PSA10") continue;
            
            const date = new Date(record.soldAt || record.createdAt);
            const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
            
            if (!groupedByDate.has(dateStr)) {
              groupedByDate.set(dateStr, { snkrdunk: [], ebay: [] });
            }
            
            const group = groupedByDate.get(dateStr)!;
            if (record.source === "snkrdunk") {
              group.snkrdunk.push(record);
            } else if (record.source === "ebay") {
              group.ebay.push(record);
            }
          }

          // Calculate daily averages
          const trendData = Array.from(groupedByDate.entries())
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([date, data]) => {
              const snkrdunkPrices = data.snkrdunk.map(r => parseFloat(r.price));
              const ebayPrices = data.ebay.map(r => parseFloat(r.price));
              
              return {
                date,
                snkrdunkPrice: snkrdunkPrices.length > 0 
                  ? snkrdunkPrices.reduce((a, b) => a + b, 0) / snkrdunkPrices.length 
                  : undefined,
                snkrdunkCount: snkrdunkPrices.length,
                ebayPrice: ebayPrices.length > 0 
                  ? ebayPrices.reduce((a, b) => a + b, 0) / ebayPrices.length 
                  : undefined,
                ebayCount: ebayPrices.length,
              };
            });

          // Calculate statistics
          const allSnkrdunkPrices = recentHistory
            .filter(r => r.source === "snkrdunk")
            .map(r => parseFloat(r.price));
          const allEbayPrices = recentHistory
            .filter(r => r.source === "ebay")
            .map(r => parseFloat(r.price));

          const stats = {
            snkrdunk: allSnkrdunkPrices.length > 0 ? {
              minPrice: Math.min(...allSnkrdunkPrices),
              maxPrice: Math.max(...allSnkrdunkPrices),
              avgPrice: allSnkrdunkPrices.reduce((a, b) => a + b, 0) / allSnkrdunkPrices.length,
              latestPrice: parseFloat(recentHistory
                .filter(r => r.source === "snkrdunk")
                .sort((a: any, b: any) => new Date(b.soldAt || b.createdAt).getTime() - new Date(a.soldAt || a.createdAt).getTime())[0]?.price || "0"),
            } : { minPrice: 0, maxPrice: 0, avgPrice: 0, latestPrice: 0 },
            ebay: allEbayPrices.length > 0 ? {
              minPrice: Math.min(...allEbayPrices),
              maxPrice: Math.max(...allEbayPrices),
              avgPrice: allEbayPrices.reduce((a, b) => a + b, 0) / allEbayPrices.length,
              latestPrice: parseFloat(recentHistory
                .filter(r => r.source === "ebay")
                .sort((a: any, b: any) => new Date(b.soldAt || b.createdAt).getTime() - new Date(a.soldAt || a.createdAt).getTime())[0]?.price || "0"),
            } : { minPrice: 0, maxPrice: 0, avgPrice: 0, latestPrice: 0 },
          };

          return {
            cardId: card.id,
            cardName: card.name,
            trendData,
            stats,
          };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to get price trend data: ${error.message}`,
          });
        }
      }),

    getEbaySoldItems: publicProcedure
      .input(z.object({
        cardId: z.number(),
        limit: z.number().optional().default(20),
        forceRefresh: z.boolean().optional().default(false),
      }))
      .query(async ({ input }) => {
        try {
          // First, try to get from database
          if (!input.forceRefresh) {
            const dbRecords = await db.getPriceHistory(input.cardId, "ebay", "PSA10", input.limit);
            
            // If we have recent records (within 7 days), return them
            if (dbRecords.length > 0) {
              const latestRecord = dbRecords[0];
              const daysSinceUpdate = latestRecord.createdAt 
                ? (Date.now() - new Date(latestRecord.createdAt).getTime()) / (1000 * 60 * 60 * 24)
                : 999;
              
              if (daysSinceUpdate < 7) {
                console.log(`[eBay] Returning ${dbRecords.length} cached records for card ${input.cardId}`);
                // Convert database records to EbaySoldItem format
                return dbRecords.map(record => ({
                  title: `PSA 10 - ${record.grade || "Unknown"}`,
                  price: parseFloat(record.price),
                  currency: record.currency,
                  soldDate: record.soldAt || new Date(),
                  imageUrl: null,
                  itemUrl: record.listingUrl || "",
                  condition: record.condition || "PSA 10",
                }));
              }
            }
          }

          // If no recent records or force refresh, fetch from eBay API
          const card = await db.getCardById(input.cardId);
          if (!card) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
          }

          // Extract card number from card name
          const cardNumber = extractCardNumber(card.name);
          if (!cardNumber) {
            console.warn(`[eBay] Cannot extract card number from: ${card.name}`);
            return [];
          }

          // Clean card name for search
          const cleanedName = cleanCardNameForSearch(card.name);

          // Search eBay for sold PSA10 items and save to database
          console.log(`[eBay] Fetching fresh data from eBay API for card ${input.cardId}`);
          const soldItems = await searchAndSaveEbaySoldItems(
            input.cardId,
            cleanedName,
            cardNumber,
            input.limit,
            true // Save to database
          );
          return soldItems;
        } catch (error: any) {
          console.error("[eBay] Error fetching sold items:", error.message);
          // Return empty array instead of throwing error to avoid breaking the UI
          return [];
        }
      }),

    // eBay Browse API - 搜尋活躍商品作為市場參考價
    searchEbayMarketPrice: publicProcedure
      .input(z.object({
        cardName: z.string(),
        cardNumber: z.string().optional(),
        limit: z.number().optional().default(10),
      }))
      .query(async ({ input }) => {
        try {
          // 簡化卡牌名稱以提高 eBay 搜尋成功率
          // 移除括號內容、特殊字符，只保留核心名稱
          let simplifiedName = input.cardName
            .replace(/\[.*?\]/g, '') // 移除方括號內容
            .replace(/\(.*?\)/g, '') // 移除圓括號內容
            .replace(/[：:]/g, '') // 移除冒號
            .replace(/\s+/g, ' ') // 合併多個空格
            .trim();

          // 構建搜尋關鍵字：簡化名稱 + 卡號 + PSA 10
          let searchQuery = simplifiedName;
          if (input.cardNumber) {
            // 只取卡號的核心部分（例如 "085" 而不是 "SVP EN 085"）
            const coreCardNumber = input.cardNumber.match(/\d+/)?.[0] || input.cardNumber;
            searchQuery += ` ${coreCardNumber}`;
          }
          searchQuery += " PSA 10 Pokemon";

          console.log(`[eBay Browse API] Original name: "${input.cardName}"`);
          console.log(`[eBay Browse API] Simplified search: "${searchQuery}"`);

          // 搜尋 eBay 活躍商品
          const items = await searchEbayItems(searchQuery, input.limit);
          console.log(`[eBay Browse API] Found ${items.length} items`);

          // 轉換價格為 HKD
          const itemsWithHkd = await Promise.all(
            items.map(async (item) => {
              const usdPrice = parseFloat(item.price.value);
              const hkdPrice = await convertUsdToHkd(usdPrice);
              return {
                ...item,
                priceHkd: hkdPrice,
              };
            })
          );

          return itemsWithHkd;
        } catch (error: any) {
          console.error("[eBay Browse API] Error:", error.message);
          return [];
        }
      }),

    // 獲取當前 USD → HKD 匯率
    getExchangeRate: publicProcedure
      .query(async () => {
        try {
          const rate = await getUsdToHkdRate();
          return { rate, lastUpdated: new Date() };
        } catch (error: any) {
          console.error("[Exchange Rate] Error:", error.message);
          return { rate: 7.8, lastUpdated: new Date() }; // 後備匯率
        }
      }),
  }),

  prices: router({
    getHistory: publicProcedure
      .input(z.object({
        cardId: z.number(),
        source: z.enum(["snkrdunk", "ebay", "tcgplayer", "other"]).optional(),
        grade: z.string().optional(),
        limit: z.number().optional().default(50),
      }))
      .query(async ({ input }) => {
        const history = await db.getPriceHistory(
          input.cardId,
          input.source,
          input.grade,
          input.limit
        );
        return history;
      }),

    getStatistics: publicProcedure
      .input(z.object({
        cardId: z.number(),
        source: z.enum(["snkrdunk", "ebay", "tcgplayer", "other"]).optional(),
        grade: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const stats = await db.getPriceStatistics(
          input.cardId,
          input.source,
          input.grade
        );
        return stats;
      }),
  }),

  trends: router({
    getMarketTrends: publicProcedure
      .input(z.object({
        cardId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        const trends = await db.getMarketTrends(
          input.cardId,
          input.startDate,
          input.endDate
        );
        return trends;
      }),
  }),

  admin: router({
    getDataSources: publicProcedure
      .query(async ({ ctx }) => {
const sources = await db.getDataSources();
        return sources;
      }),

    addSnkrdunkSource: publicProcedure
      .input(z.object({
        url: z.string().url(),
      }))
      .mutation(async ({ ctx, input }) => {
const snkrdunkId = extractSnkrdunkId(input.url);
        if (!snkrdunkId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid SNKRDUNK URL" });
        }

        // Normalize URL for duplicate check
        const normalizedUrl = input.url.split('?')[0].split('#')[0];
        
        // Check if data source already exists
        const allDataSources = await db.getDataSources();
        const existingDataSource = allDataSources.find(ds => {
          const existingNormalized = ds.sourceUrl.split('?')[0].split('#')[0];
          return existingNormalized === normalizedUrl;
        });

        if (existingDataSource) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: `Data source already exists: ${normalizedUrl}` 
          });
        }

        try {
          // Scrape SNKRDUNK page
          const cardData = await scrapeSnkrdunkPage(input.url);

          // Create or update card
          const existingCard = await db.getCardByCardId(`snkrdunk-${snkrdunkId}`);
          let cardId: number;

          if (existingCard) {
            cardId = existingCard.id;
            // Update card with scraped data
            await db.updateCard(cardId, {
              name: cardData.name,
              nameJa: cardData.nameJa,
              imageUrl: cardData.imageUrl || undefined,
            });
          } else {
            // Create new card
            cardId = await db.createCard({
              cardId: `snkrdunk-${snkrdunkId}`,
              name: cardData.name,
              nameJa: cardData.nameJa,
              imageUrl: cardData.imageUrl || undefined,
            });
          }

          // Add data source (now guaranteed to be new)
          await db.addDataSource({
            cardId,
            source: "snkrdunk",
            sourceUrl: input.url,
            sourceIdentifier: snkrdunkId,
          });

          // Save price history
          for (const priceEntry of cardData.priceHistory) {
            const priceHkd = convertJpyToHkd(priceEntry.price);
            await db.addPriceHistory({
              cardId,
              source: "snkrdunk",
              price: priceHkd.toString(),
              currency: "HKD",
              grade: priceEntry.grade,
              soldAt: priceEntry.soldAt,
              listingUrl: input.url,
            });
          }

          // Get and update data source status
          const dataSources = await db.getDataSources();
          const newDataSource = dataSources.find(
            (ds) => ds.cardId === cardId && ds.source === "snkrdunk"
          );
          if (newDataSource) {
            await db.updateDataSourceFetchStatus(newDataSource.id, "success");
          }

          return { success: true, cardId, priceCount: cardData.priceHistory.length };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to scrape SNKRDUNK: ${error.message}`,
          });
        }
      }),

    refreshDataSource: publicProcedure
      .input(z.object({
        dataSourceId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
try {
          // Get data source
          const dataSource = await db.getDataSourceById(input.dataSourceId);
          if (!dataSource) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Data source not found" });
          }

          // Scrape SNKRDUNK page
          const cardData = await scrapeSnkrdunkPage(dataSource.sourceUrl);

          // Update card
          await db.updateCard(dataSource.cardId, {
            name: cardData.name,
            nameJa: cardData.nameJa,
            imageUrl: cardData.imageUrl || undefined,
          });

          // Save new price history
          for (const priceEntry of cardData.priceHistory) {
            const priceHkd = convertJpyToHkd(priceEntry.price);
            await db.addPriceHistory({
              cardId: dataSource.cardId,
              source: "snkrdunk",
              price: priceHkd.toString(),
              currency: "HKD",
              grade: priceEntry.grade,
              soldAt: priceEntry.soldAt,
              listingUrl: dataSource.sourceUrl,
            });
          }

          // Update data source status
          await db.updateDataSourceFetchStatus(input.dataSourceId, "success");

          return { success: true, priceCount: cardData.priceHistory.length };
        } catch (error: any) {
          await db.updateDataSourceFetchStatus(
            input.dataSourceId,
            "failed",
            error.message
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to refresh data source: ${error.message}`,
          });
        }
      }),

    getUpdateStatus: publicProcedure
      .input(z.object({
        dataSourceId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
const status = await getUpdateStatus(input.dataSourceId);
        return status;
      }),

    manualUpdate: publicProcedure
      .input(z.object({
        dataSourceId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
try {
          await manualUpdateDataSource(input.dataSourceId);
          return { success: true };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to trigger manual update: ${error.message}`,
          });
        }
      }),

    deleteDataSource: publicProcedure
      .input(z.object({
        dataSourceId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
try {
          await db.deleteDataSource(input.dataSourceId);
          return { success: true };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to delete data source: ${error.message}`,
          });
        }
      }),

    autoCrawlSnkrdunk: publicProcedure
      .input(z.object({
        startPage: z.number().min(1).default(1),
        endPage: z.number().min(1).default(1575),
      }))
      .mutation(async ({ ctx, input }) => {
const { autoCrawlSnkrdunk } = await import("./scheduler");
        
        try {
          const result = await autoCrawlSnkrdunk(input.startPage, input.endPage);
          return result;
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Auto crawl failed: ${error.message}`,
          });
        }
      }),

    getCrawlProgress: publicProcedure
      .query(async ({ ctx }) => {
const { getCrawlProgress } = await import("./scheduler");
        return getCrawlProgress();
      }),

    getSchedulerStatus: publicProcedure
      .query(async ({ ctx }) => {
const status = await getSchedulerStatus();
        return status;
      }),

    triggerManualUpdateAll: publicProcedure
      .mutation(async ({ ctx }) => {
try {
          await triggerManualUpdateAll();
          return { success: true };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to trigger manual update: ${error.message}`,
          });
        }
      }),

    cleanDuplicateDataSources: publicProcedure
      .mutation(async ({ ctx }) => {
try {
          // Get all data sources
          const allSources = await db.getDataSources();
          
          // Group by normalized URL
          const urlGroups = new Map<string, typeof allSources>();
          
          for (const source of allSources) {
            const normalizedUrl = source.sourceUrl.split('?')[0].split('#')[0];
            if (!urlGroups.has(normalizedUrl)) {
              urlGroups.set(normalizedUrl, []);
            }
            urlGroups.get(normalizedUrl)!.push(source);
          }
          
          // Delete duplicates (keep the newest one)
          let deletedCount = 0;
          for (const [normalizedUrl, sources] of Array.from(urlGroups.entries())) {
            if (sources.length > 1) {
              // Sort by createdAt (newest first)
              sources.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              
              // Delete all except the first one (which is the newest)
              for (let i = 1; i < sources.length; i++) {
                await db.deleteDataSource(sources[i].id);
                deletedCount++;
              }
            }
          }
          
          return { 
            success: true, 
            deletedCount,
            message: `Successfully deleted ${deletedCount} duplicate data sources`
          };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to clean duplicates: ${error.message}`,
          });
        }
      }),

    deleteFailedDataSources: publicProcedure
      .mutation(async ({ ctx }) => {
try {
          const result = await db.deleteFailedDataSources();
          
          if (!result.success) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to delete failed data sources",
            });
          }
          
          return { 
            success: true, 
            deletedCount: result.deletedCount,
            message: `Successfully deleted ${result.deletedCount} failed data sources`
          };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to delete failed data sources: ${error.message}`,
          });
        }
      }),

  updateCardEnglishNames: publicProcedure.mutation(async () => {
    const dataSources = await db.getDataSources();
    
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const source of dataSources) {
      if (!source.cardId) continue;

      try {
        const productId = source.sourceUrl.match(/\/apparels\/(\d+)/);
        if (!productId) continue;

        // Fetch English name from API
        const apiUrl = `https://snkrdunk.com/v1/apparels/${productId[1]}`;
        const response = await fetch(apiUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
          },
        });

        if (!response.ok) {
          failed++;
          continue;
        }

        const data = await response.json();
        const nameEn = data.name;

        // Update card with English name using db function
        await db.updateCard(source.cardId, { name: nameEn });

        updated++;
        console.log(`[Update] Card ${source.cardId}: ${nameEn}`);
      } catch (error: any) {
        failed++;
        errors.push(`${source.sourceUrl}: ${error.message}`);
      }
    }

    return {
      success: true,
      updated,
      failed,
      errors: errors.slice(0, 10),
    };
  }),

  updateAllEbayRecords: publicProcedure.mutation(async ({ ctx }) => {
// Get all data sources with cards
    const dataSources = await db.getDataSources();
    const uniqueCards = new Map<number, { id: number; name: string }>();
    
    for (const source of dataSources) {
      if (source.cardId && source.card) {
        uniqueCards.set(source.cardId, { id: source.cardId, name: source.card.name });
      }
    }

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const card of Array.from(uniqueCards.values())) {
      try {
        const cardNumber = extractCardNumber(card.name);
        if (!cardNumber) {
          console.log(`[UpdateEbay] Cannot extract card number from: ${card.name}`);
          continue;
        }

        const cleanedName = cleanCardNameForSearch(card.name);
        await searchAndSaveEbaySoldItems(card.id, cleanedName, cardNumber, 20, true);
        console.log(`[UpdateEbay] Updated eBay records for card ${card.id}`);
        updated++;

        // Add delay to avoid rate limit (200ms between requests)
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error: any) {
        failed++;
        errors.push(`Card ${card.id}: ${error.message}`);
      }
    }

    return {
      success: true,
      updated,
      failed,
      total: uniqueCards.size,
      errors: errors.slice(0, 10),
    };
  }),

  fixOrphanDataSources: publicProcedure.mutation(async ({ ctx }) => {
try {
          const { fixOrphanDataSources } = await import("./fixOrphanDataSources");
          const result = await fixOrphanDataSources();
          
          return { 
            success: true, 
            fixed: result.fixed,
            failed: result.failed,
            failedUrls: result.failedUrls,
            message: `Fixed ${result.fixed} orphan data sources, ${result.failed} failed`
          };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to fix orphan data sources: ${error.message}`,
          });
        }
      }),

    getFirecrawlUsageStats: publicProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
const stats = await db.getFirecrawlUsageStats(
          input?.startDate,
          input?.endDate
        );
        
        // Get quota limit from system settings
        const quotaLimitSetting = await db.getSystemSetting("firecrawl_quota_limit");
        const quotaLimit = quotaLimitSetting ? parseInt(quotaLimitSetting.settingValue) : null;
        
        return {
          ...stats,
          quotaLimit,
          quotaUsagePercent: quotaLimit ? (stats!.totalCreditsUsed / quotaLimit) * 100 : null,
        };
      }),

    setFirecrawlQuotaLimit: publicProcedure
      .input(z.object({
        limit: z.number().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
await db.setSystemSetting(
          "firecrawl_quota_limit",
          input.limit.toString(),
          "Firecrawl monthly quota limit"
        );
        
        return { success: true };
      }),

    // Get SMTP settings
    getSmtpSettings: publicProcedure
      .query(async ({ ctx }) => {
const settings = {
          smtpHost: await db.getSystemSetting("smtp_host"),
          smtpPort: await db.getSystemSetting("smtp_port"),
          smtpUser: await db.getSystemSetting("smtp_user"),
          fromEmail: await db.getSystemSetting("from_email"),
          fromName: await db.getSystemSetting("from_name"),
        };
        
        return {
          smtpHost: settings.smtpHost?.settingValue || "",
          smtpPort: settings.smtpPort?.settingValue || "587",
          smtpUser: settings.smtpUser?.settingValue || "",
          fromEmail: settings.fromEmail?.settingValue || "",
          fromName: settings.fromName?.settingValue || "BOXIUM PTCG",
        };
      }),

    // Save SMTP settings
    saveSmtpSettings: publicProcedure
      .input(z.object({
        smtpHost: z.string(),
        smtpPort: z.string(),
        smtpUser: z.string(),
        smtpPass: z.string().optional(),
        fromEmail: z.string(),
        fromName: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
await db.setSystemSetting("smtp_host", input.smtpHost, "SMTP server host");
        await db.setSystemSetting("smtp_port", input.smtpPort, "SMTP server port");
        await db.setSystemSetting("smtp_user", input.smtpUser, "SMTP username");
        if (input.smtpPass) {
          await db.setSystemSetting("smtp_pass", input.smtpPass, "SMTP password");
        }
        await db.setSystemSetting("from_email", input.fromEmail, "From email address");
        await db.setSystemSetting("from_name", input.fromName, "From name");
        
        return { success: true };
      }),

    // Test SMTP connection
    testSmtpConnection: publicProcedure
      .input(z.object({
        email: z.string().email(),
      }))
      .mutation(async ({ ctx, input }) => {
// TODO: Implement email service
        // const { sendPasswordResetEmail, generateResetToken } = await import("./emailService");
        // const testToken = generateResetToken();
        // const emailSent = await sendPasswordResetEmail(input.email, testToken, "測試用戶");
        
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: "SMTP 功能尚未實作，請稍後再試",
        });
      }),

    // User Management APIs
    getAllUsers: publicProcedure
      .query(async ({ ctx }) => {
const users = await db.getAllUsers();
        return users;
      }),

    updateUserRole: publicProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(["admin", "user"]),
      }))
      .mutation(async ({ ctx, input }) => {
await db.updateUserRole(input.userId, input.role);
        return { success: true };
      }),

    updateUserProfile: publicProcedure
      .input(z.object({
        userId: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
const { userId, ...data } = input;
        await db.updateUserProfile(userId, data);
        return { success: true };
      }),

    deleteUser: publicProcedure
      .input(z.object({
        userId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
await db.deleteUser(input.userId);
        return { success: true };
      }),

    getUserStats: publicProcedure
      .query(async ({ ctx }) => {
const stats = await db.getUserStats();
        return stats;
      }),

    getDashboardStats: publicProcedure
      .query(async ({ ctx }) => {
const stats = await db.getDashboardStats();
        return stats;
      }),

    // 更新指定卡牌的 eBay 交易記錄（存入 prices 表）
    updateEbayPrices: publicProcedure
      .input(z.object({
        cardId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
try {
          // 獲取卡牌資訊
          const card = await db.getCardById(input.cardId);
          if (!card) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
          }

          // 簡化卡牌名稱
          let simplifiedName = card.name
            .replace(/\[.*?\]/g, '')
            .replace(/\(.*?\)/g, '')
            .replace(/[：:]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          // 構建搜尋關鍵字
          let searchQuery = simplifiedName;
          if (card.cardNumber) {
            const coreCardNumber = card.cardNumber.match(/\d+/)?.[0] || card.cardNumber;
            searchQuery += ` ${coreCardNumber}`;
          }
          searchQuery += " PSA 10 Pokemon";

          console.log(`[Admin] Updating eBay prices for card ${input.cardId}: "${searchQuery}"`);

          // 搜尋 eBay 活躍商品
          const items = await searchEbayItems(searchQuery, 20);
          console.log(`[Admin] Found ${items.length} eBay items`);

          if (items.length === 0) {
            return { success: false, message: "未找到 eBay 商品", itemsAdded: 0 };
          }

          // 將 eBay 數據存入 prices 表
          let itemsAdded = 0;
          for (const item of items) {
            try {
              const usdPrice = parseFloat(item.price.value);
              const hkdPrice = await convertUsdToHkd(usdPrice);

              // 存入資料庫（標記數據來源為 "ebay"）
              await db.addPriceHistory({
                cardId: input.cardId,
                price: hkdPrice.toFixed(2),
                currency: "HKD",
                grade: "PSA10", // eBay 搜尋結果都是 PSA 10
                source: "ebay",
                soldAt: new Date(), // 使用當前時間作為抓取時間
                listingUrl: item.itemWebUrl,
              });
              itemsAdded++;
            } catch (error: any) {
              console.error(`[Admin] Error adding eBay price: ${error.message}`);
            }
          }

          console.log(`[Admin] Added ${itemsAdded} eBay prices for card ${input.cardId}`);
          return { success: true, message: `成功添加 ${itemsAdded} 筆 eBay 交易記錄`, itemsAdded };
        } catch (error: any) {
          console.error(`[Admin] Error updating eBay prices: ${error.message}`);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `更新 eBay 價格失敗: ${error.message}`,
          });
        }
      }),
  }),

  watchlist: router({
    getUserWatchlist: publicProcedure
      .query(async ({ ctx }) => {
        const watchlist = await db.getUserWatchlist(ctx.user?.id || 0);
        return watchlist;
      }),

    addToWatchlist: publicProcedure
      .input(z.object({
        cardId: z.number(),
        targetPrice: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.addToWatchlist(
          ctx.user?.id || 0,
          input.cardId,
          input.targetPrice,
          input.notes
        );
        return { success: true, result };
      }),

    removeFromWatchlist: publicProcedure
      .input(z.object({
        cardId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.removeFromWatchlist(ctx.user?.id || 0, input.cardId);
        return { success: true, result };
      }),
  }),

  // Favorites router
  favorites: router({
    // Get user's favorites
    list: publicProcedure
      .query(async ({ ctx }) => {
        const favorites = await db.getUserFavorites(ctx.user?.id || 0);
        return favorites;
      }),

    // Add to favorites
    add: publicProcedure
      .input(z.object({
        cardId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.addToFavorites(ctx.user?.id || 0, input.cardId);
        return { success: true, result };
      }),

    // Remove from favorites
    remove: publicProcedure
      .input(z.object({
        cardId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.removeFromFavorites(ctx.user?.id || 0, input.cardId);
        return { success: true, result };
      }),

    // Check if card is favorited
    isFavorited: publicProcedure
      .input(z.object({
        cardId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const isFavorited = await db.isCardFavorited(ctx.user?.id || 0, input.cardId);
        return { isFavorited };
      }),
  }),
});

export type AppRouter = typeof appRouter;
