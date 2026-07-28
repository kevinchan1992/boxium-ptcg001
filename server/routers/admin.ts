/**
 * Admin tRPC Router
 * Admin-only operations: data sources, cache, user management, system tools
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import * as db from "../db";
import { extractSnkrdunkId, scrapeSnkrdunkPage, convertJpyToHkd, fetchCardDetailsFromApi, fetchPriceHistoryFromApi} from "../snkrdunkScraper";
import { downloadAndEncodeImage, getBestImageUrl} from "../imageUtils";
import { getUpdateStatus, manualUpdateDataSource, getSchedulerStatus, triggerManualUpdateAll} from "../scheduler";
import { executePersistentSnkrdunkBatchUpdate} from "../persistentSnkrdunkBatchUpdate";
import * as batchTaskManager from "../batchTaskManager";
import { restartScheduler} from "../batchUpdateScheduler";
import { restartPriceUpdateScheduler} from "../priceUpdateScheduler";
import { ensureOgImageExists} from "../ogImageComposer";
import { eq, lt, and, sql} from "drizzle-orm";
import { scheduledTasks, scheduleExecutionHistory} from "../../drizzle/schema_new";
export const adminRouter = router({
    getDataSources: publicProcedure
      .input(z.object({
        page: z.number().min(1).optional(),
        pageSize: z.number().min(1).max(100).optional(),
        search: z.string().optional(),
        status: z.enum(["all", "success", "pending", "failed"]).optional(),
        gameId: z.number().int().positive().optional(),
        productType: z.enum(["all", "single_card", "sealed_product"]).optional(),
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
        gameId: z.number().int().positive().optional(),
        productType: z.enum(["all", "single_card", "sealed_product"]).optional(),
      }).optional())
      .query(async ({ input }) => {
        const ids = await db.getAllFilteredDataSourceIds(input);
        return ids;
      }),

    getGames: publicProcedure
      .query(async () => {
        const dbInstance = await db.getDb();
        if (!dbInstance) return [];
        const { games } = await import('../../drizzle/schema_new');
        const { asc } = await import('drizzle-orm');
        const result = await dbInstance.select({
          id: games.id,
          code: games.code,
          name: games.name,
          nameZh: games.nameZh,
          nameJa: games.nameJa,
          isActive: games.isActive,
          sortOrder: games.sortOrder,
        }).from(games).where(eq(games.isActive, true)).orderBy(asc(games.sortOrder), asc(games.id));
        return result;
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
        gameId: z.number().int().positive().optional(), // Game type ID (defaults to 1 for Pokémon)
        productType: z.enum(["single_card", "sealed_product"]).optional(), // Product type (defaults to single_card)
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
          // Determine product type (default to single_card if not specified)
          const productType = input.productType || "single_card";

          // Scrape SNKRDUNK page with correct productType
          const cardData = await scrapeSnkrdunkPage(input.url, productType);
          const gameId = input.gameId || 1; // Default to Pokémon
          let productId: number;

          if (productType === "sealed_product") {
            // Create or update sealed product
            // For sealed products, we use the SNKRDUNK ID as the unique identifier
            // Since we don't have a getSealedProductByCardId function, we'll create a new product each time
            // TODO: Add getSealedProductByCardId function to avoid duplicates
            
            productId = await db.createSealedProduct({
              gameId,
              name: cardData.name,
              nameJa: cardData.nameJa,
              imageUrl: cardData.imageUrl || undefined,
              boxType: "booster_box", // Default to booster_box
              styleCode: cardData.styleCode || undefined,
            });
          } else {
            // Create or update single card
            const existingCard = await db.getCardByCardId(`snkrdunk-${snkrdunkId}`);

            if (existingCard) {
              productId = existingCard.id;
              // Update card with scraped data
              await db.updateCard(productId, {
                name: cardData.name,
                nameJa: cardData.nameJa,
                imageUrl: cardData.imageUrl || undefined,
              });
            } else {
              // Create new card
              // Extract card number from name (e.g., "Pikachu[SM-P 288]" → "SM-P 288")
              const cardNumberMatch = cardData.name.match(/\[([^\]]+)\]/);
              const cardNumber = cardNumberMatch ? cardNumberMatch[1].trim() : undefined;
              
              productId = await db.createCard({
                cardId: `snkrdunk-${snkrdunkId}`,
                gameId,
                name: cardData.name,
                nameJa: cardData.nameJa,
                imageUrl: cardData.imageUrl || undefined,
                cardNumber,
              });
            }
            // Pre-generate OG image once (idempotent: skips if already in S3)
            ensureOgImageExists(productId, cardData.imageUrl || null).catch(() => {});
          }

          // Add data source (now guaranteed to be new)
          await db.addDataSource({
            cardId: productId, // This is the ID of either a card or sealed product
            gameId, // Use the gameId determined above
            productType, // Use the productType determined above
            source: "snkrdunk",
            sourceUrl: input.url,
            sourceIdentifier: snkrdunkId,
          });

          // Save price history (with grade normalisation to ensure consistent format)
          const { normaliseGrade: normaliseGradeForAdd } = await import('../utils/priceValidator');
          for (const priceEntry of cardData.priceHistory) {
            const priceHkd = convertJpyToHkd(priceEntry.price);
            const normalisedGradeForAdd = productType === 'sealed_product' ? undefined : normaliseGradeForAdd(priceEntry.grade);
            await db.addPriceHistory({
              cardId: productId, // This is the ID of either a card or sealed product
              source: "snkrdunk",
              price: priceHkd.toString(),
              currency: "HKD",
              jpyPrice: priceEntry.price, // Original JPY price for stable deduplication
              grade: normalisedGradeForAdd,
              quantity: productType === 'sealed_product' ? priceEntry.quantity : undefined,
              productType, // Add productType field
              soldAt: priceEntry.soldAt,
              listingUrl: input.url,
            });
          }

          // Get and update data source status using indexed query (avoid full table scan)
          const newDataSource = await db.getDataSourceByCardIdAndSource(productId, "snkrdunk");
          if (newDataSource) {
            await db.updateDataSourceFetchStatus(newDataSource.id, "success");
          }

          return { success: true, cardId: productId, priceCount: cardData.priceHistory.length };
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

          // Use the same API-based scraper as persistentSnkrdunkBatchUpdate (confirmed working in production)
          // scrapeSnkrdunkPage (axios-based) was replaced here to fix production failures
          const productType = (dataSource.productType as "single_card" | "sealed_product") || "single_card";
          const productId = extractSnkrdunkId(dataSource.sourceUrl);
          if (!productId) {
            throw new Error(`Invalid SNKRDUNK URL: Cannot extract product ID from ${dataSource.sourceUrl}`);
          }

          // Fetch card details and price history using the same API path as batch update
          const [cardDetails, priceHistory] = await Promise.all([
            fetchCardDetailsFromApi(productId),
            fetchPriceHistoryFromApi(productId, productType),
          ]);

          // Update card or sealed product
          if (productType === 'sealed_product') {
            await db.updateSealedProduct(dataSource.cardId, {
              name: cardDetails.name,
              nameJa: cardDetails.nameJa,
              imageUrl: cardDetails.imageUrl || undefined,
              styleCode: cardDetails.styleCode || undefined,
            });
          } else {
            await db.updateCard(dataSource.cardId, {
              name: cardDetails.name,
              nameJa: cardDetails.nameJa,
              imageUrl: cardDetails.imageUrl || undefined,
            });
            // Pre-generate OG image once (idempotent: skips if already in S3)
            ensureOgImageExists(dataSource.cardId, cardDetails.imageUrl || null).catch(() => {});
          }

          // Save new price history with per-group sourcePosition (same as persistentSnkrdunkBatchUpdate.ts)
          // This ensures same-day same-price records each get a unique recordHash
          // and are NOT incorrectly deduplicated away.
          const { normaliseGrade } = await import('../utils/priceValidator');
          const groupCounters = new Map<string, number>();
          for (const priceEntry of priceHistory) {
            const rawPrice = priceEntry.price;
            // Guard: skip records with invalid price to prevent DB decimal validation errors
            if (rawPrice === undefined || rawPrice === null || isNaN(rawPrice)) {
              console.warn(`[refreshDataSource] Skipping record with invalid price: ${rawPrice} (dataSourceId=${input.dataSourceId})`);
              continue;
            }
            const priceHkd = convertJpyToHkd(rawPrice);
            const normalisedGrade = productType === 'sealed_product' ? undefined : normaliseGrade(priceEntry.grade);
            const jpyPrice = rawPrice;
            const soldAtStr = priceEntry.soldAt
              ? priceEntry.soldAt.toISOString().slice(0, 10)
              : 'unknown';
            const gradeKey = normalisedGrade ?? 'null';
            const groupKey = `${soldAtStr}|${gradeKey}|${jpyPrice}`;
            const sourcePosition = groupCounters.get(groupKey) ?? 0;
            groupCounters.set(groupKey, sourcePosition + 1);
            await db.addPriceHistory({
              cardId: dataSource.cardId,
              source: "snkrdunk",
              price: priceHkd.toString(),
              currency: "HKD",
              jpyPrice,
              sourcePosition,
              grade: normalisedGrade,
              quantity: productType === 'sealed_product' ? priceEntry.quantity : undefined,
              productType,
              soldAt: priceEntry.soldAt,
              listingUrl: dataSource.sourceUrl,
              // Pass relative-time dedup fields so dynamic time-window check can run
              isRelativeTime: priceEntry.isRelativeTime,
              estimatedSoldAt: priceEntry.estimatedSoldAt,
            });
          }

          // Update data source status
          await db.updateDataSourceFetchStatus(input.dataSourceId, "success");

          return { success: true, priceCount: priceHistory.length };
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
const { autoCrawlSnkrdunk } = await import("../scheduler");
        
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
const { getCrawlProgress } = await import("../scheduler");
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
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { scraperPerformanceLogs } = await import("../../drizzle/schema_new");
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
      const { warmCache } = await import("../services/cacheWarmer");
      const cardLimit = input?.cardLimit || 20;
      
      console.log(`[Admin] Triggering cache warming for ${cardLimit} cards...`);
      const result = await warmCache(cardLimit);
      
      return result;
    }),

  fixOrphanDataSources: adminProcedure.mutation(async ({ ctx }) => {
try {
          const { fixOrphanDataSources } = await import("../fixOrphanDataSources");
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
          fromName: settings.fromName?.settingValue || "BOXIUM TCG",
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
        // const { sendPasswordResetEmail, generateResetToken } = await import("../emailService");
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
    // ─── 批量更新 API（統一使用持久化版本，進度從數據庫讀取）───

    // 獲取批量更新進度（從數據庫讀取，前端輪詢用）
    getBatchUpdateProgress: publicProcedure
      .query(async () => {
        const runningTask = await batchTaskManager.getLatestRunningTask('batch_snkrdunk_update');
        if (runningTask) {
          // Fix: if totalItems is abnormally small (e.g. was set to batchSize instead of total),
          // use the larger of totalItems and processedItems as the denominator
          const processedItems = runningTask.processedItems || 0;
          const totalItems = Math.max(runningTask.totalItems || 0, processedItems);
          // Parse metadata for speed/ETA from GitHub Actions mid-run reports
          let speedPerSec = 0;
          let etaMinutes = 0;
          let source = 'platform';
          try {
            const meta = runningTask.metadata ? JSON.parse(runningTask.metadata as string) : {};
            speedPerSec = meta.speedPerSec || 0;
            etaMinutes = meta.etaMinutes || 0;
            source = meta.source || 'platform';
          } catch {}
          return {
            isRunning: true,
            isPaused: runningTask.status === 'paused',
            totalCards: totalItems,
            processedCards: processedItems,
            successCount: runningTask.successCount,
            failureCount: runningTask.failureCount,
            totalRecordsAdded: 0,
            errors: runningTask.errors || [],
            startTime: runningTask.startedAt ? new Date(runningTask.startedAt).getTime() : null,
            endTime: null,
            taskId: runningTask.taskId,
            speedPerSec,
            etaMinutes,
            source,
          };
        }
        return {
          isRunning: false,
          isPaused: false,
          totalCards: 0,
          processedCards: 0,
          successCount: 0,
          failureCount: 0,
          totalRecordsAdded: 0,
          errors: [],
          startTime: null,
          endTime: null,
          taskId: null,
          speedPerSec: 0,
          etaMinutes: 0,
          source: 'platform',
        };
      }),

    // 暫停批量更新（操作數據庫，batchTaskManager 是唯一的狀態來源）
    pauseBatchUpdate: adminProcedure
      .mutation(async () => {
        const runningTask = await batchTaskManager.getLatestRunningTask('batch_snkrdunk_update');
        if (runningTask) {
          await batchTaskManager.pauseTask(runningTask.taskId);
        }
        return { success: true, message: "批量更新已暫停" };
      }),

    // 繼續批量更新（操作數據庫）
    resumeBatchUpdate: adminProcedure
      .mutation(async () => {
        const runningTask = await batchTaskManager.getLatestRunningTask('batch_snkrdunk_update');
        if (runningTask) {
          await batchTaskManager.resumeTask(runningTask.taskId);
        }
        return { success: true, message: "批量更新已繼續" };
      }),

    // 啟動 SNKRDUNK 批量更新（持久化版本）
    batchUpdateSnkrdunkPrices: adminProcedure
      .mutation(async () => {
        try {
          const { taskId, totalCards } = await executePersistentSnkrdunkBatchUpdate();
          return {
            success: true,
            message: `SNKRDUNK 批量更新已啟動，共 ${totalCards} 張卡牌`,
            taskId,
            totalCards,
          };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `啟動 SNKRDUNK 批量更新失敗: ${error.message}`,
          });
        }
      }),

    // 手動觸發 GitHub Actions workflow
    triggerGitHubActionsWorkflow: adminProcedure
      .input(z.object({
        workflow: z.enum(['snkrdunk-batch-update', 'snkrdunk-listings-batch-update']),
      }))
      .mutation(async ({ input }) => {
        const githubPat = process.env.GITHUB_PAT;
        const githubRepo = process.env.GITHUB_REPO || 'kevinchan1992/boxium-ptcg001';
        const githubBranch = process.env.GITHUB_BRANCH || '主要的';

        if (!githubPat) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'GITHUB_PAT 未設定，請在後台 Secrets 設定 GitHub Personal Access Token',
          });
        }

        // Both jobs are now in the same workflow file; listings trigger uses snkrdunk-batch-update.yml
        const workflowFile = 'snkrdunk-batch-update.yml';
        // For listings-only trigger, pass skip_hours=9999 to prevent price history job from running
        const isListingsOnly = input.workflow === 'snkrdunk-listings-batch-update';
        const apiUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows/${workflowFile}/dispatches`;

        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${githubPat}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ref: githubBranch,
            inputs: isListingsOnly
              ? { skip_hours: '9999', parallel: '1', listings_parallel: '4', skip_hot_cache_hours: '1' }
              : {},
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (!resp.ok) {
          const body = await resp.text().catch(() => '');
          if (resp.status === 401 || resp.status === 403) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: `GitHub PAT 無效或權限不足（HTTP ${resp.status}）。請確認 PAT 有 workflow 權限。`,
            });
          }
          if (resp.status === 404) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `找不到 workflow 文件 ${workflowFile}，請確認已推送到 GitHub（snkrdunk-batch-update.yml）。`,
            });
          }
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `GitHub API 回應錯誤 HTTP ${resp.status}: ${body.slice(0, 200)}`,
          });
        }

        const workflowNames: Record<string, string> = {
          'snkrdunk-batch-update': 'SNKRDUNK 價格歷史批量更新',
          'snkrdunk-listings-batch-update': 'SNKRDUNK 在售商品批量更新',
        };

        return {
          success: true,
          message: `${workflowNames[input.workflow]} 已成功觸發，請前往 GitHub Actions 查看進度`,
          workflow: input.workflow,
          repoUrl: `https://github.com/${githubRepo}/actions`,
        };
      }),

    // 獲取在售商品快取統計
    getListingsCacheStats: adminProcedure
      .query(async () => {
        const stats = await db.getSnkrdunkListingsCacheStats();
        return stats;
      }),

    // 獲取 GitHub Actions workflow 最新執行狀態
    getWorkflowRunStatus: adminProcedure
      .input(z.object({
        workflow: z.enum(['snkrdunk-batch-update', 'snkrdunk-listings-batch-update']),
      }))
      .query(async ({ input }) => {
        const githubPat = process.env.GITHUB_PAT;
        const githubRepo = process.env.GITHUB_REPO || 'kevinchan1992/boxium-ptcg001';

        if (!githubPat) return null;

        // Both jobs are in the same workflow file; always query snkrdunk-batch-update.yml
        const workflowFile = 'snkrdunk-batch-update.yml';
        const apiUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows/${workflowFile}/runs?per_page=1`;

        try {
          const resp = await fetch(apiUrl, {
            headers: {
              'Authorization': `Bearer ${githubPat}`,
              'Accept': 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
            signal: AbortSignal.timeout(10000),
          });

          if (!resp.ok) return null;

          const data = await resp.json() as any;
          const run = data.workflow_runs?.[0];
          if (!run) return null;

          return {
            id: run.id as number,
            status: run.status as string,           // queued | in_progress | completed
            conclusion: run.conclusion as string | null,  // success | failure | cancelled | null
            createdAt: run.created_at as string,
            updatedAt: run.updated_at as string,
            htmlUrl: run.html_url as string,
            runNumber: run.run_number as number,
            event: run.event as string,             // schedule | workflow_dispatch
          };
        } catch {
          return null;
        }
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

    // 立即手動觸發排程（使用持久化版本）
    triggerScheduleNow: adminProcedure
      .mutation(async () => {
        try {
          // 創建執行歷史記錄
          const historyId = await db.addScheduleExecutionHistory({
            scheduleType: "batch_update_daily",
            executionType: "manual",
            status: "running",
            startedAt: new Date(),
          });

          // 使用持久化版本的批量更新
          const { taskId, totalCards } = await executePersistentSnkrdunkBatchUpdate();

          // 更新執行歷史（任務已在後台運行）
          await db.updateScheduleExecutionHistory(historyId, {
            status: "completed",
            snkrdunkSuccessCount: totalCards,
            snkrdunkFailureCount: 0,
            snkrdunkRecordsAdded: 0,
            completedAt: new Date(),
            durationMs: 0,
          });

          return {
            success: true,
            message: `排程任務已啟動，任務 ID: ${taskId}，共 ${totalCards} 張卡牌`,
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
        scheduleType: z.enum(["snkrdunk_update", "trending_update"]).optional(),
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
          const trending = await db.getScheduleExecutionHistory("trending_update", limit);
          
          return {
            snkrdunk,
            ebay: [], // eBay 功能已移除，返回空陣列
            trending,
          };
        }
      }),

    // Get schedule health statistics (last 7 days)
    getScheduleHealthStats: publicProcedure
      .query(async () => {
        const { getAllScheduleHealthStats } = await import('../getScheduleHealthStats');
        const stats = await getAllScheduleHealthStats();
        return stats;
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


    // 獲取儀表板統計數據
    getDashboardStats: publicProcedure
      .query(async () => {
        try {
          // 獲取各種統計數據
          const totalCards = await db.getTotalCardCount();
          const totalDataSources = await db.getTotalDataSourceCount();
          const activeDataSources = await db.getActiveDataSourceCount();
          const totalPriceRecords = await db.getTotalPriceRecordCount();
          // Alipay proof review stats
          const marketStats = await db.getMarketplaceStats();
          
          return {
            totalUsers: 0, // 平台已公開，無用戶系統
            totalCards,
            totalDataSources,
            activeDataSources,
            totalPriceRecords,
            pendingProofCount: marketStats.pendingProofCount,
            todayRejectedProofCount: marketStats.todayRejectedProofCount,
            overdueProofCount: marketStats.overdueProofCount,
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

    getDisputeStats: adminProcedure
      .query(async () => {
        try {
          return await db.getDisputeStats();
        } catch (error: any) {
          console.error('[Admin] Failed to get dispute stats:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
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
        taskType: z.enum(['batch_snkrdunk_update']),
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

    // 批量更新健康檢查 - 偵測卡死任務
    checkBatchHealth: adminProcedure
      .query(async () => {
        const stalledTasks = await batchTaskManager.checkStalledTasks(30);
        return {
          healthy: stalledTasks.length === 0,
          stalledTasks,
          checkedAt: new Date(),
        };
      }),

    // 強制取消卡死任務（標記為 failed）
    forceCancelStalledTask: adminProcedure
      .input(z.object({
        taskId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await batchTaskManager.completeTask(input.taskId, 'failed');
        return { success: true, message: `任務 ${input.taskId} 已強制取消` };
      }),

    // 恢復所有卡死任務（服務器啟動時自動調用，也可手動觸發）
    recoverStalledTasks: adminProcedure
      .mutation(async () => {
        const result = await batchTaskManager.recoverStalledTasks(30);
        return {
          success: true,
          recoveredCount: result.recoveredCount,
          recoveredTaskIds: result.recoveredTaskIds,
          message: result.recoveredCount > 0
            ? `已恢復 ${result.recoveredCount} 個卡死任務`
            : '沒有找到卡死任務',
        };
      }),

    // 從上次進度恢復失敗的批量更新任務
    resumeFailedBatchTask: adminProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ input }) => {
        const { resumeFailedTask } = await import('../persistentSnkrdunkBatchUpdate');
        const result = await resumeFailedTask(input.taskId);
        return {
          success: true,
          newTaskId: result.taskId,
          totalCards: result.totalCards,
          skippedCards: result.skippedCards,
          resumedFrom: result.resumedFrom,
          message: `已從任務 ${input.taskId} 的進度恢復，跳過 ${result.resumedFrom} 個已處理產品，繼續處理 ${result.totalCards} 個產品`,
        };
      }),

    // 價格更新排程 API
    getPriceUpdateSchedule: publicProcedure
      .query(async () => {
        const schedule = await db.getPriceUpdateSchedule();
        const { getPriceUpdateSchedulerStatus } = await import('../priceUpdateScheduler');
        const schedulerStatus = getPriceUpdateSchedulerStatus();
        return {
          ...schedule,
          snkrdunkSchedulerRunning: schedulerStatus.snkrdunkSchedulerRunning,
        };
      }),

    updatePriceUpdateSchedule: adminProcedure
      .input(z.object({
        snkrdunkEnabled: z.boolean().optional(),
        snkrdunkUpdateTime: z.string().optional(),
        snkrdunkUpdateMode: z.enum(['platform', 'github_actions']).optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updatePriceUpdateSchedule(input);
        // 重啟排程器以應用新設定
        await restartPriceUpdateScheduler();

        // ── 互斥邏輯：切換模式時自動 enable/disable GitHub Actions workflow ──
        // 選擇 'platform' → 停用 GitHub Actions 排程（避免重複執行）
        // 選擇 'github_actions' → 啟用 GitHub Actions 排程
        if (input.snkrdunkUpdateMode) {
          const githubPat = process.env.GITHUB_PAT;
          const githubRepo = process.env.GITHUB_REPO || 'kevinchan1992/boxium-ptcg001';
          const workflowFile = 'snkrdunk-batch-update.yml';
          if (githubPat) {
            try {
              const action = input.snkrdunkUpdateMode === 'platform' ? 'disable' : 'enable';
              const apiUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows/${workflowFile}/${action}`;
              const resp = await fetch(apiUrl, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${githubPat}`,
                  'Accept': 'application/vnd.github+json',
                  'X-GitHub-Api-Version': '2022-11-28',
                },
                signal: AbortSignal.timeout(10000),
              });
              if (resp.ok || resp.status === 204) {
                console.log(`[ScheduleMode] GitHub Actions workflow ${action}d (mode → ${input.snkrdunkUpdateMode})`);
              } else {
                console.warn(`[ScheduleMode] Failed to ${action} GitHub Actions workflow: HTTP ${resp.status}`);
              }
            } catch (err) {
              // 非致命錯誤：GitHub API 失敗不影響平台排程設定
              console.warn(`[ScheduleMode] GitHub API error when toggling workflow:`, err);
            }
          } else {
            console.warn('[ScheduleMode] GITHUB_PAT not set, skipping GitHub Actions workflow toggle');
          }
        }

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
            const { scrapeSnkrdunkListings } = await import('../services/snkrdunkScraperService');
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
        const { getAllSnkrdunkCacheList } = await import('../db');
        const result = await getAllSnkrdunkCacheList(input.page, input.pageSize);
        return result;
      }),

    // 清除單個卡牌快取（通過卡牌 ID）
    clearSingleCardCache: adminProcedure
      .input(z.object({
        cardId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { clearSnkrdunkCacheByCardId } = await import('../db');
        const deletedCount = await clearSnkrdunkCacheByCardId(input.cardId);
        return { success: true, deletedCount, message: `已清除卡牌 ${input.cardId} 的快取` };
      }),

    // 批量清除所有快取
    clearAllCacheBatch: adminProcedure
      .mutation(async () => {
        const { clearAllSnkrdunkCache } = await import('../db');
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
    // Task History APIs
    getTaskHistory: adminProcedure
      .input(z.object({
        page: z.number().min(1).optional(),
        pageSize: z.number().min(1).max(100).optional(),
        taskType: z.string().optional(),
        status: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await batchTaskManager.getTaskHistory(input);
      }),

    getTaskStats: adminProcedure
      .query(async () => {
        return await batchTaskManager.getTaskStats();
      }),

    cleanOldTasks: adminProcedure
      .input(z.object({
        keepCount: z.number().min(5).max(500).optional(),
      }))
      .mutation(async ({ input }) => {
        const deletedCount = await batchTaskManager.cleanOldTasks(input.keepCount || 50);
        return { success: true, deletedCount };
      }),

    deleteTask: adminProcedure
      .input(z.object({
        taskId: z.number(),
      }))
      .mutation(async ({ input }) => {
        // Only allow deleting completed or failed tasks
        const task = await batchTaskManager.getBatchTaskProgress(input.taskId);
        if (!task) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '找不到該任務' });
        }
        if (task.status === 'running' || task.status === 'paused') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '無法刪除正在運行或暫停的任務，請先取消任務' });
        }
        const dbInstance = await db.getDb();
        if (dbInstance) {
          await dbInstance.delete(scheduledTasks).where(eq(scheduledTasks.id, input.taskId));
        }
        return { success: true };
      }),
    cleanOldRecords: adminProcedure
      .input(z.object({
        daysToKeep: z.number().min(7).max(365).optional().default(30),
      }))
      .mutation(async ({ input }) => {
        const dbInstance = await db.getDb();
        if (!dbInstance) return { success: false, deletedTasks: 0, deletedHistory: 0 };
        const cutoffDate = new Date(Date.now() - input.daysToKeep * 24 * 60 * 60 * 1000);
        // Delete old completed/failed batch tasks (keep running/paused)
        const tasksResult = await dbInstance
          .delete(scheduledTasks)
          .where(
            and(
              lt(scheduledTasks.createdAt, cutoffDate),
              sql`${scheduledTasks.status} NOT IN ('running', 'paused')`
            )
          );
        const deletedTasks = Number((tasksResult as any)[0]?.affectedRows || 0);
        // Delete old schedule execution history
        const historyResult = await dbInstance
          .delete(scheduleExecutionHistory)
          .where(lt(scheduleExecutionHistory.startedAt, cutoffDate));
        const deletedHistory = Number((historyResult as any)[0]?.affectedRows || 0);
        console.log(`[Admin] Cleaned old records: ${deletedTasks} tasks, ${deletedHistory} schedule history (older than ${input.daysToKeep} days)`);
        return { success: true, deletedTasks, deletedHistory };
      }),

    // User Management APIs
    getUserList: adminProcedure
      .input(z.object({
        page: z.number().min(1).optional(),
        pageSize: z.number().min(1).max(100).optional(),
        search: z.string().optional(),
        role: z.enum(["admin", "user"]).optional(),
        loginMethod: z.enum(["password", "google"]).optional(),
        isBlocked: z.boolean().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { getUserList } = await import('../userManagement');
        return await getUserList(input || {});
      }),

    getUserStats: adminProcedure
      .query(async () => {
        const { getUserStats } = await import('../userManagement');
        return await getUserStats();
      }),

    updateUserRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(["admin", "user"]),
      }))
      .mutation(async ({ input }) => {
        const { updateUserRole } = await import('../userManagement');
        return await updateUserRole(input.userId, input.role);
      }),

    updateUser: adminProcedure
      .input(z.object({
        userId: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
      }))
      .mutation(async ({ input }) => {
        const { updateUser } = await import('../userManagement');
        const { userId, ...data } = input;
        return await updateUser(userId, data);
      }),

    resetUserPassword: adminProcedure
      .input(z.object({
        userId: z.number(),
        newPassword: z.string().min(8),
      }))
      .mutation(async ({ input }) => {
        const { resetUserPassword } = await import('../userManagement');
        return await resetUserPassword(input.userId, input.newPassword);
      }),

    deleteUser: adminProcedure
      .input(z.object({
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { deleteUser } = await import('../userManagement');
        return await deleteUser(input.userId);
      }),

    getUserById: adminProcedure
      .input(z.object({
        userId: z.number(),
      }))
      .query(async ({ input }) => {
        const { getUserById } = await import('../userManagement');
        return await getUserById(input.userId);
      }),

    getUserDetailWithStats: adminProcedure
      .input(z.object({
        userId: z.number(),
      }))
      .query(async ({ input }) => {
        const { getUserDetailWithStats } = await import('../userManagement');
        return await getUserDetailWithStats(input.userId);
      }),
    blockUser: adminProcedure
      .input(z.object({
        userId: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { blockUser } = await import('../userManagement');
        return await blockUser(input.userId, input.reason);
      }),
    unblockUser: adminProcedure
      .input(z.object({
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { unblockUser } = await import('../userManagement');
        return await unblockUser(input.userId);
      }),
    
    // Get trending rankings cache status
    getTrendingCacheStatus: adminProcedure
      .query(async () => {
        const { getTrendingCacheStatus } = await import('../trendingCacheManager');
        const status = await getTrendingCacheStatus();
        return status || [];
      }),
    
    // Manually refresh trending rankings cache
    refreshTrendingCache: adminProcedure
      .mutation(async () => {
        const { manualRefreshTrendingCache } = await import('../trendingCacheManager');
        const result = await manualRefreshTrendingCache();
        return result;
      }),

    // 更新卡盒封面圖
    updateSealedProductImage: adminProcedure
      .input(z.object({
        sealedProductId: z.number(),
        imageUrl: z.string().url(),
      }))
      .mutation(async ({ input }) => {
        const dbInstance = await db.getDb();
        if (!dbInstance) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { sealedProducts } = await import('../../drizzle/schema_new');
        await dbInstance
          .update(sealedProducts)
          .set({ imageUrl: input.imageUrl })
          .where(eq(sealedProducts.id, input.sealedProductId));
        return { success: true };
      }),

    // 獲取所有卡盒列表（供 Admin 管理用）
    listSealedProductsAdmin: adminProcedure
      .query(async () => {
        const dbInstance = await db.getDb();
        if (!dbInstance) return [];
        const { sealedProducts } = await import('../../drizzle/schema_new');
        const results = await dbInstance.select().from(sealedProducts);
        return results;
      }),
    // Search token index management
    populateSearchTokens: adminProcedure
      .mutation(async () => {
        const result = await db.populateAllSearchTokens();
        return result;
      }),
    getSearchTokenCount: adminProcedure
      .query(async () => {
        const count = await db.getSearchTokenCount();
        return { count };
      }),

    // 單張卡牌即時 eBay 爬取：觸發 GitHub Actions ebay-scraper.yml（single card mode）
    triggerEbayForCard: adminProcedure
      .input(z.object({
        cardId: z.number().int().positive(),
        cardName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const githubPat = process.env.GITHUB_PAT;
        const githubRepo = process.env.GITHUB_REPO || 'kevinchan1992/boxium-ptcg001';
        const githubBranch = process.env.GITHUB_BRANCH || '主要的';
        if (!githubPat) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'GITHUB_PAT 未設定，請在後台 Secrets 設定 GitHub Personal Access Token',
          });
        }
        const workflowFile = 'ebay-scraper.yml';
        const apiUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows/${workflowFile}/dispatches`;
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${githubPat}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ref: githubBranch,
            inputs: {
              card_ids: String(input.cardId),
            },
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!resp.ok) {
          const body = await resp.text().catch(() => '');
          if (resp.status === 401 || resp.status === 403) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: `GitHub PAT 無效或權限不足（HTTP ${resp.status}）。請確認 PAT 有 workflow 權限。`,
            });
          }
          if (resp.status === 404) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `找不到 workflow 文件 ${workflowFile}，請確認已推送到 GitHub。`,
            });
          }
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `GitHub API 回應錯誤 HTTP ${resp.status}: ${body.slice(0, 200)}`,
          });
        }
        return {
          success: true,
          message: `已觸發 eBay 爬取（卡牌 ID: ${input.cardId}${input.cardName ? ` — ${input.cardName}` : ''}），請稍候 1-2 分鐘後刷新查看結果`,
          cardId: input.cardId,
          repoUrl: `https://github.com/${githubRepo}/actions`,
        };
      }),

  // ─── PSA Spec ID Batch Update ──────────────────────────────────────────────
  // Called by Chrome Console script running on psacard.com to submit matched specIds
  psaBatchUpdateSpecIds: publicProcedure
    .input(z.object({
      secret: z.string(),
      results: z.array(z.object({
        cardId: z.number().int().positive(),
        specId: z.string().nullable(), // null = no match found
      })).max(200),
    }))
    .mutation(async ({ input }) => {
      // Simple secret check (not user-auth, just prevent abuse)
      const expectedSecret = process.env.CRON_SECRET || 'psa-matcher-secret';
      if (input.secret !== expectedSecret) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid secret' });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });

      const { cards } = await import('../../drizzle/schema_new');
      const { eq } = await import('drizzle-orm');

      let updated = 0;
      let noMatch = 0;

      for (const r of input.results) {
        await dbInstance.update(cards)
          .set({
            psaSpecId: r.specId,
            psaMatchedAt: new Date(),
          })
          .where(eq(cards.id, r.cardId));
        if (r.specId) updated++;
        else noMatch++;
      }

      return { success: true, updated, noMatch, total: input.results.length };
    }),

  // Get next batch of unmatched cards for PSA Console script
  psaGetUnmatchedBatch: publicProcedure
    .input(z.object({
      secret: z.string(),
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const expectedSecret = process.env.CRON_SECRET || 'psa-matcher-secret';
      if (input.secret !== expectedSecret) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid secret' });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });

      const { cards } = await import('../../drizzle/schema_new');
      const { isNull, or, lt, and, sql } = await import('drizzle-orm');

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const batch = await dbInstance.select({
        id: cards.id,
        name: cards.name,
        nameJa: cards.nameJa,
        cardNumber: cards.cardNumber,
        series: cards.series,
        language: cards.language,
        rarity: cards.rarity,
      })
      .from(cards)
      .where(
        or(
          isNull(cards.psaMatchedAt),
          lt(cards.psaMatchedAt, thirtyDaysAgo)
        )
      )
      .limit(input.limit)
      .offset(input.offset);

      // Also get total count
      const countResult = await dbInstance.select({ count: sql<number>`COUNT(*)` })
        .from(cards)
        .where(
          or(
            isNull(cards.psaMatchedAt),
            lt(cards.psaMatchedAt, thirtyDaysAgo)
          )
        );

      const total = Number(countResult[0]?.count ?? 0);

      return { cards: batch, total, offset: input.offset, limit: input.limit };
    }),
});
