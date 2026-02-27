import cron from "node-cron";
import { getDb } from "./db";
import * as db from "./db";
import { dataSources, scheduledTasks, priceHistory } from "../drizzle/schema_new";
import { eq, and, lt, or, isNull } from "drizzle-orm";
import { scrapeSnkrdunkPage, updatePriceHistoryOnly, convertJpyToHkd, extractSnkrdunkId } from "./snkrdunkScraper";
import { scrapeSnkrdunkPages } from "./snkrdunkAutoCrawler";
import { calculateAndCacheTrendingRankings } from "./trendingCacheManager";

/**
 * Auto-update scheduler for SNKRDUNK data sources
 * Runs every 12 hours to fetch latest price data
 */

const UPDATE_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
let schedulerInterval: NodeJS.Timeout | null = null;

// Scheduler control flag - set to false to pause automatic updates
// Note: This scheduler uses Axios + API calls (snkrdunkScraper.ts), NOT Firecrawl
let SCHEDULER_ENABLED = true; // Enabled - uses direct API calls

/**
 * Global crawl progress tracker
 */
interface CrawlProgress {
  isRunning: boolean;
  currentPage: number;
  totalPages: number;
  processedUrls: number;
  totalUrls: number;
  successCount: number;
  failedCount: number;
  startTime: number;
}

let crawlProgress: CrawlProgress = {
  isRunning: false,
  currentPage: 0,
  totalPages: 0,
  processedUrls: 0,
  totalUrls: 0,
  successCount: 0,
  failedCount: 0,
  startTime: 0,
};

// Track failed URLs for retry
let failedUrls: Array<{ url: string; error: string; retries: number }> = [];

/**
 * Get current crawl progress
 */
export function getCrawlProgress(): CrawlProgress {
  return { ...crawlProgress };
}

/**
 * Start the auto-update scheduler
 */
export function startScheduler() {
  if (schedulerInterval) {
    console.log("[Scheduler] Scheduler already running");
    return;
  }

  console.log("[Scheduler] Starting auto-update scheduler (12-hour interval)");

  // Run immediately on startup
  runAutoUpdate().catch((err) => {
    console.error("[Scheduler] Initial update failed:", err);
  });

  // Then run every 12 hours
  schedulerInterval = setInterval(() => {
    runAutoUpdate().catch((err) => {
      console.error("[Scheduler] Scheduled update failed:", err);
    });
  }, UPDATE_INTERVAL);

  // Start daily auto-crawl task
  startDailyAutoCrawl();
  
  // Start daily trending rankings cache refresh task
  startDailyTrendingCacheRefresh();
}

/**
 * Stop the auto-update scheduler
 */
export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Scheduler] Scheduler stopped");
  }
}

/**
 * Run auto-update for all active SNKRDUNK data sources
 */
async function runAutoUpdate() {
  // Check if scheduler is enabled
  if (!SCHEDULER_ENABLED) {
    console.log("[Scheduler] Automatic updates are currently paused");
    return;
  }
  
  const db = await getDb();
  if (!db) {
    console.warn("[Scheduler] Database not available");
    return;
  }

  try {
    console.log("[Scheduler] Starting auto-update cycle...");

    // Get all active SNKRDUNK data sources that need updating
    const sourcesToUpdate = await db
      .select()
      .from(dataSources)
      .where(
        and(
          eq(dataSources.source, "snkrdunk"),
          eq(dataSources.isActive, 1),
          // Update if nextUpdateAt is in the past or null
          or(
            isNull(dataSources.nextUpdateAt),
            lt(dataSources.nextUpdateAt, new Date())
          )
        )
      );

    console.log(
      `[Scheduler] Found ${sourcesToUpdate.length} data sources to update`
    );

    for (const source of sourcesToUpdate) {
      await updateDataSource(db, source);
    }

    console.log("[Scheduler] Auto-update cycle completed");
  } catch (error) {
    console.error("[Scheduler] Auto-update cycle failed:", error);
  }
}

/**
 * Update a single data source
 */
