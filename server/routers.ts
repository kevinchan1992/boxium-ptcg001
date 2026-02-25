import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, adminProcedure, protectedProcedure } from "./_core/trpc";
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
import { pricingRouter } from "./routers/pricing";
import { templatesRouter } from "./routers/templates";
import { diagnosticsRouter } from "./routers/diagnostics";

export const appRouter = router({
  system: systemRouter,

  pricing: pricingRouter,

  diagnostics: diagnosticsRouter,

  auth: router({
    me: publicProcedure
      .query(async ({ ctx }) => {
        console.log('[Auth.me] Checking current user...');
        console.log('[Auth.me] ctx.user exists:', !!ctx.user);
        if (ctx.user) {
          console.log('[Auth.me] User found:', {
            id: ctx.user.id,
            email: ctx.user.email,
            role: ctx.user.role,
          });
        } else {
          console.log('[Auth.me] No user in context');
        }
        return ctx.user || null;
      }),
    
    register: publicProcedure
      .input(z.object({
        email: z.string().trim().toLowerCase().email(),
        password: z.string().min(8),
        name: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { registerUser } = await import('./auth');
        const result = await registerUser(input.email, input.password, input.name);
        
        if (!result.success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: result.error || '註冊失敗',
          });
        }
        
        // Set session cookie for automatic login after registration
        if (result.token && ctx.res && ctx.req) {
          ctx.res.cookie('session', result.token, getSessionCookieOptions(ctx.req));
        }
        
        return {
          success: true,
          user: result.user,
          token: result.token,
        };
      }),
    
    login: publicProcedure
      .input(z.object({
        email: z.string().trim().toLowerCase().email(),
        password: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        console.log('[Login API] Starting login process for:', input.email);
        console.log('[Login API] ctx.req exists:', !!ctx.req);
        console.log('[Login API] ctx.res exists:', !!ctx.res);
        
        const { loginUser } = await import('./auth');
        const result = await loginUser(input.email, input.password);
        
        console.log('[Login API] Login result:', {
          success: result.success,
          hasToken: !!result.token,
          hasUser: !!result.user,
          userId: result.user?.id,
        });
        
        if (!result.success) {
          console.log('[Login API] Login failed:', result.error);
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: result.error || '登入失敗',
          });
        }
        
        // Set session cookie
        if (result.token && ctx.res && ctx.req) {
          console.log('[Login API] Setting session cookie...');
          const cookieOptions = getSessionCookieOptions(ctx.req);
          console.log('[Login API] Cookie options:', cookieOptions);
          ctx.res.cookie('session', result.token, cookieOptions);
          console.log('[Login API] Session cookie set successfully');
        } else {
          console.warn('[Login API] Cannot set cookie - missing token, req, or res:', {
            hasToken: !!result.token,
            hasReq: !!ctx.req,
            hasRes: !!ctx.res,
          });
        }
        
        return {
          success: true,
          user: result.user,
          token: result.token,
        };
      }),
    
    logout: publicProcedure
      .mutation(async ({ ctx }) => {
        console.log('[Logout API] Clearing session cookie...');
        
        if (ctx.res) {
          // Clear session cookie
          ctx.res.clearCookie('session', {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
          });
          console.log('[Logout API] Session cookie cleared');
        } else {
          console.warn('[Logout API] Cannot clear cookie - ctx.res is missing');
        }
        
        return { success: true };
      }),
  }),

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

    getDataSource: publicProcedure
      .input(z.object({
        cardId: z.number(),
        source: z.enum(["snkrdunk", "ebay", "tcgplayer", "other"]),
      }))
      .query(async ({ input }) => {
        const dataSource = await db.getDataSourceByCardIdAndSource(input.cardId, input.source);
        return dataSource;
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

    // 圖片搜尋卡牌
    searchByImage: publicProcedure
      .input(z.object({
        image: z.string(), // base64 encoded image
      }))
      .mutation(async ({ input }) => {
        try {
          const { searchCardByImage } = await import("./imageCardSearch");
          const result = await searchCardByImage(input.image);
          return result;
        } catch (error: any) {
          console.error("[Image Search] Error:", error.message);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to search by image: ${error.message}`,
          });
        }
      }),

    // 獲取隨機卡牌名稱用於 placeholder 輪播
    getRandomCardNames: publicProcedure
      .input(z.object({
        count: z.number().optional().default(10),
      }))
      .query(async ({ input }) => {
        try {
          const cards = await db.getRandomCards(input.count);
          return cards.map((card: any) => {
            // 格式化卡牌名稱：名稱 + 稀有度 + 編號 + 系列
            const parts = [];
            
            // 使用日文名稱（如果有），否則使用英文名稱
            const displayName = card.nameJa || card.name;
            parts.push(displayName);
            
            // 添加稀有度（如果有）
            if (card.rarity) {
              parts.push(card.rarity);
            }
            
            // 添加編號和系列
            if (card.cardNumber && card.series) {
              parts.push(`[${card.cardNumber}](${card.series})`);
            } else if (card.cardNumber) {
              parts.push(`[${card.cardNumber}]`);
            } else if (card.series) {
              parts.push(`(${card.series})`);
            }
            
            return parts.join(' ');
          });
        } catch (error: any) {
          console.error("[Get Random Card Names] Error:", error.message);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to get random card names: ${error.message}`,
          });
        }
      }),

    // Log user search query
    logSearch: publicProcedure
      .input(z.object({
        cardId: z.number(),
        searchQuery: z.string().optional(),
        source: z.enum(["search_page", "card_click", "trending_page", "home_page"]),
      }))
      .mutation(async ({ ctx, input }) => {
        // Log user search behavior for trending cards
        await db.logUserSearch({
          cardId: input.cardId,
          searchQuery: input.searchQuery,
          source: input.source,
          userId: ctx.user?.id,
          sessionId: undefined, // Session ID tracking not implemented yet
        });
        return { success: true };
      }),
  }),

  prices: router({
    getHistory: publicProcedure
      .input(z.object({
        cardId: z.number(),
        source: z.enum(["snkrdunk", "ebay", "tcgplayer", "other"]).optional(),
        grade: z.string().optional(),
        limit: z.number().optional().default(50),
        days: z.number().optional(), // 添加時間範圍篩選（最近 N 天）
      }))
      .query(async ({ input }) => {
        // 直接將 days 參數傳遞給 db.getPriceHistory，在數據庫層面篩選
        const history = await db.getPriceHistory(
          input.cardId,
          input.source,
          input.grade,
          input.limit,
          input.days
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
      .input(z.object({
        page: z.number().min(1).optional(),
        pageSize: z.number().min(1).max(100).optional(),
        search: z.string().optional(),
        status: z.enum(["all", "success", "pending", "failed"]).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const sources = await db.getDataSources(input);
        return sources;
      }),

    getDataSourceStats: publicProcedure
      .query(async () => {
        const stats = await db.getDataSourceStats();
        return stats;
      }),

    getAllFilteredDataSourceIds: publicProcedure
      .input(z.object({
        search: z.string().optional(),
        status: z.enum(["all", "success", "pending", "failed"]).optional(),
      }).optional())
      .query(async ({ input }) => {
        const ids = await db.getAllFilteredDataSourceIds(input);
        return ids;
      }),

    getAllDataSourceUrls: publicProcedure
      .query(async () => {
        // Get all data sources without pagination to support full deduplication
        const { data: allSources } = await db.getDataSources({ pageSize: 100000 });
        return allSources.map(ds => ds.sourceUrl);
      }),

    addSnkrdunkSource: adminProcedure
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
        
        // Check if data source already exists using database query
        const exists = await db.checkDataSourceExists(normalizedUrl);
        if (exists) {
          // Return special status instead of throwing error
          return { success: false, status: 'duplicate', message: `Data source already exists: ${normalizedUrl}` };
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
          const { data: dataSources } = await db.getDataSources({ pageSize: 10000 });
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

    refreshDataSource: adminProcedure
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

    manualUpdate: adminProcedure
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

    deleteDataSource: adminProcedure
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

    autoCrawlSnkrdunk: adminProcedure
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

    triggerManualUpdateAll: adminProcedure
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

    cleanDuplicateDataSources: adminProcedure
      .mutation(async ({ ctx }) => {
try {
          // Get all data sources
          const { data: allSources } = await db.getDataSources({ pageSize: 10000 });
          
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

    deleteFailedDataSources: adminProcedure
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

  updateCardEnglishNames: adminProcedure.mutation(async () => {
    const { data: dataSources } = await db.getDataSources({ pageSize: 10000 });
    
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

  // Get scraper performance metrics
  getScraperPerformance: publicProcedure
    .input(z.object({
      source: z.enum(["snkrdunk", "ebay", "all"]).optional(),
      hours: z.number().min(1).max(168).optional(), // Last N hours (default 24)
    }).optional())
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { scraperPerformanceLogs } = await import("../drizzle/schema_new");
      const { sql, eq, and, gte } = await import("drizzle-orm");

      const hours = input?.hours || 24;
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      // Build query conditions
      const conditions = [gte(scraperPerformanceLogs.createdAt, cutoffTime)];
      if (input?.source && input.source !== "all") {
        conditions.push(eq(scraperPerformanceLogs.source, input.source));
      }

      // Get recent logs
      const logs = await db
        .select()
        .from(scraperPerformanceLogs)
        .where(and(...conditions))
        .orderBy(sql`${scraperPerformanceLogs.createdAt} DESC`)
        .limit(100);

      // Calculate metrics
      const totalRequests = logs.length;
      const successCount = logs.filter((l: any) => l.status === "success").length;
      const errorCount = logs.filter((l: any) => l.status === "error").length;
      const timeoutCount = logs.filter((l: any) => l.status === "timeout").length;
      const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 0;

      const avgResponseTime = totalRequests > 0
        ? logs.reduce((sum: number, l: any) => sum + l.responseTime, 0) / totalRequests
        : 0;

      const totalItemsProcessed = logs.reduce((sum: number, l: any) => sum + (l.itemsProcessed || 0), 0);

      // Get error logs
      const errorLogs = logs
        .filter((l: any) => l.status === "error" || l.status === "timeout")
        .slice(0, 20)
        .map((l: any) => ({
          id: l.id,
          source: l.source,
          cardId: l.cardId,
          status: l.status,
          errorMessage: l.errorMessage,
          createdAt: l.createdAt,
        }));

      return {
        totalRequests,
        successCount,
        errorCount,
        timeoutCount,
        successRate: Math.round(successRate * 100) / 100,
        avgResponseTime: Math.round(avgResponseTime),
        totalItemsProcessed,
        recentLogs: logs.slice(0, 10).map((l: any) => ({
          id: l.id,
          source: l.source,
          cardId: l.cardId,
          operationType: l.operationType,
          status: l.status,
          responseTime: l.responseTime,
          itemsProcessed: l.itemsProcessed,
          createdAt: l.createdAt,
        })),
        errorLogs,
      };
    }),

  // Trigger cache warming
  triggerCacheWarming: adminProcedure
    .input(z.object({
      cardLimit: z.number().min(1).max(100).optional(), // Number of cards to warm (default: 20)
    }).optional())
    .mutation(async ({ input }) => {
      const { warmCache } = await import("./services/cacheWarmer");
      const cardLimit = input?.cardLimit || 20;
      
      console.log(`[Admin] Triggering cache warming for ${cardLimit} cards...`);
      const result = await warmCache(cardLimit);
      
      return result;
    }),

  updateAllEbayRecords: adminProcedure.mutation(async ({ ctx }) => {
// Get all data sources with cards
    const { data: dataSources } = await db.getDataSources({ pageSize: 10000 });
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

  fixOrphanDataSources: adminProcedure.mutation(async ({ ctx }) => {
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

    setFirecrawlQuotaLimit: adminProcedure
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
    saveSmtpSettings: adminProcedure
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
    testSmtpConnection: adminProcedure
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

    // User management removed - no authentication system

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
    updateEbayPrices: adminProcedure
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
    batchUpdateEbayPrices: adminProcedure
      .mutation(async ({ ctx }) => {
        try {
          // 檢查是否已經在運行
          const currentProgress = batchUpdateProgress.getBatchUpdateProgress();
          if (currentProgress.isRunning) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "批量更新正在進行中，請稍候。已處理 " + currentProgress.processedCards + "/" + currentProgress.totalCards + " 張卡牌。",
            });
          }

          // 獲取所有數據源的唯一卡牌
          const { data: dataSources } = await db.getDataSources({ pageSize: 100000 });
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

    // 獲取批量更新進度（同時檢查 eBay 和 SNKRDUNK）
    getBatchUpdateProgress: publicProcedure
      .query(async ({ ctx }) => {
        // 檢查 eBay 進度
        const ebayProgress = batchUpdateProgress.getBatchUpdateProgress();
        if (ebayProgress.isRunning) {
          return ebayProgress;
        }
        
        // 檢查 SNKRDUNK 進度
        const snkrdunkProgress = snkrdunkBatchUpdateProgress.getSnkrdunkBatchUpdateProgress();
        if (snkrdunkProgress.isRunning) {
          return snkrdunkProgress;
        }
        
        // 如果都沒有運行，返回 eBay 進度（預設）
        return ebayProgress;
      }),

    // 暫停批量更新（同時操作 eBay 和 SNKRDUNK）
    pauseBatchUpdate: adminProcedure
      .mutation(async ({ ctx }) => {
        // 暫停 eBay 批量更新
        batchUpdateProgress.pauseBatchUpdate();
        // 暫停 SNKRDUNK 批量更新
        snkrdunkBatchUpdateProgress.pauseSnkrdunkBatchUpdate();
        return { success: true, message: "批量更新已暫停" };
      }),

    // 繼續批量更新（同時操作 eBay 和 SNKRDUNK）
    resumeBatchUpdate: adminProcedure
      .mutation(async ({ ctx }) => {
        // 繼續 eBay 批量更新
        batchUpdateProgress.resumeBatchUpdate();
        // 繼續 SNKRDUNK 批量更新
        snkrdunkBatchUpdateProgress.resumeSnkrdunkBatchUpdate();
        return { success: true, message: "批量更新已繼續" };
      }),

    // 批量更新所有卡牌 SNKRDUNK 價格
    batchUpdateSnkrdunkPrices: adminProcedure
      .mutation(async ({ ctx }) => {
        try {
          // 檢查是否已經在運行
          const currentProgress = snkrdunkBatchUpdateProgress.getSnkrdunkBatchUpdateProgress();
          if (currentProgress.isRunning) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "批量更新正在進行中，請稍候。已處理 " + currentProgress.processedCards + "/" + currentProgress.totalCards + " 張卡牌。",
            });
          }

          // 獲取所有 SNKRDUNK 數據源的唯一卡牌
          const { data: dataSources } = await db.getDataSources({ pageSize: 100000 });
          const snkrdunkSources = dataSources.filter((ds: any) => ds.source === "snkrdunk");
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
    pauseSnkrdunkBatchUpdate: adminProcedure
      .mutation(async ({ ctx }) => {
        snkrdunkBatchUpdateProgress.pauseSnkrdunkBatchUpdate();
        return { success: true, message: "SNKRDUNK 批量更新已暫停" };
      }),

    // 繼續 SNKRDUNK 批量更新
    resumeSnkrdunkBatchUpdate: adminProcedure
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
    updateScheduleEnabled: adminProcedure
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
    triggerScheduleNow: adminProcedure
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
      .input(z.object({
        scheduleType: z.enum(["snkrdunk_update", "ebay_update", "trending_update"]).optional(),
        limit: z.number().min(1).max(50).optional().default(10),
      }).optional())
      .query(async ({ input }) => {
        const scheduleType = input?.scheduleType;
        const limit = input?.limit ?? 10;
        
        if (scheduleType) {
          // 查詢特定類型的排程歷史
          return await db.getScheduleExecutionHistory(scheduleType, limit);
        } else {
          // 查詢所有類型的排程歷史
          const snkrdunk = await db.getScheduleExecutionHistory("snkrdunk_update", limit);
          const ebay = await db.getScheduleExecutionHistory("ebay_update", limit);
          const trending = await db.getScheduleExecutionHistory("trending_update", limit);
          
          return {
            snkrdunk,
            ebay,
            trending,
          };
        }
      }),

    // Manually trigger trending cards calculation
    calculateTrendingCards: adminProcedure
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

    // 獲取儀表板統計數據
    getDashboardStats: publicProcedure
      .query(async () => {
        try {
          // 獲取各種統計數據
          const totalCards = await db.getTotalCardCount();
          const totalDataSources = await db.getTotalDataSourceCount();
          const activeDataSources = await db.getActiveDataSourceCount();
          const totalPriceRecords = await db.getTotalPriceRecordCount();
          
          return {
            totalUsers: 0, // 平台已公開，無用戶系統
            totalCards,
            totalDataSources,
            activeDataSources,
            totalPriceRecords,
          };
        } catch (error: any) {
          console.error("[Admin] Failed to get dashboard stats:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to get dashboard stats: ${error.message}`,
          });
        }
      }),

    // === 持久化批量更新 API ===

    // 啟動持久化 eBay 批量更新
    startPersistentEbayBatchUpdate: adminProcedure
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
    startPersistentSnkrdunkBatchUpdate: adminProcedure
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
    pausePersistentTask: adminProcedure
      .input(z.object({
        taskId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await batchTaskManager.pauseTask(input.taskId);
        return { success: true, message: "任務已暂停" };
      }),

    // 繼續持久化任務
    resumePersistentTask: adminProcedure
      .input(z.object({
        taskId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await batchTaskManager.resumeTask(input.taskId);
        return { success: true, message: "任務已繼續" };
      }),

    // 取消持久化任務
    cancelPersistentTask: adminProcedure
      .input(z.object({
        taskId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await batchTaskManager.cancelTask(input.taskId);
        return { success: true, message: "任務已取消" };
      }),

    // 價格更新排程 API
    getPriceUpdateSchedule: publicProcedure
      .query(async () => {
        const schedule = await db.getPriceUpdateSchedule();
        return schedule;
      }),

    updatePriceUpdateSchedule: adminProcedure
      .input(z.object({
        snkrdunkEnabled: z.boolean().optional(),
        snkrdunkUpdateTime: z.string().optional(),
        ebayEnabled: z.boolean().optional(),
        ebayUpdateTime: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updatePriceUpdateSchedule(input);
        // 重啟排程器以應用新設定
        await restartPriceUpdateScheduler();
        return { success: true, message: "排程設定已更新" };
      }),

    // 緩存管理 API
    getCacheStats: publicProcedure
      .query(async () => {
        const stats = await db.getSnkrdunkCacheStats();
        return stats;
      }),

    // 獲取詳細快取統計（按快取狀態分類）
    getDetailedCacheStats: publicProcedure
      .query(async () => {
        const stats = await db.getDetailedSnkrdunkCacheStats();
        return stats;
      }),

    // 批量更新 SNKRDUNK 數據（處理一個批次）
    processBatch: adminProcedure
      .input(z.object({
        batchIndex: z.number(),
        batchSize: z.number().default(50),
      }))
      .mutation(async ({ input }) => {
        const { batchIndex, batchSize } = input;
        const offset = batchIndex * batchSize;
        
        // 獲取這一批次的卡牌（只獲取有 SNKRDUNK ID 的卡牌）
        const cardsToProcess = await db.getCardsWithSnkrdunkId({ limit: batchSize, offset });
        
        const results = {
          success: 0,
          failed: 0,
          skipped: 0,
          errors: [] as Array<{ cardId: number; error: string }>
        };
        
        const HOT_CACHE_DURATION = 60 * 60 * 1000; // 1 hour
        const COLD_CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours
        
        for (const card of cardsToProcess) {
          try {
            // 檢查快取狀態
            const cache = await db.getSnkrdunkListingsCache(card.id);
            
            if (cache) {
              const cacheAge = Date.now() - new Date(cache.createdAt).getTime();
              
              // 跳過熱快取和冷快取
              if (cacheAge < COLD_CACHE_DURATION) {
                results.skipped++;
                continue;
              }
            }
            
            // 爬取並更新快取
            const { scrapeSnkrdunkListings } = await import('./services/snkrdunkPlaywright');
            const listings = await scrapeSnkrdunkListings(card.snkrdunkId!);
            
            // 保存快取
            const now = new Date();
            await db.saveSnkrdunkListingsCache({
              cardId: card.id,
              snkrdunkId: card.snkrdunkId!,
              listings: JSON.stringify(listings),
              hotExpiresAt: new Date(now.getTime() + HOT_CACHE_DURATION),
              expiresAt: new Date(now.getTime() + COLD_CACHE_DURATION),
            });
            
            results.success++;
          } catch (error: any) {
            results.failed++;
            results.errors.push({
              cardId: card.id,
              error: error.message || String(error)
            });
          }
        }
        
        return {
          batchIndex,
          processed: cardsToProcess.length,
          results,
          hasMore: cardsToProcess.length === batchSize
        };
      }),

    clearCardCache: adminProcedure
      .input(z.object({
        cardId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const deletedCount = await db.clearSnkrdunkCacheByCardId(input.cardId);
        return { success: true, deletedCount };
      }),

    clearAllCache: adminProcedure
      .mutation(async () => {
        const deletedCount = await db.clearAllSnkrdunkCache();
        return { success: true, deletedCount };
      }),

    // 獲取所有快取列表（包含卡牌信息、過期時間、商品數量）
    getAllCacheList: adminProcedure
      .input(z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      }))
      .query(async ({ input }) => {
        const { getAllSnkrdunkCacheList } = await import('./db');
        const result = await getAllSnkrdunkCacheList(input.page, input.pageSize);
        return result;
      }),

    // 清除單個卡牌快取（通過卡牌 ID）
    clearSingleCardCache: adminProcedure
      .input(z.object({
        cardId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { clearSnkrdunkCacheByCardId } = await import('./db');
        const deletedCount = await clearSnkrdunkCacheByCardId(input.cardId);
        return { success: true, deletedCount, message: `已清除卡牌 ${input.cardId} 的快取` };
      }),

    // 批量清除所有快取
    clearAllCacheBatch: adminProcedure
      .mutation(async () => {
        const { clearAllSnkrdunkCache } = await import('./db');
        const deletedCount = await clearAllSnkrdunkCache();
        return { success: true, deletedCount, message: `已清除 ${deletedCount} 個快取記錄` };
      }),

    // 啟動批量更新任務（創建任務記錄）
    startBatchUpdateTask: adminProcedure
      .mutation(async () => {
        // 檢查是否已有運行中的任務
        const existingTask = await db.getRunningBatchUpdateTask('batch_snkrdunk_update');
        if (existingTask) {
          return {
            taskId: existingTask.id,
            message: '已有批量更新任務運行中',
            existing: true,
          };
        }

        // 獲取總卡牌數
        const stats = await db.getDetailedSnkrdunkCacheStats();
        const totalItems = stats.needUpdate;

        // 創建新任務
        const taskId = await db.createScheduledTask({
          taskType: 'batch_snkrdunk_update',
          status: 'running',
          totalItems,
          processedItems: 0,
          successCount: 0,
          failureCount: 0,
          progress: 0,
          metadata: JSON.stringify({ errors: [] }),
        });

        return {
          taskId,
          totalItems,
          message: '批量更新任務已啟動',
          existing: false,
        };
      }),

    // 更新批量更新任務進度
    updateBatchUpdateProgress: adminProcedure
      .input(z.object({
        taskId: z.number(),
        processed: z.number(),
        success: z.number(),
        failed: z.number(),
        skipped: z.number(),
        errors: z.array(z.object({
          cardId: z.number(),
          error: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        const task = await db.getScheduledTask(input.taskId);
        if (!task) {
          throw new Error(`Task ${input.taskId} not found`);
        }

        const newProcessedItems = (task.processedItems || 0) + input.processed;
        const newSuccessCount = (task.successCount || 0) + input.success;
        const newFailureCount = (task.failureCount || 0) + input.failed;
        const progress = task.totalItems ? Math.round((newProcessedItems / task.totalItems) * 100) : 0;

        // 更新錯誤信息
        let metadata: any = {};
        try {
          metadata = task.metadata ? JSON.parse(task.metadata) : {};
        } catch (e) {
          metadata = {};
        }

        if (!metadata.errors) {
          metadata.errors = [];
        }
        metadata.errors.push(...input.errors);

        // 只保留最近 100 個錯誤
        if (metadata.errors.length > 100) {
          metadata.errors = metadata.errors.slice(-100);
        }

        await db.updateScheduledTask(input.taskId, {
          processedItems: newProcessedItems,
          successCount: newSuccessCount,
          failureCount: newFailureCount,
          progress,
          metadata: JSON.stringify(metadata),
        });

        return {
          success: true,
          progress,
          processedItems: newProcessedItems,
        };
      }),

    // 獲取 SNKRDUNK 快取批量更新任務進度
    getSnkrdunkCacheBatchUpdateProgress: adminProcedure
      .query(async () => {
        const task = await db.getLatestBatchUpdateTask('batch_snkrdunk_update');
        if (!task) {
          return null;
        }

        // 解析錯誤信息
        let errors: Array<{ cardId: number; error: string }> = [];
        try {
          const metadata = task.metadata ? JSON.parse(task.metadata) : {};
          errors = metadata.errors || [];
        } catch (e) {
          console.error('Failed to parse task metadata:', e);
        }

        return {
          taskId: task.id,
          taskType: task.taskType,
          status: task.status,
          totalItems: task.totalItems || 0,
          processedItems: task.processedItems || 0,
          successCount: task.successCount || 0,
          failureCount: task.failureCount || 0,
          progress: task.progress || 0,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
          errors,
        };
      }),

    // 完成批量更新任務
    completeBatchUpdateTask: adminProcedure
      .input(z.object({
        taskId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.updateScheduledTask(input.taskId, {
          status: 'completed',
          completedAt: new Date(),
          progress: 100,
        });

        return { success: true };
      }),

    // 停止批量更新任務
    stopBatchUpdateTask: adminProcedure
      .input(z.object({
        taskId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.updateScheduledTask(input.taskId, {
          status: 'completed',
          completedAt: new Date(),
        });

        return { success: true };
      }),
    // User Management APIs
    getUserList: adminProcedure
      .input(z.object({
        page: z.number().min(1).optional(),
        pageSize: z.number().min(1).max(100).optional(),
        search: z.string().optional(),
        role: z.enum(["admin", "user"]).optional(),
        loginMethod: z.enum(["password", "google"]).optional(),
      }).optional())
      .query(async ({ input }) => {
        const { getUserList } = await import('./userManagement');
        return await getUserList(input || {});
      }),

    getUserStats: adminProcedure
      .query(async () => {
        const { getUserStats } = await import('./userManagement');
        return await getUserStats();
      }),

    updateUserRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(["admin", "user"]),
      }))
      .mutation(async ({ input }) => {
        const { updateUserRole } = await import('./userManagement');
        return await updateUserRole(input.userId, input.role);
      }),

    updateUser: adminProcedure
      .input(z.object({
        userId: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
      }))
      .mutation(async ({ input }) => {
        const { updateUser } = await import('./userManagement');
        const { userId, ...data } = input;
        return await updateUser(userId, data);
      }),

    resetUserPassword: adminProcedure
      .input(z.object({
        userId: z.number(),
        newPassword: z.string().min(8),
      }))
      .mutation(async ({ input }) => {
        const { resetUserPassword } = await import('./userManagement');
        return await resetUserPassword(input.userId, input.newPassword);
      }),

    deleteUser: adminProcedure
      .input(z.object({
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { deleteUser } = await import('./userManagement');
        return await deleteUser(input.userId);
      }),

    getUserById: adminProcedure
      .input(z.object({
        userId: z.number(),
      }))
      .query(async ({ input }) => {
        const { getUserById } = await import('./userManagement');
        return await getUserById(input.userId);
      }),
    
    // Get trending rankings cache status
    getTrendingCacheStatus: adminProcedure
      .query(async () => {
        const { getTrendingCacheStatus } = await import('./trendingCacheManager');
        const status = await getTrendingCacheStatus();
        return status || [];
      }),
    
    // Manually refresh trending rankings cache
    refreshTrendingCache: adminProcedure
      .mutation(async () => {
        const { manualRefreshTrendingCache } = await import('./trendingCacheManager');
        const result = await manualRefreshTrendingCache();
        return result;
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

  templates: templatesRouter,

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
  }),

  // Blog router - article management and AI generation
  blog: router({
    // Debug: Get post data for troubleshooting
    debugGetPost: publicProcedure
      .input(z.object({ id: z.number().optional() }))
      .query(async ({ input }) => {
        const blogDb = await import('./blogDb');
        const { getDb } = await import('./db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { posts } = await import('../drizzle/schema_new');
        const { desc } = await import('drizzle-orm');
        
        let query = db.select().from(posts);
        if (input.id) {
          const { eq } = await import('drizzle-orm');
          query = query.where(eq(posts.id, input.id)) as any;
        } else {
          query = query.orderBy(desc(posts.createdAt)).limit(1) as any;
        }
        
        const result = await query;
        return result.length > 0 ? result[0] : null;
      }),

    // Get all posts with filters
    getPosts: publicProcedure
      .input(z.object({
        categoryId: z.number().optional(),
        status: z.enum(['draft', 'published']).optional(),
        search: z.string().optional(),
        sortBy: z.enum(['newest', 'oldest', 'views']).optional(),
        limit: z.number().min(1).max(50).optional(),
        offset: z.number().min(0).optional(),
      }))
      .query(async ({ input }) => {
        const blogDb = await import('./blogDb');
        return await blogDb.getPosts(input);
      }),

    // Get post by slug
    getPostBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const blogDb = await import('./blogDb');
        return await blogDb.getPostBySlug(input.slug);
      }),

    // Create new post (Admin only)
    createPost: adminProcedure
      .input(z.object({
        title: z.string(),
        excerpt: z.string().optional(),
        content: z.string(),
        featuredImage: z.string().optional(),
        category: z.string().optional(), // Category name (e.g., "市場分析", "卡牌評測")
        categoryId: z.number().optional(),
        status: z.enum(['draft', 'published']),
        dataSource: z.enum(['manual', 'ai-generated', 'mixed']),
        relatedCardIds: z.string().optional(),
        dataSnapshot: z.string().optional(),
        metaTitle: z.string().optional(),
        metaDescription: z.string().optional(),
        metaKeywords: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const blogDb = await import('./blogDb');
        
        // Generate slug from title
        const slug = blogDb.generateSlug(input.title);
        
        // Create post
        const postId = await blogDb.createPost({
          title: input.title,
          slug,
          excerpt: input.excerpt || null,
          content: input.content,
          featuredImage: input.featuredImage || null,
          category: input.category || null,
          categoryId: input.categoryId || null,
          status: input.status,
          publishedAt: input.status === 'published' ? new Date() : null,
          viewCount: 0,
          authorId: ctx.user?.id || 0,
          dataSource: input.dataSource,
          relatedCardIds: input.relatedCardIds || null,
          dataSnapshot: input.dataSnapshot || null,
          metaTitle: input.metaTitle || null,
          metaDescription: input.metaDescription || null,
          metaKeywords: input.metaKeywords || null,
        });
        
        // Add tags if provided
        if (input.tags && input.tags.length > 0) {
          const tagIds: number[] = [];
          for (const tagName of input.tags) {
            const tagSlug = blogDb.generateSlug(tagName);
            let tag = await blogDb.getTagBySlug(tagSlug);
            if (!tag) {
              const tagId = await blogDb.createTag({ name: tagName, slug: tagSlug });
              tagIds.push(tagId);
            } else {
              tagIds.push(tag.id);
            }
          }
          await blogDb.addTagsToPost(postId, tagIds);
        }
        
        return { postId, slug };
      }),

    // Update post (Admin only)
    updatePost: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        excerpt: z.string().optional(),
        content: z.string().optional(),
        featuredImage: z.string().optional(),
        category: z.string().optional(), // Category name (e.g., "市場分析", "卡牌評測")
        categoryId: z.number().optional(),
        status: z.enum(['draft', 'published']).optional(),
        metaTitle: z.string().optional(),
        metaDescription: z.string().optional(),
        metaKeywords: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const blogDb = await import('./blogDb');
        
        // Save current version before updating
        const currentPost = await blogDb.getPostById(input.id);
        if (currentPost && ctx.user) {
          const { getDb } = await import('./db');
          const db = await getDb();
          if (db) {
            const { postVersions } = await import('../drizzle/schema_new');
            await db.insert(postVersions).values({
              postId: input.id,
              title: currentPost.title,
              excerpt: currentPost.excerpt || null,
              content: currentPost.content,
              featuredImage: currentPost.featuredImage || null,
              category: currentPost.category || null,
              tags: '', // Will be populated from postTags relation if needed
              metaKeywords: currentPost.metaKeywords || null,
              createdBy: ctx.user.id,
            });
          }
        }
        
        const updates: any = {};
        if (input.title) {
          updates.title = input.title;
          updates.slug = blogDb.generateSlug(input.title);
        }
        if (input.excerpt !== undefined) updates.excerpt = input.excerpt;
        if (input.content) updates.content = input.content;
        if (input.featuredImage !== undefined) updates.featuredImage = input.featuredImage;
        if (input.category !== undefined) updates.category = input.category;
        if (input.categoryId !== undefined) updates.categoryId = input.categoryId;
        if (input.status) {
          updates.status = input.status;
          updates.publishedAt = input.status === 'published' ? new Date() : null;
        }
        if (input.metaTitle !== undefined) updates.metaTitle = input.metaTitle;
        if (input.metaDescription !== undefined) updates.metaDescription = input.metaDescription;
        if (input.metaKeywords !== undefined) updates.metaKeywords = input.metaKeywords;
        
        await blogDb.updatePost(input.id, updates);
        
        // Update tags if provided
        if (input.tags) {
          await blogDb.removeTagsFromPost(input.id);
          if (input.tags.length > 0) {
            const tagIds: number[] = [];
            for (const tagName of input.tags) {
              const tagSlug = blogDb.generateSlug(tagName);
              let tag = await blogDb.getTagBySlug(tagSlug);
              if (!tag) {
                const tagId = await blogDb.createTag({ name: tagName, slug: tagSlug });
                tagIds.push(tagId);
              } else {
                tagIds.push(tag.id);
              }
            }
            await blogDb.addTagsToPost(input.id, tagIds);
          }
        }
        
        return { success: true };
      }),

    // Delete post (Admin only)
    deletePost: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const blogDb = await import('./blogDb');
        await blogDb.removeTagsFromPost(input.id);
        await blogDb.deletePost(input.id);
        return { success: true };
      }),

    // Toggle publish status (Admin only)
    togglePublish: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const blogDb = await import('./blogDb');
        await blogDb.togglePublishPost(input.id);
        return { success: true };
      }),

    // AI translate post (Admin only)
    translatePost: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const blogDb = await import('./blogDb');
        const { invokeLLM } = await import('./_core/llm');
        
        // Get post data
        const post = await blogDb.getPostById(input.id);
        if (!post) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
        }
        
        // Generate English translation using JSON schema
        const enResponse = await invokeLLM({
          messages: [
            { role: 'system', content: 'You are a professional translator. Translate the Chinese blog post to English. Maintain markdown formatting.' },
            { role: 'user', content: `Translate this blog post to English:\n\nTitle: ${post.title}\n\nExcerpt: ${post.excerpt || ''}\n\nContent:\n${post.content}` }
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'blog_translation',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Translated title' },
                  excerpt: { type: 'string', description: 'Translated excerpt' },
                  content: { type: 'string', description: 'Translated content with markdown' }
                },
                required: ['title', 'excerpt', 'content'],
                additionalProperties: false
              }
            }
          }
        });
        
        const enData = JSON.parse(enResponse.choices[0].message.content as string);
        const titleEn = enData.title;
        const excerptEn = enData.excerpt;
        const contentEn = enData.content;
        
        // Generate Japanese translation using JSON schema
        const jaResponse = await invokeLLM({
          messages: [
            { role: 'system', content: 'You are a professional translator. Translate the Chinese blog post to Japanese. Maintain markdown formatting.' },
            { role: 'user', content: `Translate this blog post to Japanese:\n\nTitle: ${post.title}\n\nExcerpt: ${post.excerpt || ''}\n\nContent:\n${post.content}` }
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'blog_translation',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Translated title' },
                  excerpt: { type: 'string', description: 'Translated excerpt' },
                  content: { type: 'string', description: 'Translated content with markdown' }
                },
                required: ['title', 'excerpt', 'content'],
                additionalProperties: false
              }
            }
          }
        });
        
        const jaData = JSON.parse(jaResponse.choices[0].message.content as string);
        const titleJa = jaData.title;
        const excerptJa = jaData.excerpt;
        const contentJa = jaData.content;
        
        // Update post with translations
        await blogDb.updatePost(input.id, {
          titleEn,
          excerptEn,
          contentEn,
          titleJa,
          excerptJa,
          contentJa,
        });
        
        return { 
          success: true,
          translations: {
            en: { title: titleEn, excerpt: excerptEn },
            ja: { title: titleJa, excerpt: excerptJa }
          }
        };
      }),

    // Update post translation (Admin only)
    updatePostTranslation: adminProcedure
      .input(z.object({
        id: z.number(),
        titleEn: z.string().optional(),
        titleJa: z.string().optional(),
        excerptEn: z.string().optional(),
        excerptJa: z.string().optional(),
        contentEn: z.string().optional(),
        contentJa: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const blogDb = await import('./blogDb');
        const { id, ...translations } = input;
        
        // Update post with translations
        await blogDb.updatePost(id, translations);
        
        return { success: true };
      }),

    // Get all categories
    getCategories: publicProcedure
      .query(async () => {
        const blogDb = await import('./blogDb');
        return await blogDb.getCategories();
      }),

    // Create category (Admin only)
    createCategory: adminProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const blogDb = await import('./blogDb');
        const slug = blogDb.generateSlug(input.name);
        const categoryId = await blogDb.createCategory({
          name: input.name,
          slug,
          description: input.description || null,
        });
        return { categoryId, slug };
      }),

    // Increment post view count
    incrementViewCount: publicProcedure
      .input(z.object({ slug: z.string() }))
      .mutation(async ({ input }) => {
        const blogDb = await import('./blogDb');
        await blogDb.incrementPostViewCount(input.slug);
        return { success: true };
      }),

    // Record share event
    recordShare: publicProcedure
      .input(z.object({
        slug: z.string(),
        shareType: z.enum(['facebook', 'whatsapp', 'copy_link']),
      }))
      .mutation(async ({ input, ctx }) => {
        const blogDb = await import('./blogDb');
        await blogDb.recordPostShare({
          slug: input.slug,
          shareType: input.shareType,
          userAgent: ctx.req?.headers['user-agent'],
          ipAddress: ctx.req?.ip || ctx.req?.socket?.remoteAddress,
        });
        return { success: true };
      }),

    // Get all posts share statistics (Admin only)
    getAllPostsShareStats: adminProcedure
      .query(async () => {
        const blogDb = await import('./blogDb');
        return await blogDb.getAllPostsShareStats();
      }),

    // AI generate article (Admin only)
    generateArticle: adminProcedure
      .input(z.object({
        articleType: z.enum(['daily-report', 'card-analysis', 'market-trend', 'news']),
        featuredImageUrl: z.string().optional(),
        dataInput: z.object({
          cardIds: z.array(z.number()).optional(),
          timeRange: z.enum(['7d', '30d', '60d', 'all']).optional(),
          topic: z.string().optional(),
        }).optional(),
        imageInput: z.object({
          imageUrls: z.array(z.string()),
          extractedText: z.string().optional(),
        }).optional(),
        textInput: z.object({
          content: z.string(),
          topic: z.string(),
        }).optional(),
        urlInput: z.object({
          url: z.string(),
          targetLanguage: z.enum(['zh-TW', 'en', 'ja']).optional(),
        }).optional(),
        options: z.object({
          language: z.enum(['zh-TW', 'en', 'ja']).optional(),
          tone: z.enum(['professional', 'casual', 'technical']).optional(),
          length: z.enum(['short', 'medium', 'long']).optional(),
        }).optional(),
      }))
      .mutation(async ({ input }) => {
        const articleGenerator = await import('./articleGenerator');
        const result = await articleGenerator.generateArticle(input);
        // Add featured image URL to result if provided
        if (input.featuredImageUrl) {
          result.featuredImage = input.featuredImageUrl;
        }
        return result;
      }),

    // Generate theme image using AI (Admin only)
    generateThemeImage: adminProcedure
      .input(z.object({ prompt: z.string() }))
      .mutation(async ({ input }) => {
        const { generateImage } = await import('./_core/imageGeneration');
        const result = await generateImage({ prompt: input.prompt });
        return result;
      }),

    // Get post versions (Admin only)
    getPostVersions: adminProcedure
      .input(z.object({ postId: z.number() }))
      .query(async ({ input }) => {
        const { getDb } = await import('./db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { postVersions, users } = await import('../drizzle/schema_new');
        const { desc, eq } = await import('drizzle-orm');
        
        const versions = await db.select({
          id: postVersions.id,
          title: postVersions.title,
          excerpt: postVersions.excerpt,
          content: postVersions.content,
          featuredImage: postVersions.featuredImage,
          category: postVersions.category,
          tags: postVersions.tags,
          metaKeywords: postVersions.metaKeywords,
          createdAt: postVersions.createdAt,
          createdByName: users.name,
        })
        .from(postVersions)
        .leftJoin(users, eq(postVersions.createdBy, users.id))
        .where(eq(postVersions.postId, input.postId))
        .orderBy(desc(postVersions.createdAt));
        
        return versions;
      }),

    // Restore post version (Admin only)
    restorePostVersion: adminProcedure
      .input(z.object({ 
        postId: z.number(),
        versionId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { getDb } = await import('./db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { postVersions } = await import('../drizzle/schema_new');
        const { eq } = await import('drizzle-orm');
        
        // Get version data
        const [version] = await db.select()
          .from(postVersions)
          .where(eq(postVersions.id, input.versionId))
          .limit(1);
        
        if (!version) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found' });
        }
        
        // Update post with version data
        const blogDb = await import('./blogDb');
        await blogDb.updatePost(input.postId, {
          title: version.title,
          excerpt: version.excerpt || undefined,
          content: version.content,
          featuredImage: version.featuredImage || undefined,
          category: version.category || undefined,
          metaKeywords: version.metaKeywords || undefined,
        });
        
        // Update tags if available
        if (version.tags) {
          // Note: Tags are stored as comma-separated string in version
          // For simplicity, we skip tag restoration in this version
          // TODO: Implement proper tag restoration if needed
        }
        
        return { success: true };
      }),

    // AI generate metadata (category, tags, SEO keywords) for article (Admin only)
    generateMetadata: adminProcedure
      .input(z.object({
        title: z.string(),
        excerpt: z.string(),
        content: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import('./_core/llm');
        
        // Call LLM to generate metadata
        const response = await invokeLLM({
          messages: [
            { 
              role: 'system', 
              content: 'You are a professional SEO specialist and content categorizer. Analyze the article and generate appropriate category, tags, and SEO keywords. Return the result in JSON format.' 
            },
            { 
              role: 'user', 
              content: `Analyze this article and generate metadata:\n\nTitle: ${input.title}\n\nExcerpt: ${input.excerpt}\n\nContent:\n${input.content.substring(0, 2000)}...\n\nPlease generate:\n1. A single category (e.g., "市場分析", "卡牌評測", "新聞資訊", "投資指南")\n2. 3-5 relevant tags (e.g., "Pokémon TCG", "卡牌價格", "市場趨勢")\n3. 5-8 SEO keywords (e.g., "Pokémon TCG", "寶可夢卡牌", "市場分析", "投資指南")` 
            }
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'article_metadata',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  category: { type: 'string', description: 'Single category for the article' },
                  tags: { 
                    type: 'array', 
                    items: { type: 'string' },
                    description: '3-5 relevant tags'
                  },
                  seoKeywords: { 
                    type: 'array', 
                    items: { type: 'string' },
                    description: '5-8 SEO keywords'
                  },
                },
                required: ['category', 'tags', 'seoKeywords'],
                additionalProperties: false,
              },
            },
          },
        });
        
        const messageContent = response.choices[0]?.message?.content;
        if (!messageContent) {
          throw new Error('生成失敗');
        }
        
        const contentString = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent);
        const metadata = JSON.parse(contentString || '{}');
        
        return metadata;
      }),

    // AI edit article (Admin only)
    editArticleWithAI: adminProcedure
      .input(z.object({
        article: z.object({
          title: z.string(),
          excerpt: z.string(),
          content: z.string(),
        }),
        instruction: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import('./_core/llm');
        
        // Call LLM to edit the article based on user instruction
        const response = await invokeLLM({
          messages: [
            { 
              role: 'system', 
              content: 'You are a professional blog editor. Edit the article based on user instructions while maintaining the original style and structure. Return the edited article in JSON format with title, excerpt, and content fields. Keep markdown formatting.' 
            },
            { 
              role: 'user', 
              content: `Edit this article based on the following instruction:\n\nInstruction: ${input.instruction}\n\nCurrent Article:\nTitle: ${input.article.title}\n\nExcerpt: ${input.article.excerpt}\n\nContent:\n${input.article.content}` 
            }
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'edited_article',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Edited title' },
                  excerpt: { type: 'string', description: 'Edited excerpt' },
                  content: { type: 'string', description: 'Edited content with markdown' }
                },
                required: ['title', 'excerpt', 'content'],
                additionalProperties: false
              }
            }
          }
        });
        
        const editedData = JSON.parse(response.choices[0].message.content as string);
        
        return {
          title: editedData.title,
          excerpt: editedData.excerpt,
          content: editedData.content,
        };
      }),

    // List all uploaded images (Admin only)
    listUploadedImages: adminProcedure
      .input(z.object({
        search: z.string().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        const { getDb } = await import('./db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { uploadedImages, users } = await import('../drizzle/schema_new');
        const { eq, like, desc } = await import('drizzle-orm');
        
        let query = db.select({
          id: uploadedImages.id,
          url: uploadedImages.url,
          fileKey: uploadedImages.fileKey,
          fileName: uploadedImages.fileName,
          fileSize: uploadedImages.fileSize,
          mimeType: uploadedImages.mimeType,
          uploadedBy: uploadedImages.uploadedBy,
          createdAt: uploadedImages.createdAt,
          uploaderName: users.name,
        })
        .from(uploadedImages)
        .leftJoin(users, eq(uploadedImages.uploadedBy, users.id))
        .orderBy(desc(uploadedImages.createdAt))
        .limit(input.limit)
        .offset(input.offset);
        
        if (input.search) {
          query = query.where(like(uploadedImages.fileName, `%${input.search}%`)) as any;
        }
        
        const images = await query;
        return images;
      }),

    // Delete uploaded image (Admin only)
    deleteUploadedImage: adminProcedure
      .input(z.object({ imageId: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import('./db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { uploadedImages } = await import('../drizzle/schema_new');
        const { eq } = await import('drizzle-orm');
        
        // TODO: Also delete from S3 if needed
        await db.delete(uploadedImages).where(eq(uploadedImages.id, input.imageId));
        
        return { success: true };
      }),

    // Record uploaded image (Admin only)
    recordUploadedImage: adminProcedure
      .input(z.object({
        url: z.string(),
        fileKey: z.string(),
        fileName: z.string(),
        fileSize: z.number(),
        mimeType: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        
        const { getDb } = await import('./db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { uploadedImages } = await import('../drizzle/schema_new');
        
        const [image] = await db.insert(uploadedImages).values({
          url: input.url,
          fileKey: input.fileKey,
          fileName: input.fileName,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
          uploadedBy: ctx.user.id,
        });
        
        return { success: true, imageId: image.insertId };
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
        // Try to get from cache first (only for default 30-day range)
        if (input.days === 30 || input.days === undefined) {
          const { getTrendingFromCache } = await import("./trendingCacheManager");
          const cachedData = await getTrendingFromCache("search_popularity", 30);
          if (cachedData) {
            console.log("[Trending API] Serving from cache: search_popularity");
            return input.limit ? cachedData.slice(0, input.limit) : cachedData;
          }
        }
        
        // Fall back to real-time calculation
        console.log("[Trending API] Cache miss, calculating in real-time: search_popularity");
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
        // Try to get from cache first (only for default 30-day range)
        if (input.days === 30 || input.days === undefined) {
          const { getTrendingFromCache } = await import("./trendingCacheManager");
          const cachedData = await getTrendingFromCache("price_increase", 30);
          if (cachedData) {
            console.log("[Trending API] Serving from cache: price_increase");
            return input.limit ? cachedData.slice(0, input.limit) : cachedData;
          }
        }
        
        // Fall back to real-time calculation
        console.log("[Trending API] Cache miss, calculating in real-time: price_increase");
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
        // Try to get from cache first (only for default 30-day range)
        if (input.days === 30 || input.days === undefined) {
          const { getTrendingFromCache } = await import("./trendingCacheManager");
          const cachedData = await getTrendingFromCache("price_decrease", 30);
          if (cachedData) {
            console.log("[Trending API] Serving from cache: price_decrease");
            return input.limit ? cachedData.slice(0, input.limit) : cachedData;
          }
        }
        
        // Fall back to real-time calculation
        console.log("[Trending API] Cache miss, calculating in real-time: price_decrease");
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

  // Profile router - user personal page APIs
  profile: router({
    // Get user's watchlist
    getWatchlist: protectedProcedure
      .query(async ({ ctx }) => {
        const { getUserWatchlist } = await import("./profile");
        const watchlist = await getUserWatchlist(ctx.user.id);
        return watchlist;
      }),

    // Check if card is in watchlist
    isInWatchlist: protectedProcedure
      .input(z.object({
        cardId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const { isCardInWatchlist } = await import("./profile");
        const isInWatchlist = await isCardInWatchlist(ctx.user.id, input.cardId);
        return { isInWatchlist };
      }),

    // Add card to watchlist
    addToWatchlist: protectedProcedure
      .input(z.object({
        cardId: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { addToWatchlist } = await import("./profile");
        await addToWatchlist(ctx.user.id, input.cardId, input.notes);
        return { success: true };
      }),

    // Update watchlist notes
    updateWatchlistNotes: protectedProcedure
      .input(z.object({
        watchlistId: z.number(),
        notes: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updateWatchlistNotes } = await import("./profile");
        await updateWatchlistNotes(ctx.user.id, input.watchlistId, input.notes);
        return { success: true };
      }),

    // Remove from watchlist by watchlist ID
    removeFromWatchlist: protectedProcedure
      .input(z.object({
        watchlistId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { removeFromWatchlist } = await import("./profile");
        await removeFromWatchlist(ctx.user.id, input.watchlistId);
        return { success: true };
      }),

    // Remove from watchlist by card ID
    removeFromWatchlistByCardId: protectedProcedure
      .input(z.object({
        cardId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { removeFromWatchlistByCardId } = await import("./profile");
        await removeFromWatchlistByCardId(ctx.user.id, input.cardId);
        return { success: true };
      }),

    // Get view history
    getViewHistory: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).optional(),
      }))
      .query(async ({ ctx, input }) => {
        const { getUserViewHistory } = await import("./profile");
        const history = await getUserViewHistory(ctx.user.id, input.limit);
        return history;
      }),

    // Add view history record
    addViewHistory: protectedProcedure
      .input(z.object({
        cardId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { addViewHistory } = await import("./profile");
        await addViewHistory(ctx.user.id, input.cardId);
        return { success: true };
      }),

    // Clear view history
    clearViewHistory: protectedProcedure
      .mutation(async ({ ctx }) => {
        const { clearViewHistory } = await import("./profile");
        await clearViewHistory(ctx.user.id);
        return { success: true };
      }),

    // Get watchlist statistics
    getWatchlistStats: protectedProcedure
      .query(async ({ ctx }) => {
        const { getUserWatchlistStats } = await import("./profile");
        const stats = await getUserWatchlistStats(ctx.user.id);
        return stats;
      }),
  }),

});

export type AppRouter = typeof appRouter;
