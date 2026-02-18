import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { extractSnkrdunkId, scrapeSnkrdunkPage, convertJpyToHkd } from "./snkrdunkScraper";
import { searchAndSaveEbaySoldItems, extractCardNumber, cleanCardNameForSearch } from "./ebayService";
import { downloadAndEncodeImage, getBestImageUrl } from "./imageUtils";
import { searchEbayByImageWithHkd } from "./ebayImageSearch";
import { searchEbayItems, convertUsdToHkd, getUsdToHkdRate } from "./ebay";
import { getUpdateStatus, manualUpdateDataSource, getSchedulerStatus, triggerManualUpdateAll } from "./scheduler";
import * as batchUpdateProgress from "./batchUpdateProgress";
import * as snkrdunkBatchUpdateProgress from "./batchUpdateSnkrdunkProgress";
import { executePersistentEbayBatchUpdate } from "./persistentEbayBatchUpdate";
import { executePersistentSnkrdunkBatchUpdate } from "./persistentSnkrdunkBatchUpdate";
import * as batchTaskManager from "./batchTaskManager";
import { executeEbayBatchUpdate, executeSnkrdunkBatchUpdate } from "./batchUpdateExecutor";
import { restartScheduler } from "./batchUpdateScheduler";
import { restartPriceUpdateScheduler } from "./priceUpdateScheduler";

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

    getStats: publicProcedure
      .query(async () => {
        try {
          const totalCards = await db.getTotalCardCount();
          return {
            totalCards,
          };
        } catch (error: any) {
          console.error("[getStats] Error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to get stats: ${error.message}`,
          });
        }
      }),

    getTrending: publicProcedure
      .input(z.object({
        limit: z.number().optional().default(5),
      }))
      .query(async ({ input }) => {
        try {
          // Use cached trending cards (calculated daily at 06:00 HKT)
          const cachedCards = await db.getCachedTrendingCards();
          
          // If cache is empty, return empty array
          // (Cache will be populated by daily scheduler)
          if (cachedCards.length === 0) {
            console.warn("[getTrending] No cached trending cards found, cache may not be initialized yet");
            return [];
          }
          
          // Return cached cards (already sorted by rank)
          return cachedCards.slice(0, input.limit);
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
          // If days is 0 or negative, return all PSA 10 data
          const recentHistory = input.days > 0 
            ? (() => {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - input.days);
                return allHistory.filter(record => 
                  new Date(record.soldAt || record.createdAt) >= cutoffDate &&
                  (record.grade === "PSA 10" || record.grade === "PSA10")
                );
              })()
            : allHistory.filter(record => 
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

    // 獲取搜尋統計數據
    getSearchStats: publicProcedure
      .query(async ({ ctx }) => {
        const stats = await db.getSearchStats();
        if (!stats) {
          return {
            totalSearches: 0,
            imageSearches: 0,
            textSearches: 0,
            avgImageDuration: 0,
            avgTextDuration: 0,
            successfulSearches: 0,
            imageSuccessRate: 0,
            fallbackToTextCount: 0,
          };
        }

        // 計算圖片搜尋成功率
        const imageSuccessRate = stats.imageSearches > 0 
          ? (stats.imageSearches / stats.totalSearches) * 100 
          : 0;

        // 計算回退到文字搜尋的次數（總搜尋次數 - 圖片搜尋次數）
        const fallbackToTextCount = stats.textSearches;

        return {
          ...stats,
          imageSuccessRate: Math.round(imageSuccessRate * 100) / 100,
          fallbackToTextCount,
        };
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

          console.log(`[Admin] Updating eBay prices for card ${input.cardId}`);

          let items: any[] = [];
          let searchMethod: 'image' | 'text' = 'text';
          const searchStartTime = Date.now();

          // 優先使用圖片搜尋
          const imageUrl = getBestImageUrl(card);
          if (imageUrl) {
            try {
              console.log(`[Admin] 嘗試使用圖片搜尋: ${imageUrl}`);
              const base64Image = await downloadAndEncodeImage(imageUrl);
              const imageSearchResults = await searchEbayByImageWithHkd(base64Image, convertUsdToHkd, undefined, 20);
              
              if (imageSearchResults.length > 0) {
                // 圖片搜尋成功，使用圖片搜尋結果
                items = imageSearchResults.map(item => ({
                  price: { value: item.price.toString(), currency: item.currency },
                  itemWebUrl: item.url,
                }));
                searchMethod = 'image';
                console.log(`[Admin] 圖片搜尋成功，找到 ${items.length} 個商品`);
              } else {
                console.log(`[Admin] 圖片搜尋未找到商品，回退到文字搜尋`);
              }
            } catch (error: any) {
              console.error(`[Admin] 圖片搜尋失敗: ${error.message}，回退到文字搜尋`);
            }
          } else {
            console.log(`[Admin] 無有效圖片 URL，使用文字搜尋`);
          }

          // 如果圖片搜尋失敗或無圖片，使用文字搜尋
          if (items.length === 0) {
            console.log(`[Admin] 使用文字搜尋: "${searchQuery}"`);
            items = await searchEbayItems(searchQuery, 20);
            console.log(`[Admin] 文字搜尋找到 ${items.length} 個商品`);
          }

          // 記錄搜尋統計
          const searchDuration = Date.now() - searchStartTime;
          await db.addSearchStat({
            cardId: input.cardId,
            searchMethod,
            searchDuration,
            resultsCount: items.length,
            success: items.length > 0,
            errorMessage: items.length === 0 ? "未找到 eBay 商品" : undefined,
          });

          if (items.length === 0) {
            return { success: false, message: "未找到 eBay 商品", itemsAdded: 0 };
          }

          // 將 eBay 數據存入 prices 表
          let itemsAdded = 0;
          for (const item of items) {
            try {
              let hkdPrice: number;
              
              // 如果是圖片搜尋結果，價格已經轉換為 HKD
              if (searchMethod === 'image') {
                hkdPrice = parseFloat(item.price.value);
              } else {
                // 文字搜尋結果，需要轉換價格
                const usdPrice = parseFloat(item.price.value);
                hkdPrice = await convertUsdToHkd(usdPrice);
              }

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

    // 批量更新所有卡牌 eBay 價格
    batchUpdateEbayPrices: publicProcedure
      .mutation(async ({ ctx }) => {
        try {
          // 檢查是否已經在運行
          const currentProgress = batchUpdateProgress.getBatchUpdateProgress();
          if (currentProgress.isRunning) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "批量更新已在運行中",
            });
          }

          // 獲取所有數據源的唯一卡牌
          const dataSources = await db.getDataSources();
          const uniqueCards = new Map<number, { id: number; name: string }>();
          
          for (const source of dataSources) {
            if (source.card) {
              uniqueCards.set(source.card.id, {
                id: source.card.id,
                name: source.card.name,
              });
            }
          }

          const cardsToUpdate = Array.from(uniqueCards.values());
          console.log(`[BatchUpdate] Starting batch update for ${cardsToUpdate.length} cards`);

          // 初始化進度
          batchUpdateProgress.initBatchUpdateProgress(cardsToUpdate.length);

          // 在後台執行批量更新（異步）
          (async () => {
            for (const card of cardsToUpdate) {
              try {
                // 檢查是否暫停
                while (batchUpdateProgress.isPaused()) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }

                // 獲取卡牌資訊
                const fullCard = await db.getCardById(card.id);
                if (!fullCard) {
                  batchUpdateProgress.updateProgressFailure(card.id, card.name, "卡牌不存在");
                  continue;
                }

                // 簡化卡牌名稱
                let simplifiedName = fullCard.name
                  .replace(/\[.*?\]/g, '')
                  .replace(/\(.*?\)/g, '')
                  .replace(/[：:]/g, '')
                  .replace(/\s+/g, ' ')
                  .trim();

                // 構建搜尋關鍵字
                let searchQuery = simplifiedName;
                if (fullCard.cardNumber) {
                  const coreCardNumber = fullCard.cardNumber.match(/\d+/)?.[0] || fullCard.cardNumber;
                  searchQuery += ` ${coreCardNumber}`;
                }
                searchQuery += " PSA 10 Pokemon";

                let items: any[] = [];
                let searchMethod: 'image' | 'text' = 'text';
                const searchStartTime = Date.now();

                // 優先使用圖片搜尋
                const imageUrl = getBestImageUrl(fullCard);
                if (imageUrl) {
                  try {
                    const base64Image = await downloadAndEncodeImage(imageUrl);
                    const imageSearchResults = await searchEbayByImageWithHkd(base64Image, convertUsdToHkd, undefined, 20);
                    
                    if (imageSearchResults.length > 0) {
                      items = imageSearchResults.map(item => ({
                        price: { value: item.price.toString(), currency: item.currency },
                        itemWebUrl: item.url,
                      }));
                      searchMethod = 'image';
                    }
                  } catch (error: any) {
                    console.error(`[BatchUpdate] 圖片搜尋失敗: ${error.message}`);
                  }
                }

                // 如果圖片搜尋失敗或無圖片，使用文字搜尋
                if (items.length === 0) {
                  items = await searchEbayItems(searchQuery, 20);
                }

                // 記錄搜尋統計
                const searchDuration = Date.now() - searchStartTime;
                await db.addSearchStat({
                  cardId: card.id,
                  searchMethod,
                  searchDuration,
                  resultsCount: items.length,
                  success: items.length > 0,
                  errorMessage: items.length === 0 ? "未找到 eBay 商品" : undefined,
                });

                if (items.length === 0) {
                  batchUpdateProgress.updateProgressFailure(card.id, card.name, "未找到 eBay 商品");
                  continue;
                }

                // 將 eBay 數據存入 prices 表
                let itemsAdded = 0;
                for (const item of items) {
                  try {
                    let hkdPrice: number;
                    
                    if (searchMethod === 'image') {
                      hkdPrice = parseFloat(item.price.value);
                    } else {
                      const usdPrice = parseFloat(item.price.value);
                      hkdPrice = await convertUsdToHkd(usdPrice);
                    }

                    await db.addPriceHistory({
                      cardId: card.id,
                      price: hkdPrice.toFixed(2),
                      currency: "HKD",
                      grade: "PSA10",
                      source: "ebay",
                      soldAt: new Date(),
                      listingUrl: item.itemWebUrl,
                    });
                    itemsAdded++;
                  } catch (error: any) {
                    console.error(`[BatchUpdate] Error adding eBay price: ${error.message}`);
                  }
                }

                batchUpdateProgress.updateProgressSuccess(itemsAdded);
                console.log(`[BatchUpdate] Updated card ${card.id}, added ${itemsAdded} records`);

                // 每處理 5 張卡片後暫停 1 秒，避免 API 限制
                if (batchUpdateProgress.getBatchUpdateProgress().processedCards % 5 === 0) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              } catch (error: any) {
                console.error(`[BatchUpdate] Error updating card ${card.id}: ${error.message}`);
                batchUpdateProgress.updateProgressFailure(card.id, card.name, error.message);
              }
            }

            // 完成批量更新
            batchUpdateProgress.completeBatchUpdate();
            console.log(`[BatchUpdate] Batch update completed`);
          })();

          return {
            success: true,
            message: `批量更新已啟動，共 ${cardsToUpdate.length} 張卡牌`,
            totalCards: cardsToUpdate.length,
          };
        } catch (error: any) {
          console.error(`[BatchUpdate] Error starting batch update: ${error.message}`);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `啟動批量更新失敗: ${error.message}`,
          });
        }
      }),

    // 獲取批量更新進度
    getBatchUpdateProgress: publicProcedure
      .query(async ({ ctx }) => {
        const progress = batchUpdateProgress.getBatchUpdateProgress();
        return progress;
      }),

    // 暫停批量更新
    pauseBatchUpdate: publicProcedure
      .mutation(async ({ ctx }) => {
        batchUpdateProgress.pauseBatchUpdate();
        return { success: true, message: "批量更新已暫停" };
      }),

    // 繼續批量更新
    resumeBatchUpdate: publicProcedure
      .mutation(async ({ ctx }) => {
        batchUpdateProgress.resumeBatchUpdate();
        return { success: true, message: "批量更新已繼續" };
      }),

    // 批量更新所有卡牌 SNKRDUNK 價格
    batchUpdateSnkrdunkPrices: publicProcedure
      .mutation(async ({ ctx }) => {
        try {
          // 檢查是否已經在運行
          const currentProgress = snkrdunkBatchUpdateProgress.getSnkrdunkBatchUpdateProgress();
          if (currentProgress.isRunning) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "SNKRDUNK 批量更新已在運行中",
            });
          }

          // 獲取所有 SNKRDUNK 數據源的唯一卡牌
          const dataSources = await db.getDataSources();
          const snkrdunkSources = dataSources.filter(ds => ds.source === "snkrdunk");
          const uniqueCards = new Map<number, { id: number; name: string }>();
          
          for (const source of snkrdunkSources) {
            if (source.card) {
              uniqueCards.set(source.card.id, {
                id: source.card.id,
                name: source.card.name,
              });
            }
          }

          const cardsToUpdate = Array.from(uniqueCards.values());
          console.log(`[SnkrdunkBatchUpdate] Starting batch update for ${cardsToUpdate.length} cards`);

          // 初始化進度
          snkrdunkBatchUpdateProgress.initSnkrdunkBatchUpdateProgress(cardsToUpdate.length);

          // 在後台執行批量更新（異步）
          (async () => {
            for (const card of cardsToUpdate) {
              try {
                // 檢查是否暫停
                while (snkrdunkBatchUpdateProgress.isSnkrdunkPaused()) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }

                // 獲取該卡牌的 SNKRDUNK 數據源
                const cardDataSources = snkrdunkSources.filter(ds => ds.cardId === card.id);
                if (cardDataSources.length === 0) {
                  snkrdunkBatchUpdateProgress.updateSnkrdunkProgressFailure(card.id, card.name, "無 SNKRDUNK 數據源");
                  continue;
                }

                // 使用第一個數據源的 URL
                const dataSource = cardDataSources[0];
                const url = dataSource.sourceUrl;

                // 爬取 SNKRDUNK 頁面
                const cardData = await scrapeSnkrdunkPage(url);

                // 更新卡牌資訊
                await db.updateCard(card.id, {
                  name: cardData.name,
                  nameJa: cardData.nameJa,
                  imageUrl: cardData.imageUrl || undefined,
                });

                // 儲存價格歷史
                let recordsAdded = 0;
                for (const priceEntry of cardData.priceHistory) {
                  const priceHkd = convertJpyToHkd(priceEntry.price);
                  await db.addPriceHistory({
                    cardId: card.id,
                    source: "snkrdunk",
                    price: priceHkd.toString(),
                    currency: "HKD",
                    grade: priceEntry.grade,
                    soldAt: priceEntry.soldAt,
                    listingUrl: url,
                  });
                  recordsAdded++;
                }

                // 更新所有該卡牌的 SNKRDUNK 數據源狀態
                for (const ds of cardDataSources) {
                  await db.updateDataSourceFetchStatus(ds.id, "success");
                }

                snkrdunkBatchUpdateProgress.updateSnkrdunkProgressSuccess(recordsAdded);
                console.log(`[SnkrdunkBatchUpdate] Updated card ${card.id}, added ${recordsAdded} records`);

                // 每處理 3 張卡片後暫停 2 秒，避免 API 限制
                if (snkrdunkBatchUpdateProgress.getSnkrdunkBatchUpdateProgress().processedCards % 3 === 0) {
                  await new Promise(resolve => setTimeout(resolve, 2000));
                }
              } catch (error: any) {
                console.error(`[SnkrdunkBatchUpdate] Error updating card ${card.id}: ${error.message}`);
                snkrdunkBatchUpdateProgress.updateSnkrdunkProgressFailure(card.id, card.name, error.message);
              }
            }

            // 完成批量更新
            snkrdunkBatchUpdateProgress.completeSnkrdunkBatchUpdate();
            console.log(`[SnkrdunkBatchUpdate] Batch update completed`);
          })();

          return {
            success: true,
            message: `SNKRDUNK 批量更新已啟動，共 ${cardsToUpdate.length} 張卡牌`,
            totalCards: cardsToUpdate.length,
          };
        } catch (error: any) {
          console.error(`[SnkrdunkBatchUpdate] Error starting batch update: ${error.message}`);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `啟動 SNKRDUNK 批量更新失敗: ${error.message}`,
          });
        }
      }),

    // 獲取 SNKRDUNK 批量更新進度
    getSnkrdunkBatchUpdateProgress: publicProcedure
      .query(async ({ ctx }) => {
        const progress = snkrdunkBatchUpdateProgress.getSnkrdunkBatchUpdateProgress();
        return progress;
      }),

    // 暫停 SNKRDUNK 批量更新
    pauseSnkrdunkBatchUpdate: publicProcedure
      .mutation(async ({ ctx }) => {
        snkrdunkBatchUpdateProgress.pauseSnkrdunkBatchUpdate();
        return { success: true, message: "SNKRDUNK 批量更新已暫停" };
      }),

    // 繼續 SNKRDUNK 批量更新
    resumeSnkrdunkBatchUpdate: publicProcedure
      .mutation(async ({ ctx }) => {
        snkrdunkBatchUpdateProgress.resumeSnkrdunkBatchUpdate();
        return { success: true, message: "SNKRDUNK 批量更新已繼續" };
      }),

    // 獲取排程設定
    getScheduleConfig: publicProcedure
      .query(async ({ ctx }) => {
        const config = await db.getScheduleConfig("batch_update_daily");
        return config;
      }),

    // 啟用/停用排程
    updateScheduleEnabled: publicProcedure
      .input(z.object({
        enabled: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateScheduleEnabled("batch_update_daily", input.enabled);
        // 重新啟動排程器以應用新設定
        await restartScheduler();
        return {
          success: true,
          message: input.enabled ? "排程已啟用" : "排程已停用",
        };
      }),

    // 立即手動觸發排程
    triggerScheduleNow: publicProcedure
      .mutation(async ({ ctx }) => {
        try {
          // 創建執行歷史記錄
          const historyId = await db.addScheduleExecutionHistory({
            scheduleType: "batch_update_daily",
            executionType: "manual",
            status: "running",
            startedAt: new Date(),
          });

          // 在後台執行批量更新（異步）
          (async () => {
            const startTime = Date.now();
            try {
              // 啟動 eBay 批量更新
              const ebayResult = await executeEbayBatchUpdate();

              // 啟動 SNKRDUNK 批量更新
              const snkrdunkResult = await executeSnkrdunkBatchUpdate();

              // 更新執行歷史
              const durationMs = Date.now() - startTime;
              await db.updateScheduleExecutionHistory(historyId, {
                status: "completed",
                ebaySuccessCount: ebayResult.successCount,
                ebayFailureCount: ebayResult.failureCount,
                ebayRecordsAdded: ebayResult.totalRecordsAdded,
                snkrdunkSuccessCount: snkrdunkResult.successCount,
                snkrdunkFailureCount: snkrdunkResult.failureCount,
                snkrdunkRecordsAdded: snkrdunkResult.totalRecordsAdded,
                completedAt: new Date(),
                durationMs,
              });

              console.log(`[Schedule] Manual execution completed in ${durationMs}ms`);
            } catch (error: any) {
              console.error(`[Schedule] Manual execution failed: ${error.message}`);
              await db.updateScheduleExecutionHistory(historyId, {
                status: "failed",
                errorMessage: error.message,
                completedAt: new Date(),
                durationMs: Date.now() - startTime,
              });
            }
          })();

          return {
            success: true,
            message: "排程任務已啟動，正在後台執行",
          };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `啟動排程任務失敗: ${error.message}`,
          });
        }
      }),

    // 獲取排程執行歷史
    getScheduleExecutionHistory: publicProcedure
      .query(async ({ ctx }) => {
        const history = await db.getScheduleExecutionHistory("batch_update_daily", 10);
        return history;
      }),

    // Manually trigger trending cards calculation
    calculateTrendingCards: protectedProcedure
      .mutation(async () => {
        try {
          console.log("[Admin] Manually triggering trending cards calculation...");
          await db.calculateAndCacheTrendingCards();
          return { success: true, message: "Trending cards calculated and cached successfully" };
        } catch (error: any) {
          console.error("[Admin] Failed to calculate trending cards:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to calculate trending cards: ${error.message}`,
          });
        }
      }),

    // Get health metrics for data sources
    getHealthMetrics: publicProcedure
      .query(async () => {
        try {
          const metrics = await db.getDataSourceHealthMetrics();
          return metrics;
        } catch (error: any) {
          console.error("[Admin] Failed to get health metrics:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to get health metrics: ${error.message}`,
          });
        }
      }),

    // === 持久化批量更新 API ===

    // 啟動持久化 eBay 批量更新
    startPersistentEbayBatchUpdate: publicProcedure
      .mutation(async () => {
        try {
          const result = await executePersistentEbayBatchUpdate();
          return {
            success: true,
            message: `批量更新已啟動，共 ${result.totalCards} 張卡牌`,
            taskId: result.taskId,
            totalCards: result.totalCards,
          };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "批量更新啟動失敗",
          });
        }
      }),

    // 啟動持久化 SNKRDUNK 批量更新
    startPersistentSnkrdunkBatchUpdate: publicProcedure
      .mutation(async () => {
        try {
          const result = await executePersistentSnkrdunkBatchUpdate();
          return {
            success: true,
            message: `SNKRDUNK 批量更新已啟動，共 ${result.totalCards} 張卡牌`,
            taskId: result.taskId,
            totalCards: result.totalCards,
          };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "SNKRDUNK 批量更新啟動失敗",
          });
        }
      }),

    // 獲取持久化任務進度
    getPersistentTaskProgress: publicProcedure
      .input(z.object({
        taskType: z.enum(['batch_ebay_update', 'batch_snkrdunk_update']),
      }))
      .query(async ({ input }) => {
        const task = await batchTaskManager.getLatestRunningTask(input.taskType);
        return task;
      }),

    // 暂停持久化任務
    pausePersistentTask: publicProcedure
      .input(z.object({
        taskId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await batchTaskManager.pauseTask(input.taskId);
        return { success: true, message: "任務已暂停" };
      }),

    // 繼續持久化任務
    resumePersistentTask: publicProcedure
      .input(z.object({
        taskId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await batchTaskManager.resumeTask(input.taskId);
        return { success: true, message: "任務已繼續" };
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

  // Market Insights router - provides market analysis data
  marketInsights: router({
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
        const { invokeLLM } = await import("./_core/llm");
        
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

    // Log user search query
    logSearch: publicProcedure
      .input(z.object({
        searchQuery: z.string(),
        searchType: z.enum(["card_name", "set_name", "card_number", "general"]),
        resultCount: z.number(),
        cardId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // userSearchLogs table removed, no longer logging searches
        // await db.logUserSearch({ ... });
        return { success: true };
      }),
  }),

  // Trending router - hot cards rankings
  trending: router({
    // Get trending cards by search popularity
    getBySearches: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(20).optional(),
        days: z.number().min(1).max(90).optional(),
      }))
      .query(async ({ input }) => {
        const results = await db.getTrendingBySearches({
          limit: input.limit,
          days: input.days,
        });
        return results;
      }),

    // Get trending cards by price increase
    getByPriceIncrease: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(20).optional(),
        days: z.number().min(1).max(90).optional(),
      }))
      .query(async ({ input }) => {
        const results = await db.getTrendingByPriceIncrease({
          limit: input.limit,
          days: input.days,
        });
        return results;
      }),

    // Get trending cards by price decrease
    getByPriceDecrease: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(20).optional(),
        days: z.number().min(1).max(90).optional(),
      }))
      .query(async ({ input }) => {
        const results = await db.getTrendingByPriceDecrease({
          limit: input.limit,
          days: input.days,
        });
        return results;
      }),

    // Get newly added cards
    getNewlyAdded: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(20).optional(),
        days: z.number().min(1).max(90).optional(),
      }))
      .query(async ({ input }) => {
        const results = await db.getNewlyAddedCards({
          limit: input.limit,
          days: input.days,
        });
        return results;
      }),

    // Get price history for a card (for trend charts)
    getPriceHistory: publicProcedure
      .input(z.object({
        cardId: z.number(),
        days: z.number().min(1).max(90).optional(),
      }))
      .query(async ({ input }) => {
        const history = await db.getCardPriceHistory(input.cardId, input.days);
        return history;
      }),
  }),

});

export type AppRouter = typeof appRouter;