async function updateDataSource(db: any, source: any) {
  const taskId = `${source.id}-${Date.now()}`;

  try {
    // Create scheduled task record (skip if db doesn't support insert return)
    try {
      await db.insert(scheduledTasks).values({
        taskType: "snkrdunk_update",
        status: "running",
        targetId: source.id,
        startedAt: new Date(),
        metadata: JSON.stringify({
          sourceUrl: source.sourceUrl,
          cardId: source.cardId,
        }),
      });
    } catch (e) {
      console.warn("[Scheduler] Could not create task record:", e);
    }

    console.log(
      `[Scheduler] Updating price data for source ${source.id} from ${source.sourceUrl}`
    );

    // Only update price history (not card data)
    const priceData = await updatePriceHistoryOnly(source.sourceUrl);

    // Insert price history records
    if (priceData && priceData.length > 0) {
      const priceRecords = priceData.map((price) => ({
        cardId: source.cardId,
        source: "snkrdunk",
        price: convertJpyToHkd(price.price).toString(),
        currency: "HKD",
        soldAt: price.soldAt,
        grade: price.grade || null,
      }));

      // Insert in batches to avoid query too large
      for (let i = 0; i < priceRecords.length; i += 50) {
        const batch = priceRecords.slice(i, i + 50);
        await db.insert(priceHistory).values(batch);
      }
      console.log(
        `[Scheduler] Inserted ${priceRecords.length} price history records`
      );
    }

    // Update the data source with new timestamps
    const nextUpdate = new Date();
    nextUpdate.setHours(nextUpdate.getHours() + 12);

    await db
      .update(dataSources)
      .set({
        lastFetchedAt: new Date(),
        lastUpdatedAt: new Date(),
        nextUpdateAt: nextUpdate,
        lastFetchStatus: "success",
        fetchErrorMessage: null,
        updateCount: (source.updateCount || 0) + 1,
      })
      .where(eq(dataSources.id, source.id));

    console.log(
      `[Scheduler] Successfully updated data source ${source.id}`
    );

    // Update scheduled task as completed (skip if db doesn't support)
    try {
      const taskRecord = await db
        .select()
        .from(scheduledTasks)
        .where(eq(scheduledTasks.taskType, "snkrdunk_update"))
        .limit(1);
      if (taskRecord.length > 0) {
        await db
          .update(scheduledTasks)
          .set({
            status: "completed",
            completedAt: new Date(),
          })
          .where(eq(scheduledTasks.id, taskRecord[0].id));
      }
    } catch (e) {
      console.warn("[Scheduler] Could not update task record:", e);
    }
  } catch (error) {
    console.error(
      `[Scheduler] Failed to update data source ${source.id}:`,
      error
    );

    const errorMessage =
      error instanceof Error ? error.message : String(error);

    // Update the data source with error status
    await db
      .update(dataSources)
      .set({
        lastFetchStatus: "failed",
        fetchErrorMessage: errorMessage,
      })
      .where(eq(dataSources.id, source.id));

    // Update scheduled task as failed (skip if db doesn't support)
    try {
      const taskRecord = await db
        .select()
        .from(scheduledTasks)
        .where(eq(scheduledTasks.taskType, "snkrdunk_update"))
        .limit(1);
      if (taskRecord.length > 0) {
        await db
          .update(scheduledTasks)
          .set({
            status: "failed",
            completedAt: new Date(),
            errorMessage: errorMessage,
          })
          .where(eq(scheduledTasks.id, taskRecord[0].id));
      }
    } catch (e) {
      console.warn("[Scheduler] Could not update failed task record:", e);
    }
  }
}

/**
 * Manually trigger update for a specific data source
 */
export async function manualUpdateDataSource(dataSourceId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const source = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.id, dataSourceId))
    .limit(1);

  if (!source.length) {
    throw new Error("Data source not found");
  }

  await updateDataSource(db, source[0]);
}

/**
 * Get scheduler status and statistics
 */
export async function getSchedulerStatus() {
  const db = await getDb();
  if (!db) {
    return null;
  }

  try {
    // Get all active data sources
    const allSources = await db
      .select()
      .from(dataSources)
      .where(and(eq(dataSources.source, "snkrdunk"), eq(dataSources.isActive, 1)));

    // Calculate next update time (earliest nextUpdateAt)
    const nextUpdate = allSources
      .map((s) => s.nextUpdateAt)
      .filter((t): t is Date => t !== null)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    // Get statistics for last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    const recentUpdates = allSources.filter(
      (s) => s.lastFetchedAt && s.lastFetchedAt >= oneDayAgo
    );

    const successCount = recentUpdates.filter(
      (s) => s.lastFetchStatus === "success"
    ).length;
    const failedCount = recentUpdates.filter(
      (s) => s.lastFetchStatus === "failed"
    ).length;

    // Get failed sources for retry queue
    const failedSources = allSources
      .filter((s) => s.lastFetchStatus === "failed")
      .map((s) => ({
        id: s.id,
        sourceUrl: s.sourceUrl,
        errorMessage: s.fetchErrorMessage,
        lastAttempt: s.lastFetchedAt,
      }))
      .slice(0, 10); // Limit to 10 most recent failures

    return {
      nextUpdateAt: nextUpdate || null,
      totalActiveSources: allSources.length,
      last24Hours: {
        totalUpdates: recentUpdates.length,
        successCount,
        failedCount,
      },
      failedSources,
      isRunning: crawlProgress.isRunning,
      currentProgress: crawlProgress.isRunning
        ? {
            processedUrls: crawlProgress.processedUrls,
            totalUrls: crawlProgress.totalUrls,
            successCount: crawlProgress.successCount,
            failedCount: crawlProgress.failedCount,
          }
        : null,
    };
  } catch (error) {
    console.error("[Scheduler] Failed to get scheduler status:", error);
    return null;
  }
}

