import { getDb } from "../db";
import { scraperPerformanceLogs } from "../../drizzle/schema_new";

/**
 * Performance tracker for scraper operations
 * Records performance metrics for monitoring and analysis
 */

export interface PerformanceMetrics {
  source: "snkrdunk" | "ebay";
  cardId?: number;
  operationType: "single" | "batch";
  status: "success" | "error" | "timeout";
  responseTime: number; // in milliseconds
  itemsProcessed?: number;
  errorMessage?: string;
}

/**
 * Log a scraper performance metric
 */
export async function logPerformance(metrics: PerformanceMetrics) {
  const db = await getDb();
  
  if (!db) {
    console.error("[PerformanceTracker] Database not available");
    return;
  }
  
  try {
    await db.insert(scraperPerformanceLogs).values({
      source: metrics.source,
      cardId: metrics.cardId,
      operationType: metrics.operationType,
      status: metrics.status,
      responseTime: metrics.responseTime,
      itemsProcessed: metrics.itemsProcessed || 0,
      errorMessage: metrics.errorMessage,
    });
  } catch (error) {
    console.error("[PerformanceTracker] Failed to log performance:", error);
  }
}

/**
 * Wrap a scraper function with performance tracking
 */
export async function trackPerformance<T>(
  source: "snkrdunk" | "ebay",
  operationType: "single" | "batch",
  cardId: number | undefined,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  let status: "success" | "error" | "timeout" = "success";
  let errorMessage: string | undefined;
  let itemsProcessed = 0;

  try {
    const result = await fn();
    
    // Try to extract items processed from result
    if (result && typeof result === "object") {
      if ("length" in result && Array.isArray(result)) {
        itemsProcessed = result.length;
      } else if ("itemsProcessed" in result && typeof result.itemsProcessed === "number") {
        itemsProcessed = result.itemsProcessed;
      }
    }
    
    return result;
  } catch (error: any) {
    status = error.message?.includes("timeout") ? "timeout" : "error";
    errorMessage = error.message || String(error);
    throw error;
  } finally {
    const responseTime = Date.now() - startTime;
    
    await logPerformance({
      source,
      cardId,
      operationType,
      status,
      responseTime,
      itemsProcessed,
      errorMessage,
    });
  }
}