/**
 * Manually trigger update for all active data sources
 * This bypasses the SCHEDULER_ENABLED check to allow manual updates
 */
export async function triggerManualUpdateAll() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  console.log("[Scheduler] Manual update triggered for all data sources");
  
  try {
    // Get all active SNKRDUNK data sources (no time filter for manual update)
    const sourcesToUpdate = await db
      .select()
      .from(dataSources)
      .where(
        and(
          eq(dataSources.source, "snkrdunk"),
          eq(dataSources.isActive, 1)
        )
      );

    console.log(
      `[Scheduler] Found ${sourcesToUpdate.length} data sources to update`
    );

    for (const source of sourcesToUpdate) {
      await updateDataSource(db, source);
    }

    console.log("[Scheduler] Manual update cycle completed");
  } catch (error) {
    console.error("[Scheduler] Manual update cycle failed:", error);
    throw error;
  }
}

/**
 * Get update status for a data source
 */
export async function getUpdateStatus(dataSourceId: number) {
  const db = await getDb();
  if (!db) {
    return null;
  }

  const source = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.id, dataSourceId))
    .limit(1);

  if (!source.length) {
    return null;
  }

  const s = source[0];
  return {
    id: s.id,
    source: s.source,
    sourceUrl: s.sourceUrl,
    lastUpdatedAt: s.lastUpdatedAt,
    nextUpdateAt: s.nextUpdateAt,
    lastFetchStatus: s.lastFetchStatus,
    fetchErrorMessage: s.fetchErrorMessage,
    updateCount: s.updateCount,
  };
}

/**
 * Start daily auto-crawl task for SNKRDUNK
 * Runs at 01:00 AM Hong Kong time every day
 */
function startDailyAutoCrawl() {
  console.log("[Scheduler] Registering daily SNKRDUNK auto-crawl task (01:00 AM HKT)");

  // Schedule: Every day at 01:00 AM Hong Kong time
  cron.schedule("0 1 * * *", async () => {
    console.log("[AutoCrawl] Starting daily SNKRDUNK auto-crawl at", new Date().toISOString());
    
    try {
      await autoCrawlSnkrdunk();
      console.log("[AutoCrawl] Daily SNKRDUNK auto-crawl completed successfully");
    } catch (error) {
      console.error("[AutoCrawl] Daily SNKRDUNK auto-crawl failed:", error);
    }
  }, {
    timezone: "Asia/Hong_Kong"
  });

  console.log("[Scheduler] Daily auto-crawl task registered");
}

/**
 * Start daily trending rankings cache refresh task
 * Runs at 07:00 AM Hong Kong time every day
 */
function startDailyTrendingCacheRefresh() {
  console.log("[Scheduler] Registering daily trending rankings cache refresh task (07:00 AM HKT)");

  // Schedule: Every day at 07:00 AM Hong Kong time
  cron.schedule("0 7 * * *", async () => {
    console.log("[TrendingCache] Starting daily trending rankings cache refresh at", new Date().toISOString());
    
    try {
      const result = await calculateAndCacheTrendingRankings();
      console.log("[TrendingCache] Daily cache refresh completed:", result);
    } catch (error) {
      console.error("[TrendingCache] Daily cache refresh failed:", error);
    }
  }, {
    timezone: "Asia/Hong_Kong"
  });

  console.log("[Scheduler] Daily trending cache refresh task registered");
}

/**
 * Auto-crawl all SNKRDUNK cards
 * Can be triggered by scheduled task or manual trigger
 */
export async function autoCrawlSnkrdunk(startPage: number = 1, endPage: number = 1575) {
  console.log(`[AutoCrawl] Starting SNKRDUNK auto-crawl from page ${startPage} to ${endPage}...`);
  
  // Initialize progress tracker
  crawlProgress = {
    isRunning: true,
    currentPage: 0,
    totalPages: endPage - startPage + 1,
    processedUrls: 0,
    totalUrls: 0,
    successCount: 0,
    failedCount: 0,
    startTime: Date.now(),
  };
  
  const startTime = Date.now();
  let totalFound = 0;
  let newUrls = 0;
  let duplicates = 0;
  let successCount = 0;
  let failedCount = 0;
  failedUrls = []; // Reset failed URLs list

  try {
    // Fetch all card URLs from SNKRDUNK
    console.log("[AutoCrawl] Fetching card URLs from SNKRDUNK...");
    crawlProgress.currentPage = startPage;
    const urls = await scrapeSnkrdunkPages(startPage, endPage);
    totalFound = urls.length;
    crawlProgress.totalUrls = totalFound;
    console.log(`[AutoCrawl] Found ${totalFound} card URLs`);

    // Deduplicate against existing data sources
    console.log("[AutoCrawl] Checking for duplicates...");
    const { data: existingSources } = await db.getDataSources({ pageSize: 10000 });
    const existingUrls = new Set(existingSources.map((s: any) => s.sourceUrl));
    const uniqueUrls = urls.filter(url => !existingUrls.has(url));
    newUrls = uniqueUrls.length;
    duplicates = totalFound - newUrls;
    console.log(`[AutoCrawl] ${newUrls} new URLs, ${duplicates} duplicates filtered`);

    // Process new URLs in batches
    console.log("[AutoCrawl] Processing new URLs...");
    for (let i = 0; i < uniqueUrls.length; i++) {
      const url = uniqueUrls[i];
      
      // Update progress
      crawlProgress.processedUrls = i + 1;
      
      // Log progress every 100 URLs
      if ((i + 1) % 100 === 0) {
        console.log(`[AutoCrawl] Progress: ${i + 1}/${uniqueUrls.length} URLs processed`);
      }

      let success = false;
      let lastError: any = null;
      
      // Retry up to 3 times
      for (let retryCount = 0; retryCount < 3; retryCount++) {
        try {
          const snkrdunkId = extractSnkrdunkId(url);
          if (!snkrdunkId) {
            console.warn(`[AutoCrawl] Invalid URL format: ${url}`);
            lastError = new Error('Invalid URL format');
            break; // Don't retry invalid URLs
          }

          // Scrape card data
          const cardData = await scrapeSnkrdunkPage(url);
        
        // Check if card already exists
        const existingCard = await db.getCardByCardId(`snkrdunk-${snkrdunkId}`);
        let cardId: number;

        if (existingCard) {
          // Update existing card
          cardId = existingCard.id;
          await db.updateCard(cardId, {
            name: cardData.name,
            nameJa: cardData.nameJa,
            imageUrl: cardData.imageUrl || undefined,
          });
        } else {
          // Create new card
          // Extract card number from name (e.g., "Pikachu[SM-P 288]" → "SM-P 288")
          const cardNumberMatch = cardData.name.match(/\[([^\]]+)\]/);
          const cardNumber = cardNumberMatch ? cardNumberMatch[1].trim() : undefined;
          
          cardId = await db.createCard({
            cardId: `snkrdunk-${snkrdunkId}`,
            name: cardData.name,
            nameJa: cardData.nameJa,
            imageUrl: cardData.imageUrl,
            cardNumber,
          });
        }

        // Add data source
        await db.addDataSource({
          cardId,
          gameId: 1, // Default to Pokémon (gameId=1)
          productType: "single_card", // Default to single_card
          source: "snkrdunk",
          sourceUrl: url,
        });

        // Add price history
        for (const priceEntry of cardData.priceHistory) {
          const priceHkd = convertJpyToHkd(priceEntry.price);
          await db.addPriceHistory({
            cardId,
            source: "snkrdunk",
            price: priceHkd.toString(),
            currency: "HKD",
            grade: priceEntry.grade,
            soldAt: priceEntry.soldAt,
            listingUrl: url,
          });
        }

          successCount++;
          crawlProgress.successCount = successCount;
          success = true;
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error;
          if (retryCount < 2) {
            console.warn(`[AutoCrawl] Retry ${retryCount + 1}/3 for ${url}:`, error);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
          } else {
            console.error(`[AutoCrawl] Failed after 3 retries for ${url}:`, error);
          }
        }
      }
      
      // Record final failure
      if (!success) {
        failedCount++;
        crawlProgress.failedCount = failedCount;
        failedUrls.push({
          url,
          error: lastError instanceof Error ? lastError.message : String(lastError),
          retries: 3,
        });
      }

      // Add delay to avoid overwhelming the server (500ms per URL)
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);

    console.log(`[AutoCrawl] Completed in ${duration} minutes`);
    console.log(`[AutoCrawl] Results: ${successCount} success, ${failedCount} failed, ${duplicates} duplicates`);
    
    if (failedUrls.length > 0) {
      console.log(`[AutoCrawl] Failed URLs (${failedUrls.length}):`);
      failedUrls.forEach(({ url, error }) => {
        console.log(`  - ${url}: ${error}`);
      });
    }

    // Mark as completed
    crawlProgress.isRunning = false;

    return {
      success: true,
      totalFound,
      newUrls,
      duplicates,
      successCount,
      failedCount,
      duration: `${duration} minutes`,
      failedUrls: failedUrls.map(f => ({ url: f.url, error: f.error })),
    };
  } catch (error) {
    console.error("[AutoCrawl] Fatal error:", error);
    // Mark as failed
    crawlProgress.isRunning = false;
    throw error;
  }
}
